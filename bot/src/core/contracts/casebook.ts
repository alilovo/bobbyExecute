/**
 * Casebook foundations.
 *
 * Layer separation is explicit:
 * - raw_journal_truth
 * - canonical_case_record
 * - derived_knowledge_view (named boundary only; not implemented here)
 * - playbook_or_optimization_memory (named boundary only; not implemented here)
 *
 * This slice only implements canonical_case_record as journal-backed, non-authoritative
 * structured compression of lower-layer truth.
 */
import { z } from "zod";

export const CASEBOOK_LAYERS = [
  "raw_journal_truth",
  "canonical_case_record",
  "derived_knowledge_view",
  "playbook_or_optimization_memory",
] as const;
export type CasebookLayer = (typeof CASEBOOK_LAYERS)[number];
export const CasebookLayerSchema = z.enum(CASEBOOK_LAYERS);

export const CaseSubjectKinds = [
  "token",
  "trade",
  "meta",
  "account_or_kol",
  "signal_cluster",
  "setup_type",
  "market_regime",
  "failure_mode",
  "review_period",
] as const;
export type CaseSubjectKind = (typeof CaseSubjectKinds)[number];
export const CaseSubjectKindSchema = z.enum(CaseSubjectKinds);

export const CasebookCaseTypes = [
  "trade_case",
  "meta_shift_case",
  "signal_cluster_case",
  "kol_influence_case",
  "trade_post_mortem_case",
] as const;
export type CanonicalCaseType = (typeof CasebookCaseTypes)[number];
export const CanonicalCaseTypeSchema = z.enum(CasebookCaseTypes);

export const CASE_REQUIRED_SUBJECT_KINDS: Readonly<Record<CanonicalCaseType, readonly CaseSubjectKind[]>> = {
  trade_case: ["token", "trade"],
  meta_shift_case: ["meta", "market_regime"],
  signal_cluster_case: ["signal_cluster", "setup_type", "review_period"],
  kol_influence_case: ["account_or_kol", "signal_cluster"],
  trade_post_mortem_case: ["trade", "failure_mode", "review_period"],
} as const;

export const CaseJournalRecordRefSchema = z
  .object({
    trace_id: z.string().min(1),
    timestamp: z.string().datetime(),
    stage: z.string().min(1),
    event_hash: z.string().min(1),
    decision_hash: z.string().min(1).optional(),
    result_hash: z.string().min(1).optional(),
    blocked: z.boolean().optional(),
    reason: z.string().min(1).optional(),
  })
  .strict();
export type CaseJournalRecordRef = z.infer<typeof CaseJournalRecordRefSchema>;

export const CaseSubjectRefSchema = z
  .object({
    subject_kind: CaseSubjectKindSchema,
    subject_id: z.string().min(1),
    subject_label: z.string().min(1).optional(),
  })
  .strict();
export type CaseSubjectRef = z.infer<typeof CaseSubjectRefSchema>;

export const CaseTimePhaseSchema = z
  .object({
    observed_at: z.string().datetime(),
    source_journal_record_refs: z.array(CaseJournalRecordRefSchema).min(1),
    trace_refs: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const DecisionTimeCasePhaseSchema = CaseTimePhaseSchema.extend({
  knowledge_phase: z.literal("decision_time"),
});
export const OutcomeTimeCasePhaseSchema = CaseTimePhaseSchema.extend({
  knowledge_phase: z.literal("outcome_time"),
});
export const ReviewTimeCasePhaseSchema = CaseTimePhaseSchema.extend({
  knowledge_phase: z.literal("review_time"),
});

export type CaseTimePhase = z.infer<typeof CaseTimePhaseSchema>;
export type DecisionTimeCasePhase = z.infer<typeof DecisionTimeCasePhaseSchema>;
export type OutcomeTimeCasePhase = z.infer<typeof OutcomeTimeCasePhaseSchema>;
export type ReviewTimeCasePhase = z.infer<typeof ReviewTimeCasePhaseSchema>;

export const CaseEvidenceMapSchema = z
  .object({
    source_journal_record_refs: z.array(CaseJournalRecordRefSchema).min(1),
    event_refs: z.array(CaseJournalRecordRefSchema).default([]),
    gate_refs: z.array(CaseJournalRecordRefSchema).default([]),
    routing_refs: z.array(CaseJournalRecordRefSchema).default([]),
    transition_refs: z.array(CaseJournalRecordRefSchema).default([]),
    cadence_refs: z.array(CaseJournalRecordRefSchema).default([]),
    write_effect_refs: z.array(CaseJournalRecordRefSchema).default([]),
    trace_refs: z.array(z.string().min(1)).min(1),
    evidence_lineage_refs: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type CaseEvidenceMap = z.infer<typeof CaseEvidenceMapSchema>;

const CanonicalCaseBaseFieldsSchema = z
  .object({
    schema_version: z.literal("casebook.canonical_case.v1"),
    layer: z.literal("canonical_case_record"),
    source_layer: z.literal("raw_journal_truth"),
    authority_class: z.literal("non_authoritative"),
    case_id: z.string().min(1),
    trace_id: z.string().min(1),
    case_type: CanonicalCaseTypeSchema,
    subject_refs: z.array(CaseSubjectRefSchema).min(1),
    decision_time: DecisionTimeCasePhaseSchema,
    outcome_time: OutcomeTimeCasePhaseSchema,
    review_time: ReviewTimeCasePhaseSchema,
    evidence: CaseEvidenceMapSchema,
    compressed_case_summary: z.string().min(1).optional(),
    compressed_case_facts: z.array(z.string().min(1)).default([]),
    compressed_case_inferences: z.array(z.string().min(1)).default([]),
    compressed_case_lessons: z.array(z.string().min(1)).default([]),
    compression_version: z.string().min(1).optional(),
  })
  .strict();

function hasRequiredSubjectKinds(
  subjectRefs: readonly CaseSubjectRef[],
  requiredKinds: readonly CaseSubjectKind[]
): boolean {
  return requiredKinds.every((kind) => subjectRefs.some((ref) => ref.subject_kind === kind));
}

function createCaseSchema(caseType: CanonicalCaseType, requiredKinds: readonly CaseSubjectKind[]) {
  return CanonicalCaseBaseFieldsSchema.extend({
    case_type: z.literal(caseType),
  }).superRefine((value, context) => {
    if (!hasRequiredSubjectKinds(value.subject_refs, requiredKinds)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subject_refs"],
        message: `missing_required_subject_kind:${caseType}`,
      });
    }
  });
}

export const TradeCaseSchema = createCaseSchema("trade_case", CASE_REQUIRED_SUBJECT_KINDS.trade_case);
export const MetaShiftCaseSchema = createCaseSchema("meta_shift_case", CASE_REQUIRED_SUBJECT_KINDS.meta_shift_case);
export const SignalClusterCaseSchema = createCaseSchema(
  "signal_cluster_case",
  CASE_REQUIRED_SUBJECT_KINDS.signal_cluster_case
);
export const KolInfluenceCaseSchema = createCaseSchema(
  "kol_influence_case",
  CASE_REQUIRED_SUBJECT_KINDS.kol_influence_case
);
export const TradePostMortemCaseSchema = createCaseSchema(
  "trade_post_mortem_case",
  CASE_REQUIRED_SUBJECT_KINDS.trade_post_mortem_case
);

export const CanonicalCaseRecordSchema = z.union([
  TradeCaseSchema,
  MetaShiftCaseSchema,
  SignalClusterCaseSchema,
  KolInfluenceCaseSchema,
  TradePostMortemCaseSchema,
]);

export type CanonicalCaseBaseFields = z.infer<typeof CanonicalCaseBaseFieldsSchema>;
export type TradeCaseRecord = z.infer<typeof TradeCaseSchema>;
export type MetaShiftCaseRecord = z.infer<typeof MetaShiftCaseSchema>;
export type SignalClusterCaseRecord = z.infer<typeof SignalClusterCaseSchema>;
export type KolInfluenceCaseRecord = z.infer<typeof KolInfluenceCaseSchema>;
export type TradePostMortemCaseRecord = z.infer<typeof TradePostMortemCaseSchema>;
export type CanonicalCaseRecord = z.infer<typeof CanonicalCaseRecordSchema>;
