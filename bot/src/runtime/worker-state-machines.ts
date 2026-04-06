import { z } from "zod";
import { hashDecision, hashResult } from "../core/determinism/hash.js";
import type { JournalEntry } from "../core/contracts/journal.js";
import { appendJournal } from "../persistence/journal-repository.js";
import type { JournalWriter } from "../journal-writer/writer.js";
import type {
  WorkerEventEnvelope,
  WorkerGateReasonClass,
  WorkerGateStageName,
  WorkerModelRouteClass,
  ShadowWorkerEventFeatureSnapshot,
  WorkerSuppressionKind,
  WorkerWriteEffect,
} from "./worker-event-gate/contracts.js";
import type { WorkerEventGateEvaluationResult } from "./worker-event-gate/engine.js";

export const WORKER_STATE_TRANSITION_JOURNAL_SCHEMA_VERSION =
  "worker.state.transition.v1" as const;

export const WorkerStateMachineKindSchema = z.enum([
  "lowcap_hunter",
  "shadow_intelligence",
]);
export type WorkerStateMachineKind = z.infer<typeof WorkerStateMachineKindSchema>;

export const WorkerStateTransitionOutcomeKindSchema = z.enum([
  "transition_applied",
  "transition_blocked",
  "no_transition",
  "invalid_transition",
]);
export type WorkerStateTransitionOutcomeKind = z.infer<
  typeof WorkerStateTransitionOutcomeKindSchema
>;

export const WorkerStateTransitionReasonClassSchema = z.enum([
  "STATE_ADVANCED",
  "STATE_BLOCKED_SUPPRESSED",
  "STATE_NO_CHANGE",
  "STATE_INVALID_EDGE",
  "STATE_REJECTED",
  "STATE_REVIEW_QUEUE",
  "STATE_ALERT",
]);
export type WorkerStateTransitionReasonClass = z.infer<
  typeof WorkerStateTransitionReasonClassSchema
>;

export const LOW_CAP_HUNTER_STATE_ORDER = [
  "observed",
  "screened",
  "candidate",
  "promoted",
  "modeled",
  "watchlisted",
  "rejected",
  "review_queue",
] as const;

export const SHADOW_INTELLIGENCE_STATE_ORDER = [
  "watching",
  "stable",
  "notable_change",
  "transition_detected",
  "modeled",
  "updated_case",
  "review_queue",
  "alert",
] as const;

export const LowCapHunterStateStatusSchema = z.enum(LOW_CAP_HUNTER_STATE_ORDER);
export type LowCapHunterStateStatus = z.infer<typeof LowCapHunterStateStatusSchema>;

export const ShadowIntelligenceStateStatusSchema = z.enum(SHADOW_INTELLIGENCE_STATE_ORDER);
export type ShadowIntelligenceStateStatus = z.infer<
  typeof ShadowIntelligenceStateStatusSchema
>;

export const LowCapHunterStateSchema = z
  .object({
    workerKind: z.literal("lowcap_hunter"),
    status: LowCapHunterStateStatusSchema,
  })
  .strict();
export type LowCapHunterState = z.infer<typeof LowCapHunterStateSchema>;

export const ShadowIntelligenceStateSchema = z
  .object({
    workerKind: z.literal("shadow_intelligence"),
    status: ShadowIntelligenceStateStatusSchema,
  })
  .strict();
export type ShadowIntelligenceState = z.infer<typeof ShadowIntelligenceStateSchema>;

export const WorkerStateSchema = z.union([
  LowCapHunterStateSchema,
  ShadowIntelligenceStateSchema,
]);
export type WorkerState = z.infer<typeof WorkerStateSchema>;

export interface WorkerStateTransitionBasis {
  eventId: string;
  traceId: string;
  family: WorkerEventEnvelope["family"];
  eventType: string;
  observedAt: string;
  normalizedEntityId: string;
  normalizedEntityKey: string;
  timeBucket: string;
  normalizedEvidenceRefs: readonly string[];
  normalizationBasisHash: string;
  evidenceSignature: string;
  gateEvaluationHash: string;
  gateReplayKey: string;
  gateBlocked: boolean;
  blockingStage?: WorkerGateStageName;
  suppressionKind?: WorkerSuppressionKind;
  routeClass: WorkerModelRouteClass;
  routeReasonClass: WorkerGateReasonClass;
  modelCalled: boolean;
  modelReasonClass: WorkerGateReasonClass;
  writeEffect: WorkerWriteEffect;
  writeEffectReasonClass: WorkerGateReasonClass;
  evidenceRefs: readonly string[];
}

export interface WorkerStateTransitionResult<TState extends WorkerState> {
  workerKind: TState["workerKind"];
  kind: WorkerStateTransitionOutcomeKind;
  reasonClass: WorkerStateTransitionReasonClass;
  stateBefore: TState;
  stateAfter: TState;
  basis: WorkerStateTransitionBasis;
  basisHash: string;
  transitionHash: string;
  replayKey: string;
}

export type LowCapHunterTransitionResult = WorkerStateTransitionResult<LowCapHunterState>;
export type ShadowIntelligenceTransitionResult =
  WorkerStateTransitionResult<ShadowIntelligenceState>;

export function createLowCapHunterState(
  status: LowCapHunterStateStatus = "observed"
): LowCapHunterState {
  return {
    workerKind: "lowcap_hunter",
    status,
  };
}

export function createShadowIntelligenceState(
  status: ShadowIntelligenceStateStatus = "watching"
): ShadowIntelligenceState {
  return {
    workerKind: "shadow_intelligence",
    status,
  };
}

export function parseLowCapHunterState(value: unknown): LowCapHunterState | null {
  const parsed = LowCapHunterStateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseShadowIntelligenceState(value: unknown): ShadowIntelligenceState | null {
  const parsed = ShadowIntelligenceStateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function buildTransitionBasis(
  evaluation: WorkerEventGateEvaluationResult
): WorkerStateTransitionBasis {
  return {
    eventId: evaluation.event.eventId,
    traceId: evaluation.traceId,
    family: evaluation.event.family,
    eventType: evaluation.event.eventType,
    observedAt: evaluation.event.observedAt,
    normalizedEntityId: evaluation.normalization.normalizedEntityId,
    normalizedEntityKey: evaluation.normalization.normalizedEntityKey,
    timeBucket: evaluation.normalization.timeBucket,
    normalizedEvidenceRefs: evaluation.normalization.normalizedEvidenceRefs,
    normalizationBasisHash: evaluation.normalization.basisHash,
    evidenceSignature: evaluation.normalization.evidenceSignature,
    gateEvaluationHash: evaluation.evaluationHash,
    gateReplayKey: evaluation.replayKey,
    gateBlocked: evaluation.blocked,
    blockingStage: evaluation.blockingStage,
    suppressionKind: evaluation.suppression?.kind,
    routeClass: evaluation.routing.routeClass,
    routeReasonClass: evaluation.routing.reasonClass,
    modelCalled: evaluation.modelResult.called,
    modelReasonClass: evaluation.modelResult.reasonClass,
    writeEffect: evaluation.writeEffect.effect,
    writeEffectReasonClass: evaluation.writeEffect.reasonClass,
    evidenceRefs: [...evaluation.event.evidenceRefs],
  };
}

function buildTransitionResult<TState extends WorkerState>(input: {
  workerKind: TState["workerKind"];
  kind: WorkerStateTransitionOutcomeKind;
  reasonClass: WorkerStateTransitionReasonClass;
  stateBefore: TState;
  stateAfter: TState;
  basis: WorkerStateTransitionBasis;
}): WorkerStateTransitionResult<TState> {
  const basisHash = hashDecision({
    workerKind: input.workerKind,
    stateBefore: input.stateBefore,
    basis: input.basis,
  });
  const transitionHash = hashResult({
    workerKind: input.workerKind,
    stateBefore: input.stateBefore,
    stateAfter: input.stateAfter,
    kind: input.kind,
    reasonClass: input.reasonClass,
    basisHash,
    gateEvaluationHash: input.basis.gateEvaluationHash,
    gateReplayKey: input.basis.gateReplayKey,
  });
  const replayKey = hashDecision({
    workerKind: input.workerKind,
    stateBefore: input.stateBefore,
    stateAfter: input.stateAfter,
    kind: input.kind,
    reasonClass: input.reasonClass,
    basisHash,
    gateReplayKey: input.basis.gateReplayKey,
  });

  return {
    workerKind: input.workerKind,
    kind: input.kind,
    reasonClass: input.reasonClass,
    stateBefore: input.stateBefore,
    stateAfter: input.stateAfter,
    basis: input.basis,
    basisHash,
    transitionHash,
    replayKey,
  };
}

function createAppliedResult<TState extends WorkerState>(input: {
  workerKind: TState["workerKind"];
  stateBefore: TState;
  stateAfter: TState;
  reasonClass: WorkerStateTransitionReasonClass;
  basis: WorkerStateTransitionBasis;
}): WorkerStateTransitionResult<TState> {
  return buildTransitionResult({
    workerKind: input.workerKind,
    kind: "transition_applied",
    reasonClass: input.reasonClass,
    stateBefore: input.stateBefore,
    stateAfter: input.stateAfter,
    basis: input.basis,
  });
}

function createBlockedResult<TState extends WorkerState>(input: {
  workerKind: TState["workerKind"];
  stateBefore: TState;
  basis: WorkerStateTransitionBasis;
}): WorkerStateTransitionResult<TState> {
  return buildTransitionResult({
    workerKind: input.workerKind,
    kind: "transition_blocked",
    reasonClass: "STATE_BLOCKED_SUPPRESSED",
    stateBefore: input.stateBefore,
    stateAfter: input.stateBefore,
    basis: input.basis,
  });
}

function createNoTransitionResult<TState extends WorkerState>(input: {
  workerKind: TState["workerKind"];
  stateBefore: TState;
  basis: WorkerStateTransitionBasis;
}): WorkerStateTransitionResult<TState> {
  return buildTransitionResult({
    workerKind: input.workerKind,
    kind: "no_transition",
    reasonClass: "STATE_NO_CHANGE",
    stateBefore: input.stateBefore,
    stateAfter: input.stateBefore,
    basis: input.basis,
  });
}

function createInvalidTransitionResult<TState extends WorkerState>(input: {
  workerKind: TState["workerKind"];
  stateBefore: TState;
  basis: WorkerStateTransitionBasis;
}): WorkerStateTransitionResult<TState> {
  return buildTransitionResult({
    workerKind: input.workerKind,
    kind: "invalid_transition",
    reasonClass: "STATE_INVALID_EDGE",
    stateBefore: input.stateBefore,
    stateAfter: input.stateBefore,
    basis: input.basis,
  });
}

function lowCapHasForwardSignal(evaluation: WorkerEventGateEvaluationResult): boolean {
  return evaluation.routing.routeClass !== "no_model" || evaluation.writeEffect.effect !== "no_write";
}

function shadowAlertSignal(evaluation: WorkerEventGateEvaluationResult): boolean {
  const feature = evaluation.event.featureSnapshot as ShadowWorkerEventFeatureSnapshot;
  return (
    evaluation.event.severity === "critical" ||
    feature.riskSpike ||
    feature.thesisConflict
  );
}

function shadowHasForwardSignal(evaluation: WorkerEventGateEvaluationResult): boolean {
  return (
    evaluation.routing.routeClass !== "no_model" ||
    evaluation.writeEffect.effect !== "no_write" ||
    shadowAlertSignal(evaluation)
  );
}

function lowCapNextState(
  currentState: LowCapHunterState,
  evaluation: WorkerEventGateEvaluationResult
): LowCapHunterStateStatus {
  switch (currentState.status) {
    case "observed":
      return "screened";
    case "screened":
      if (evaluation.routing.routeClass === "eligible_small_adjudication") {
        return "candidate";
      }
      if (evaluation.routing.routeClass === "eligible_deep_adjudication") {
        return "promoted";
      }
      return "screened";
    case "candidate":
      if (evaluation.routing.routeClass === "eligible_deep_adjudication") {
        return "promoted";
      }
      return "candidate";
    case "promoted":
      if (evaluation.routing.routeClass !== "no_model") {
        return "modeled";
      }
      return "promoted";
    case "modeled":
      if (evaluation.writeEffect.effect === "watchlist_update") {
        return "watchlisted";
      }
      if (evaluation.writeEffect.effect === "review_queue_insert") {
        return "review_queue";
      }
      return "modeled";
    case "watchlisted":
    case "rejected":
    case "review_queue":
      return currentState.status;
    default: {
      const exhaustiveCheck: never = currentState.status;
      return exhaustiveCheck;
    }
  }
}

function shadowNextState(
  currentState: ShadowIntelligenceState,
  evaluation: WorkerEventGateEvaluationResult
): ShadowIntelligenceStateStatus {
  const feature = evaluation.event.featureSnapshot as ShadowWorkerEventFeatureSnapshot;

  if (shadowAlertSignal(evaluation)) {
    return "alert";
  }

  switch (currentState.status) {
    case "watching":
      return "stable";
    case "stable":
      if (
        feature.currentState === "notable_change" ||
        feature.transitionConfidence >= 0.5 ||
        evaluation.routing.routeClass !== "no_model"
      ) {
        return "notable_change";
      }
      return "stable";
    case "notable_change":
      if (
        feature.currentState === "transition_detected" ||
        feature.transitionConfidence >= 0.7 ||
        evaluation.routing.routeClass !== "no_model"
      ) {
        return "transition_detected";
      }
      return "notable_change";
    case "transition_detected":
      if (evaluation.routing.routeClass !== "no_model") {
        return "modeled";
      }
      return "transition_detected";
    case "modeled":
      if (evaluation.writeEffect.effect === "case_update") {
        return "updated_case";
      }
      if (evaluation.writeEffect.effect === "derived_refresh_trigger") {
        return "review_queue";
      }
      return "modeled";
    case "updated_case":
      if (
        evaluation.writeEffect.effect === "review_queue_insert" ||
        evaluation.writeEffect.effect === "derived_refresh_trigger"
      ) {
        return "review_queue";
      }
      return "updated_case";
    case "review_queue":
    case "alert":
      return currentState.status;
    default: {
      const exhaustiveCheck: never = currentState.status;
      return exhaustiveCheck;
    }
  }
}

function transitionLowCapHunterStateInternal(input: {
  currentState: LowCapHunterState;
  evaluation: WorkerEventGateEvaluationResult;
}): LowCapHunterTransitionResult {
  const currentState = LowCapHunterStateSchema.parse(input.currentState);
  const evaluation = input.evaluation;
  const basis = buildTransitionBasis(evaluation);
  const blockedBySuppression =
    evaluation.suppression?.kind === "dedupe" ||
    evaluation.suppression?.kind === "cooldown" ||
    evaluation.suppression?.kind === "defer";
  const terminal =
    currentState.status === "watchlisted" ||
    currentState.status === "rejected" ||
    currentState.status === "review_queue";

  if (evaluation.event.family !== "lowcap") {
    return createInvalidTransitionResult({
      workerKind: currentState.workerKind,
      stateBefore: currentState,
      basis,
    });
  }

  if (blockedBySuppression) {
    return createBlockedResult({
      workerKind: currentState.workerKind,
      stateBefore: currentState,
      basis,
    });
  }

  if (terminal) {
    if (lowCapHasForwardSignal(evaluation)) {
      return createInvalidTransitionResult({
        workerKind: currentState.workerKind,
        stateBefore: currentState,
        basis,
      });
    }

    return createNoTransitionResult({
      workerKind: currentState.workerKind,
      stateBefore: currentState,
      basis,
    });
  }

  if (evaluation.blocked) {
    if (
      evaluation.blockingStage === "validity" ||
      evaluation.blockingStage === "integrity" ||
      evaluation.blockingStage === "convergence_relevance"
    ) {
      return createAppliedResult({
        workerKind: currentState.workerKind,
        stateBefore: currentState,
        stateAfter: createLowCapHunterState("rejected"),
        reasonClass: "STATE_REJECTED",
        basis,
      });
    }

    if (lowCapHasForwardSignal(evaluation)) {
      return createInvalidTransitionResult({
        workerKind: currentState.workerKind,
        stateBefore: currentState,
        basis,
      });
    }

    return createNoTransitionResult({
      workerKind: currentState.workerKind,
      stateBefore: currentState,
      basis,
    });
  }

  const nextStatus = lowCapNextState(currentState, evaluation);
  if (nextStatus === currentState.status) {
    return createNoTransitionResult({
      workerKind: currentState.workerKind,
      stateBefore: currentState,
      basis,
    });
  }

  return createAppliedResult({
    workerKind: currentState.workerKind,
    stateBefore: currentState,
    stateAfter: createLowCapHunterState(nextStatus),
    reasonClass:
      nextStatus === "review_queue"
        ? "STATE_REVIEW_QUEUE"
        : nextStatus === "rejected"
          ? "STATE_REJECTED"
          : "STATE_ADVANCED",
    basis,
  });
}

function transitionShadowIntelligenceStateInternal(input: {
  currentState: ShadowIntelligenceState;
  evaluation: WorkerEventGateEvaluationResult;
}): ShadowIntelligenceTransitionResult {
  const currentState = ShadowIntelligenceStateSchema.parse(input.currentState);
  const evaluation = input.evaluation;
  const basis = buildTransitionBasis(evaluation);
  const blockedBySuppression =
    evaluation.suppression?.kind === "dedupe" ||
    evaluation.suppression?.kind === "cooldown" ||
    evaluation.suppression?.kind === "defer";
  const terminal = currentState.status === "review_queue" || currentState.status === "alert";

  if (evaluation.event.family !== "shadow") {
    return createInvalidTransitionResult({
      workerKind: currentState.workerKind,
      stateBefore: currentState,
      basis,
    });
  }

  if (blockedBySuppression) {
    return createBlockedResult({
      workerKind: currentState.workerKind,
      stateBefore: currentState,
      basis,
    });
  }

  if (terminal) {
    if (shadowHasForwardSignal(evaluation)) {
      return createInvalidTransitionResult({
        workerKind: currentState.workerKind,
        stateBefore: currentState,
        basis,
      });
    }

    return createNoTransitionResult({
      workerKind: currentState.workerKind,
      stateBefore: currentState,
      basis,
    });
  }

  if (shadowAlertSignal(evaluation)) {
    return createAppliedResult({
      workerKind: currentState.workerKind,
      stateBefore: currentState,
      stateAfter: createShadowIntelligenceState("alert"),
      reasonClass: "STATE_ALERT",
      basis,
    });
  }

  if (evaluation.blocked) {
    if (
      evaluation.blockingStage === "validity" ||
      evaluation.blockingStage === "integrity" ||
      evaluation.blockingStage === "convergence_relevance"
    ) {
      return createAppliedResult({
        workerKind: currentState.workerKind,
        stateBefore: currentState,
        stateAfter: createShadowIntelligenceState("review_queue"),
        reasonClass: "STATE_REVIEW_QUEUE",
        basis,
      });
    }

    if (shadowHasForwardSignal(evaluation)) {
      return createInvalidTransitionResult({
        workerKind: currentState.workerKind,
        stateBefore: currentState,
        basis,
      });
    }

    return createNoTransitionResult({
      workerKind: currentState.workerKind,
      stateBefore: currentState,
      basis,
    });
  }

  const nextStatus = shadowNextState(currentState, evaluation);
  if (nextStatus === currentState.status) {
    return createNoTransitionResult({
      workerKind: currentState.workerKind,
      stateBefore: currentState,
      basis,
    });
  }

  return createAppliedResult({
    workerKind: currentState.workerKind,
    stateBefore: currentState,
    stateAfter: createShadowIntelligenceState(nextStatus),
    reasonClass:
      nextStatus === "review_queue"
        ? "STATE_REVIEW_QUEUE"
        : nextStatus === "alert"
          ? "STATE_ALERT"
          : "STATE_ADVANCED",
    basis,
  });
}

export function transitionLowCapHunterState(input: {
  currentState: LowCapHunterState;
  evaluation: WorkerEventGateEvaluationResult;
}): LowCapHunterTransitionResult {
  return transitionLowCapHunterStateInternal(input);
}

export function transitionShadowIntelligenceState(input: {
  currentState: ShadowIntelligenceState;
  evaluation: WorkerEventGateEvaluationResult;
}): ShadowIntelligenceTransitionResult {
  return transitionShadowIntelligenceStateInternal(input);
}

export interface WorkerStateTransitionJournalRecord<TState extends WorkerState>
  extends WorkerStateTransitionResult<TState> {
  recordType: "transition";
  schemaVersion: typeof WORKER_STATE_TRANSITION_JOURNAL_SCHEMA_VERSION;
}

export interface WorkerStateTransitionReplayTrace<TState extends WorkerState> {
  workerKind: TState["workerKind"] | null;
  stateBefore: TState | null;
  stateAfter: TState | null;
  blocked: boolean;
  invalid: boolean;
  noTransition: boolean;
  history: WorkerStateTransitionResult<TState>[];
  journalEntries: JournalEntry[];
}

function transitionJournalStage(workerKind: WorkerStateMachineKind): string {
  return workerKind === "lowcap_hunter"
    ? "worker.transition.lowcap_hunter"
    : "worker.transition.shadow_intelligence";
}

function buildTransitionJournalRecord<TState extends WorkerState>(
  result: WorkerStateTransitionResult<TState>
): WorkerStateTransitionJournalRecord<TState> {
  return {
    recordType: "transition",
    schemaVersion: WORKER_STATE_TRANSITION_JOURNAL_SCHEMA_VERSION,
    ...result,
  };
}

function buildTransitionJournalEntry<TState extends WorkerState>(
  result: WorkerStateTransitionResult<TState>
): JournalEntry {
  const record = buildTransitionJournalRecord(result);
  const input = {
    workerKind: record.workerKind,
    stateBefore: record.stateBefore,
    basis: record.basis,
    basisHash: record.basisHash,
    transitionHash: record.transitionHash,
    replayKey: record.replayKey,
  };
  const output = { ...record };
  const decisionHash = hashDecision(input);
  const resultHash = hashResult(output);
  const blocked = record.kind === "transition_blocked" || record.kind === "invalid_transition";
  const reason = record.reasonClass;

  return {
    traceId: record.basis.traceId,
    timestamp: record.basis.observedAt,
    stage: transitionJournalStage(record.workerKind),
    decisionHash,
    resultHash,
    input,
    output,
    blocked,
    reason,
    eventHash: hashResult({
      traceId: record.basis.traceId,
      timestamp: record.basis.observedAt,
      stage: transitionJournalStage(record.workerKind),
      decisionHash,
      resultHash,
      blocked,
      reason,
    }),
  };
}

export function buildWorkerStateTransitionJournalEntry<TState extends WorkerState>(
  result: WorkerStateTransitionResult<TState>
): JournalEntry {
  return buildTransitionJournalEntry(result);
}

export async function appendWorkerStateTransitionJournal<TState extends WorkerState>(
  writer: JournalWriter,
  result: WorkerStateTransitionResult<TState>
): Promise<JournalEntry> {
  const entry = buildTransitionJournalEntry(result);
  await appendJournal(writer, entry);
  return entry;
}

function parseTransitionRecord(output: unknown): WorkerStateTransitionJournalRecord<WorkerState> | null {
  if (!output || typeof output !== "object") {
    return null;
  }

  const record = output as Partial<WorkerStateTransitionJournalRecord<WorkerState>>;
  if (
    record.recordType !== "transition" ||
    record.schemaVersion !== WORKER_STATE_TRANSITION_JOURNAL_SCHEMA_VERSION
  ) {
    return null;
  }

  const workerKindParsed = WorkerStateMachineKindSchema.safeParse(record.workerKind);
  if (!workerKindParsed.success) {
    throw new Error(`INVALID_WORKER_STATE_TRANSITION_RECORD:workerKind:${String(record.workerKind)}`);
  }

  const kindParsed = WorkerStateTransitionOutcomeKindSchema.safeParse(record.kind);
  if (!kindParsed.success) {
    throw new Error(`INVALID_WORKER_STATE_TRANSITION_RECORD:kind:${String(record.kind)}`);
  }

  const reasonParsed = WorkerStateTransitionReasonClassSchema.safeParse(record.reasonClass);
  if (!reasonParsed.success) {
    throw new Error(`INVALID_WORKER_STATE_TRANSITION_RECORD:reasonClass:${String(record.reasonClass)}`);
  }

  const stateBeforeParsed =
    workerKindParsed.data === "lowcap_hunter"
      ? LowCapHunterStateSchema.safeParse(record.stateBefore)
      : ShadowIntelligenceStateSchema.safeParse(record.stateBefore);
  if (!stateBeforeParsed.success) {
    throw new Error("INVALID_WORKER_STATE_TRANSITION_RECORD:stateBefore");
  }

  const stateAfterParsed =
    workerKindParsed.data === "lowcap_hunter"
      ? LowCapHunterStateSchema.safeParse(record.stateAfter)
      : ShadowIntelligenceStateSchema.safeParse(record.stateAfter);
  if (!stateAfterParsed.success) {
    throw new Error("INVALID_WORKER_STATE_TRANSITION_RECORD:stateAfter");
  }

  return {
    recordType: "transition",
    schemaVersion: WORKER_STATE_TRANSITION_JOURNAL_SCHEMA_VERSION,
    workerKind: workerKindParsed.data,
    kind: kindParsed.data,
    reasonClass: reasonParsed.data,
    stateBefore: stateBeforeParsed.data,
    stateAfter: stateAfterParsed.data,
    basis: record.basis as WorkerStateTransitionBasis,
    basisHash: record.basisHash as string,
    transitionHash: record.transitionHash as string,
    replayKey: record.replayKey as string,
  };
}

function reconstructWorkerStateTransitionReplay<TState extends WorkerState>(
  entries: ReadonlyArray<JournalEntry>,
  workerKind: TState["workerKind"]
): WorkerStateTransitionReplayTrace<TState> {
  const history: WorkerStateTransitionResult<TState>[] = [];
  let stateBefore: TState | null = null;
  let stateAfter: TState | null = null;
  let blocked = false;
  let invalid = false;
  let noTransition = false;

  for (const entry of entries) {
    const record = parseTransitionRecord(entry.output);
    if (!record || record.workerKind !== workerKind) {
      continue;
    }

    history.push(record as unknown as WorkerStateTransitionResult<TState>);
    if (!stateBefore) {
      stateBefore = record.stateBefore as TState;
    }
    stateAfter = record.stateAfter as TState;

    if (record.kind === "transition_blocked") {
      blocked = true;
    }
    if (record.kind === "invalid_transition") {
      invalid = true;
    }
    if (record.kind === "no_transition") {
      noTransition = true;
    }
  }

  return {
    workerKind,
    stateBefore,
    stateAfter,
    blocked,
    invalid,
    noTransition,
    history,
    journalEntries: [...entries],
  };
}

export function reconstructLowCapHunterTransitionReplay(
  entries: ReadonlyArray<JournalEntry>
): WorkerStateTransitionReplayTrace<LowCapHunterState> {
  return reconstructWorkerStateTransitionReplay(entries, "lowcap_hunter");
}

export function reconstructShadowIntelligenceTransitionReplay(
  entries: ReadonlyArray<JournalEntry>
): WorkerStateTransitionReplayTrace<ShadowIntelligenceState> {
  return reconstructWorkerStateTransitionReplay(entries, "shadow_intelligence");
}

export function lowCapHunterStateOrder(): readonly LowCapHunterStateStatus[] {
  return LOW_CAP_HUNTER_STATE_ORDER;
}

export function shadowIntelligenceStateOrder(): readonly ShadowIntelligenceStateStatus[] {
  return SHADOW_INTELLIGENCE_STATE_ORDER;
}
