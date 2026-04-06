import { z } from "zod";
import { canonicalize } from "../../core/determinism/canonicalize.js";
import { hashDecision } from "../../core/determinism/hash.js";

export const WORKER_EVENT_GATE_SCHEMA_VERSION = "worker.event.gate.v1" as const;
export const WORKER_EVENT_GATE_STATE_SCHEMA_VERSION = "worker.event.gate.state.v1" as const;

export const WorkerEventFamilySchema = z.enum(["lowcap", "shadow"]);
export type WorkerEventFamily = z.infer<typeof WorkerEventFamilySchema>;

export const WorkerEventSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export type WorkerEventSeverity = z.infer<typeof WorkerEventSeveritySchema>;

export const WorkerEventKnowledgeModeSchema = z.enum([
  "observed",
  "inferred",
  "learned",
  "operational",
]);
export type WorkerEventKnowledgeMode = z.infer<typeof WorkerEventKnowledgeModeSchema>;

export const WorkerEventSourceScopeSchema = z.enum(["internal", "external", "mixed"]);
export type WorkerEventSourceScope = z.infer<typeof WorkerEventSourceScopeSchema>;

export const WorkerGateStageNameSchema = z.enum([
  "validity",
  "integrity",
  "convergence_relevance",
  "dedupe",
  "cooldown",
  "batch_debounce",
  "model_promotion",
  "post_model_routing",
]);
export type WorkerGateStageName = z.infer<typeof WorkerGateStageNameSchema>;

export const WorkerGateDispositionSchema = z.enum([
  "pass",
  "fail",
  "suppressed",
  "deferred",
  "batched",
  "promoted",
  "no_model",
  "skipped",
]);
export type WorkerGateDisposition = z.infer<typeof WorkerGateDispositionSchema>;

export const WorkerGateReasonClassSchema = z.enum([
  "VALIDITY_PASS",
  "VALIDITY_BLOCK",
  "INTEGRITY_PASS",
  "INTEGRITY_BLOCK",
  "CONVERGENCE_PASS",
  "CONVERGENCE_BLOCK",
  "DEDUPE_PASS",
  "DEDUPE_SUPPRESSED",
  "COOLDOWN_PASS",
  "COOLDOWN_SUPPRESSED",
  "BATCH_PASS",
  "BATCH_DEFERRED",
  "BATCH_GROUPED",
  "MODEL_NO_PROMOTION",
  "MODEL_ELIGIBLE_SMALL",
  "MODEL_ELIGIBLE_DEEP",
  "ROUTING_NO_MODEL",
  "ROUTING_SMALL",
  "ROUTING_DEEP",
  "WRITE_NO_WRITE",
  "WRITE_WATCHLIST_UPDATE",
  "WRITE_CASE_UPDATE",
  "WRITE_REVIEW_QUEUE_INSERT",
  "WRITE_DERIVED_REFRESH_TRIGGER",
]);
export type WorkerGateReasonClass = z.infer<typeof WorkerGateReasonClassSchema>;

export const WorkerSuppressionKindSchema = z.enum([
  "invalid",
  "dedupe",
  "cooldown",
  "integrity",
  "low_relevance",
  "stale",
  "denied",
  "defer",
]);
export type WorkerSuppressionKind = z.infer<typeof WorkerSuppressionKindSchema>;

export const WorkerModelRouteClassSchema = z.enum([
  "no_model",
  "eligible_small_adjudication",
  "eligible_deep_adjudication",
]);
export type WorkerModelRouteClass = z.infer<typeof WorkerModelRouteClassSchema>;

export const WorkerWriteEffectSchema = z.enum([
  "watchlist_update",
  "case_update",
  "review_queue_insert",
  "derived_refresh_trigger",
  "no_write",
]);
export type WorkerWriteEffect = z.infer<typeof WorkerWriteEffectSchema>;

export const LowCapVenueSchema = z.enum(["pump.fun", "bags.fm", "bagsapp", "other"]);
export const LowCapBondingStateSchema = z.enum([
  "pre_bonding",
  "very_early_bonding",
  "bonding",
  "bonded",
  "unknown",
]);
export const LowCapWalletQualityStateSchema = z.enum(["clean", "mixed", "toxic", "unknown"]);
export const LowCapStructureStateSchema = z.enum([
  "early",
  "base_forming",
  "reclaimed",
  "vertical_only",
  "broken",
  "unknown",
]);
export const LowCapLiquidityStateSchema = z.enum([
  "healthy",
  "fragile",
  "trap_risk",
  "unknown",
]);

export const ShadowCurrentStateSchema = z.enum([
  "watching",
  "stable",
  "notable_change",
  "transition_detected",
  "transition_confirmed",
  "invalidated",
]);
export const ShadowTransitionTypeSchema = z.enum([
  "trend_reversal",
  "base_reclaim",
  "second_leg_reacceleration",
  "breakout_from_consolidation",
  "wallet_quality_shift",
  "attention_resurgence",
  "decay_before_failure",
  "thesis_conflict",
  "risk_spike",
]);
export const ShadowDistributionStateSchema = z.enum([
  "healthy",
  "concentrated",
  "insider_skewed",
  "unknown",
]);
export const ShadowWalletQualityStateSchema = z.enum(["clean", "mixed", "toxic", "unknown"]);
export const ShadowLiquidityStateSchema = z.enum([
  "healthy",
  "fragile",
  "trap_risk",
  "unknown",
]);

export const LowCapWorkerEventFeatureSnapshotSchema = z
  .object({
    tokenName: z.string().min(1),
    ticker: z.string().min(1),
    contractAddress: z.string().min(1),
    venue: LowCapVenueSchema,
    launchAgeSeconds: z.number().nonnegative(),
    marketCap: z.union([z.number().nonnegative(), z.literal("unknown")]),
    volume: z.union([z.number().nonnegative(), z.literal("unknown")]),
    bondingState: LowCapBondingStateSchema,
    walletQualityState: LowCapWalletQualityStateSchema,
    structureState: LowCapStructureStateSchema,
    liquidityState: LowCapLiquidityStateSchema,
    metaCluster: z.string().nullable().default(null),
    attentionType: z.string().nullable().default(null),
    trustedSignalCount: z.number().int().nonnegative().default(0),
    convergenceScore: z.number().min(0).max(1).default(0),
    integrityScore: z.number().min(0).max(1).default(0),
    freshnessScore: z.number().min(0).max(1).default(0),
    noiseScore: z.number().min(0).max(1).default(0),
    batchGroupHint: z.string().nullable().default(null),
  })
  .strict();

export type LowCapWorkerEventFeatureSnapshot = z.infer<
  typeof LowCapWorkerEventFeatureSnapshotSchema
>;

export const ShadowWorkerEventFeatureSnapshotSchema = z
  .object({
    tokenName: z.string().min(1),
    ticker: z.string().min(1),
    contractAddress: z.string().min(1),
    currentState: ShadowCurrentStateSchema,
    baselineState: z.string().min(1),
    transitionType: ShadowTransitionTypeSchema,
    structureShift: z.string().min(1),
    flowShift: z.string().min(1),
    attentionShift: z.string().min(1),
    walletQualityState: ShadowWalletQualityStateSchema,
    distributionState: ShadowDistributionStateSchema,
    liquidityState: ShadowLiquidityStateSchema,
    transitionConfidence: z.number().min(0).max(1),
    severityScore: z.number().min(0).max(1).default(0),
    convergenceScore: z.number().min(0).max(1).default(0),
    integrityScore: z.number().min(0).max(1).default(0),
    freshnessScore: z.number().min(0).max(1).default(0),
    batchGroupHint: z.string().nullable().default(null),
    thesisConflict: z.boolean().default(false),
    riskSpike: z.boolean().default(false),
  })
  .strict();

export type ShadowWorkerEventFeatureSnapshot = z.infer<
  typeof ShadowWorkerEventFeatureSnapshotSchema
>;

const WorkerEventEnvelopeBaseSchema = z.object({
  schemaVersion: z.literal(WORKER_EVENT_GATE_SCHEMA_VERSION),
  eventId: z.string().min(1),
  traceId: z.string().min(1),
  family: WorkerEventFamilySchema,
  eventType: z.string().min(1),
  eventVersion: z.string().min(1),
  producer: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  entityKey: z.string().min(1),
  observedAt: z.string().datetime(),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  severity: WorkerEventSeveritySchema,
  confidence: z.number().min(0).max(1),
  knowledgeMode: WorkerEventKnowledgeModeSchema,
  evidenceRefs: z.array(z.string().min(1)).default([]),
  sourceScope: WorkerEventSourceScopeSchema,
  promotionCandidate: z.boolean().default(false),
  suppressionCandidate: z.boolean().default(false),
});

export const LowCapWorkerEventEnvelopeSchema = WorkerEventEnvelopeBaseSchema.extend({
  family: z.literal("lowcap"),
  featureSnapshot: LowCapWorkerEventFeatureSnapshotSchema,
}).superRefine((value, ctx) => {
  if (!value.eventType.startsWith("lowcap.")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["eventType"],
      message: "lowcap events must use a lowcap.* eventType",
    });
  }
});

export const ShadowWorkerEventEnvelopeSchema = WorkerEventEnvelopeBaseSchema.extend({
  family: z.literal("shadow"),
  featureSnapshot: ShadowWorkerEventFeatureSnapshotSchema,
}).superRefine((value, ctx) => {
  if (!value.eventType.startsWith("shadow.")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["eventType"],
      message: "shadow events must use a shadow.* eventType",
    });
  }
});

export const WorkerEventEnvelopeSchema = z.union([
  LowCapWorkerEventEnvelopeSchema,
  ShadowWorkerEventEnvelopeSchema,
]);

export type WorkerEventEnvelope = z.infer<typeof WorkerEventEnvelopeSchema>;
export type LowCapWorkerEventEnvelope = z.infer<typeof LowCapWorkerEventEnvelopeSchema>;
export type ShadowWorkerEventEnvelope = z.infer<typeof ShadowWorkerEventEnvelopeSchema>;

export interface WorkerEventGateStateRecord {
  key: string;
  eventId: string;
  family: WorkerEventFamily;
  eventType: string;
  observedAt: string;
  expiresAt: string;
  severity: WorkerEventSeverity;
  confidence: number;
  evidenceSignature: string;
  basisHash: string;
}

export interface WorkerEventGateCooldownRecord extends WorkerEventGateStateRecord {
  cooldownClass: string;
}

export interface WorkerEventGateBatchRecord {
  key: string;
  family: WorkerEventFamily;
  eventIds: string[];
  eventTypes: string[];
  firstObservedAt: string;
  lastObservedAt: string;
  releaseAt: string;
  windowMs: number;
  count: number;
  status: "pending" | "released";
}

export interface WorkerEventGateState {
  schemaVersion: typeof WORKER_EVENT_GATE_STATE_SCHEMA_VERSION;
  dedupeRecords: WorkerEventGateStateRecord[];
  cooldownRecords: WorkerEventGateCooldownRecord[];
  batchRecords: WorkerEventGateBatchRecord[];
  lastEvaluatedAt?: string;
}

export const WORKER_EVENT_GATE_DEFAULT_WINDOWS = {
  lowcap: {
    dedupeMs: 15 * 60 * 1000,
    batchMs: 5 * 60 * 1000,
    cooldown: {
      prime: 15 * 60 * 1000,
      strong: 30 * 60 * 1000,
      borderline: 45 * 60 * 1000,
      stale: 2 * 60 * 60 * 1000,
    },
  },
  shadow: {
    dedupeMs: 30 * 60 * 1000,
    batchMs: 10 * 60 * 1000,
    cooldown: {
      critical: 15 * 60 * 1000,
      normal: 60 * 60 * 1000,
      review: 2 * 60 * 60 * 1000,
      stable: 3 * 60 * 60 * 1000,
    },
  },
} as const;

export interface WorkerEventNormalization {
  basisHash: string;
  evidenceSignature: string;
  normalizedEvidenceRefs: string[];
  normalizedEntityId: string;
  normalizedEntityKey: string;
  timeBucket: string;
}

export function assertWorkerEventEnvelope(
  value: unknown,
  source = "unknown"
): WorkerEventEnvelope {
  const result = WorkerEventEnvelopeSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  const reason = result.error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}:${issue.message}`;
    })
    .join(";");

  throw new Error(`INVALID_WORKER_EVENT_ENVELOPE:${source}:${reason}`);
}

export function createWorkerEventGateState(): WorkerEventGateState {
  return {
    schemaVersion: WORKER_EVENT_GATE_STATE_SCHEMA_VERSION,
    dedupeRecords: [],
    cooldownRecords: [],
    batchRecords: [],
  };
}

export function normalizeIdentifierPart(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : "unknown";
}

export function sortStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function stableTimeBucketLabel(observedAt: string, windowMs: number): string {
  const observedMs = Date.parse(observedAt);
  if (!Number.isFinite(observedMs) || windowMs <= 0) {
    return `invalid/${windowMs}`;
  }

  const bucketStartMs = Math.floor(observedMs / windowMs) * windowMs;
  const bucketStartIso = new Date(bucketStartMs).toISOString().replace(/\.000Z$/, "Z");
  const bucketMinutes = Math.round(windowMs / 60_000);
  return `${bucketStartIso}/${bucketMinutes}m`;
}

export function isKnownWorkerEventFamily(value: string): value is WorkerEventFamily {
  return value === "lowcap" || value === "shadow";
}

export function familyPrefix(family: WorkerEventFamily): string {
  return `${family}.`;
}

export function buildWorkerEventNormalization(
  event: WorkerEventEnvelope,
  bucketWindowMs: number
): WorkerEventNormalization {
  const normalizedEvidenceRefs = sortStrings(event.evidenceRefs);
  const normalizedEntityId = normalizeIdentifierPart(event.entityId);
  const normalizedEntityKey = normalizeIdentifierPart(event.entityKey);
  const timeBucket = stableTimeBucketLabel(event.observedAt, bucketWindowMs);

  const basisHash = hashDecision(
    canonicalize({
      family: event.family,
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: normalizedEntityId,
      entityKey: normalizedEntityKey,
      observedAt: event.observedAt,
      windowStart: event.windowStart,
      windowEnd: event.windowEnd,
      severity: event.severity,
      confidence: event.confidence,
      knowledgeMode: event.knowledgeMode,
      sourceScope: event.sourceScope,
      promotionCandidate: event.promotionCandidate,
      suppressionCandidate: event.suppressionCandidate,
      evidenceRefs: normalizedEvidenceRefs,
      featureSnapshot: event.featureSnapshot,
    })
  );

  const evidenceSignature = hashDecision(
    canonicalize({
      family: event.family,
      eventType: event.eventType,
      entityId: normalizedEntityId,
      entityKey: normalizedEntityKey,
      evidenceRefs: normalizedEvidenceRefs,
      featureSnapshot: event.featureSnapshot,
    })
  );

  return {
    basisHash,
    evidenceSignature,
    normalizedEvidenceRefs,
    normalizedEntityId,
    normalizedEntityKey,
    timeBucket,
  };
}

export function buildDedupeKey(event: WorkerEventEnvelope, timeBucket: string): string {
  return `${event.family}:${normalizeIdentifierPart(event.entityId)}:${event.eventType}:${timeBucket}`;
}

export function buildCooldownKey(
  event: WorkerEventEnvelope,
  promotionClass: string
): string {
  return `${event.family}_cd:${normalizeIdentifierPart(event.entityId)}:${normalizeIdentifierPart(promotionClass)}`;
}

export function buildBatchKey(event: WorkerEventEnvelope, timeBucket: string): string {
  return `${event.family}:batch:${normalizeIdentifierPart(event.entityId)}:${timeBucket}`;
}

export function parseIsoMs(value: string): number {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : NaN;
}

export function isWithinWindow(
  observedAt: string,
  start: string,
  end: string
): boolean {
  const observedMs = parseIsoMs(observedAt);
  const startMs = parseIsoMs(start);
  const endMs = parseIsoMs(end);
  return (
    Number.isFinite(observedMs) &&
    Number.isFinite(startMs) &&
    Number.isFinite(endMs) &&
    startMs <= observedMs &&
    observedMs <= endMs
  );
}

export function severityRank(severity: WorkerEventSeverity): number {
  switch (severity) {
    case "low":
      return 0;
    case "medium":
      return 1;
    case "high":
      return 2;
    case "critical":
      return 3;
    default:
      return 0;
  }
}

export function lowcapPromotionClass(event: LowCapWorkerEventEnvelope): "prime" | "strong" | "borderline" | "stale" {
  const feature = event.featureSnapshot;
  if (
    event.severity === "critical" ||
    (event.confidence >= 0.9 && feature.convergenceScore >= 0.8 && feature.integrityScore >= 0.8)
  ) {
    return "prime";
  }
  if (event.confidence >= 0.75 || feature.convergenceScore >= 0.7) {
    return "strong";
  }
  if (event.confidence >= 0.5 || feature.convergenceScore >= 0.4) {
    return "borderline";
  }
  return "stale";
}

export function shadowTransitionClass(
  event: ShadowWorkerEventEnvelope
): "critical" | "normal" | "review" | "stable" {
  const feature = event.featureSnapshot;
  if (
    event.severity === "critical" ||
    feature.riskSpike ||
    feature.severityScore >= 0.85 ||
    feature.transitionConfidence >= 0.85
  ) {
    return "critical";
  }
  if (feature.transitionConfidence >= 0.7 || event.severity === "high") {
    return "normal";
  }
  if (feature.transitionConfidence >= 0.5 || feature.currentState === "notable_change") {
    return "review";
  }
  return "stable";
}

export function dedupeWindowMs(event: WorkerEventEnvelope): number {
  return event.family === "lowcap"
    ? WORKER_EVENT_GATE_DEFAULT_WINDOWS.lowcap.dedupeMs
    : WORKER_EVENT_GATE_DEFAULT_WINDOWS.shadow.dedupeMs;
}

export function batchWindowMs(event: WorkerEventEnvelope): number {
  return event.family === "lowcap"
    ? WORKER_EVENT_GATE_DEFAULT_WINDOWS.lowcap.batchMs
    : WORKER_EVENT_GATE_DEFAULT_WINDOWS.shadow.batchMs;
}

export function cooldownWindowMs(
  event: WorkerEventEnvelope,
  classification: string
): number {
  if (event.family === "lowcap") {
    const cooldown = WORKER_EVENT_GATE_DEFAULT_WINDOWS.lowcap.cooldown as Record<string, number>;
    return cooldown[classification] ?? cooldown.stale;
  }

  const cooldown = WORKER_EVENT_GATE_DEFAULT_WINDOWS.shadow.cooldown as Record<string, number>;
  return cooldown[classification] ?? cooldown.stable;
}
