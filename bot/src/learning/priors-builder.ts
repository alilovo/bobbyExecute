import { hashResult } from "../core/determinism/hash.js";
import {
  DerivedKnowledgeViewSchema,
  type DerivedKnowledgeView,
  type FailureModeView,
  type KolAccountRankingView,
  type RegimeMetaPerformanceView,
  type SetupPerformanceView,
  type SignalPatternView,
} from "../core/contracts/derived-views.js";
import {
  MachineSafePriorRecordSchema,
  MachineSafePriorPromotionInputSchema,
  type MachineSafePriorRecord,
  type MachineSafePriorPromotionInput,
  type MachineSafePriorType,
  type MachineSafePriorValuePayload,
  type MachineSafePriorEvidenceLineage,
} from "../core/contracts/priors.js";

const FORBIDDEN_SOURCE_CLASSES = new Set(["free_note", "hypothesis", "unreviewed_comment", "raw_model_output"]);

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function fail(details: string): never {
  throw new Error(`PRIOR_BUILD_FAILED:${details}`);
}

function isForbiddenSourceClass(sourceClass: MachineSafePriorPromotionInput["source_class"]): boolean {
  return FORBIDDEN_SOURCE_CLASSES.has(sourceClass);
}

function getExpectedViewType(priorType: MachineSafePriorType): DerivedKnowledgeView["view_type"] {
  switch (priorType) {
    case "setup_performance_prior":
      return "setup_performance_view";
    case "regime_meta_performance_prior":
      return "regime_meta_performance_view";
    case "kol_account_ranking_prior":
      return "kol_account_ranking_view";
    case "failure_mode_prior":
      return "failure_mode_view";
    case "signal_pattern_prior":
      return "signal_pattern_view";
    default: {
      const exhaustiveCheck: never = priorType;
      return exhaustiveCheck;
    }
  }
}

function getEntrySubjectKey(priorType: MachineSafePriorType, entry: unknown): string {
  switch (priorType) {
    case "setup_performance_prior":
      return (entry as SetupPerformanceView["entries"][number]).setup_type_ref.subject_id;
    case "regime_meta_performance_prior": {
      const typed = entry as RegimeMetaPerformanceView["entries"][number];
      return `${typed.market_regime_ref.subject_id}::${typed.meta_ref.subject_id}`;
    }
    case "kol_account_ranking_prior":
      return (entry as KolAccountRankingView["entries"][number]).account_or_kol_ref.subject_id;
    case "failure_mode_prior":
      return (entry as FailureModeView["entries"][number]).failure_mode_ref.subject_id;
    case "signal_pattern_prior":
      return (entry as SignalPatternView["entries"][number]).signal_pattern_key;
    default: {
      const exhaustiveCheck: never = priorType;
      return exhaustiveCheck;
    }
  }
}

function getMetricName(priorType: MachineSafePriorType): string {
  switch (priorType) {
    case "setup_performance_prior":
    case "regime_meta_performance_prior":
      return "performance_score";
    case "kol_account_ranking_prior":
      return "ranking_score";
    case "failure_mode_prior":
      return "failure_pressure_score";
    case "signal_pattern_prior":
      return "pattern_score";
    default: {
      const exhaustiveCheck: never = priorType;
      return exhaustiveCheck;
    }
  }
}

function getMetricValue(priorType: MachineSafePriorType, entry: unknown): number {
  switch (priorType) {
    case "setup_performance_prior":
    case "regime_meta_performance_prior":
      return (entry as SetupPerformanceView["entries"][number] | RegimeMetaPerformanceView["entries"][number]).performance_score;
    case "kol_account_ranking_prior":
      return (entry as KolAccountRankingView["entries"][number]).ranking_score;
    case "failure_mode_prior":
      return (entry as FailureModeView["entries"][number]).failure_pressure_score;
    case "signal_pattern_prior":
      return (entry as SignalPatternView["entries"][number]).pattern_score;
    default: {
      const exhaustiveCheck: never = priorType;
      return exhaustiveCheck;
    }
  }
}

function pickMatchingEntry(
  priorType: MachineSafePriorType,
  subjectKey: string,
  sourceView: DerivedKnowledgeView
): DerivedKnowledgeView["entries"][number] {
  for (const entry of sourceView.entries) {
    if (getEntrySubjectKey(priorType, entry) === subjectKey) {
      return entry;
    }
  }
  fail(`subject_key_mismatch:${priorType}:${subjectKey}`);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function buildSourceViewRef(sourceView: DerivedKnowledgeView) {
  return {
    view_id: sourceView.view_id,
    view_type: sourceView.view_type,
    view_status: sourceView.view_status,
    source_case_refs: sourceView.source_case_refs,
    trace_refs: sourceView.trace_refs,
    evidence_lineage_refs: sourceView.evidence_lineage_refs,
  };
}

function buildEvidenceLineage(
  sourceView: DerivedKnowledgeView,
  sourceEntry: DerivedKnowledgeView["entries"][number]
): MachineSafePriorEvidenceLineage {
  const sourceCaseRefs = sourceEntry.source_case_refs;
  const sourceJournalRecordRefs = sourceCaseRefs
    .flatMap((sourceCaseRef) => sourceCaseRef.source_journal_record_refs)
    .sort((left, right) => compareText(left.trace_id, right.trace_id) || compareText(left.stage, right.stage) || compareText(left.event_hash, right.event_hash));

  return {
    source_class: "derived_knowledge_view",
    source_view_ref: buildSourceViewRef(sourceView),
    source_case_refs: sourceCaseRefs,
    source_journal_record_refs: sourceJournalRecordRefs,
    trace_refs: uniqueSorted([...sourceView.trace_refs, ...sourceCaseRefs.flatMap((sourceCaseRef) => sourceCaseRef.trace_refs)]),
    evidence_lineage_refs: uniqueSorted([
      ...sourceView.evidence_lineage_refs,
      ...sourceCaseRefs.flatMap((sourceCaseRef) => sourceCaseRef.evidence_lineage_refs),
    ]),
  };
}

function buildValuePayload(
  priorType: MachineSafePriorType,
  entry: DerivedKnowledgeView["entries"][number]
): MachineSafePriorValuePayload {
  return {
    payload_kind: "numeric_score",
    metric_name: getMetricName(priorType),
    metric_value: getMetricValue(priorType, entry),
    sample_count: entry.sample_count,
    evidence_count: entry.source_case_refs.length,
    confidence: 1,
  };
}

function buildPriorId(input: {
  priorType: MachineSafePriorType;
  subjectKey: string;
  sourceViewId: string;
  sourceEntryKey: string;
  reviewMetadata: MachineSafePriorPromotionInput["review_metadata"];
  minimumSampleCount: number;
  minimumEvidenceCount: number;
  metricValue: number;
}): string {
  return `prior:${input.priorType}:${hashResult({
    priorType: input.priorType,
    subjectKey: input.subjectKey,
    sourceViewId: input.sourceViewId,
    sourceEntryKey: input.sourceEntryKey,
    reviewedAt: input.reviewMetadata.reviewed_at,
    reviewedBy: input.reviewMetadata.reviewed_by,
    reviewJournalRecordRefs: input.reviewMetadata.review_journal_record_refs.map((ref) => ({
      trace_id: ref.trace_id,
      timestamp: ref.timestamp,
      stage: ref.stage,
      event_hash: ref.event_hash,
    })),
    minimumSampleCount: input.minimumSampleCount,
    minimumEvidenceCount: input.minimumEvidenceCount,
    metricValue: input.metricValue,
  })}`;
}

export function buildMachineSafePrior(input: MachineSafePriorPromotionInput): MachineSafePriorRecord {
  const parsedInput = MachineSafePriorPromotionInputSchema.safeParse(input);
  if (!parsedInput.success) {
    fail(`invalid_input:${parsedInput.error.issues[0]?.path.join(".") ?? "unknown"}`);
  }

  const normalized = parsedInput.data;
  if (isForbiddenSourceClass(normalized.source_class)) {
    fail(`forbidden_source_class:${normalized.source_class}`);
  }
  if (normalized.source_class !== "derived_knowledge_view") {
    fail(`unsupported_source_class:${normalized.source_class}`);
  }

  const parsedView = DerivedKnowledgeViewSchema.safeParse(normalized.source_view);
  if (!parsedView.success) {
    fail(`invalid_source_view:${parsedView.error.issues[0]?.path.join(".") ?? "unknown"}`);
  }
  const sourceView = parsedView.data;
  const expectedViewType = getExpectedViewType(normalized.prior_type);
  if (sourceView.view_type !== expectedViewType) {
    fail(`source_view_type_mismatch:${normalized.prior_type}:${sourceView.view_type}`);
  }
  if (sourceView.view_status !== "ready") {
    fail(`insufficient_evidence:view_status:${sourceView.view_status}`);
  }
  if (sourceView.sample_count < normalized.minimum_sample_count) {
    fail(`insufficient_evidence:sample_count:${sourceView.sample_count}:${normalized.minimum_sample_count}`);
  }
  if (sourceView.source_case_refs.length < normalized.minimum_evidence_count) {
    fail(
      `insufficient_evidence:source_case_refs:${sourceView.source_case_refs.length}:${normalized.minimum_evidence_count}`
    );
  }
  if (normalized.review_metadata.review_state !== "reviewed") {
    fail(`review_gate_blocked:${normalized.review_metadata.review_state}`);
  }
  if (normalized.review_metadata.review_journal_record_refs.length === 0) {
    fail("review_gate_blocked:no_review_journal_refs");
  }

  const sourceEntry = pickMatchingEntry(normalized.prior_type, normalized.subject_key, sourceView);
  if (sourceEntry.sample_count < normalized.minimum_sample_count) {
    fail(`insufficient_evidence:entry_sample_count:${sourceEntry.sample_count}:${normalized.minimum_sample_count}`);
  }
  if (sourceEntry.source_case_refs.length < normalized.minimum_evidence_count) {
    fail(
      `insufficient_evidence:entry_source_case_refs:${sourceEntry.source_case_refs.length}:${normalized.minimum_evidence_count}`
    );
  }

  const valuePayload = buildValuePayload(normalized.prior_type, sourceEntry);
  const evidenceLineage = buildEvidenceLineage(sourceView, sourceEntry);
  const priorId = buildPriorId({
    priorType: normalized.prior_type,
    subjectKey: normalized.subject_key,
    sourceViewId: sourceView.view_id,
    sourceEntryKey: getEntrySubjectKey(normalized.prior_type, sourceEntry),
    reviewMetadata: normalized.review_metadata,
    minimumSampleCount: normalized.minimum_sample_count,
    minimumEvidenceCount: normalized.minimum_evidence_count,
    metricValue: valuePayload.metric_value,
  });

  const promotionGateResult = {
    gate_status: "approved" as const,
    gate_reason: "validated_reviewed_evidence_backed",
    minimum_sample_count: normalized.minimum_sample_count,
    minimum_evidence_count: normalized.minimum_evidence_count,
    actual_sample_count: sourceEntry.sample_count,
    actual_evidence_count: sourceEntry.source_case_refs.length,
  };

  const priorRecord = MachineSafePriorRecordSchema.parse({
    schema_version: "priors.machine_safe_prior.v1",
    layer: "machine_safe_prior",
    source_layer: "derived_knowledge_view",
    recomputable_from_layer: "derived_knowledge_view",
    authority_class: "non_authoritative",
    prior_id: priorId,
    prior_type: normalized.prior_type,
    subject_key: normalized.subject_key,
    value_payload: valuePayload,
    evidence_lineage: evidenceLineage,
    validation_state: "validated",
    promotion_gate_result: promotionGateResult,
    effective_range: {
      effective_from: normalized.review_metadata.reviewed_at,
      effective_until: normalized.effective_until,
    },
    review_metadata: normalized.review_metadata,
    advisory_classification: "advisory_only",
    bot_safe_classification: "bot_safe",
  });

  return priorRecord;
}

