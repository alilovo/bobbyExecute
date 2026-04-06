import { hashDecision, hashResult } from "../../core/determinism/hash.js";
import type {
  WorkerEventEnvelope,
  WorkerEventGateBatchRecord,
  WorkerEventGateCooldownRecord,
  WorkerEventGateState,
  WorkerEventGateStateRecord,
  WorkerEventNormalization,
  WorkerGateDisposition,
  WorkerGateReasonClass,
  WorkerGateStageName,
  WorkerModelRouteClass,
  WorkerSuppressionKind,
  WorkerWriteEffect,
} from "./contracts.js";
import {
  batchWindowMs,
  buildBatchKey,
  buildCooldownKey,
  buildDedupeKey,
  buildWorkerEventNormalization,
  cooldownWindowMs,
  createWorkerEventGateState,
  dedupeWindowMs,
  isKnownWorkerEventFamily,
  isWithinWindow,
  lowcapPromotionClass,
  normalizeIdentifierPart,
  parseIsoMs,
  shadowTransitionClass,
  sortStrings,
  stableTimeBucketLabel,
} from "./contracts.js";

export const WORKER_GATE_STAGE_ORDER = [
  "validity",
  "integrity",
  "convergence_relevance",
  "dedupe",
  "cooldown",
  "batch_debounce",
  "model_promotion",
  "post_model_routing",
] as const satisfies readonly WorkerGateStageName[];

export const WORKER_EVENT_GATE_EVALUATION_SCHEMA_VERSION = "worker.event.gate.evaluation.v1" as const;

export interface WorkerSuppressionRecord {
  stage: WorkerGateStageName;
  kind: WorkerSuppressionKind;
  reasonClass: WorkerGateReasonClass;
  basisHash: string;
  evidenceSignature: string;
  key?: string;
  expiresAt?: string;
  releaseAt?: string;
  details: Readonly<Record<string, unknown>>;
}

export interface WorkerModelRoutingDecision {
  routeClass: WorkerModelRouteClass;
  reasonClass: WorkerGateReasonClass;
  basisHash: string;
  evaluatedAt: string;
  advisoryOnly: true;
  details: Readonly<Record<string, unknown>>;
}

export interface WorkerModelResultPlaceholder {
  modelName: "none";
  routeClass: WorkerModelRouteClass;
  reasonClass: WorkerGateReasonClass;
  basisHash: string;
  evaluatedAt: string;
  called: false;
  details: Readonly<Record<string, unknown>>;
}

export interface WorkerWriteEffectDecision {
  effect: WorkerWriteEffect;
  reasonClass: WorkerGateReasonClass;
  basisHash: string;
  evaluatedAt: string;
  advisoryOnly: true;
  target: "watchlist" | "case" | "review_queue" | "derived_refresh" | "none";
  details: Readonly<Record<string, unknown>>;
}

interface WorkerGateStageResultBase {
  stage: WorkerGateStageName;
  disposition: WorkerGateDisposition;
  reasonClass: WorkerGateReasonClass;
  evaluatedAt: string;
  basisHash: string;
  input: Readonly<Record<string, unknown>>;
  output: Readonly<Record<string, unknown>>;
  blocked: boolean;
  terminal: boolean;
  suppressed: boolean;
  promoted: boolean;
  routeClass?: WorkerModelRouteClass;
  writeEffect?: WorkerWriteEffect;
  key?: string;
  windowMs?: number;
  expiresAt?: string;
  releaseAt?: string;
  suppression?: WorkerSuppressionRecord;
  skippedBecause?: WorkerGateStageName;
}

export interface WorkerGatePassResult extends WorkerGateStageResultBase {
  disposition: "pass";
}

export interface WorkerGateFailResult extends WorkerGateStageResultBase {
  disposition: "fail";
  blocked: true;
  terminal: true;
}

export interface WorkerGateSuppressedResult extends WorkerGateStageResultBase {
  disposition: "suppressed";
  blocked: true;
  terminal: true;
  suppression: WorkerSuppressionRecord;
}

export interface WorkerGateDeferredResult extends WorkerGateStageResultBase {
  disposition: "deferred";
  blocked: true;
  terminal: true;
  suppression: WorkerSuppressionRecord;
  releaseAt: string;
}

export interface WorkerGateBatchedResult extends WorkerGateStageResultBase {
  disposition: "batched";
  blocked: true;
  terminal: true;
  suppression: WorkerSuppressionRecord;
  releaseAt: string;
}

export interface WorkerGatePromotedResult extends WorkerGateStageResultBase {
  disposition: "promoted";
  routeClass: Exclude<WorkerModelRouteClass, "no_model">;
}

export interface WorkerGateNoModelResult extends WorkerGateStageResultBase {
  disposition: "no_model";
  routeClass: "no_model";
}

export interface WorkerGateSkippedResult extends WorkerGateStageResultBase {
  disposition: "skipped";
  skippedBecause: WorkerGateStageName;
}

export type WorkerGateStageResult =
  | WorkerGatePassResult
  | WorkerGateFailResult
  | WorkerGateSuppressedResult
  | WorkerGateDeferredResult
  | WorkerGateBatchedResult
  | WorkerGatePromotedResult
  | WorkerGateNoModelResult
  | WorkerGateSkippedResult;

export interface WorkerEventGateEvaluationInput {
  event: WorkerEventEnvelope;
  state?: WorkerEventGateState;
}

export interface WorkerEventGateEvaluationResult {
  schemaVersion: typeof WORKER_EVENT_GATE_EVALUATION_SCHEMA_VERSION;
  traceId: string;
  event: WorkerEventEnvelope;
  normalization: WorkerEventNormalization;
  stateBefore: WorkerEventGateState;
  stateAfter: WorkerEventGateState;
  stages: WorkerGateStageResult[];
  blocked: boolean;
  blockingStage?: WorkerGateStageName;
  terminalStage: WorkerGateStageName;
  suppression?: WorkerSuppressionRecord;
  routing: WorkerModelRoutingDecision;
  modelResult: WorkerModelResultPlaceholder;
  writeEffect: WorkerWriteEffectDecision;
  evaluationHash: string;
  replayKey: string;
}

function cloneState(state: WorkerEventGateState): WorkerEventGateState {
  return {
    schemaVersion: state.schemaVersion,
    dedupeRecords: state.dedupeRecords.map((record) => ({ ...record })),
    cooldownRecords: state.cooldownRecords.map((record) => ({ ...record })),
    batchRecords: state.batchRecords.map((record) => ({
      ...record,
      eventIds: [...record.eventIds],
      eventTypes: [...record.eventTypes],
    })),
    lastEvaluatedAt: state.lastEvaluatedAt,
  };
}

function ensureValidState(state?: WorkerEventGateState): WorkerEventGateState {
  if (!state || state.schemaVersion !== createWorkerEventGateState().schemaVersion) {
    return createWorkerEventGateState();
  }
  return cloneState(state);
}

function addMilliseconds(iso: string, ms: number): string {
  return new Date(parseIsoMs(iso) + ms).toISOString();
}

function sortEventIds(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function buildStageResultBase(input: {
  stage: WorkerGateStageName;
  disposition: WorkerGateDisposition;
  reasonClass: WorkerGateReasonClass;
  evaluatedAt: string;
  basisHash: string;
  input: Readonly<Record<string, unknown>>;
  output: Readonly<Record<string, unknown>>;
  blocked: boolean;
  terminal: boolean;
  suppressed: boolean;
  promoted: boolean;
  routeClass?: WorkerModelRouteClass;
  writeEffect?: WorkerWriteEffect;
  key?: string;
  windowMs?: number;
  expiresAt?: string;
  releaseAt?: string;
  suppression?: WorkerSuppressionRecord;
  skippedBecause?: WorkerGateStageName;
}): WorkerGateStageResultBase {
  return { ...input };
}

function createSuppressionRecord(input: {
  stage: WorkerGateStageName;
  kind: WorkerSuppressionKind;
  reasonClass: WorkerGateReasonClass;
  basisHash: string;
  evidenceSignature: string;
  key?: string;
  expiresAt?: string;
  releaseAt?: string;
  details?: Readonly<Record<string, unknown>>;
}): WorkerSuppressionRecord {
  return {
    stage: input.stage,
    kind: input.kind,
    reasonClass: input.reasonClass,
    basisHash: input.basisHash,
    evidenceSignature: input.evidenceSignature,
    key: input.key,
    expiresAt: input.expiresAt,
    releaseAt: input.releaseAt,
    details: input.details ?? {},
  };
}

function createSkippedResult(stage: WorkerGateStageName, skippedBecause: WorkerGateStageName, evaluatedAt: string): WorkerGateSkippedResult {
  const basisHash = hashDecision({ stage, skippedBecause, evaluatedAt });
  return {
    ...buildStageResultBase({
      stage,
      disposition: "skipped",
      reasonClass: "MODEL_NO_PROMOTION",
      evaluatedAt,
      basisHash,
      input: { stage, skippedBecause },
      output: { stage, skippedBecause, skipped: true },
      blocked: false,
      terminal: false,
      suppressed: false,
      promoted: false,
      skippedBecause,
    }),
    disposition: "skipped",
    skippedBecause,
  };
}

function createPassResult(input: {
  stage: WorkerGateStageName;
  reasonClass: WorkerGateReasonClass;
  evaluatedAt: string;
  basisHash: string;
  inputSnapshot: Readonly<Record<string, unknown>>;
  outputSnapshot: Readonly<Record<string, unknown>>;
  routeClass?: WorkerModelRouteClass;
  writeEffect?: WorkerWriteEffect;
  key?: string;
  windowMs?: number;
  expiresAt?: string;
  releaseAt?: string;
  promoted?: boolean;
}): WorkerGatePassResult {
  return {
    ...buildStageResultBase({
      stage: input.stage,
      disposition: "pass",
      reasonClass: input.reasonClass,
      evaluatedAt: input.evaluatedAt,
      basisHash: input.basisHash,
      input: input.inputSnapshot,
      output: input.outputSnapshot,
      blocked: false,
      terminal: false,
      suppressed: false,
      promoted: input.promoted ?? false,
      routeClass: input.routeClass,
      writeEffect: input.writeEffect,
      key: input.key,
      windowMs: input.windowMs,
      expiresAt: input.expiresAt,
      releaseAt: input.releaseAt,
    }),
    disposition: "pass",
  };
}

function createFailResult(input: {
  stage: WorkerGateStageName;
  reasonClass: WorkerGateReasonClass;
  evaluatedAt: string;
  basisHash: string;
  inputSnapshot: Readonly<Record<string, unknown>>;
  outputSnapshot: Readonly<Record<string, unknown>>;
  suppression: WorkerSuppressionRecord;
}): WorkerGateFailResult {
  return {
    ...buildStageResultBase({
      stage: input.stage,
      disposition: "fail",
      reasonClass: input.reasonClass,
      evaluatedAt: input.evaluatedAt,
      basisHash: input.basisHash,
      input: input.inputSnapshot,
      output: input.outputSnapshot,
      blocked: true,
      terminal: true,
      suppressed: false,
      promoted: false,
      suppression: input.suppression,
    }),
    disposition: "fail",
    blocked: true,
    terminal: true,
  };
}

function createSuppressedResult(input: {
  stage: WorkerGateStageName;
  reasonClass: WorkerGateReasonClass;
  evaluatedAt: string;
  basisHash: string;
  inputSnapshot: Readonly<Record<string, unknown>>;
  outputSnapshot: Readonly<Record<string, unknown>>;
  suppression: WorkerSuppressionRecord;
}): WorkerGateSuppressedResult {
  return {
    ...buildStageResultBase({
      stage: input.stage,
      disposition: "suppressed",
      reasonClass: input.reasonClass,
      evaluatedAt: input.evaluatedAt,
      basisHash: input.basisHash,
      input: input.inputSnapshot,
      output: input.outputSnapshot,
      blocked: true,
      terminal: true,
      suppressed: true,
      promoted: false,
      suppression: input.suppression,
    }),
    disposition: "suppressed",
    blocked: true,
    terminal: true,
    suppression: input.suppression,
  };
}

function createDeferredResult(input: {
  stage: WorkerGateStageName;
  reasonClass: WorkerGateReasonClass;
  evaluatedAt: string;
  basisHash: string;
  inputSnapshot: Readonly<Record<string, unknown>>;
  outputSnapshot: Readonly<Record<string, unknown>>;
  suppression: WorkerSuppressionRecord;
  releaseAt: string;
  key?: string;
  windowMs?: number;
}): WorkerGateDeferredResult {
  return {
    ...buildStageResultBase({
      stage: input.stage,
      disposition: "deferred",
      reasonClass: input.reasonClass,
      evaluatedAt: input.evaluatedAt,
      basisHash: input.basisHash,
      input: input.inputSnapshot,
      output: input.outputSnapshot,
      blocked: true,
      terminal: true,
      suppressed: true,
      promoted: false,
      suppression: input.suppression,
      key: input.key,
      windowMs: input.windowMs,
      releaseAt: input.releaseAt,
    }),
    disposition: "deferred",
    blocked: true,
    terminal: true,
    suppression: input.suppression,
    releaseAt: input.releaseAt,
  };
}

function createBatchedResult(input: {
  stage: WorkerGateStageName;
  reasonClass: WorkerGateReasonClass;
  evaluatedAt: string;
  basisHash: string;
  inputSnapshot: Readonly<Record<string, unknown>>;
  outputSnapshot: Readonly<Record<string, unknown>>;
  suppression: WorkerSuppressionRecord;
  releaseAt: string;
  key?: string;
  windowMs?: number;
}): WorkerGateBatchedResult {
  return {
    ...buildStageResultBase({
      stage: input.stage,
      disposition: "batched",
      reasonClass: input.reasonClass,
      evaluatedAt: input.evaluatedAt,
      basisHash: input.basisHash,
      input: input.inputSnapshot,
      output: input.outputSnapshot,
      blocked: true,
      terminal: true,
      suppressed: true,
      promoted: false,
      suppression: input.suppression,
      key: input.key,
      windowMs: input.windowMs,
      releaseAt: input.releaseAt,
    }),
    disposition: "batched",
    blocked: true,
    terminal: true,
    suppression: input.suppression,
    releaseAt: input.releaseAt,
  };
}

function createPromotedResult(input: {
  stage: WorkerGateStageName;
  reasonClass: WorkerGateReasonClass;
  evaluatedAt: string;
  basisHash: string;
  inputSnapshot: Readonly<Record<string, unknown>>;
  outputSnapshot: Readonly<Record<string, unknown>>;
  routeClass: Exclude<WorkerModelRouteClass, "no_model">;
}): WorkerGatePromotedResult {
  return {
    ...buildStageResultBase({
      stage: input.stage,
      disposition: "promoted",
      reasonClass: input.reasonClass,
      evaluatedAt: input.evaluatedAt,
      basisHash: input.basisHash,
      input: input.inputSnapshot,
      output: input.outputSnapshot,
      blocked: false,
      terminal: false,
      suppressed: false,
      promoted: true,
      routeClass: input.routeClass,
    }),
    disposition: "promoted",
    routeClass: input.routeClass,
  };
}

function createNoModelResult(input: {
  stage: WorkerGateStageName;
  reasonClass: WorkerGateReasonClass;
  evaluatedAt: string;
  basisHash: string;
  inputSnapshot: Readonly<Record<string, unknown>>;
  outputSnapshot: Readonly<Record<string, unknown>>;
}): WorkerGateNoModelResult {
  return {
    ...buildStageResultBase({
      stage: input.stage,
      disposition: "no_model",
      reasonClass: input.reasonClass,
      evaluatedAt: input.evaluatedAt,
      basisHash: input.basisHash,
      input: input.inputSnapshot,
      output: input.outputSnapshot,
      blocked: false,
      terminal: false,
      suppressed: false,
      promoted: false,
      routeClass: "no_model",
    }),
    disposition: "no_model",
    routeClass: "no_model",
  };
}

function familySpecificIntegrityCheck(event: WorkerEventEnvelope): {
  ok: boolean;
  details: Readonly<Record<string, unknown>>;
} {
  if (event.family === "lowcap") {
    const feature = event.featureSnapshot;
    const toxic = feature.walletQualityState === "toxic" || feature.liquidityState === "trap_risk";
    const scoreOk = feature.integrityScore >= 0.4 && feature.freshnessScore >= 0.15;
    return {
      ok: scoreOk && !toxic,
      details: {
        family: "lowcap",
        integrityScore: feature.integrityScore,
        freshnessScore: feature.freshnessScore,
        walletQualityState: feature.walletQualityState,
        liquidityState: feature.liquidityState,
        toxic,
      },
    };
  }

  const feature = event.featureSnapshot;
  const toxic = feature.walletQualityState === "toxic" || feature.liquidityState === "trap_risk";
  const scoreOk = feature.integrityScore >= 0.4 && feature.freshnessScore >= 0.15;
  return {
    ok: scoreOk && !toxic,
    details: {
      family: "shadow",
      integrityScore: feature.integrityScore,
      freshnessScore: feature.freshnessScore,
      distributionState: feature.distributionState,
      walletQualityState: feature.walletQualityState,
      liquidityState: feature.liquidityState,
      toxic,
    },
  };
}

function convergenceAssessment(event: WorkerEventEnvelope): {
  relevant: boolean;
  kind: WorkerSuppressionKind;
  reasonClass: WorkerGateReasonClass;
  details: Readonly<Record<string, unknown>>;
} {
  if (event.family === "lowcap") {
    const feature = event.featureSnapshot;
    const score = Math.max(
      event.confidence,
      feature.convergenceScore,
      feature.integrityScore,
      feature.freshnessScore,
      feature.trustedSignalCount > 0 ? 0.55 : 0
    );
    const threshold = event.promotionCandidate ? 0.35 : 0.45;
    if (score >= threshold && !event.suppressionCandidate) {
      return {
        relevant: true,
        kind: "low_relevance",
        reasonClass: "CONVERGENCE_PASS",
        details: {
          family: "lowcap",
          score,
          threshold,
          trustedSignalCount: feature.trustedSignalCount,
          convergenceScore: feature.convergenceScore,
          freshnessScore: feature.freshnessScore,
          promotionCandidate: event.promotionCandidate,
        },
      };
    }

    const kind: WorkerSuppressionKind =
      feature.freshnessScore < 0.25 ? "stale" : event.suppressionCandidate ? "denied" : "low_relevance";
    return {
      relevant: false,
      kind,
      reasonClass: "CONVERGENCE_BLOCK",
      details: {
        family: "lowcap",
        score,
        threshold,
        trustedSignalCount: feature.trustedSignalCount,
        convergenceScore: feature.convergenceScore,
        freshnessScore: feature.freshnessScore,
        noiseScore: feature.noiseScore,
        promotionCandidate: event.promotionCandidate,
        suppressionCandidate: event.suppressionCandidate,
      },
    };
  }

  const feature = event.featureSnapshot;
  const score = Math.max(
    event.confidence,
    feature.convergenceScore,
    feature.transitionConfidence,
    feature.severityScore,
    feature.freshnessScore
  );
  const threshold = event.promotionCandidate ? 0.32 : 0.42;
  if (score >= threshold && !event.suppressionCandidate && !feature.thesisConflict && !feature.riskSpike) {
    return {
      relevant: true,
      kind: "low_relevance",
      reasonClass: "CONVERGENCE_PASS",
      details: {
        family: "shadow",
        score,
        threshold,
        transitionConfidence: feature.transitionConfidence,
        severityScore: feature.severityScore,
        convergenceScore: feature.convergenceScore,
        freshnessScore: feature.freshnessScore,
        promotionCandidate: event.promotionCandidate,
      },
    };
  }

  const kind: WorkerSuppressionKind =
    feature.freshnessScore < 0.25 ? "stale" : feature.riskSpike || feature.thesisConflict ? "denied" : "low_relevance";
  return {
    relevant: false,
    kind,
    reasonClass: "CONVERGENCE_BLOCK",
    details: {
      family: "shadow",
      score,
      threshold,
      transitionConfidence: feature.transitionConfidence,
      severityScore: feature.severityScore,
      convergenceScore: feature.convergenceScore,
      freshnessScore: feature.freshnessScore,
      thesisConflict: feature.thesisConflict,
      riskSpike: feature.riskSpike,
      promotionCandidate: event.promotionCandidate,
      suppressionCandidate: event.suppressionCandidate,
    },
  };
}

function selectRouteClass(event: WorkerEventEnvelope): WorkerModelRouteClass {
  if (event.family === "lowcap") {
    const feature = event.featureSnapshot;
    const deepEligible =
      event.severity === "critical" ||
      event.confidence >= 0.9 ||
      feature.convergenceScore >= 0.8 ||
      (feature.integrityScore >= 0.85 && feature.freshnessScore >= 0.7);
    if (deepEligible) {
      return "eligible_deep_adjudication";
    }

    const smallEligible =
      event.promotionCandidate ||
      event.confidence >= 0.65 ||
      feature.convergenceScore >= 0.6 ||
      feature.trustedSignalCount >= 2;
    if (smallEligible) {
      return "eligible_small_adjudication";
    }

    return "no_model";
  }

  const feature = event.featureSnapshot;
  const deepEligible =
    event.severity === "critical" ||
    feature.riskSpike ||
    feature.transitionConfidence >= 0.8 ||
    feature.severityScore >= 0.85;
  if (deepEligible) {
    return "eligible_deep_adjudication";
  }

  const smallEligible =
    event.promotionCandidate ||
    event.confidence >= 0.6 ||
    feature.transitionConfidence >= 0.55 ||
    feature.convergenceScore >= 0.5;
  if (smallEligible) {
    return "eligible_small_adjudication";
  }

  return "no_model";
}

function selectWriteEffect(event: WorkerEventEnvelope, routeClass: WorkerModelRouteClass): WorkerWriteEffect {
  if (routeClass === "no_model") {
    return "no_write";
  }
  if (routeClass === "eligible_small_adjudication") {
    return event.family === "lowcap" ? "watchlist_update" : "derived_refresh_trigger";
  }
  return event.family === "lowcap" ? "review_queue_insert" : "case_update";
}

function writeEffectReasonClass(effect: WorkerWriteEffect): WorkerGateReasonClass {
  switch (effect) {
    case "watchlist_update":
      return "WRITE_WATCHLIST_UPDATE";
    case "case_update":
      return "WRITE_CASE_UPDATE";
    case "review_queue_insert":
      return "WRITE_REVIEW_QUEUE_INSERT";
    case "derived_refresh_trigger":
      return "WRITE_DERIVED_REFRESH_TRIGGER";
    case "no_write":
      return "WRITE_NO_WRITE";
    default:
      return "WRITE_NO_WRITE";
  }
}

function buildRoutingDecision(input: {
  routeClass: WorkerModelRouteClass;
  basisHash: string;
  evaluatedAt: string;
  details: Readonly<Record<string, unknown>>;
}): WorkerModelRoutingDecision {
  const reasonClass =
    input.routeClass === "no_model"
      ? "MODEL_NO_PROMOTION"
      : input.routeClass === "eligible_small_adjudication"
        ? "MODEL_ELIGIBLE_SMALL"
        : "MODEL_ELIGIBLE_DEEP";
  return {
    routeClass: input.routeClass,
    reasonClass,
    basisHash: input.basisHash,
    evaluatedAt: input.evaluatedAt,
    advisoryOnly: true,
    details: input.details,
  };
}

function buildModelResultPlaceholder(input: {
  event: WorkerEventEnvelope;
  evaluatedAt: string;
  basisHash: string;
  routeClass: WorkerModelRouteClass;
  routing: WorkerModelRoutingDecision;
}): WorkerModelResultPlaceholder {
  return {
    modelName: "none",
    routeClass: input.routeClass,
    reasonClass: input.routing.reasonClass,
    basisHash: hashDecision({
      traceId: input.event.traceId,
      stage: "model_result_placeholder",
      basisHash: input.basisHash,
      routeClass: input.routeClass,
    }),
    evaluatedAt: input.evaluatedAt,
    called: false,
    details: {
      advisoryOnly: true,
      routeClass: input.routeClass,
      called: false,
      modelName: "none",
    },
  };
}

function buildWriteEffectDecision(input: {
  event: WorkerEventEnvelope;
  evaluatedAt: string;
  basisHash: string;
  routeClass: WorkerModelRouteClass;
  effect: WorkerWriteEffect;
}): WorkerWriteEffectDecision {
  return {
    effect: input.effect,
    reasonClass: writeEffectReasonClass(input.effect),
    basisHash: input.basisHash,
    evaluatedAt: input.evaluatedAt,
    advisoryOnly: true,
    target:
      input.effect === "watchlist_update"
        ? "watchlist"
        : input.effect === "case_update"
          ? "case"
          : input.effect === "review_queue_insert"
            ? "review_queue"
            : input.effect === "derived_refresh_trigger"
              ? "derived_refresh"
              : "none",
    details: {
      advisoryOnly: true,
      routeClass: input.routeClass,
      effect: input.effect,
      family: input.event.family,
    },
  };
}

function evaluateValidity(
  event: WorkerEventEnvelope,
  normalization: WorkerEventNormalization
): WorkerGatePassResult | WorkerGateFailResult {
  const observedMs = parseIsoMs(event.observedAt);
  const windowStartMs = parseIsoMs(event.windowStart);
  const windowEndMs = parseIsoMs(event.windowEnd);
  const validWindow = isWithinWindow(event.observedAt, event.windowStart, event.windowEnd);
  const expectedPrefix = `${event.family}.`;
  const prefixOk = event.eventType.startsWith(expectedPrefix);
  const familyOk = isKnownWorkerEventFamily(event.family);
  const timeOk =
    Number.isFinite(observedMs) &&
    Number.isFinite(windowStartMs) &&
    Number.isFinite(windowEndMs) &&
    windowStartMs <= windowEndMs;
  const basisHash = hashDecision({
    stage: "validity",
    traceId: event.traceId,
    eventId: event.eventId,
    observedAt: event.observedAt,
    windowStart: event.windowStart,
    windowEnd: event.windowEnd,
    timeBucket: normalization.timeBucket,
    family: event.family,
    eventType: event.eventType,
  });
  const inputSnapshot = {
    eventId: event.eventId,
    observedAt: event.observedAt,
    windowStart: event.windowStart,
    windowEnd: event.windowEnd,
    expectedPrefix,
    familyOk,
    prefixOk,
    timeOk,
  };
  const outputSnapshot = {
    valid: familyOk && prefixOk && timeOk && validWindow,
    timeBucket: normalization.timeBucket,
    normalizedEvidenceRefs: normalization.normalizedEvidenceRefs,
    normalizedEntityId: normalization.normalizedEntityId,
    normalizedEntityKey: normalization.normalizedEntityKey,
  };

  if (!familyOk || !prefixOk || !timeOk || !validWindow) {
    const suppression = createSuppressionRecord({
      stage: "validity",
      kind: "invalid",
      reasonClass: "VALIDITY_BLOCK",
      basisHash,
      evidenceSignature: normalization.evidenceSignature,
      key: event.eventId,
      details: {
        familyOk,
        prefixOk,
        timeOk,
        validWindow,
        observedAt: event.observedAt,
        windowStart: event.windowStart,
        windowEnd: event.windowEnd,
      },
    });
    return createFailResult({
      stage: "validity",
      reasonClass: "VALIDITY_BLOCK",
      evaluatedAt: event.observedAt,
      basisHash,
      inputSnapshot,
      outputSnapshot,
      suppression,
    });
  }

  return createPassResult({
    stage: "validity",
    reasonClass: "VALIDITY_PASS",
    evaluatedAt: event.observedAt,
    basisHash,
    inputSnapshot,
    outputSnapshot,
  });
}

function evaluateIntegrity(
  event: WorkerEventEnvelope,
  normalization: WorkerEventNormalization
): WorkerGatePassResult | WorkerGateFailResult {
  const assessment = familySpecificIntegrityCheck(event);
  const basisHash = hashDecision({
    stage: "integrity",
    traceId: event.traceId,
    basisHash: normalization.basisHash,
    integrityScore: event.featureSnapshot.integrityScore,
    freshnessScore: event.featureSnapshot.freshnessScore,
    family: event.family,
  });
  const inputSnapshot = {
    family: event.family,
    integrityScore: event.featureSnapshot.integrityScore,
    freshnessScore: event.featureSnapshot.freshnessScore,
    assessedAt: event.observedAt,
  };
  const outputSnapshot = {
    integrityOk: assessment.ok,
    details: assessment.details,
  };

  if (!assessment.ok) {
    const suppression = createSuppressionRecord({
      stage: "integrity",
      kind: "integrity",
      reasonClass: "INTEGRITY_BLOCK",
      basisHash,
      evidenceSignature: normalization.evidenceSignature,
      key: event.eventId,
      details: assessment.details,
    });
    return createFailResult({
      stage: "integrity",
      reasonClass: "INTEGRITY_BLOCK",
      evaluatedAt: event.observedAt,
      basisHash,
      inputSnapshot,
      outputSnapshot,
      suppression,
    });
  }

  return createPassResult({
    stage: "integrity",
    reasonClass: "INTEGRITY_PASS",
    evaluatedAt: event.observedAt,
    basisHash,
    inputSnapshot,
    outputSnapshot,
  });
}

function evaluateConvergenceRelevance(
  event: WorkerEventEnvelope,
  normalization: WorkerEventNormalization
): WorkerGatePassResult | WorkerGateSuppressedResult {
  const assessment = convergenceAssessment(event);
  const basisHash = hashDecision({
    stage: "convergence_relevance",
    traceId: event.traceId,
    basisHash: normalization.basisHash,
    family: event.family,
    confidence: event.confidence,
    suppressionCandidate: event.suppressionCandidate,
    promotionCandidate: event.promotionCandidate,
  });
  const inputSnapshot = {
    family: event.family,
    confidence: event.confidence,
    promotionCandidate: event.promotionCandidate,
    suppressionCandidate: event.suppressionCandidate,
    featureScores:
      event.family === "lowcap"
        ? {
            convergenceScore: event.featureSnapshot.convergenceScore,
            freshnessScore: event.featureSnapshot.freshnessScore,
            noiseScore: event.featureSnapshot.noiseScore,
            trustedSignalCount: event.featureSnapshot.trustedSignalCount,
          }
        : {
            convergenceScore: event.featureSnapshot.convergenceScore,
            freshnessScore: event.featureSnapshot.freshnessScore,
            severityScore: event.featureSnapshot.severityScore,
            transitionConfidence: event.featureSnapshot.transitionConfidence,
            thesisConflict: event.featureSnapshot.thesisConflict,
            riskSpike: event.featureSnapshot.riskSpike,
          },
  };
  const outputSnapshot = {
    relevant: assessment.relevant,
    score:
      event.family === "lowcap"
        ? Math.max(
            event.confidence,
            event.featureSnapshot.convergenceScore,
            event.featureSnapshot.integrityScore,
            event.featureSnapshot.freshnessScore,
            event.featureSnapshot.trustedSignalCount > 0 ? 0.55 : 0
          )
        : Math.max(
            event.confidence,
            event.featureSnapshot.convergenceScore,
            event.featureSnapshot.transitionConfidence,
            event.featureSnapshot.severityScore,
            event.featureSnapshot.freshnessScore
          ),
    threshold: event.family === "lowcap" ? (event.promotionCandidate ? 0.35 : 0.45) : event.promotionCandidate ? 0.32 : 0.42,
  };

  if (!assessment.relevant) {
    const suppression = createSuppressionRecord({
      stage: "convergence_relevance",
      kind: assessment.kind,
      reasonClass: assessment.reasonClass,
      basisHash,
      evidenceSignature: normalization.evidenceSignature,
      key: event.eventId,
      details: assessment.details,
    });
    return createSuppressedResult({
      stage: "convergence_relevance",
      reasonClass: assessment.reasonClass,
      evaluatedAt: event.observedAt,
      basisHash,
      inputSnapshot,
      outputSnapshot,
      suppression,
    });
  }

  return createPassResult({
    stage: "convergence_relevance",
    reasonClass: "CONVERGENCE_PASS",
    evaluatedAt: event.observedAt,
    basisHash,
    inputSnapshot,
    outputSnapshot,
  });
}

function evaluateDedupe(
  event: WorkerEventEnvelope,
  normalization: WorkerEventNormalization,
  state: WorkerEventGateState
): { result: WorkerGatePassResult | WorkerGateSuppressedResult; nextState: WorkerEventGateState } {
  const dedupeWindow = dedupeWindowMs(event);
  const timeBucket = normalization.timeBucket;
  const dedupeKey = `${buildDedupeKey(event, timeBucket)}:${normalization.normalizedEntityKey}`;
  const observedMs = parseIsoMs(event.observedAt);
  const activeRecord = state.dedupeRecords.find(
    (record) =>
      record.key === dedupeKey &&
      record.basisHash === normalization.basisHash &&
      parseIsoMs(record.expiresAt) > observedMs
  );
  const basisHash = hashDecision({
    stage: "dedupe",
    traceId: event.traceId,
    basisHash: normalization.basisHash,
    dedupeKey,
    timeBucket,
    entityKey: normalization.normalizedEntityKey,
  });
  const inputSnapshot = {
    dedupeKey,
    timeBucket,
    dedupeWindowMs: dedupeWindow,
    basisHash: normalization.basisHash,
    entityKey: normalization.normalizedEntityKey,
  };

  if (activeRecord) {
    const suppression = createSuppressionRecord({
      stage: "dedupe",
      kind: "dedupe",
      reasonClass: "DEDUPE_SUPPRESSED",
      basisHash,
      evidenceSignature: normalization.evidenceSignature,
      key: dedupeKey,
      expiresAt: activeRecord.expiresAt,
      details: {
        matchedEventId: activeRecord.eventId,
        expiresAt: activeRecord.expiresAt,
        key: dedupeKey,
      },
    });
    return {
      result: createSuppressedResult({
        stage: "dedupe",
        reasonClass: "DEDUPE_SUPPRESSED",
        evaluatedAt: event.observedAt,
        basisHash,
        inputSnapshot,
        outputSnapshot: {
          dedupeKey,
          suppressed: true,
          matchedEventId: activeRecord.eventId,
          expiresAt: activeRecord.expiresAt,
        },
        suppression,
      }),
      nextState: state,
    };
  }

  const expiresAt = addMilliseconds(event.observedAt, dedupeWindow);
  const record: WorkerEventGateStateRecord = {
    key: dedupeKey,
    eventId: event.eventId,
    family: event.family,
    eventType: event.eventType,
    observedAt: event.observedAt,
    expiresAt,
    severity: event.severity,
    confidence: event.confidence,
    evidenceSignature: normalization.evidenceSignature,
    basisHash: normalization.basisHash,
  };
  const nextState = cloneState(state);
  nextState.dedupeRecords = [...nextState.dedupeRecords, record];
  nextState.lastEvaluatedAt = event.observedAt;

  return {
    result: createPassResult({
      stage: "dedupe",
      reasonClass: "DEDUPE_PASS",
      evaluatedAt: event.observedAt,
      basisHash,
      inputSnapshot,
      outputSnapshot: {
        dedupeKey,
        suppressed: false,
        expiresAt,
      },
      key: dedupeKey,
      windowMs: dedupeWindow,
      expiresAt,
    }),
    nextState,
  };
}

function evaluateCooldown(
  event: WorkerEventEnvelope,
  normalization: WorkerEventNormalization,
  state: WorkerEventGateState
): { result: WorkerGatePassResult | WorkerGateSuppressedResult; nextState: WorkerEventGateState } {
  const cooldownClass =
    event.family === "lowcap" ? lowcapPromotionClass(event) : shadowTransitionClass(event);
  const cooldownWindow = cooldownWindowMs(event, cooldownClass);
  const cooldownKey = `${buildCooldownKey(event, cooldownClass)}:${normalization.normalizedEntityKey}`;
  const observedMs = parseIsoMs(event.observedAt);
  const activeRecord = state.cooldownRecords.find(
    (record) => record.key === cooldownKey && parseIsoMs(record.expiresAt) > observedMs
  );
  const basisHash = hashDecision({
    stage: "cooldown",
    traceId: event.traceId,
    basisHash: normalization.basisHash,
    cooldownKey,
    cooldownClass,
  });
  const inputSnapshot = {
    cooldownClass,
    cooldownKey,
    cooldownWindowMs: cooldownWindow,
    basisHash: normalization.basisHash,
    entityKey: normalization.normalizedEntityKey,
  };

  if (activeRecord) {
    const suppression = createSuppressionRecord({
      stage: "cooldown",
      kind: "cooldown",
      reasonClass: "COOLDOWN_SUPPRESSED",
      basisHash,
      evidenceSignature: normalization.evidenceSignature,
      key: cooldownKey,
      expiresAt: activeRecord.expiresAt,
      details: {
        matchedEventId: activeRecord.eventId,
        expiresAt: activeRecord.expiresAt,
        cooldownClass,
      },
    });
    return {
      result: createSuppressedResult({
        stage: "cooldown",
        reasonClass: "COOLDOWN_SUPPRESSED",
        evaluatedAt: event.observedAt,
        basisHash,
        inputSnapshot,
        outputSnapshot: {
          cooldownKey,
          suppressed: true,
          matchedEventId: activeRecord.eventId,
          expiresAt: activeRecord.expiresAt,
        },
        suppression,
      }),
      nextState: state,
    };
  }

  const expiresAt = addMilliseconds(event.observedAt, cooldownWindow);
  const record: WorkerEventGateCooldownRecord = {
    key: cooldownKey,
    eventId: event.eventId,
    family: event.family,
    eventType: event.eventType,
    observedAt: event.observedAt,
    expiresAt,
    severity: event.severity,
    confidence: event.confidence,
    evidenceSignature: normalization.evidenceSignature,
    basisHash: normalization.basisHash,
    cooldownClass,
  };
  const nextState = cloneState(state);
  nextState.cooldownRecords = [...nextState.cooldownRecords, record];
  nextState.lastEvaluatedAt = event.observedAt;

  return {
    result: createPassResult({
      stage: "cooldown",
      reasonClass: "COOLDOWN_PASS",
      evaluatedAt: event.observedAt,
      basisHash,
      inputSnapshot,
      outputSnapshot: {
        cooldownKey,
        suppressed: false,
        expiresAt,
        cooldownClass,
      },
      key: cooldownKey,
      windowMs: cooldownWindow,
      expiresAt,
    }),
    nextState,
  };
}

function evaluateBatchDebounce(
  event: WorkerEventEnvelope,
  normalization: WorkerEventNormalization,
  state: WorkerEventGateState
): { result: WorkerGatePassResult | WorkerGateDeferredResult | WorkerGateBatchedResult; nextState: WorkerEventGateState } {
  const batchWindow = batchWindowMs(event);
  const batchBucket = stableTimeBucketLabel(event.observedAt, batchWindow);
  const batchGroup = normalizeIdentifierPart(event.featureSnapshot.batchGroupHint ?? normalization.normalizedEntityKey);
  const batchKey = `${buildBatchKey(event, batchBucket)}:${batchGroup}`;
  const observedMs = parseIsoMs(event.observedAt);
  const pendingRecord = state.batchRecords.find((record) => record.key === batchKey && record.status === "pending");
  const batchable =
    event.suppressionCandidate ||
    event.confidence < (event.family === "lowcap" ? 0.8 : 0.75) ||
    event.featureSnapshot.batchGroupHint != null;
  const basisHash = hashDecision({
    stage: "batch_debounce",
    traceId: event.traceId,
    basisHash: normalization.basisHash,
    batchKey,
    batchGroup,
  });
  const inputSnapshot = {
    batchKey,
    batchBucket,
    batchGroup,
    batchWindowMs: batchWindow,
    batchable,
  };

  if (pendingRecord) {
    const pendingReleaseMs = parseIsoMs(pendingRecord.releaseAt);
    const nextState = cloneState(state);
    const recordIndex = nextState.batchRecords.findIndex((record) => record.key === batchKey && record.status === "pending");
    const updatedRecord = {
      ...pendingRecord,
      eventIds: sortEventIds([...pendingRecord.eventIds, event.eventId]),
      eventTypes: sortStrings([...pendingRecord.eventTypes, event.eventType]),
      lastObservedAt: event.observedAt,
      count: pendingRecord.count + 1,
      status: observedMs >= pendingReleaseMs ? ("released" as const) : ("pending" as const),
    };
    nextState.batchRecords[recordIndex] = updatedRecord;
    nextState.lastEvaluatedAt = event.observedAt;

    if (observedMs < pendingReleaseMs) {
      const suppression = createSuppressionRecord({
        stage: "batch_debounce",
        kind: "defer",
        reasonClass: "BATCH_GROUPED",
        basisHash,
        evidenceSignature: normalization.evidenceSignature,
        key: batchKey,
        releaseAt: pendingRecord.releaseAt,
        details: {
          batchKey,
          releaseAt: pendingRecord.releaseAt,
          pendingEventId: pendingRecord.eventIds[0],
          status: "batched",
        },
      });
      return {
        result: createBatchedResult({
          stage: "batch_debounce",
          reasonClass: "BATCH_GROUPED",
          evaluatedAt: event.observedAt,
          basisHash,
          inputSnapshot,
          outputSnapshot: {
            batchKey,
            batched: true,
            pendingEventId: pendingRecord.eventIds[0],
            releaseAt: pendingRecord.releaseAt,
          },
          suppression,
          releaseAt: pendingRecord.releaseAt,
          key: batchKey,
          windowMs: batchWindow,
        }),
        nextState,
      };
    }

    return {
      result: createPassResult({
        stage: "batch_debounce",
        reasonClass: "BATCH_PASS",
        evaluatedAt: event.observedAt,
        basisHash,
        inputSnapshot,
        outputSnapshot: {
          batchKey,
          batched: false,
          released: true,
          releaseAt: pendingRecord.releaseAt,
        },
        key: batchKey,
        windowMs: batchWindow,
        releaseAt: pendingRecord.releaseAt,
      }),
      nextState,
    };
  }

  if (!batchable) {
    return {
      result: createPassResult({
        stage: "batch_debounce",
        reasonClass: "BATCH_PASS",
        evaluatedAt: event.observedAt,
        basisHash,
        inputSnapshot,
        outputSnapshot: {
          batchKey,
          batched: false,
          released: false,
          batchable: false,
        },
        key: batchKey,
        windowMs: batchWindow,
      }),
      nextState: state,
    };
  }

  const releaseAt = addMilliseconds(event.observedAt, batchWindow);
  const record: WorkerEventGateBatchRecord = {
    key: batchKey,
    family: event.family,
    eventIds: [event.eventId],
    eventTypes: [event.eventType],
    firstObservedAt: event.observedAt,
    lastObservedAt: event.observedAt,
    releaseAt,
    windowMs: batchWindow,
    count: 1,
    status: "pending",
  };
  const nextState = cloneState(state);
  nextState.batchRecords = [...nextState.batchRecords, record];
  nextState.lastEvaluatedAt = event.observedAt;
  const suppression = createSuppressionRecord({
    stage: "batch_debounce",
    kind: "defer",
    reasonClass: "BATCH_DEFERRED",
    basisHash,
    evidenceSignature: normalization.evidenceSignature,
    key: batchKey,
    releaseAt,
    details: {
      batchKey,
      releaseAt,
      status: "deferred",
      batchable,
    },
  });

  return {
    result: createDeferredResult({
      stage: "batch_debounce",
      reasonClass: "BATCH_DEFERRED",
      evaluatedAt: event.observedAt,
      basisHash,
      inputSnapshot,
      outputSnapshot: {
        batchKey,
        deferred: true,
        releaseAt,
        batchable,
      },
      suppression,
      releaseAt,
      key: batchKey,
      windowMs: batchWindow,
    }),
    nextState,
  };
}

function evaluateModelPromotion(
  event: WorkerEventEnvelope,
  normalization: WorkerEventNormalization
): WorkerGatePromotedResult | WorkerGateNoModelResult {
  const routeClass = selectRouteClass(event);
  const reasonClass =
    routeClass === "no_model"
      ? "MODEL_NO_PROMOTION"
      : routeClass === "eligible_small_adjudication"
        ? "MODEL_ELIGIBLE_SMALL"
        : "MODEL_ELIGIBLE_DEEP";
  const basisHash = hashDecision({
    stage: "model_promotion",
    traceId: event.traceId,
    basisHash: normalization.basisHash,
    routeClass,
    family: event.family,
    confidence: event.confidence,
  });
  const inputSnapshot = {
    family: event.family,
    confidence: event.confidence,
    severity: event.severity,
    promotionCandidate: event.promotionCandidate,
    routeBasis:
      event.family === "lowcap"
        ? {
            promotionClass: lowcapPromotionClass(event),
            convergenceScore: event.featureSnapshot.convergenceScore,
            integrityScore: event.featureSnapshot.integrityScore,
            trustedSignalCount: event.featureSnapshot.trustedSignalCount,
          }
        : {
            transitionClass: shadowTransitionClass(event),
            convergenceScore: event.featureSnapshot.convergenceScore,
            integrityScore: event.featureSnapshot.integrityScore,
            transitionConfidence: event.featureSnapshot.transitionConfidence,
          },
  };
  const outputSnapshot = {
    routeClass,
    reasonClass,
  };

  if (routeClass === "no_model") {
    return createNoModelResult({
      stage: "model_promotion",
      reasonClass,
      evaluatedAt: event.observedAt,
      basisHash,
      inputSnapshot,
      outputSnapshot,
    });
  }

  return createPromotedResult({
    stage: "model_promotion",
    reasonClass,
    evaluatedAt: event.observedAt,
    basisHash,
    inputSnapshot,
    outputSnapshot,
    routeClass,
  });
}

function evaluatePostModelRouting(
  event: WorkerEventEnvelope,
  normalization: WorkerEventNormalization,
  routeClass: WorkerModelRouteClass
): {
  result: WorkerGatePassResult;
  routing: WorkerModelRoutingDecision;
  modelResult: WorkerModelResultPlaceholder;
  writeEffect: WorkerWriteEffectDecision;
} {
  const basisHash = hashDecision({
    stage: "post_model_routing",
    traceId: event.traceId,
    basisHash: normalization.basisHash,
    routeClass,
    family: event.family,
  });
  const routing = buildRoutingDecision({
    routeClass,
    basisHash,
    evaluatedAt: event.observedAt,
    details: {
      advisoryOnly: true,
      routeClass,
      family: event.family,
      promotionCandidate: event.promotionCandidate,
      confidence: event.confidence,
    },
  });
  const modelResult = buildModelResultPlaceholder({
    event,
    evaluatedAt: event.observedAt,
    basisHash,
    routeClass,
    routing,
  });
  const effect = selectWriteEffect(event, routeClass);
  const writeEffect = buildWriteEffectDecision({
    event,
    evaluatedAt: event.observedAt,
    basisHash: hashDecision({
      stage: "write_effect",
      traceId: event.traceId,
      basisHash: normalization.basisHash,
      routeClass,
      effect,
    }),
    routeClass,
    effect,
  });
  const inputSnapshot = { routeClass, modelResult, routing };
  const outputSnapshot = { effect, target: writeEffect.target, routeClass };

  return {
    result: createPassResult({
      stage: "post_model_routing",
      reasonClass: writeEffect.reasonClass,
      evaluatedAt: event.observedAt,
      basisHash,
      inputSnapshot,
      outputSnapshot,
      routeClass,
      writeEffect: effect,
      promoted: routeClass !== "no_model",
    }),
    routing,
    modelResult,
    writeEffect,
  };
}

export function evaluateWorkerEventGate(input: WorkerEventGateEvaluationInput): WorkerEventGateEvaluationResult {
  const event = input.event;
  const stateBefore = ensureValidState(input.state);
  const normalization = buildWorkerEventNormalization(event, dedupeWindowMs(event));
  let stateAfter = cloneState(stateBefore);
  const stageResults: WorkerGateStageResult[] = [];
  let blocked = false;
  let blockingStage: WorkerGateStageName | undefined;
  let suppression: WorkerSuppressionRecord | undefined;
  let routeClass: WorkerModelRouteClass = "no_model";

  for (const stage of WORKER_GATE_STAGE_ORDER) {
    if (blocked) {
      stageResults.push(createSkippedResult(stage, blockingStage ?? "validity", event.observedAt));
      continue;
    }

    switch (stage) {
      case "validity": {
        const result = evaluateValidity(event, normalization);
        stageResults.push(result);
        if (result.blocked) {
          blocked = true;
          blockingStage = stage;
          suppression = result.suppression;
        }
        break;
      }
      case "integrity": {
        const result = evaluateIntegrity(event, normalization);
        stageResults.push(result);
        if (result.blocked) {
          blocked = true;
          blockingStage = stage;
          suppression = result.suppression;
        }
        break;
      }
      case "convergence_relevance": {
        const result = evaluateConvergenceRelevance(event, normalization);
        stageResults.push(result);
        if (result.blocked) {
          blocked = true;
          blockingStage = stage;
          suppression = result.suppression;
        }
        break;
      }
      case "dedupe": {
        const outcome = evaluateDedupe(event, normalization, stateAfter);
        stageResults.push(outcome.result);
        stateAfter = outcome.nextState;
        if (outcome.result.blocked) {
          blocked = true;
          blockingStage = stage;
          suppression = outcome.result.suppression;
        }
        break;
      }
      case "cooldown": {
        const outcome = evaluateCooldown(event, normalization, stateAfter);
        stageResults.push(outcome.result);
        stateAfter = outcome.nextState;
        if (outcome.result.blocked) {
          blocked = true;
          blockingStage = stage;
          suppression = outcome.result.suppression;
        }
        break;
      }
      case "batch_debounce": {
        const outcome = evaluateBatchDebounce(event, normalization, stateAfter);
        stageResults.push(outcome.result);
        stateAfter = outcome.nextState;
        if (outcome.result.blocked) {
          blocked = true;
          blockingStage = stage;
          suppression = outcome.result.suppression;
        }
        break;
      }
      case "model_promotion": {
        const result = evaluateModelPromotion(event, normalization);
        stageResults.push(result);
        routeClass = result.routeClass;
        break;
      }
      case "post_model_routing": {
        const outcome = evaluatePostModelRouting(event, normalization, routeClass);
        stageResults.push(outcome.result);
        routeClass = outcome.routing.routeClass;
        stateAfter.lastEvaluatedAt = event.observedAt;
        break;
      }
      default: {
        const exhaustiveCheck: never = stage;
        throw new Error(`UNHANDLED_WORKER_GATE_STAGE:${String(exhaustiveCheck)}`);
      }
    }
  }

  const routing = blocked
    ? buildRoutingDecision({
        routeClass: "no_model",
        basisHash: hashDecision({
          stage: "post_model_routing",
          traceId: event.traceId,
          basisHash: normalization.basisHash,
          routeClass: "no_model",
          family: event.family,
        }),
        evaluatedAt: event.observedAt,
        details: {
          advisoryOnly: true,
          routeClass: "no_model",
          blocked: true,
          blockingStage,
          family: event.family,
        },
      })
    : buildRoutingDecision({
        routeClass,
        basisHash: hashDecision({
          stage: "post_model_routing",
          traceId: event.traceId,
          basisHash: normalization.basisHash,
          routeClass,
          family: event.family,
        }),
        evaluatedAt: event.observedAt,
        details: {
          advisoryOnly: true,
          routeClass,
          family: event.family,
          confidence: event.confidence,
          promotionCandidate: event.promotionCandidate,
        },
      });

  const modelResult = buildModelResultPlaceholder({
    event,
    evaluatedAt: event.observedAt,
    basisHash: normalization.basisHash,
    routeClass: routing.routeClass,
    routing,
  });
  const writeEffect = buildWriteEffectDecision({
    event,
    evaluatedAt: event.observedAt,
    basisHash: hashDecision({
      stage: "write_effect",
      traceId: event.traceId,
      basisHash: normalization.basisHash,
      routeClass: routing.routeClass,
      effect: selectWriteEffect(event, routing.routeClass),
    }),
    routeClass: routing.routeClass,
    effect: selectWriteEffect(event, routing.routeClass),
  });

  if (blocked) {
    stateAfter.lastEvaluatedAt = event.observedAt;
  }

  const terminalStage: WorkerGateStageName = blocked ? (blockingStage ?? "validity") : "post_model_routing";
  const evaluationHash = hashResult({
    schemaVersion: WORKER_EVENT_GATE_EVALUATION_SCHEMA_VERSION,
    traceId: event.traceId,
    eventId: event.eventId,
    blocked,
    blockingStage,
    terminalStage,
    routeClass: routing.routeClass,
    writeEffect: writeEffect.effect,
    normalization,
    stateAfter,
    stageResults: stageResults.map((stageResult) => ({
      stage: stageResult.stage,
      disposition: stageResult.disposition,
      reasonClass: stageResult.reasonClass,
      blocked: stageResult.blocked,
      terminal: stageResult.terminal,
      key: stageResult.key,
      routeClass: stageResult.routeClass,
      writeEffect: stageResult.writeEffect,
      skippedBecause: stageResult.skippedBecause,
    })),
  });
  const replayKey = hashDecision({
    traceId: event.traceId,
    eventId: event.eventId,
    basisHash: normalization.basisHash,
    terminalStage,
    routeClass: routing.routeClass,
    writeEffect: writeEffect.effect,
  });

  return {
    schemaVersion: WORKER_EVENT_GATE_EVALUATION_SCHEMA_VERSION,
    traceId: event.traceId,
    event,
    normalization,
    stateBefore,
    stateAfter,
    stages: stageResults,
    blocked,
    blockingStage,
    terminalStage,
    suppression,
    routing,
    modelResult,
    writeEffect,
    evaluationHash,
    replayKey,
  };
}

export function createWorkerEventGateEvaluationState(): WorkerEventGateState {
  return createWorkerEventGateState();
}

export function normalizeWorkerEventGateEvent(event: WorkerEventEnvelope): WorkerEventNormalization {
  return buildWorkerEventNormalization(event, dedupeWindowMs(event));
}

export function workerEventGateStageOrder(): readonly WorkerGateStageName[] {
  return WORKER_GATE_STAGE_ORDER;
}
