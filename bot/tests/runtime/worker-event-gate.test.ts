import { describe, expect, it } from "vitest";
import { InMemoryJournalWriter } from "../../src/journal-writer/writer.js";
import {
  appendWorkerEventGateJournal,
  buildWorkerEventGateJournalEntries,
  reconstructWorkerEventGateReplay,
} from "../../src/runtime/worker-event-gate/journal.js";
import {
  WORKER_GATE_STAGE_ORDER,
  createWorkerEventGateEvaluationState,
  evaluateWorkerEventGate,
} from "../../src/runtime/worker-event-gate/engine.js";
import type { WorkerEventEnvelope } from "../../src/runtime/worker-event-gate/contracts.js";
import {
  buildDecisionEnvelopeFixtureSet,
  decisionEnvelopeSemantics,
} from "../fixtures/decision-envelope.fixtures.js";

function buildLowcapEvent(): WorkerEventEnvelope {
  return {
    schemaVersion: "worker.event.gate.v1",
    eventId: "lowcap-event-1",
    traceId: "trace-lowcap-1",
    family: "lowcap",
    eventType: "lowcap.signal",
    eventVersion: "1",
    producer: "discovery",
    entityType: "token",
    entityId: "token-alpha",
    entityKey: "token-alpha:key",
    observedAt: "2026-03-17T12:00:00.000Z",
    windowStart: "2026-03-17T11:58:00.000Z",
    windowEnd: "2026-03-17T12:05:00.000Z",
    severity: "high",
    confidence: 0.93,
    knowledgeMode: "observed",
    evidenceRefs: ["market:alpha", "wallet:alpha"],
    sourceScope: "mixed",
    promotionCandidate: true,
    suppressionCandidate: false,
    featureSnapshot: {
      tokenName: "Alpha",
      ticker: "ALPHA",
      contractAddress: "alpha-contract",
      venue: "pump.fun",
      launchAgeSeconds: 900,
      marketCap: 25_000,
      volume: 50_000,
      bondingState: "bonding",
      walletQualityState: "clean",
      structureState: "early",
      liquidityState: "healthy",
      metaCluster: "cluster-a",
      attentionType: "resurgence",
      trustedSignalCount: 2,
      convergenceScore: 0.84,
      integrityScore: 0.9,
      freshnessScore: 0.92,
      noiseScore: 0.05,
      batchGroupHint: null,
    },
  };
}

function buildShadowEvent(): WorkerEventEnvelope {
  return {
    schemaVersion: "worker.event.gate.v1",
    eventId: "shadow-event-1",
    traceId: "trace-shadow-1",
    family: "shadow",
    eventType: "shadow.transition",
    eventVersion: "1",
    producer: "monitor",
    entityType: "signal",
    entityId: "shadow-beta",
    entityKey: "shadow-beta:key",
    observedAt: "2026-03-17T12:00:00.000Z",
    windowStart: "2026-03-17T11:58:00.000Z",
    windowEnd: "2026-03-17T12:05:00.000Z",
    severity: "high",
    confidence: 0.86,
    knowledgeMode: "operational",
    evidenceRefs: ["market:beta", "trend:beta"],
    sourceScope: "external",
    promotionCandidate: true,
    suppressionCandidate: false,
    featureSnapshot: {
      tokenName: "Beta",
      ticker: "BETA",
      contractAddress: "shadow-contract",
      currentState: "notable_change",
      baselineState: "watching",
      transitionType: "trend_reversal",
      structureShift: "expanding",
      flowShift: "accelerating",
      attentionShift: "resurgent",
      walletQualityState: "mixed",
      distributionState: "concentrated",
      liquidityState: "healthy",
      transitionConfidence: 0.88,
      severityScore: 0.9,
      convergenceScore: 0.74,
      integrityScore: 0.91,
      freshnessScore: 0.93,
      batchGroupHint: null,
      thesisConflict: false,
      riskSpike: false,
    },
  };
}

describe("worker-event-gate runtime", () => {
  it("runs the fixed gate sequence deterministically without mutating state", () => {
    const event = buildLowcapEvent();
    const state = createWorkerEventGateEvaluationState();
    const snapshot = structuredClone(state);

    const first = evaluateWorkerEventGate({ event, state });
    const second = evaluateWorkerEventGate({ event: { ...event }, state: createWorkerEventGateEvaluationState() });

    expect(first.stages.map((stage) => stage.stage)).toStrictEqual(WORKER_GATE_STAGE_ORDER);
    expect(second.stages.map((stage) => stage.stage)).toStrictEqual(WORKER_GATE_STAGE_ORDER);
    expect(first.stages.map((stage) => stage.disposition)).toStrictEqual(
      second.stages.map((stage) => stage.disposition)
    );
    expect(first.evaluationHash).toBe(second.evaluationHash);
    expect(first.replayKey).toBe(second.replayKey);
    expect(state).toStrictEqual(snapshot);
  });

  it("dedupe suppression is reproducible and journaled", async () => {
    const event = buildLowcapEvent();
    const seeded = evaluateWorkerEventGate({
      event,
      state: createWorkerEventGateEvaluationState(),
    });
    const duplicate = {
      ...event,
      eventId: "lowcap-event-duplicate",
    } as WorkerEventEnvelope;

    const first = evaluateWorkerEventGate({
      event: duplicate,
      state: seeded.stateAfter,
    });
    const second = evaluateWorkerEventGate({
      event: { ...duplicate },
      state: seeded.stateAfter,
    });

    expect(first.stages.map((stage) => stage.disposition)).toStrictEqual(
      second.stages.map((stage) => stage.disposition)
    );
    expect(first.stages[3].disposition).toBe("suppressed");
    expect(first.suppression?.kind).toBe("dedupe");
    expect(first.blockingStage).toBe("dedupe");

    const writer = new InMemoryJournalWriter();
    await appendWorkerEventGateJournal(writer, first);
    const entries = writer.list();

    expect(entries.some((entry) => entry.stage === "worker.suppression")).toBe(true);
    expect(entries.some((entry) => entry.stage === "worker.gate.dedupe")).toBe(true);

    const replay = reconstructWorkerEventGateReplay(entries);
    expect(replay.event?.eventId).toBe("lowcap-event-duplicate");
    expect(replay.suppression?.kind).toBe("dedupe");
    expect(replay.routing?.routeClass).toBe("no_model");
    expect(replay.writeEffect?.effect).toBe("no_write");
  });

  it("cooldown suppression is reproducible and journaled", async () => {
    const initial = evaluateWorkerEventGate({
      event: buildLowcapEvent(),
      state: createWorkerEventGateEvaluationState(),
    });
    const secondEvent = {
      ...buildLowcapEvent(),
      eventId: "lowcap-event-cooldown",
      traceId: "trace-lowcap-cooldown",
      confidence: 0.92,
      featureSnapshot: {
        ...buildLowcapEvent().featureSnapshot,
        convergenceScore: 0.82,
        integrityScore: 0.91,
      },
    } as WorkerEventEnvelope;

    const first = evaluateWorkerEventGate({
      event: secondEvent,
      state: initial.stateAfter,
    });
    const second = evaluateWorkerEventGate({
      event: { ...secondEvent },
      state: initial.stateAfter,
    });

    expect(first.stages.map((stage) => stage.disposition)).toStrictEqual(
      second.stages.map((stage) => stage.disposition)
    );
    expect(first.stages[4].disposition).toBe("suppressed");
    expect(first.suppression?.kind).toBe("cooldown");
    expect(first.blockingStage).toBe("cooldown");

    const entries = buildWorkerEventGateJournalEntries(first);
    const replay = reconstructWorkerEventGateReplay(entries);

    expect(replay.suppression?.kind).toBe("cooldown");
    expect(replay.routing?.routeClass).toBe("no_model");
    expect(replay.writeEffect?.effect).toBe("no_write");
  });

  it("batch debounce defer behavior is deterministic and journalable", async () => {
    const event = {
      ...buildLowcapEvent(),
      eventId: "lowcap-event-batch",
      traceId: "trace-lowcap-batch",
      confidence: 0.68,
      promotionCandidate: true,
      featureSnapshot: {
        ...buildLowcapEvent().featureSnapshot,
        batchGroupHint: "batch-a",
        convergenceScore: 0.61,
        integrityScore: 0.86,
        freshnessScore: 0.9,
      },
    } as WorkerEventEnvelope;

    const evaluation = evaluateWorkerEventGate({
      event,
      state: createWorkerEventGateEvaluationState(),
    });

    expect(evaluation.stages[5].disposition).toBe("deferred");
    expect(evaluation.blocked).toBe(true);
    expect(evaluation.terminalStage).toBe("batch_debounce");
    expect(evaluation.writeEffect.effect).toBe("no_write");
    expect(evaluation.stateAfter.batchRecords).toHaveLength(1);
    expect(evaluation.stateAfter.batchRecords[0].status).toBe("pending");

    const writer = new InMemoryJournalWriter();
    await appendWorkerEventGateJournal(writer, evaluation);
    const replay = reconstructWorkerEventGateReplay(writer.list());

    expect(replay.blocked).toBe(true);
    expect(replay.suppression?.kind).toBe("defer");
    expect(replay.writeEffect?.effect).toBe("no_write");
  });

  it("small promotion routes to family-specific lower-authority write effects", () => {
    const lowcapSmall = {
      ...buildLowcapEvent(),
      eventId: "lowcap-small",
      traceId: "trace-lowcap-small",
      confidence: 0.82,
      featureSnapshot: {
        ...buildLowcapEvent().featureSnapshot,
        convergenceScore: 0.62,
        integrityScore: 0.82,
        freshnessScore: 0.68,
      },
    } as WorkerEventEnvelope;
    const shadowSmall = {
      ...buildShadowEvent(),
      eventId: "shadow-small",
      traceId: "trace-shadow-small",
      confidence: 0.76,
      featureSnapshot: {
        ...buildShadowEvent().featureSnapshot,
        transitionConfidence: 0.61,
        severityScore: 0.7,
      },
    } as WorkerEventEnvelope;

    const lowcapEvaluation = evaluateWorkerEventGate({
      event: lowcapSmall,
      state: createWorkerEventGateEvaluationState(),
    });
    const shadowEvaluation = evaluateWorkerEventGate({
      event: shadowSmall,
      state: createWorkerEventGateEvaluationState(),
    });

    expect(lowcapEvaluation.routing.routeClass).toBe("eligible_small_adjudication");
    expect(lowcapEvaluation.writeEffect.effect).toBe("watchlist_update");
    expect(shadowEvaluation.routing.routeClass).toBe("eligible_small_adjudication");
    expect(shadowEvaluation.writeEffect.effect).toBe("derived_refresh_trigger");
  });

  it("journal replay reconstructs the observed event, gate path, routing, and write effect", async () => {
    const event = buildShadowEvent();
    const evaluation = evaluateWorkerEventGate({
      event,
      state: createWorkerEventGateEvaluationState(),
    });

    expect(evaluation.blocked).toBe(false);
    expect(evaluation.routing.routeClass).toBe("eligible_deep_adjudication");
    expect(evaluation.writeEffect.effect).toBe("case_update");
    expect(evaluation.modelResult.called).toBe(false);
    expect(evaluation.routing.advisoryOnly).toBe(true);
    expect(evaluation.writeEffect.advisoryOnly).toBe(true);

    const writer = new InMemoryJournalWriter();
    await appendWorkerEventGateJournal(writer, evaluation);
    const replay = reconstructWorkerEventGateReplay(writer.list());

    expect(replay.event).toStrictEqual(event);
    expect(replay.gatePath.map((stage) => stage.stage)).toStrictEqual(WORKER_GATE_STAGE_ORDER);
    expect(replay.blocked).toBe(false);
    expect(replay.suppression).toBeUndefined();
    expect(replay.routing?.routeClass).toBe("eligible_deep_adjudication");
    expect(replay.modelResult?.called).toBe(false);
    expect(replay.writeEffect?.effect).toBe("case_update");
    expect(replay.terminalStage).toBe("post_model_routing");
  });

  it("leaves decisionEnvelope untouched and keeps routing/write effects advisory-only", async () => {
    const fixtureSet = await buildDecisionEnvelopeFixtureSet();
    const originalEnvelopeSemantics = decisionEnvelopeSemantics(fixtureSet.allowEnvelope);
    const event = buildLowcapEvent();

    const evaluation = evaluateWorkerEventGate({
      event,
      state: createWorkerEventGateEvaluationState(),
    });

    expect(evaluation.routing.advisoryOnly).toBe(true);
    expect(evaluation.modelResult.called).toBe(false);
    expect(evaluation.writeEffect.advisoryOnly).toBe(true);
    expect(evaluation.writeEffect.effect).toBe("review_queue_insert");
    expect(decisionEnvelopeSemantics(fixtureSet.allowEnvelope)).toStrictEqual(originalEnvelopeSemantics);
    expect((evaluation as unknown as { decisionEnvelope?: unknown }).decisionEnvelope).toBeUndefined();
  });
});
