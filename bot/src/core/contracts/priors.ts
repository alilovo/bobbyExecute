/**
 * Machine-safe priors.
 *
 * Layer separation is explicit:
 * - raw_journal_truth
 * - canonical_case_record
 * - derived_knowledge_view
 * - machine_safe_prior
 * - playbook_or_optimization_memory (named boundary only; not implemented here)
 *
 * This slice only implements machine_safe_prior as a validated, non-authoritative
 * promotion layer over reviewed derived knowledge views.
 */
import { z } from "zod";
import {
  CaseJournalRecordRefSchema,
  type CaseJournalRecordRef,
} from "./casebook.js";
import {
  DerivedKnowledgeViewKindSchema,
  DerivedKnowledgeViewSchema,
  DerivedKnowledgeViewStatusSchema,
  DerivedViewSourceCaseRefSchema,
} from "./derived-views.js";

export const MACHINE_SAFE_PRIOR_LAYER = "machine_safe_prior" as const;
export const MACHINE_SAFE_PRIOR_SOURCE_LAYER = "derived_knowledge_view" as const;
export const MACHINE_SAFE_PRIOR_RECOMPUTABLE_LAYER = "derived_knowledge_view" as const;
export const MACHINE_SAFE_PRIOR_SCHEMA_VERSION = "priors.machine_safe_prior.v1" as const;

export const MachineSafePriorTypes = [
  "setup_performance_prior",
  "regime_meta_performance_prior",
  "kol_account_ranking_prior",
  "failure_mode_prior",
  "signal_pattern_prior",
] as const;
export type MachineSafePriorType = (typeof MachineSafePriorTypes)[number];
export const MachineSafePriorTypeSchema = z.enum(MachineSafePriorTypes);

export const MachineSafePriorSourceClasses = [
  "derived_knowledge_view",
  "free_note",
  "hypothesis",
  "unreviewed_comment",
  "raw_model_output",
] as const;
export type MachineSafePriorSourceClass = (typeof MachineSafePriorSourceClasses)[number];
export const MachineSafePriorSourceClassSchema = z.enum(MachineSafePriorSourceClasses);

export const MachineSafePriorValidationStates = [
  "validated",
  "insufficient_evidence",
  "blocked_forbidden_source",
  "blocked_review_gate",
  "blocked_subject_mismatch",
] as const;
export type MachineSafePriorValidationState = (typeof MachineSafePriorValidationStates)[number];
export const MachineSafePriorValidationStateSchema = z.enum(MachineSafePriorValidationStates);

export const MachineSafePriorPromotionGateStatusSchema = z.enum(["approved", "blocked"]);

const MachineSafePriorSourceViewRefSchema = z
  .object({
    view_id: z.string().min(1),
    view_type: DerivedKnowledgeViewKindSchema,
    view_status: DerivedKnowledgeViewStatusSchema,
    source_case_refs: z.array(DerivedViewSourceCaseRefSchema).min(1),
    trace_refs: z.array(z.string().min(1)).min(1),
    evidence_lineage_refs: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const MachineSafePriorEvidenceLineageSchema = z
  .object({
    source_class: z.literal("derived_knowledge_view"),
    source_view_ref: MachineSafePriorSourceViewRefSchema,
    source_case_refs: z.array(DerivedViewSourceCaseRefSchema).min(1),
    source_journal_record_refs: z.array(CaseJournalRecordRefSchema).min(1),
    trace_refs: z.array(z.string().min(1)).min(1),
    evidence_lineage_refs: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type MachineSafePriorEvidenceLineage = z.infer<typeof MachineSafePriorEvidenceLineageSchema>;

export const MachineSafePriorValuePayloadSchema = z
  .object({
    payload_kind: z.literal("numeric_score"),
    metric_name: z.string().min(1),
    metric_value: z.number(),
    sample_count: z.number().int().nonnegative(),
    evidence_count: z.number().int().nonnegative(),
    confidence: z.number().min(0).max(1),
  })
  .strict();
export type MachineSafePriorValuePayload = z.infer<typeof MachineSafePriorValuePayloadSchema>;

export const MachineSafePriorReviewMetadataSchema = z
  .object({
    review_state: z.literal("reviewed"),
    reviewed_by: z.string().min(1),
    reviewed_at: z.string().datetime(),
    review_journal_record_refs: z.array(CaseJournalRecordRefSchema).min(1),
  })
  .strict();
export type MachineSafePriorReviewMetadata = z.infer<typeof MachineSafePriorReviewMetadataSchema>;

export const MachineSafePriorPromotionGateResultSchema = z
  .object({
    gate_status: MachineSafePriorPromotionGateStatusSchema,
    gate_reason: z.string().min(1).optional(),
    minimum_sample_count: z.number().int().positive(),
    minimum_evidence_count: z.number().int().positive(),
    actual_sample_count: z.number().int().nonnegative(),
    actual_evidence_count: z.number().int().nonnegative(),
  })
  .strict();
export type MachineSafePriorPromotionGateResult = z.infer<typeof MachineSafePriorPromotionGateResultSchema>;

export const MachineSafePriorEffectiveRangeSchema = z
  .object({
    effective_from: z.string().datetime(),
    effective_until: z.string().datetime().optional(),
  })
  .strict();
export type MachineSafePriorEffectiveRange = z.infer<typeof MachineSafePriorEffectiveRangeSchema>;

export const MachineSafePriorRecordSchema = z
  .object({
    schema_version: z.literal(MACHINE_SAFE_PRIOR_SCHEMA_VERSION),
    layer: z.literal(MACHINE_SAFE_PRIOR_LAYER),
    source_layer: z.literal(MACHINE_SAFE_PRIOR_SOURCE_LAYER),
    recomputable_from_layer: z.literal(MACHINE_SAFE_PRIOR_RECOMPUTABLE_LAYER),
    authority_class: z.literal("non_authoritative"),
    prior_id: z.string().min(1),
    prior_type: MachineSafePriorTypeSchema,
    subject_key: z.string().min(1),
    value_payload: MachineSafePriorValuePayloadSchema,
    evidence_lineage: MachineSafePriorEvidenceLineageSchema,
    validation_state: MachineSafePriorValidationStateSchema,
    promotion_gate_result: MachineSafePriorPromotionGateResultSchema,
    effective_range: MachineSafePriorEffectiveRangeSchema,
    review_metadata: MachineSafePriorReviewMetadataSchema,
    advisory_classification: z.literal("advisory_only"),
    bot_safe_classification: z.literal("bot_safe"),
  })
  .strict();
export type MachineSafePriorRecord = z.infer<typeof MachineSafePriorRecordSchema>;

export const MachineSafePriorPromotionInputSchema = z
  .object({
    prior_type: MachineSafePriorTypeSchema,
    subject_key: z.string().min(1),
    source_class: MachineSafePriorSourceClassSchema,
    source_view: DerivedKnowledgeViewSchema.optional(),
    minimum_sample_count: z.number().int().positive(),
    minimum_evidence_count: z.number().int().positive(),
    review_metadata: MachineSafePriorReviewMetadataSchema,
    effective_until: z.string().datetime().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.source_class === "derived_knowledge_view" && !value.source_view) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["source_view"],
        message: "missing_source_view_for_derived_knowledge_view",
      });
    }
  });
export type MachineSafePriorPromotionInput = z.infer<typeof MachineSafePriorPromotionInputSchema>;
