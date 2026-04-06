/**
 * Worker-control overlay contracts for PR-01.
 * Baseline aligned to non-canonical architecture input under docs/_inputs/*.
 */
import { z } from "zod";
import {
  DecisionTimeContextMarkerSchema,
  EntityRefSchema,
  EventSourceSchema,
  IntegrityHintSchema,
  KnowledgeModeSchema,
  NonAuthoritativeBoundarySchema,
  ReplayMetadataSchema,
} from "./boundary-utils.js";

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}:${issue.message}`;
    })
    .join(";");
}

export const WorkerKindSchema = z.enum(["low_cap_hunter", "shadow_intelligence"]);

export const EventSeveritySchema = z.enum(["low", "medium", "high", "critical"]);

export const LowCapHunterEventTypeSchema = z.enum([
  "observation",
  "candidate",
  "promotion",
  "suppression",
  "post_model",
]);

export const ShadowIntelligenceEventTypeSchema = z.enum([
  "observation",
  "transition",
  "suppression_control",
  "post_model",
]);

const SharedEventEnvelopeBaseSchema = z
  .object({
    schema_version: z.literal("worker_control_event.v1"),
    event_id: z.string().min(1),
    trace_id: z.string().min(1),
    source: EventSourceSchema,
    entity_refs: z.array(EntityRefSchema).min(1),
    observed_at: z.string().datetime(),
    evidence_refs: z.array(z.string()).default([]),
    severity: EventSeveritySchema,
    confidence_hint: z.number().min(0).max(1).optional(),
    integrity_hint: IntegrityHintSchema.optional(),
    knowledge_mode: KnowledgeModeSchema.default("observed"),
    decision_time_context_marker: DecisionTimeContextMarkerSchema,
    replay_metadata: ReplayMetadataSchema,
  })
  .strict();

const LowCapWorkerEventEnvelopeSchema = SharedEventEnvelopeBaseSchema.extend({
  worker_kind: z.literal("low_cap_hunter"),
  event_type: LowCapHunterEventTypeSchema,
});

const ShadowWorkerEventEnvelopeSchema = SharedEventEnvelopeBaseSchema.extend({
  worker_kind: z.literal("shadow_intelligence"),
  event_type: ShadowIntelligenceEventTypeSchema,
});

export const WorkerControlEventEnvelopeSchema = z.discriminatedUnion("worker_kind", [
  LowCapWorkerEventEnvelopeSchema,
  ShadowWorkerEventEnvelopeSchema,
]);

export const GateStageSchema = z.enum([
  "validity",
  "integrity",
  "convergence_relevance",
  "dedupe",
  "cooldown",
  "batch_debounce",
  "model_promotion",
  "post_model_routing",
]);

export const GateStageResultSchema = z.enum(["pass", "fail", "suppress", "defer", "batch"]);

export const GateStageEvaluationSchema = z
  .object({
    stage: GateStageSchema,
    stage_result: GateStageResultSchema,
    reason_code: z.string().min(1).optional(),
    reason_class: z
      .enum(["validity", "integrity", "relevance", "dedupe", "cooldown", "batch", "promotion", "routing"])
      .optional(),
    threshold_snapshot_ref: z.string().min(1).optional(),
    dedupe_key: z.string().min(1).optional(),
    cooldown_key: z.string().min(1).optional(),
    batch_key: z.string().min(1).optional(),
    severity_override_applied: z.boolean().default(false),
  })
  .strict();

export const GateEvaluationRecordSchema = z
  .object({
    schema_version: z.literal("worker_gate_evaluation.v1"),
    gate_eval_id: z.string().min(1),
    trace_id: z.string().min(1),
    event_id: z.string().min(1),
    stage_evaluations: z.array(GateStageEvaluationSchema).min(1),
    overall_result: GateStageResultSchema,
    evaluated_at: z.string().datetime(),
  })
  .merge(NonAuthoritativeBoundarySchema)
  .superRefine((value, context) => {
    const stageSet = new Set<string>();
    for (const evaluation of value.stage_evaluations) {
      if (stageSet.has(evaluation.stage)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stage_evaluations"],
          message: `duplicate_stage:${evaluation.stage}`,
        });
      }
      stageSet.add(evaluation.stage);
    }
  });

export const ModelRouteClassSchema = z.enum([
  "route_a_no_model",
  "route_b_small_adjudication",
  "route_c_deep_adjudication",
]);

export const ModelRoutingResultSchema = z
  .object({
    schema_version: z.literal("worker_model_routing.v1"),
    route_decision_id: z.string().min(1),
    trace_id: z.string().min(1),
    event_id: z.string().min(1),
    route_class: ModelRouteClassSchema,
    route_reason_code: z.string().min(1),
    advisory_route: z.literal(true),
    requested_model: z
      .object({
        provider: z.string().min(1),
        model: z.string().min(1),
      })
      .strict()
      .optional(),
    route_basis_stages: z.array(GateStageSchema).min(1),
    cooldown_override: z.boolean().default(false),
    requested_at: z.string().datetime(),
  })
  .merge(NonAuthoritativeBoundarySchema)
  .strict();

export const AdvisoryNormalizedResultTypeSchema = z.enum([
  "candidate_assessment",
  "transition_assessment",
  "review_signal",
  "case_signal",
  "inconclusive",
  "no_action",
]);

export const AdvisoryOutputProvenanceSchema = z
  .object({
    model_provider: z.string().min(1),
    model_name: z.string().min(1),
    input_context_refs: z.array(z.string()).min(1),
    prompt_version: z.string().min(1).optional(),
    output_hash: z.string().min(1).optional(),
    completed_at: z.string().datetime(),
  })
  .strict();

export const AdvisoryModelOutputEnvelopeSchema = z
  .object({
    schema_version: z.literal("worker_model_output.v1"),
    assessment_id: z.string().min(1),
    trace_id: z.string().min(1),
    event_id: z.string().min(1),
    advisory_label: z.string().min(1),
    normalized_result_type: AdvisoryNormalizedResultTypeSchema,
    confidence: z.number().min(0).max(1).nullable(),
    uncertainty: z.number().min(0).max(1).nullable(),
    limitations: z.array(z.string()).default([]),
    provenance: AdvisoryOutputProvenanceSchema,
    non_authority_notice: z.literal("advisory_only_no_execution_authority"),
  })
  .merge(NonAuthoritativeBoundarySchema)
  .strict();

export const WriteEffectTypeSchema = z.enum([
  "watchlist_update",
  "case_update",
  "review_queue_insert",
  "derived_refresh_trigger",
  "no_write",
]);

export const WriteEffectTargetRefSchema = z
  .object({
    target_type: z.enum(["watchlist", "casebook", "review_queue", "derived_view", "none"]),
    target_id: z.string().min(1),
  })
  .strict();

export const WriteEffectEnvelopeSchema = z
  .object({
    schema_version: z.literal("worker_write_effect.v1"),
    write_effect_id: z.string().min(1),
    trace_id: z.string().min(1),
    source_event_id: z.string().min(1),
    effect_type: WriteEffectTypeSchema,
    target_ref: WriteEffectTargetRefSchema.optional(),
    write_reason_code: z.string().min(1),
    written_at: z.string().datetime(),
    journal_truth_anchor: z.literal("journal"),
  })
  .merge(NonAuthoritativeBoundarySchema)
  .strict();

export const LowCapHunterStateSchema = z.enum([
  "observed",
  "screened",
  "candidate",
  "promoted",
  "modeled",
  "watchlisted",
  "rejected",
  "review_queue",
]);

export const ShadowIntelligenceStateSchema = z.enum([
  "watching",
  "stable",
  "notable_change",
  "transition_detected",
  "modeled",
  "updated_case",
  "review_queue",
  "alert",
]);

const WorkerStateTransitionBaseSchema = z
  .object({
    schema_version: z.literal("worker_state_transition.v1"),
    transition_id: z.string().min(1),
    trace_id: z.string().min(1),
    event_id: z.string().min(1),
    transition_reason_code: z.string().min(1),
    transitioned_at: z.string().datetime(),
  })
  .strict();

const LowCapWorkerStateTransitionSchema = WorkerStateTransitionBaseSchema.extend({
  worker_kind: z.literal("low_cap_hunter"),
  from_state: LowCapHunterStateSchema,
  to_state: LowCapHunterStateSchema,
});

const ShadowWorkerStateTransitionSchema = WorkerStateTransitionBaseSchema.extend({
  worker_kind: z.literal("shadow_intelligence"),
  from_state: ShadowIntelligenceStateSchema,
  to_state: ShadowIntelligenceStateSchema,
});

export const WorkerStateTransitionSchema = z
  .discriminatedUnion("worker_kind", [LowCapWorkerStateTransitionSchema, ShadowWorkerStateTransitionSchema])
  .superRefine((value, context) => {
    if (value.from_state === value.to_state) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to_state"],
        message: "transition_must_change_state",
      });
    }
  });

export const SuppressionTypeSchema = z.enum([
  "invalid",
  "dedupe",
  "cooldown",
  "integrity",
  "low_relevance",
  "stale",
  "denied",
  "batch_debounce",
]);

export const SuppressionRecordSchema = z
  .object({
    schema_version: z.literal("worker_suppression.v1"),
    suppression_id: z.string().min(1),
    trace_id: z.string().min(1),
    event_id: z.string().min(1),
    suppression_type: SuppressionTypeSchema,
    suppression_reason_code: z.string().min(1),
    suppression_reason_class: z.string().min(1).optional(),
    dedupe_key: z.string().min(1).optional(),
    cooldown_key: z.string().min(1).optional(),
    blocking_evidence_refs: z.array(z.string()).default([]),
    suppressed_at: z.string().datetime(),
  })
  .merge(NonAuthoritativeBoundarySchema)
  .strict();

export const STQDayTypeSchema = z.enum([
  "D1_runner_rotation_day",
  "D2_active_continuation_day",
  "D3_mixed_noisy_day",
  "D4_dead_drift_day",
]);

export const STQTimeWindowSchema = z.enum([
  "T1_ignition_window",
  "T2_expansion_window",
  "T3_follow_through_window",
  "T4_stale_review_window",
]);

export const STQCadenceHintSchema = z.enum(["15m", "30m", "45m", "60m", "2h", "3h"]);

export const STQPlaceholderContractSchema = z
  .object({
    schema_version: z.literal("stq_placeholder.v1"),
    stq_id: z.string().min(1),
    trace_id: z.string().min(1),
    event_id: z.string().min(1),
    worker_kind: WorkerKindSchema,
    day_type: STQDayTypeSchema.nullable(),
    time_window: STQTimeWindowSchema.nullable(),
    stq_score: z.number().min(0).max(100).nullable(),
    cadence_hint: STQCadenceHintSchema.nullable(),
    status: z.enum(["placeholder_only", "not_evaluated"]),
    advisory_only: z.literal(true),
    notes: z.array(z.string()).default([]),
  })
  .merge(NonAuthoritativeBoundarySchema)
  .strict();

export type WorkerKind = z.infer<typeof WorkerKindSchema>;
export type EventSeverity = z.infer<typeof EventSeveritySchema>;
export type LowCapHunterEventType = z.infer<typeof LowCapHunterEventTypeSchema>;
export type ShadowIntelligenceEventType = z.infer<typeof ShadowIntelligenceEventTypeSchema>;
export type WorkerControlEventEnvelope = z.infer<typeof WorkerControlEventEnvelopeSchema>;
export type GateStage = z.infer<typeof GateStageSchema>;
export type GateStageResult = z.infer<typeof GateStageResultSchema>;
export type GateStageEvaluation = z.infer<typeof GateStageEvaluationSchema>;
export type GateEvaluationRecord = z.infer<typeof GateEvaluationRecordSchema>;
export type ModelRouteClass = z.infer<typeof ModelRouteClassSchema>;
export type ModelRoutingResult = z.infer<typeof ModelRoutingResultSchema>;
export type AdvisoryNormalizedResultType = z.infer<typeof AdvisoryNormalizedResultTypeSchema>;
export type AdvisoryOutputProvenance = z.infer<typeof AdvisoryOutputProvenanceSchema>;
export type AdvisoryModelOutputEnvelope = z.infer<typeof AdvisoryModelOutputEnvelopeSchema>;
export type WriteEffectType = z.infer<typeof WriteEffectTypeSchema>;
export type WriteEffectTargetRef = z.infer<typeof WriteEffectTargetRefSchema>;
export type WriteEffectEnvelope = z.infer<typeof WriteEffectEnvelopeSchema>;
export type LowCapHunterState = z.infer<typeof LowCapHunterStateSchema>;
export type ShadowIntelligenceState = z.infer<typeof ShadowIntelligenceStateSchema>;
export type WorkerStateTransition = z.infer<typeof WorkerStateTransitionSchema>;
export type SuppressionType = z.infer<typeof SuppressionTypeSchema>;
export type SuppressionRecord = z.infer<typeof SuppressionRecordSchema>;
export type STQDayType = z.infer<typeof STQDayTypeSchema>;
export type STQTimeWindow = z.infer<typeof STQTimeWindowSchema>;
export type STQCadenceHint = z.infer<typeof STQCadenceHintSchema>;
export type STQPlaceholderContract = z.infer<typeof STQPlaceholderContractSchema>;

export function assertWorkerControlEventEnvelope(
  value: unknown,
  source = "unknown"
): WorkerControlEventEnvelope {
  const result = WorkerControlEventEnvelopeSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  throw new Error(`INVALID_WORKER_CONTROL_EVENT:${source}:${formatZodIssues(result.error)}`);
}

export function assertGateEvaluationRecord(value: unknown, source = "unknown"): GateEvaluationRecord {
  const result = GateEvaluationRecordSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  throw new Error(`INVALID_GATE_EVALUATION:${source}:${formatZodIssues(result.error)}`);
}

export function assertModelRoutingResult(value: unknown, source = "unknown"): ModelRoutingResult {
  const result = ModelRoutingResultSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  throw new Error(`INVALID_MODEL_ROUTING_RESULT:${source}:${formatZodIssues(result.error)}`);
}

export function assertAdvisoryModelOutputEnvelope(
  value: unknown,
  source = "unknown"
): AdvisoryModelOutputEnvelope {
  const result = AdvisoryModelOutputEnvelopeSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  throw new Error(`INVALID_ADVISORY_MODEL_OUTPUT:${source}:${formatZodIssues(result.error)}`);
}

export function assertWriteEffectEnvelope(value: unknown, source = "unknown"): WriteEffectEnvelope {
  const result = WriteEffectEnvelopeSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  throw new Error(`INVALID_WRITE_EFFECT:${source}:${formatZodIssues(result.error)}`);
}

export function assertWorkerStateTransition(value: unknown, source = "unknown"): WorkerStateTransition {
  const result = WorkerStateTransitionSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  throw new Error(`INVALID_WORKER_STATE_TRANSITION:${source}:${formatZodIssues(result.error)}`);
}

export function assertSuppressionRecord(value: unknown, source = "unknown"): SuppressionRecord {
  const result = SuppressionRecordSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  throw new Error(`INVALID_SUPPRESSION_RECORD:${source}:${formatZodIssues(result.error)}`);
}

export function assertSTQPlaceholderContract(value: unknown, source = "unknown"): STQPlaceholderContract {
  const result = STQPlaceholderContractSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  throw new Error(`INVALID_STQ_PLACEHOLDER:${source}:${formatZodIssues(result.error)}`);
}
