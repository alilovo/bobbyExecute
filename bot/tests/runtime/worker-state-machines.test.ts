import { describe, expect, it } from "vitest";
import { InMemoryJournalWriter } from "../../src/journal-writer/writer.js";
import {
  appendWorkerStateTransitionJournal,
  buildWorkerStateTransitionJournalEntry,
  createLowCapHunterState,
  createShadowIntelligenceState,
  LowCapHunterStateSchema,
  SHADOW_INTELLIGENCE_STATE_ORDER,
  ShadowIntelligenceStateSchema,
  WorkerStateMachineKindSchema,
  WorkerStateTransitionOutcomeKindSchema,
  WorkerStateTransitionReasonClassSchema,
  lowCapHunterStateOrder,
  shadowIntelligenceStateOrder,
  reconstructLowCapHunterTransitionReplay,
  reconstructShadowIntelligenceTransitionReplay,
  transitionLowCapHunterState,
  transitionShadowIntelligenceState,
} from "../../src/runtime/worker-state-machines.js";
import type { WorkerEventEnvelope } from "../../src/runtime/worker-event-gate/contracts.js";
import {
  createWorkerEventGateEvaluationState,
  evaluateWorkerEventGate,
  type WorkerEventGateEvaluationResult,
} from "../../src/runtime/worker-event-gate/engine.js";
import {
  buildDecisionEnvelopeFixtureSet,
  decisionEnvelopeSemantics,
} from "../fixtures/decision-envelope.fixtures.js";

function buildLowcapEvent(overrides: Record<string, unknown> = {}): WorkerEventEnvelope {
  const base = {
    schemaVersion: "worker.event.gate.v1",
    eventId: "lowcap-event",
    traceId: "trace-lowcap",
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
    severity: "medium",
    confidence: 0.72,
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
      convergenceScore: 0.62,
      integrityScore: 0.82,
      freshnessScore: 0.68,
      noiseScore: 0.05,
      batchGroupHint: null,
    },
  };

  return {
    ...base,
    ...overrides,
    featureSnapshot: {
      ...base.featureSnapshot,
      ...((overrides.featureSnapshot as Record<string, unknown> | undefined) ?? {}),
    },
  } as WorkerEventEnvelope;
}

function buildShadowEvent(overrides: Record<string, unknown> = {}): WorkerEventEnvelope {
  const base = {
    schemaVersion: "worker.event.gate.v1",
    eventId: "shadow-event",
    traceId: "trace-shadow",
    family: "shadow",
    eventType: "shadow.transition",
    eventVersion: "1",
    producer: "monitor",
    entityType: "signal",
    entityId: "shadow-alpha",
    entityKey: "shadow-alpha:key",
    observedAt: "2026-03-17T12:00:00.000Z",
    windowStart: "2026-03-17T11:58:00.000Z",
    windowEnd: "2026-03-17T12:05:00.000Z",
    severity: "low",
    confidence: 0.55,
    knowledgeMode: "operational",
    evidenceRefs: ["market:shadow-alpha"],
    sourceScope: "external",
    promotionCandidate: false,
    suppressionCandidate: false,
    featureSnapshot: {
      tokenName: "Shadow Alpha",
      ticker: "SHA",
      contractAddress: "shadow-alpha-contract",
      currentState: "stable",
      baselineState: "watching",
      transitionType: "attention_resurgence",
      structureShift: "steady",
      flowShift: "steady",
      attentionShift: "steady",
      walletQualityState: "clean",
      distributionState: "healthy",
      liquidityState: "healthy",
      transitionConfidence: 0.3,
      severityScore: 0.4,
      convergenceScore: 0.38,
      integrityScore: 0.82,
      freshnessScore: 0.8,
      batchGroupHint: null,
      thesisConflict: false,
      riskSpike: false,
    },
  };

  return {
    ...base,
    ...overrides,
    featureSnapshot: {
      ...base.featureSnapshot,
      ...((overrides.featureSnapshot as Record<string, unknown> | undefined) ?? {}),
    },
  } as WorkerEventEnvelope;
}

function synthesizeNoTransitionEvaluation(
  evaluation: WorkerEventGateEvaluationResult
): WorkerEventGateEvaluationResult {
  return {
    ...evaluation,
    blocked: false,
    blockingStage: undefined,
    suppression: undefined,
    routing: {
      ...evaluation.routing,
      routeClass: "no_model",
      reasonClass: "MODEL_NO_PROMOTION",
      details: {
        advisoryOnly: true,
        routeClass: "no_model",
      },
    },
    modelResult: {
      ...evaluation.modelResult,
      routeClass: "no_model",
      reasonClass: "MODEL_NO_PROMOTION",
      called: false,
      details: {
        advisoryOnly: true,
        routeClass: "no_model",
        called: false,
        modelName: "none",
      },
    },
    writeEffect: {
      ...evaluation.writeEffect,
      effect: "no_write",
      reasonClass: "WRITE_NO_WRITE",
      target: "none",
      details: {
        advisoryOnly: true,
        effect: "no_write",
      },
    },
  };
}

describe("worker state machines", () => {
  it("are deterministic and preserve input state immutability", () => {
    const lowcapEvaluation = evaluateWorkerEventGate({
      event: buildLowcapEvent(),
      state: createWorkerEventGateEvaluationState(),
    });
    const shadowEvaluation = evaluateWorkerEventGate({
      event: buildShadowEvent(),
      state: createWorkerEventGateEvaluationState(),
    });

    const lowcapState = createLowCapHunterState();
    const shadowState = createShadowIntelligenceState();
    const lowcapSnapshot = structuredClone(lowcapState);
    const shadowSnapshot = structuredClone(shadowState);

    const lowcapFirst = transitionLowCapHunterState({
      currentState: lowcapState,
      evaluation: lowcapEvaluation,
    });
    const lowcapSecond = transitionLowCapHunterState({
      currentState: structuredClone(lowcapState),
      evaluation: { ...lowcapEvaluation },
    });
    const shadowFirst = transitionShadowIntelligenceState({
      currentState: shadowState,
      evaluation: shadowEvaluation,
    });
    const shadowSecond = transitionShadowIntelligenceState({
      currentState: structuredClone(shadowState),
      evaluation: { ...shadowEvaluation },
    });

    expect(lowcapSecond).toStrictEqual(lowcapFirst);
    expect(shadowSecond).toStrictEqual(shadowFirst);
    expect(lowcapState).toStrictEqual(lowcapSnapshot);
    expect(shadowState).toStrictEqual(shadowSnapshot);
  });

  it("blocks suppression and rejects integrity-blocked lowcap inputs", async () => {
    const firstEvaluation = evaluateWorkerEventGate({
      event: buildLowcapEvent(),
      state: createWorkerEventGateEvaluationState(),
    });
    const duplicateEvent = buildLowcapEvent({
      eventId: "lowcap-duplicate",
      traceId: "trace-lowcap-duplicate",
    });
    const blockedEvaluation = evaluateWorkerEventGate({
      event: duplicateEvent,
      state: firstEvaluation.stateAfter,
    });
    const blockedTransition = transitionLowCapHunterState({
      currentState: createLowCapHunterState("screened"),
      evaluation: blockedEvaluation,
    });
    const rejectedTransition = transitionLowCapHunterState({
      currentState: createLowCapHunterState("screened"),
      evaluation: evaluateWorkerEventGate({
        event: buildLowcapEvent({
          eventId: "lowcap-integrity-blocked",
          traceId: "trace-lowcap-integrity-blocked",
          confidence: 0.8,
          featureSnapshot: {
            walletQualityState: "toxic",
            liquidityState: "trap_risk",
            integrityScore: 0.1,
            freshnessScore: 0.05,
            convergenceScore: 0.12,
          },
        }),
        state: createWorkerEventGateEvaluationState(),
      }),
    });

    expect(blockedTransition.kind).toBe("transition_blocked");
    expect(blockedTransition.stateAfter).toStrictEqual(blockedTransition.stateBefore);
    expect(rejectedTransition.kind).toBe("transition_applied");
    expect(rejectedTransition.stateAfter.status).toBe("rejected");

    const writer = new InMemoryJournalWriter();
    await appendWorkerStateTransitionJournal(writer, blockedTransition);
    const replay = reconstructLowCapHunterTransitionReplay(writer.list());

    expect(replay.blocked).toBe(true);
    expect(replay.invalid).toBe(false);
    expect(replay.stateBefore?.status).toBe("screened");
    expect(replay.stateAfter?.status).toBe("screened");
    expect(replay.history[0].kind).toBe("transition_blocked");
  });

  it("rejects illegal advances from terminal states and fails closed", () => {
    const lowcapDeepEvaluation = evaluateWorkerEventGate({
      event: buildLowcapEvent({
        eventId: "lowcap-deep",
        traceId: "trace-lowcap-deep",
        confidence: 0.94,
        severity: "high",
        observedAt: "2026-03-17T12:06:00.000Z",
        windowStart: "2026-03-17T12:04:00.000Z",
        windowEnd: "2026-03-17T12:09:00.000Z",
        featureSnapshot: {
          convergenceScore: 0.84,
          integrityScore: 0.91,
          freshnessScore: 0.92,
        },
      }),
      state: createWorkerEventGateEvaluationState(),
    });
    const shadowDeepEvaluation = evaluateWorkerEventGate({
      event: buildShadowEvent({
        eventId: "shadow-deep",
        traceId: "trace-shadow-deep",
        confidence: 0.86,
        severity: "high",
        observedAt: "2026-03-17T12:12:00.000Z",
        windowStart: "2026-03-17T12:10:00.000Z",
        windowEnd: "2026-03-17T12:15:00.000Z",
        featureSnapshot: {
          currentState: "transition_detected",
          transitionType: "second_leg_reacceleration",
          transitionConfidence: 0.88,
          severityScore: 0.9,
          convergenceScore: 0.74,
          integrityScore: 0.91,
          freshnessScore: 0.93,
          riskSpike: false,
          thesisConflict: false,
        },
      }),
      state: createWorkerEventGateEvaluationState(),
    });

    const lowcapTerminal = transitionLowCapHunterState({
      currentState: createLowCapHunterState("watchlisted"),
      evaluation: lowcapDeepEvaluation,
    });
    const shadowTerminal = transitionShadowIntelligenceState({
      currentState: createShadowIntelligenceState("alert"),
      evaluation: shadowDeepEvaluation,
    });

    expect(lowcapTerminal.kind).toBe("invalid_transition");
    expect(lowcapTerminal.stateAfter).toStrictEqual(lowcapTerminal.stateBefore);
    expect(shadowTerminal.kind).toBe("invalid_transition");
    expect(shadowTerminal.stateAfter).toStrictEqual(shadowTerminal.stateBefore);
  });

  it("reconstructs lowcap replay with no-transition and applied progression", async () => {
    const baseState = createLowCapHunterState("screened");
    const noTransitionEvaluation = synthesizeNoTransitionEvaluation(
      evaluateWorkerEventGate({
      event: buildLowcapEvent({
        eventId: "lowcap-replay-no-transition",
        traceId: "trace-lowcap-replay",
        confidence: 0.2,
        promotionCandidate: false,
        featureSnapshot: {
          convergenceScore: 0.14,
          integrityScore: 0.61,
          freshnessScore: 0.52,
          noiseScore: 0.18,
          trustedSignalCount: 0,
          walletQualityState: "mixed",
          bondingState: "pre_bonding",
          structureState: "base_forming",
          liquidityState: "healthy",
        },
      }),
      state: createWorkerEventGateEvaluationState(),
      })
    );
    const appliedEvaluation = evaluateWorkerEventGate({
      event: buildLowcapEvent({
        eventId: "lowcap-replay-applied",
        traceId: "trace-lowcap-replay",
        observedAt: "2026-03-17T12:06:00.000Z",
        windowStart: "2026-03-17T12:04:00.000Z",
        windowEnd: "2026-03-17T12:09:00.000Z",
        confidence: 0.95,
        promotionCandidate: true,
        featureSnapshot: {
          convergenceScore: 0.78,
          integrityScore: 0.87,
          freshnessScore: 0.76,
          trustedSignalCount: 2,
          noiseScore: 0.08,
        },
      }),
      state: createWorkerEventGateEvaluationState(),
    });

    const noTransition = transitionLowCapHunterState({
      currentState: baseState,
      evaluation: noTransitionEvaluation,
    });
    const applied = transitionLowCapHunterState({
      currentState: noTransition.stateAfter,
      evaluation: appliedEvaluation,
    });

    const writer = new InMemoryJournalWriter();
    await appendWorkerStateTransitionJournal(writer, noTransition);
    await appendWorkerStateTransitionJournal(writer, applied);

    const replay = reconstructLowCapHunterTransitionReplay(writer.list());

    expect(replay.workerKind).toBe("lowcap_hunter");
    expect(replay.stateBefore).toStrictEqual(baseState);
    expect(replay.stateAfter).toStrictEqual(applied.stateAfter);
    expect(replay.blocked).toBe(false);
    expect(replay.invalid).toBe(false);
    expect(replay.noTransition).toBe(true);
    expect(replay.history).toHaveLength(2);
    expect(replay.history[0].kind).toBe("no_transition");
    expect(replay.history[1].kind).toBe("transition_applied");
    expect(LowCapHunterStateSchema.parse(replay.stateAfter)).toStrictEqual(applied.stateAfter);
    expect(WorkerStateMachineKindSchema.parse(replay.workerKind)).toBe("lowcap_hunter");
    expect(WorkerStateTransitionOutcomeKindSchema.parse(replay.history[0].kind)).toBe(
      "no_transition"
    );
    expect(WorkerStateTransitionReasonClassSchema.parse(replay.history[1].reasonClass)).toBe(
      "STATE_ADVANCED"
    );

    const [firstEntry, secondEntry] = writer.list();
    expect(firstEntry.stage).toBe("worker.transition.lowcap_hunter");
    expect(firstEntry.reason).toBe("STATE_NO_CHANGE");
    expect(firstEntry.decisionHash).toBeDefined();
    expect(firstEntry.resultHash).toBeDefined();
    expect(firstEntry.output).toMatchObject({
      recordType: "transition",
      schemaVersion: "worker.state.transition.v1",
      workerKind: "lowcap_hunter",
      kind: "no_transition",
      reasonClass: "STATE_NO_CHANGE",
      stateBefore: baseState,
      stateAfter: baseState,
    });
    expect(secondEntry.output).toMatchObject({
      recordType: "transition",
      workerKind: "lowcap_hunter",
      kind: "transition_applied",
      reasonClass: "STATE_ADVANCED",
    });
  });

  it("reconstructs shadow replay with no-transition and alert progression", async () => {
    const baseState = createShadowIntelligenceState("stable");
    const noTransitionEvaluation = synthesizeNoTransitionEvaluation(
      evaluateWorkerEventGate({
      event: buildShadowEvent({
        eventId: "shadow-replay-no-transition",
        traceId: "trace-shadow-replay",
        confidence: 0.12,
        promotionCandidate: false,
        severity: "low",
        featureSnapshot: {
          currentState: "stable",
          baselineState: "watching",
          transitionType: "decay_before_failure",
          transitionConfidence: 0.12,
          severityScore: 0.08,
          convergenceScore: 0.15,
          freshnessScore: 0.52,
          riskSpike: false,
          thesisConflict: false,
        },
      }),
      state: createWorkerEventGateEvaluationState(),
      })
    );
    const alertEvaluation = evaluateWorkerEventGate({
      event: buildShadowEvent({
        eventId: "shadow-replay-alert",
        traceId: "trace-shadow-replay",
        observedAt: "2026-03-17T12:06:00.000Z",
        windowStart: "2026-03-17T12:04:00.000Z",
        windowEnd: "2026-03-17T12:09:00.000Z",
        severity: "critical",
        confidence: 0.88,
        promotionCandidate: true,
        featureSnapshot: {
          currentState: "stable",
          baselineState: "watching",
          transitionType: "risk_spike",
          transitionConfidence: 0.2,
          severityScore: 0.91,
          convergenceScore: 0.72,
          freshnessScore: 0.83,
          riskSpike: false,
          thesisConflict: false,
        },
      }),
      state: createWorkerEventGateEvaluationState(),
    });

    const noTransition = transitionShadowIntelligenceState({
      currentState: baseState,
      evaluation: noTransitionEvaluation,
    });
    const alertTransition = transitionShadowIntelligenceState({
      currentState: noTransition.stateAfter,
      evaluation: alertEvaluation,
    });

    const writer = new InMemoryJournalWriter();
    await appendWorkerStateTransitionJournal(writer, noTransition);
    await appendWorkerStateTransitionJournal(writer, alertTransition);

    const replay = reconstructShadowIntelligenceTransitionReplay(writer.list());

    expect(replay.workerKind).toBe("shadow_intelligence");
    expect(replay.stateBefore).toStrictEqual(baseState);
    expect(replay.stateAfter).toStrictEqual(alertTransition.stateAfter);
    expect(replay.blocked).toBe(false);
    expect(replay.invalid).toBe(false);
    expect(replay.noTransition).toBe(true);
    expect(replay.history).toHaveLength(2);
    expect(replay.history[0].kind).toBe("no_transition");
    expect(replay.history[1].kind).toBe("transition_applied");
    expect(ShadowIntelligenceStateSchema.parse(replay.stateAfter)).toStrictEqual(
      alertTransition.stateAfter
    );
    expect(WorkerStateMachineKindSchema.parse(replay.workerKind)).toBe(
      "shadow_intelligence"
    );
    expect(WorkerStateTransitionOutcomeKindSchema.parse(replay.history[1].kind)).toBe(
      "transition_applied"
    );
    expect(WorkerStateTransitionReasonClassSchema.parse(replay.history[1].reasonClass)).toBe(
      "STATE_ALERT"
    );

    const [firstEntry, secondEntry] = writer.list();
    expect(firstEntry.stage).toBe("worker.transition.shadow_intelligence");
    expect(firstEntry.reason).toBe("STATE_NO_CHANGE");
    expect(firstEntry.decisionHash).toBeDefined();
    expect(firstEntry.resultHash).toBeDefined();
    expect(firstEntry.output).toMatchObject({
      recordType: "transition",
      schemaVersion: "worker.state.transition.v1",
      workerKind: "shadow_intelligence",
      kind: "no_transition",
      reasonClass: "STATE_NO_CHANGE",
      stateBefore: baseState,
      stateAfter: baseState,
    });
    expect(secondEntry.output).toMatchObject({
      recordType: "transition",
      workerKind: "shadow_intelligence",
      kind: "transition_applied",
      reasonClass: "STATE_ALERT",
      stateAfter: alertTransition.stateAfter,
    });
  });

  it("keeps decision-envelope truth untouched and state surfaces explicit", async () => {
    const fixtures = await buildDecisionEnvelopeFixtureSet();
    const allowBefore = decisionEnvelopeSemantics(fixtures.allowEnvelope);
    const denyBefore = decisionEnvelopeSemantics(fixtures.denyEnvelope);

    const lowcapEvaluation = evaluateWorkerEventGate({
      event: buildLowcapEvent({
        eventId: "lowcap-boundary",
        traceId: "trace-boundary-lowcap",
      }),
      state: createWorkerEventGateEvaluationState(),
    });
    const shadowEvaluation = evaluateWorkerEventGate({
      event: buildShadowEvent({
        eventId: "shadow-boundary",
        traceId: "trace-boundary-shadow",
      }),
      state: createWorkerEventGateEvaluationState(),
    });

    const lowcapTransition = transitionLowCapHunterState({
      currentState: createLowCapHunterState(),
      evaluation: lowcapEvaluation,
    });
    const shadowTransition = transitionShadowIntelligenceState({
      currentState: createShadowIntelligenceState(),
      evaluation: shadowEvaluation,
    });

    const lowcapJournal = buildWorkerStateTransitionJournalEntry(lowcapTransition);
    const shadowJournal = buildWorkerStateTransitionJournalEntry(shadowTransition);

    expect(decisionEnvelopeSemantics(fixtures.allowEnvelope)).toStrictEqual(allowBefore);
    expect(decisionEnvelopeSemantics(fixtures.denyEnvelope)).toStrictEqual(denyBefore);
    expect(lowCapHunterStateOrder()).toStrictEqual([
      "observed",
      "screened",
      "candidate",
      "promoted",
      "modeled",
      "watchlisted",
      "rejected",
      "review_queue",
    ]);
    expect(shadowIntelligenceStateOrder()).toStrictEqual(SHADOW_INTELLIGENCE_STATE_ORDER);
    expect(lowcapJournal).not.toHaveProperty("decisionEnvelope");
    expect(shadowJournal).not.toHaveProperty("decisionEnvelope");
    expect(lowcapJournal.stage).toBe("worker.transition.lowcap_hunter");
    expect(shadowJournal.stage).toBe("worker.transition.shadow_intelligence");
    expect(WorkerStateMachineKindSchema.parse(lowcapJournal.output.workerKind)).toBe(
      "lowcap_hunter"
    );
    expect(WorkerStateMachineKindSchema.parse(shadowJournal.output.workerKind)).toBe(
      "shadow_intelligence"
    );
    expect(WorkerStateTransitionReasonClassSchema.parse(lowcapTransition.reasonClass)).toBe(
      lowcapTransition.reasonClass
    );
    expect(WorkerStateTransitionReasonClassSchema.parse(shadowTransition.reasonClass)).toBe(
      shadowTransition.reasonClass
    );
  });
});
