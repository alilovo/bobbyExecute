import { describe, expect, it } from "vitest";
import { InMemoryJournalWriter } from "../../src/journal-writer/writer.js";
import {
  appendStqCadenceJournal,
  buildStqCadenceJournalEntry,
  createDefaultLowCapCadenceState,
  createDefaultShadowCadenceState,
  classifyStqConvergenceBand,
  classifyStqDayType,
  classifyStqIntegrityBand,
  classifyStqTimeWindow,
  evaluateStqCadencePolicy,
  reconstructStqCadenceReplay,
} from "../../src/runtime/stq-cadence.js";
import {
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
    eventId: "stq-lowcap-event",
    traceId: "stq-trace-lowcap",
    family: "lowcap",
    eventType: "lowcap.signal",
    eventVersion: "1",
    producer: "discovery",
    entityType: "token",
    entityId: "token-alpha",
    entityKey: "token-alpha:key",
    observedAt: "2026-03-17T03:00:00.000Z",
    windowStart: "2026-03-17T02:55:00.000Z",
    windowEnd: "2026-03-17T03:10:00.000Z",
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
    eventId: "stq-shadow-event",
    traceId: "stq-trace-shadow",
    family: "shadow",
    eventType: "shadow.transition",
    eventVersion: "1",
    producer: "monitor",
    entityType: "signal",
    entityId: "shadow-beta",
    entityKey: "shadow-beta:key",
    observedAt: "2026-03-17T15:00:00.000Z",
    windowStart: "2026-03-17T14:55:00.000Z",
    windowEnd: "2026-03-17T15:10:00.000Z",
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

describe("stq cadence runtime", () => {
  it("classifies day type and time window deterministically", () => {
    const evaluation = evaluateWorkerEventGate({
      event: buildLowcapEvent(),
      state: createWorkerEventGateEvaluationState(),
    });

    const firstDayType = classifyStqDayType({
      gateEvaluation: evaluation,
      workerState: createDefaultLowCapCadenceState(),
    });
    const secondDayType = classifyStqDayType({
      gateEvaluation: { ...evaluation },
      workerState: createDefaultLowCapCadenceState(),
    });
    const firstTimeWindow = classifyStqTimeWindow({
      gateEvaluation: evaluation,
      workerState: createDefaultLowCapCadenceState(),
    });
    const secondTimeWindow = classifyStqTimeWindow({
      gateEvaluation: { ...evaluation },
      workerState: createDefaultLowCapCadenceState(),
    });

    expect(firstDayType).toBe(secondDayType);
    expect(firstTimeWindow).toBe(secondTimeWindow);
    expect(firstDayType).toBe("d2_active_continuation_day");
    expect(firstTimeWindow).toBe("t1_ignition");
  });

  it("computes STQ score and polling interval deterministically", () => {
    const evaluation = evaluateWorkerEventGate({
      event: buildLowcapEvent(),
      state: createWorkerEventGateEvaluationState(),
    });

    const first = evaluateStqCadencePolicy({
      gateEvaluation: evaluation,
      workerState: createDefaultLowCapCadenceState(),
    });
    const second = evaluateStqCadencePolicy({
      gateEvaluation: { ...evaluation },
      workerState: createDefaultLowCapCadenceState(),
    });

    expect(first).toStrictEqual(second);
    expect(classifyStqConvergenceBand({
      gateEvaluation: evaluation,
      workerState: createDefaultLowCapCadenceState(),
    })).toBe("strong");
    expect(classifyStqIntegrityBand({
      gateEvaluation: evaluation,
      workerState: createDefaultLowCapCadenceState(),
    })).toBe("clean");
    expect(first.convergenceBand).toBe("strong");
    expect(first.integrityBand).toBe("clean");
    expect(first.stqBand).toBe("high");
    expect(first.pollingIntervalLabel).toBe("5m");
    expect(first.advisoryOnly).toBe(true);
    expect(first.noPromotionGuard.allowed).toBe(false);
  });

  it("keeps cadence advisory-only and never becomes a promotion or model route", () => {
    const evaluation = evaluateWorkerEventGate({
      event: buildShadowEvent(),
      state: createWorkerEventGateEvaluationState(),
    });

    const cadence = evaluateStqCadencePolicy({
      gateEvaluation: evaluation,
      workerState: createDefaultShadowCadenceState(),
    });

    expect(cadence.advisoryOnly).toBe(true);
    expect(cadence.canonicalDecisionTruth).toBe("decisionEnvelope");
    expect(cadence.noPromotionGuard.allowed).toBe(false);
    expect(cadence.noPromotionGuard.reason).toBe("advisory_only");
    expect((cadence as unknown as { routeClass?: string }).routeClass).toBeUndefined();
    expect((cadence as unknown as { modelResult?: unknown }).modelResult).toBeUndefined();
    expect((cadence as unknown as { decisionEnvelope?: unknown }).decisionEnvelope).toBeUndefined();
  });

  it("fails closed on malformed or missing observedAt and preserves replay-visible invalidity", () => {
    const evaluation = evaluateWorkerEventGate({
      event: buildShadowEvent(),
      state: createWorkerEventGateEvaluationState(),
    });

    const malformed = evaluateStqCadencePolicy({
      gateEvaluation: {
        ...evaluation,
        event: {
          ...evaluation.event,
          observedAt: "not-a-timestamp",
        },
      },
      workerState: createDefaultShadowCadenceState(),
    });
    const missing = evaluateStqCadencePolicy({
      gateEvaluation: {
        ...evaluation,
        event: {
          ...evaluation.event,
          observedAt: undefined as unknown as string,
        },
      },
      workerState: createDefaultShadowCadenceState(),
    });
    const validMidnight = evaluateStqCadencePolicy({
      gateEvaluation: {
        ...evaluation,
        event: {
          ...evaluation.event,
          observedAt: "2026-03-17T00:00:00.000Z",
        },
      },
      workerState: createDefaultShadowCadenceState(),
    });

    expect(malformed.timeWindow).toBe("t4_stale_review");
    expect(missing.timeWindow).toBe("t4_stale_review");
    expect(validMidnight.timeWindow).toBe("t1_ignition");
    expect(malformed.basis.observedAtStatus).toBe("malformed");
    expect(missing.basis.observedAtStatus).toBe("missing");
    expect(validMidnight.basis.observedAtStatus).toBe("valid");
    expect(malformed.basis.hourBucket).toBeNull();
    expect(missing.basis.hourBucket).toBeNull();
    expect(validMidnight.basis.hourBucket).toBe(0);
    expect(malformed.advisoryOnly).toBe(true);
    expect(malformed.canonicalDecisionTruth).toBe("decisionEnvelope");
    expect((malformed as unknown as { decisionEnvelope?: unknown }).decisionEnvelope).toBeUndefined();
  });

  it("composes safely with cooldown suppression and respects the gate floor", () => {
    const seeded = evaluateWorkerEventGate({
      event: buildLowcapEvent(),
      state: createWorkerEventGateEvaluationState(),
    });
    const blocked = evaluateWorkerEventGate({
      event: {
        ...buildLowcapEvent(),
        eventId: "stq-lowcap-duplicate",
        traceId: "stq-trace-lowcap-duplicate",
      },
      state: seeded.stateAfter,
    });

    expect(blocked.blocked).toBe(true);
    expect(blocked.suppression?.kind).toBe("dedupe");

    const cadence = evaluateStqCadencePolicy({
      gateEvaluation: blocked,
      workerState: createDefaultLowCapCadenceState(),
    });

    expect(cadence.cooldownComposition.gateBlocked).toBe(true);
    expect(cadence.cooldownComposition.respectedGateCooldown).toBe(true);
    expect(cadence.cooldownComposition.effectiveIntervalMs).toBeGreaterThanOrEqual(
      cadence.cooldownComposition.cooldownFloorMs ?? 0
    );
    expect(cadence.noPromotionGuard.reason).toBe("gate_suppressed");
  });

  it("journals and replays cadence decisions without introducing a second truth surface", async () => {
    const fixtures = await buildDecisionEnvelopeFixtureSet();
    const before = decisionEnvelopeSemantics(fixtures.allowEnvelope);
    const evaluation = evaluateWorkerEventGate({
      event: buildShadowEvent(),
      state: createWorkerEventGateEvaluationState(),
    });
    const cadence = evaluateStqCadencePolicy({
      gateEvaluation: evaluation,
      workerState: createDefaultShadowCadenceState(),
    });

    const writer = new InMemoryJournalWriter();
    await appendStqCadenceJournal(writer, cadence);
    const replay = reconstructStqCadenceReplay(writer.list());

    expect(replay.traceId).toBe(cadence.traceId);
    expect(replay.eventId).toBe(cadence.eventId);
    expect(replay.workerKind).toBe(cadence.workerKind);
    expect(replay.result).toStrictEqual(cadence);
    expect(buildStqCadenceJournalEntry(cadence).stage).toBe("worker.cadence.policy");
    expect(decisionEnvelopeSemantics(fixtures.allowEnvelope)).toStrictEqual(before);
    expect((cadence as unknown as { decisionEnvelope?: unknown }).decisionEnvelope).toBeUndefined();
  });
});
