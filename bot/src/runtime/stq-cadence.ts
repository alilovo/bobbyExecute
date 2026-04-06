import { canonicalize } from "../core/determinism/canonicalize.js";
import { hashDecision, hashResult } from "../core/determinism/hash.js";
import type { JournalEntry } from "../core/contracts/journal.js";
import { appendJournal } from "../persistence/journal-repository.js";
import type { JournalWriter } from "../journal-writer/writer.js";
import type { WorkerEventGateEvaluationResult } from "./worker-event-gate/engine.js";
import type { WorkerEventFamily } from "./worker-event-gate/contracts.js";
import type { WorkerState, WorkerStateMachineKind } from "./worker-state-machines.js";

export const STQ_CADENCE_SCHEMA_VERSION = "worker.stq_cadence.v1" as const;

export const STQ_DAY_TYPES = [
  "d1_runner_rotation_day",
  "d2_active_continuation_day",
  "d3_mixed_noisy_day",
  "d4_dead_drift_day",
] as const;
export type STQDayType = (typeof STQ_DAY_TYPES)[number];

export const STQ_TIME_WINDOWS = [
  "t1_ignition",
  "t2_expansion",
  "t3_follow_through",
  "t4_stale_review",
] as const;
export type STQTimeWindow = (typeof STQ_TIME_WINDOWS)[number];

export const STQ_CONVERGENCE_BANDS = ["strong", "medium", "weak"] as const;
export type STQConvergenceBand = (typeof STQ_CONVERGENCE_BANDS)[number];

export const STQ_INTEGRITY_BANDS = ["clean", "mixed", "poor"] as const;
export type STQIntegrityBand = (typeof STQ_INTEGRITY_BANDS)[number];

export const STQ_SCORE_BANDS = ["high", "medium", "low"] as const;
export type STQScoreBand = (typeof STQ_SCORE_BANDS)[number];

export const STQ_ATTENTION_DIRECTIONS = ["increase", "maintain", "reduce"] as const;
export type STQAttentionDirection = (typeof STQ_ATTENTION_DIRECTIONS)[number];

export const STQ_POLLING_INTERVAL_LABELS = [
  "5m",
  "10m",
  "15m",
  "30m",
  "45m",
  "60m",
  "90m",
  "120m",
] as const;
export type STQPollingIntervalLabel = (typeof STQ_POLLING_INTERVAL_LABELS)[number];

export const STQ_TRANSITION_SIGNIFICANCE = ["high", "medium", "low"] as const;
export type STQTransitionSignificance = (typeof STQ_TRANSITION_SIGNIFICANCE)[number];

export const STQ_NO_PROMOTION_GUARD_REASONS = [
  "advisory_only",
  "event_first_required",
  "gate_suppressed",
  "cooldown_respected",
  "worker_terminal",
] as const;
export type STQNoPromotionGuardReason = (typeof STQ_NO_PROMOTION_GUARD_REASONS)[number];

export const STQ_OBSERVED_AT_STATUSES = ["valid", "malformed", "missing"] as const;
export type STQObservedAtStatus = (typeof STQ_OBSERVED_AT_STATUSES)[number];

export interface STQCadencePolicyInput {
  gateEvaluation: WorkerEventGateEvaluationResult;
  workerState?: WorkerState | null;
}

export interface STQCadenceNoPromotionGuard {
  allowed: false;
  reason: STQNoPromotionGuardReason;
  basis: {
    workerStateKind?: WorkerStateMachineKind;
    workerStateStatus?: string;
    gateBlocked: boolean;
    blockingStage?: string;
    suppressionKind?: string;
  };
}

export interface STQCadenceCooldownComposition {
  gateBlocked: boolean;
  blockingStage?: string;
  suppressionKind?: string;
  cooldownFloorMs: number | null;
  cooldownFloorLabel: STQPollingIntervalLabel | null;
  selectedIntervalMs: number;
  selectedIntervalLabel: STQPollingIntervalLabel;
  effectiveIntervalMs: number;
  effectiveIntervalLabel: STQPollingIntervalLabel;
  respectedGateCooldown: boolean;
}

export interface STQCadencePolicyResult {
  schemaVersion: typeof STQ_CADENCE_SCHEMA_VERSION;
  cadencePolicyId: string;
  traceId: string;
  eventId: string;
  workerKind: WorkerStateMachineKind;
  eventFamily: WorkerEventFamily;
  advisoryOnly: true;
  authorityClass: "non_authoritative";
  canonicalDecisionTruth: "decisionEnvelope";
  evaluatedAt: string;
  dayType: STQDayType;
  timeWindow: STQTimeWindow;
  convergenceBand: STQConvergenceBand;
  integrityBand: STQIntegrityBand;
  stqScore: number;
  stqBand: STQScoreBand;
  transitionSignificance: STQTransitionSignificance;
  attentionDirection: STQAttentionDirection;
  pollingIntervalMs: number;
  pollingIntervalLabel: STQPollingIntervalLabel;
  noPromotionGuard: STQCadenceNoPromotionGuard;
  cooldownComposition: STQCadenceCooldownComposition;
  basis: {
    workerStateKind?: WorkerStateMachineKind;
    workerStateStatus?: string;
    observedAtStatus: STQObservedAtStatus;
    observedAt: string;
    hourBucket: number | null;
    family: WorkerEventFamily;
    severity: string;
    confidence: number;
    convergenceScore: number;
    integrityScore: number;
    gateBlocked: boolean;
    blockingStage?: string;
    suppressionKind?: string;
    routeClass: string;
    writeEffect: string;
    transitionSignificance: STQTransitionSignificance;
  };
  replayMetadata: {
    policyVersion: typeof STQ_CADENCE_SCHEMA_VERSION;
    gateEvaluationHash: string;
    gateReplayKey: string;
    basisHash: string;
    resultHash: string;
  };
}

export interface STQCadenceJournalRecord {
  recordType: "cadence_record";
  schemaVersion: "worker.stq_cadence_journal_record.v1";
  cadenceRecordId: string;
  traceId: string;
  eventId: string;
  payload: STQCadencePolicyResult;
  journaledAt: string;
  authorityClass: "non_authoritative";
  canonicalDecisionTruth: "decisionEnvelope";
}

export interface STQCadenceReplayTrace {
  traceId: string | null;
  eventId: string | null;
  workerKind: WorkerStateMachineKind | null;
  result: STQCadencePolicyResult | null;
  journalEntries: JournalEntry[];
}

const INTERVAL_MS: Record<STQPollingIntervalLabel, number> = {
  "5m": 5 * 60 * 1000,
  "10m": 10 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "45m": 45 * 60 * 1000,
  "60m": 60 * 60 * 1000,
  "90m": 90 * 60 * 1000,
  "120m": 120 * 60 * 1000,
};

const INTERVAL_LABELS = [...STQ_POLLING_INTERVAL_LABELS].sort(
  (left, right) => INTERVAL_MS[left] - INTERVAL_MS[right]
);

const OBSERVED_AT_FALLBACK = "1970-01-01T00:00:00.000Z";

function clampIndex(index: number): number {
  return Math.min(INTERVAL_LABELS.length - 1, Math.max(0, index));
}

interface ParsedObservedAt {
  status: STQObservedAtStatus;
  observedAt: string;
  hourBucket: number | null;
}

function parseObservedAt(value: unknown): ParsedObservedAt {
  if (typeof value !== "string" || value.trim().length === 0) {
    return {
      status: "missing",
      observedAt: OBSERVED_AT_FALLBACK,
      hourBucket: null,
    };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return {
      status: "malformed",
      observedAt: OBSERVED_AT_FALLBACK,
      hourBucket: null,
    };
  }

  return {
    status: "valid",
    observedAt: value,
    hourBucket: parsed.getUTCHours(),
  };
}

function timeWindowForHour(hour: number): STQTimeWindow {
  if (hour < 6) return "t1_ignition";
  if (hour < 12) return "t2_expansion";
  if (hour < 18) return "t3_follow_through";
  return "t4_stale_review";
}

function convergenceBand(score: number): STQConvergenceBand {
  return score >= 0.75 ? "strong" : score >= 0.45 ? "medium" : "weak";
}

function integrityBand(score: number): STQIntegrityBand {
  return score >= 0.75 ? "clean" : score >= 0.45 ? "mixed" : "poor";
}

function dayTypeFor(input: {
  workerKind: WorkerStateMachineKind;
  convergenceBand: STQConvergenceBand;
  integrityBand: STQIntegrityBand;
  gateBlocked: boolean;
  suppressionKind?: string;
  transitionSignificance: STQTransitionSignificance;
}): STQDayType {
  if (input.gateBlocked && ["cooldown", "dedupe", "defer"].includes(input.suppressionKind ?? "")) {
    return "d4_dead_drift_day";
  }
  if (input.integrityBand === "poor") return "d4_dead_drift_day";
  if (input.convergenceBand === "strong" && input.integrityBand === "clean") {
    return input.workerKind === "lowcap_hunter"
      ? input.transitionSignificance === "high"
        ? "d2_active_continuation_day"
        : "d1_runner_rotation_day"
      : input.transitionSignificance === "high"
        ? "d1_runner_rotation_day"
        : "d2_active_continuation_day";
  }
  if (input.convergenceBand === "medium" || input.integrityBand === "mixed") {
    return "d3_mixed_noisy_day";
  }
  return "d4_dead_drift_day";
}

function significanceFor(
  gateEvaluation: WorkerEventGateEvaluationResult,
  workerState?: WorkerState | null
): STQTransitionSignificance {
  if (
    gateEvaluation.event.severity === "critical" ||
    gateEvaluation.routing.routeClass === "eligible_deep_adjudication" ||
    gateEvaluation.writeEffect.effect === "case_update" ||
    gateEvaluation.writeEffect.effect === "review_queue_insert" ||
    ["cooldown", "dedupe", "defer"].includes(gateEvaluation.suppression?.kind ?? "")
  ) {
    return "high";
  }

  if (
    gateEvaluation.routing.routeClass === "eligible_small_adjudication" ||
    gateEvaluation.writeEffect.effect === "watchlist_update" ||
    gateEvaluation.writeEffect.effect === "derived_refresh_trigger"
  ) {
    return "medium";
  }

  if (workerState) {
    if (workerState.workerKind === "lowcap_hunter") {
      return ["candidate", "promoted", "modeled"].includes(workerState.status) ? "medium" : "low";
    }
    return ["notable_change", "transition_detected", "modeled", "updated_case"].includes(workerState.status)
      ? "medium"
      : "low";
  }

  return "low";
}

function dayTypeScore(dayType: STQDayType): number {
  return dayType === "d1_runner_rotation_day"
    ? 20
    : dayType === "d2_active_continuation_day"
      ? 28
      : dayType === "d3_mixed_noisy_day"
        ? 12
        : 0;
}

function timeWindowScore(window: STQTimeWindow): number {
  return window === "t1_ignition" ? 18 : window === "t2_expansion" ? 24 : window === "t3_follow_through" ? 14 : 4;
}

function convergenceScorePoints(band: STQConvergenceBand): number {
  return band === "strong" ? 30 : band === "medium" ? 18 : 6;
}

function integrityScorePoints(band: STQIntegrityBand): number {
  return band === "clean" ? 25 : band === "mixed" ? 12 : 0;
}

function roleScore(
  workerKind: WorkerStateMachineKind,
  dayType: STQDayType,
  timeWindow: STQTimeWindow
): number {
  if (workerKind === "lowcap_hunter") {
    return dayType === "d1_runner_rotation_day" || dayType === "d2_active_continuation_day" ? 5 : 2;
  }
  return timeWindow === "t3_follow_through" || timeWindow === "t4_stale_review" ? 5 : 2;
}

function significanceScore(significance: STQTransitionSignificance): number {
  return significance === "high" ? 12 : significance === "medium" ? 6 : 0;
}

function scoreBand(score: number): STQScoreBand {
  return score >= 75 ? "high" : score >= 50 ? "medium" : "low";
}

function baseIntervalIndex(band: STQScoreBand): number {
  return band === "high" ? 0 : band === "medium" ? 2 : 4;
}

function intervalLabelForIndex(index: number): STQPollingIntervalLabel {
  return INTERVAL_LABELS[clampIndex(index)];
}

function intervalIndexForMinimumMs(minimumMs: number): number {
  for (let index = 0; index < INTERVAL_LABELS.length; index += 1) {
    if (INTERVAL_MS[INTERVAL_LABELS[index]] >= minimumMs) {
      return index;
    }
  }
  return INTERVAL_LABELS.length - 1;
}

function suppressionFloorMs(gateEvaluation: WorkerEventGateEvaluationResult): number | null {
  const suppression = gateEvaluation.suppression;
  if (!suppression) return null;
  const observedMs = Date.parse(gateEvaluation.event.observedAt);
  if (!Number.isFinite(observedMs)) return null;
  const records =
    suppression.kind === "cooldown"
      ? gateEvaluation.stateBefore.cooldownRecords
      : suppression.kind === "dedupe"
        ? gateEvaluation.stateBefore.dedupeRecords
        : gateEvaluation.stateBefore.batchRecords;
  const record = suppression.key ? records.find((item) => item.key === suppression.key) : undefined;
  const releaseAt = record
    ? "releaseAt" in record
      ? record.releaseAt
      : record.expiresAt
    : suppression.releaseAt ?? suppression.expiresAt;
  if (!releaseAt) return null;
  const releaseMs = Date.parse(releaseAt);
  if (!Number.isFinite(releaseMs)) return null;
  return Math.max(0, releaseMs - observedMs);
}

function cooldownComposition(
  gateEvaluation: WorkerEventGateEvaluationResult,
  selectedIntervalLabel: STQPollingIntervalLabel
): STQCadenceCooldownComposition {
  const selectedIntervalMs = INTERVAL_MS[selectedIntervalLabel];
  const floorMs = gateEvaluation.blocked ? suppressionFloorMs(gateEvaluation) : null;
  const floorLabel = floorMs === null ? null : intervalLabelForIndex(intervalIndexForMinimumMs(floorMs));
  const effectiveLabel =
    floorMs === null
      ? selectedIntervalLabel
      : intervalLabelForIndex(Math.max(intervalIndexForMinimumMs(selectedIntervalMs), intervalIndexForMinimumMs(floorMs)));
  return {
    gateBlocked: gateEvaluation.blocked,
    blockingStage: gateEvaluation.blockingStage,
    suppressionKind: gateEvaluation.suppression?.kind,
    cooldownFloorMs: floorMs,
    cooldownFloorLabel: floorLabel,
    selectedIntervalMs,
    selectedIntervalLabel,
    effectiveIntervalMs: INTERVAL_MS[effectiveLabel],
    effectiveIntervalLabel: effectiveLabel,
    respectedGateCooldown: floorMs === null || INTERVAL_MS[effectiveLabel] >= floorMs,
  };
}

function noPromotionGuard(
  gateEvaluation: WorkerEventGateEvaluationResult,
  workerState?: WorkerState | null
): STQCadenceNoPromotionGuard {
  return {
    allowed: false,
    reason:
      gateEvaluation.blocked && gateEvaluation.suppression
        ? gateEvaluation.suppression.kind === "cooldown"
          ? "cooldown_respected"
          : "gate_suppressed"
        : workerState && (workerState.status === "review_queue" || workerState.status === "alert")
          ? "worker_terminal"
          : "advisory_only",
    basis: {
      workerStateKind: workerState?.workerKind,
      workerStateStatus: workerState ? workerState.status : undefined,
      gateBlocked: gateEvaluation.blocked,
      blockingStage: gateEvaluation.blockingStage,
      suppressionKind: gateEvaluation.suppression?.kind,
    },
  };
}

function transitionSignificanceFor(
  gateEvaluation: WorkerEventGateEvaluationResult,
  workerState?: WorkerState | null
): STQTransitionSignificance {
  return significanceFor(gateEvaluation, workerState);
}

export function classifyStqDayType(input: STQCadencePolicyInput): STQDayType {
  const workerKind = input.gateEvaluation.event.family === "lowcap" ? "lowcap_hunter" : "shadow_intelligence";
  const convergence = classifyStqConvergenceBand(input);
  const integrity = classifyStqIntegrityBand(input);
  const significance = transitionSignificanceFor(input.gateEvaluation, input.workerState ?? null);
  return dayTypeFor({
    workerKind,
    convergenceBand: convergence,
    integrityBand: integrity,
    gateBlocked: input.gateEvaluation.blocked,
    suppressionKind: input.gateEvaluation.suppression?.kind,
    transitionSignificance: significance,
  });
}

export function classifyStqTimeWindow(input: STQCadencePolicyInput): STQTimeWindow {
  const observedAt = parseObservedAt(input.gateEvaluation.event.observedAt);
  return observedAt.status === "valid" && observedAt.hourBucket !== null
    ? timeWindowForHour(observedAt.hourBucket)
    : "t4_stale_review";
}

export function classifyStqConvergenceBand(input: STQCadencePolicyInput): STQConvergenceBand {
  return convergenceBand(input.gateEvaluation.event.featureSnapshot.convergenceScore);
}

export function classifyStqIntegrityBand(input: STQCadencePolicyInput): STQIntegrityBand {
  return integrityBand(input.gateEvaluation.event.featureSnapshot.integrityScore);
}

export function evaluateStqCadencePolicy(input: STQCadencePolicyInput): STQCadencePolicyResult {
  const gateEvaluation = input.gateEvaluation;
  const workerState = input.workerState ?? null;
  const observedAt = parseObservedAt(gateEvaluation.event.observedAt);
  const workerKind = gateEvaluation.event.family === "lowcap" ? "lowcap_hunter" : "shadow_intelligence";
  const convergence = classifyStqConvergenceBand(input);
  const integrity = classifyStqIntegrityBand(input);
  const significance = transitionSignificanceFor(gateEvaluation, workerState);
  const timeWindow = observedAt.status === "valid" && observedAt.hourBucket !== null
    ? timeWindowForHour(observedAt.hourBucket)
    : "t4_stale_review";
  const dayType = dayTypeFor({
    workerKind,
    convergenceBand: convergence,
    integrityBand: integrity,
    gateBlocked: gateEvaluation.blocked,
    suppressionKind: gateEvaluation.suppression?.kind,
    transitionSignificance: significance,
  });
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        dayTypeScore(dayType) +
          timeWindowScore(timeWindow) +
          convergenceScorePoints(convergence) +
          integrityScorePoints(integrity) +
          roleScore(workerKind, dayType, timeWindow) +
          significanceScore(significance) -
          (["cooldown", "dedupe", "defer"].includes(gateEvaluation.suppression?.kind ?? "") ? 20 : 0)
      )
    )
  );
  const band = scoreBand(score);
  const selectedBaseIndex = baseIntervalIndex(band);
  const selectedIndex =
    selectedBaseIndex +
    (dayType === "d1_runner_rotation_day"
      ? -1
      : dayType === "d3_mixed_noisy_day"
        ? 1
        : dayType === "d4_dead_drift_day"
          ? 2
          : 0) +
    (timeWindow === "t1_ignition"
      ? -1
      : timeWindow === "t3_follow_through"
        ? 1
        : timeWindow === "t4_stale_review"
          ? 2
          : 0) +
    (significance === "high" ? -1 : significance === "low" ? 1 : 0) +
    (workerKind === "lowcap_hunter"
      ? dayType === "d1_runner_rotation_day" || dayType === "d2_active_continuation_day"
        ? -1
        : 0
      : dayType === "d3_mixed_noisy_day" || dayType === "d4_dead_drift_day"
        ? -1
        : 0);
  const selectedIntervalLabel = intervalLabelForIndex(selectedIndex);
  const cooldown = cooldownComposition(gateEvaluation, selectedIntervalLabel);
  const attentionDirection =
    cooldown.effectiveIntervalMs < 30 * 60 * 1000
      ? "increase"
      : cooldown.effectiveIntervalMs > 30 * 60 * 1000
        ? "reduce"
        : "maintain";
  const basis = {
    workerStateKind: workerState?.workerKind,
    workerStateStatus: workerState ? workerState.status : undefined,
    observedAtStatus: observedAt.status,
    observedAt: observedAt.observedAt,
    hourBucket: observedAt.hourBucket,
    family: gateEvaluation.event.family,
    severity: gateEvaluation.event.severity,
    confidence: gateEvaluation.event.confidence,
    convergenceScore: gateEvaluation.event.featureSnapshot.convergenceScore,
    integrityScore: gateEvaluation.event.featureSnapshot.integrityScore,
    gateBlocked: gateEvaluation.blocked,
    blockingStage: gateEvaluation.blockingStage,
    suppressionKind: gateEvaluation.suppression?.kind,
    routeClass: gateEvaluation.routing.routeClass,
    writeEffect: gateEvaluation.writeEffect.effect,
    transitionSignificance: significance,
  };
  const replayMetadata = {
    policyVersion: STQ_CADENCE_SCHEMA_VERSION,
    gateEvaluationHash: gateEvaluation.evaluationHash,
    gateReplayKey: gateEvaluation.replayKey,
    basisHash: hashDecision(canonicalize(basis)),
    resultHash: hashResult(
      canonicalize({
        dayType,
        timeWindow,
        convergence,
        integrity,
        score,
        band,
        attentionDirection,
        selectedIntervalLabel,
        effectiveIntervalLabel: cooldown.effectiveIntervalLabel,
      })
    ),
  };
  const result: STQCadencePolicyResult = {
    schemaVersion: STQ_CADENCE_SCHEMA_VERSION,
    cadencePolicyId: hashDecision(
      canonicalize({
        traceId: gateEvaluation.traceId,
        eventId: gateEvaluation.event.eventId,
        gateEvaluationHash: gateEvaluation.evaluationHash,
        workerState: workerState ? { workerKind: workerState.workerKind, status: workerState.status } : null,
      })
    ),
    traceId: gateEvaluation.traceId,
    eventId: gateEvaluation.event.eventId,
    workerKind,
    eventFamily: gateEvaluation.event.family,
    advisoryOnly: true,
    authorityClass: "non_authoritative",
    canonicalDecisionTruth: "decisionEnvelope",
    evaluatedAt: gateEvaluation.event.observedAt,
    dayType,
    timeWindow,
    convergenceBand: convergence,
    integrityBand: integrity,
    stqScore: score,
    stqBand: band,
    transitionSignificance: significance,
    attentionDirection,
    pollingIntervalMs: cooldown.effectiveIntervalMs,
    pollingIntervalLabel: cooldown.effectiveIntervalLabel,
    noPromotionGuard: noPromotionGuard(gateEvaluation, workerState),
    cooldownComposition: cooldown,
    basis,
    replayMetadata,
  };
  return result;
}

function buildJournalRecord(result: STQCadencePolicyResult): STQCadenceJournalRecord {
  return {
    recordType: "cadence_record",
    schemaVersion: "worker.stq_cadence_journal_record.v1",
    cadenceRecordId: result.cadencePolicyId,
    traceId: result.traceId,
    eventId: result.eventId,
    payload: result,
    journaledAt: result.evaluatedAt,
    authorityClass: "non_authoritative",
    canonicalDecisionTruth: "decisionEnvelope",
  };
}

export function buildStqCadenceJournalEntry(result: STQCadencePolicyResult): JournalEntry {
  const record = buildJournalRecord(result);
  const input = {
    cadencePolicyId: record.cadenceRecordId,
    traceId: record.traceId,
    eventId: record.eventId,
    basis: record.payload.basis,
    replayMetadata: record.payload.replayMetadata,
    cooldownComposition: record.payload.cooldownComposition,
    noPromotionGuard: record.payload.noPromotionGuard,
  };
  const output = { ...record };
  const decisionHash = hashDecision(canonicalize(input));
  const resultHash = hashResult(canonicalize(output));
  return {
    traceId: record.traceId,
    timestamp: record.journaledAt,
    stage: "worker.cadence.policy",
    decisionHash,
    resultHash,
    input,
    output,
    blocked: false,
    reason: record.payload.noPromotionGuard.reason,
    eventHash: hashResult(
      canonicalize({
        traceId: record.traceId,
        timestamp: record.journaledAt,
        stage: "worker.cadence.policy",
        decisionHash,
        resultHash,
        blocked: false,
        reason: record.payload.noPromotionGuard.reason,
      })
    ),
  };
}

export async function appendStqCadenceJournal(
  writer: JournalWriter,
  result: STQCadencePolicyResult
): Promise<JournalEntry> {
  const entry = buildStqCadenceJournalEntry(result);
  await appendJournal(writer, entry);
  return entry;
}

function parseCadenceRecord(output: unknown): STQCadenceJournalRecord | null {
  if (!output || typeof output !== "object") return null;
  const record = output as Partial<STQCadenceJournalRecord>;
  return record.recordType === "cadence_record" && record.schemaVersion === "worker.stq_cadence_journal_record.v1"
    ? (record as STQCadenceJournalRecord)
    : null;
}

export function reconstructStqCadenceReplay(entries: ReadonlyArray<JournalEntry>): STQCadenceReplayTrace {
  const replay: STQCadenceReplayTrace = {
    traceId: null,
    eventId: null,
    workerKind: null,
    result: null,
    journalEntries: [...entries],
  };

  for (const entry of entries) {
    const record = parseCadenceRecord(entry.output);
    if (!record) continue;
    replay.traceId = record.traceId;
    replay.eventId = record.eventId;
    replay.workerKind = record.payload.workerKind;
    replay.result = record.payload;
  }

  return replay;
}

export function createDefaultLowCapCadenceState(): WorkerState {
  return { workerKind: "lowcap_hunter", status: "observed" };
}

export function createDefaultShadowCadenceState(): WorkerState {
  return { workerKind: "shadow_intelligence", status: "watching" };
}
