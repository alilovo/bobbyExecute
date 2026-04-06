/**
 * Derived knowledge views.
 *
 * Layer separation is explicit:
 * - raw_journal_truth
 * - canonical_case_record
 * - derived_knowledge_view
 * - playbook_or_optimization_memory (named boundary only; not implemented here)
 *
 * This slice only implements derived_knowledge_view as recomputable, non-authoritative
 * interpretation over canonical case records.
 */
import { z } from "zod";
import {
  CaseJournalRecordRefSchema,
  CaseSubjectRefSchema,
  type CanonicalCaseType,
  CanonicalCaseTypeSchema,
} from "./casebook.js";

export const DERIVED_KNOWLEDGE_VIEW_LAYER = "derived_knowledge_view" as const;
export const DERIVED_KNOWLEDGE_VIEW_SOURCE_LAYER = "canonical_case_record" as const;
export const DERIVED_KNOWLEDGE_VIEW_SCHEMA_VERSION = "derived.knowledge_view.v1" as const;

export const DerivedKnowledgeViewKinds = [
  "setup_performance_view",
  "regime_meta_performance_view",
  "kol_account_ranking_view",
  "failure_mode_view",
  "signal_pattern_view",
] as const;
export type DerivedKnowledgeViewKind = (typeof DerivedKnowledgeViewKinds)[number];
export const DerivedKnowledgeViewKindSchema = z.enum(DerivedKnowledgeViewKinds);

export const DerivedKnowledgeViewStatuses = ["ready", "insufficient_sample"] as const;
export type DerivedKnowledgeViewStatus = (typeof DerivedKnowledgeViewStatuses)[number];
export const DerivedKnowledgeViewStatusSchema = z.enum(DerivedKnowledgeViewStatuses);

export const SetupTypeSubjectRefSchema = CaseSubjectRefSchema.extend({
  subject_kind: z.literal("setup_type"),
});
export const MarketRegimeSubjectRefSchema = CaseSubjectRefSchema.extend({
  subject_kind: z.literal("market_regime"),
});
export const MetaSubjectRefSchema = CaseSubjectRefSchema.extend({
  subject_kind: z.literal("meta"),
});
export const AccountOrKolSubjectRefSchema = CaseSubjectRefSchema.extend({
  subject_kind: z.literal("account_or_kol"),
});
export const FailureModeSubjectRefSchema = CaseSubjectRefSchema.extend({
  subject_kind: z.literal("failure_mode"),
});
export const SignalClusterSubjectRefSchema = CaseSubjectRefSchema.extend({
  subject_kind: z.literal("signal_cluster"),
});

export const DerivedViewSourceCaseRefSchema = z
  .object({
    case_id: z.string().min(1),
    case_type: CanonicalCaseTypeSchema,
    trace_id: z.string().min(1),
    source_journal_record_refs: z.array(CaseJournalRecordRefSchema).min(1),
    trace_refs: z.array(z.string().min(1)).min(1),
    evidence_lineage_refs: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type DerivedViewSourceCaseRef = z.infer<typeof DerivedViewSourceCaseRefSchema>;

const DerivedViewBaseSchema = z
  .object({
    schema_version: z.literal(DERIVED_KNOWLEDGE_VIEW_SCHEMA_VERSION),
    layer: z.literal(DERIVED_KNOWLEDGE_VIEW_LAYER),
    source_layer: z.literal(DERIVED_KNOWLEDGE_VIEW_SOURCE_LAYER),
    authority_class: z.literal("non_authoritative"),
    view_id: z.string().min(1),
    view_type: DerivedKnowledgeViewKindSchema,
    view_status: DerivedKnowledgeViewStatusSchema,
    sample_count: z.number().int().nonnegative(),
    minimum_sample_count: z.number().int().positive(),
    recomputable_from_layer: z.literal(DERIVED_KNOWLEDGE_VIEW_SOURCE_LAYER),
    source_case_refs: z.array(DerivedViewSourceCaseRefSchema).default([]),
    trace_refs: z.array(z.string().min(1)).default([]),
    evidence_lineage_refs: z.array(z.string().min(1)).default([]),
    insufficient_sample_reason: z.string().min(1).optional(),
  })
  .strict();

const DerivedViewSampleStatsSchema = z
  .object({
    positive_case_count: z.number().int().nonnegative(),
    negative_case_count: z.number().int().nonnegative(),
    neutral_case_count: z.number().int().nonnegative(),
  })
  .strict();

const DerivedViewEntryBaseSchema = z
  .object({
    sample_count: z.number().int().nonnegative(),
    minimum_sample_count: z.number().int().positive(),
    sample_status: DerivedKnowledgeViewStatusSchema,
    source_case_refs: z.array(DerivedViewSourceCaseRefSchema).min(1),
    trace_refs: z.array(z.string().min(1)).min(1),
    evidence_lineage_refs: z.array(z.string().min(1)).default([]),
    rank_position: z.number().int().positive(),
  })
  .strict();

export const SetupPerformanceEntrySchema = DerivedViewEntryBaseSchema.extend({
  setup_type_ref: SetupTypeSubjectRefSchema,
  sample_stats: DerivedViewSampleStatsSchema,
  performance_score: z.number(),
});
export type SetupPerformanceEntry = z.infer<typeof SetupPerformanceEntrySchema>;

export const SetupPerformanceViewSchema = DerivedViewBaseSchema.extend({
  view_type: z.literal("setup_performance_view"),
  entries: z.array(SetupPerformanceEntrySchema),
});
export type SetupPerformanceView = z.infer<typeof SetupPerformanceViewSchema>;

export const RegimeMetaPerformanceEntrySchema = DerivedViewEntryBaseSchema.extend({
  market_regime_ref: MarketRegimeSubjectRefSchema,
  meta_ref: MetaSubjectRefSchema,
  sample_stats: DerivedViewSampleStatsSchema,
  performance_score: z.number(),
});
export type RegimeMetaPerformanceEntry = z.infer<typeof RegimeMetaPerformanceEntrySchema>;

export const RegimeMetaPerformanceViewSchema = DerivedViewBaseSchema.extend({
  view_type: z.literal("regime_meta_performance_view"),
  entries: z.array(RegimeMetaPerformanceEntrySchema),
});
export type RegimeMetaPerformanceView = z.infer<typeof RegimeMetaPerformanceViewSchema>;

export const KolAccountRankingEntrySchema = DerivedViewEntryBaseSchema.extend({
  account_or_kol_ref: AccountOrKolSubjectRefSchema,
  sample_stats: DerivedViewSampleStatsSchema,
  ranking_score: z.number(),
});
export type KolAccountRankingEntry = z.infer<typeof KolAccountRankingEntrySchema>;

export const KolAccountRankingViewSchema = DerivedViewBaseSchema.extend({
  view_type: z.literal("kol_account_ranking_view"),
  entries: z.array(KolAccountRankingEntrySchema),
});
export type KolAccountRankingView = z.infer<typeof KolAccountRankingViewSchema>;

export const FailureModeEntrySchema = DerivedViewEntryBaseSchema.extend({
  failure_mode_ref: FailureModeSubjectRefSchema,
  sample_stats: DerivedViewSampleStatsSchema,
  failure_pressure_score: z.number(),
});
export type FailureModeEntry = z.infer<typeof FailureModeEntrySchema>;

export const FailureModeViewSchema = DerivedViewBaseSchema.extend({
  view_type: z.literal("failure_mode_view"),
  entries: z.array(FailureModeEntrySchema),
});
export type FailureModeView = z.infer<typeof FailureModeViewSchema>;

export const SignalPatternEntrySchema = DerivedViewEntryBaseSchema.extend({
  signal_pattern_key: z.string().min(1),
  signal_cluster_ref: SignalClusterSubjectRefSchema,
  setup_type_ref: SetupTypeSubjectRefSchema.optional(),
  market_regime_ref: MarketRegimeSubjectRefSchema.optional(),
  sample_stats: DerivedViewSampleStatsSchema,
  pattern_score: z.number(),
});
export type SignalPatternEntry = z.infer<typeof SignalPatternEntrySchema>;

export const SignalPatternViewSchema = DerivedViewBaseSchema.extend({
  view_type: z.literal("signal_pattern_view"),
  entries: z.array(SignalPatternEntrySchema),
});
export type SignalPatternView = z.infer<typeof SignalPatternViewSchema>;

export const DerivedKnowledgeViewSchema = z.union([
  SetupPerformanceViewSchema,
  RegimeMetaPerformanceViewSchema,
  KolAccountRankingViewSchema,
  FailureModeViewSchema,
  SignalPatternViewSchema,
]);
export type DerivedKnowledgeView =
  | SetupPerformanceView
  | RegimeMetaPerformanceView
  | KolAccountRankingView
  | FailureModeView
  | SignalPatternView;

export type DerivedViewSourceLayer = CanonicalCaseType | typeof DERIVED_KNOWLEDGE_VIEW_SOURCE_LAYER;
