import { hashResult } from "../core/determinism/hash.js";
import type { CanonicalCaseRecord, CaseSubjectRef, CaseSubjectKind } from "../core/contracts/casebook.js";
import { CanonicalCaseRecordSchema } from "../core/contracts/casebook.js";
import {
  AccountOrKolSubjectRefSchema,
  DerivedKnowledgeViewSchema,
  FailureModeSubjectRefSchema,
  KolAccountRankingEntrySchema,
  KolAccountRankingViewSchema,
  MarketRegimeSubjectRefSchema,
  RegimeMetaPerformanceEntrySchema,
  RegimeMetaPerformanceViewSchema,
  SetupPerformanceEntrySchema,
  SetupPerformanceViewSchema,
  SetupTypeSubjectRefSchema,
  SignalClusterSubjectRefSchema,
  SignalPatternEntrySchema,
  SignalPatternViewSchema,
  FailureModeEntrySchema,
  FailureModeViewSchema,
  type DerivedKnowledgeView,
  type DerivedKnowledgeViewKind,
  type DerivedKnowledgeViewStatus,
  type DerivedViewSourceCaseRef,
  type FailureModeEntry,
  type FailureModeView,
  type KolAccountRankingEntry,
  type KolAccountRankingView,
  type RegimeMetaPerformanceEntry,
  type RegimeMetaPerformanceView,
  type SetupPerformanceEntry,
  type SetupPerformanceView,
  type SignalPatternEntry,
  type SignalPatternView,
} from "../core/contracts/derived-views.js";

export const DERIVED_VIEW_MINIMUM_SAMPLE_COUNTS: Readonly<Record<DerivedKnowledgeViewKind, number>> = {
  setup_performance_view: 3,
  regime_meta_performance_view: 3,
  kol_account_ranking_view: 3,
  failure_mode_view: 2,
  signal_pattern_view: 3,
} as const;

const OUTCOME_TOKEN_POSITIVE = new Set([
  "performance:positive",
  "outcome:positive",
  "outcome:win",
  "outcome:success",
  "performance:win",
]);
const OUTCOME_TOKEN_NEGATIVE = new Set([
  "performance:negative",
  "outcome:negative",
  "outcome:loss",
  "outcome:failure",
  "performance:loss",
]);
const OUTCOME_TOKEN_NEUTRAL = new Set(["performance:neutral", "outcome:neutral", "outcome:flat"]);

type OutcomeLabel = "positive" | "negative" | "neutral";

interface NormalizedCaseRecord extends CanonicalCaseRecord {
  case_id: string;
}

type SetupTypeRef = CaseSubjectRef & { subject_kind: "setup_type" };
type MarketRegimeRef = CaseSubjectRef & { subject_kind: "market_regime" };
type AccountOrKolRef = CaseSubjectRef & { subject_kind: "account_or_kol" };
type FailureModeRef = CaseSubjectRef & { subject_kind: "failure_mode" };
type SignalClusterRef = CaseSubjectRef & { subject_kind: "signal_cluster" };
type MetaRef = CaseSubjectRef & { subject_kind: "meta" };

interface GroupedCases<TFocus> {
  key: string;
  focus: TFocus;
  cases: NormalizedCaseRecord[];
}

interface SampleStats {
  positive_case_count: number;
  negative_case_count: number;
  neutral_case_count: number;
}

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
  throw new Error(`DERIVED_VIEW_BUILD_FAILED:${details}`);
}

function normalizeCases(sourceCases: ReadonlyArray<CanonicalCaseRecord>): NormalizedCaseRecord[] {
  if (sourceCases.length === 0) {
    return [];
  }

  const normalized = sourceCases.map((sourceCase, index) => {
    const parsed = CanonicalCaseRecordSchema.safeParse(sourceCase);
    if (!parsed.success) {
      fail(`invalid_case:${index}`);
    }
    return parsed.data as NormalizedCaseRecord;
  });

  normalized.sort((left, right) => compareText(left.case_id, right.case_id) || compareText(left.trace_id, right.trace_id));
  return normalized;
}

function createSourceCaseRef(sourceCase: NormalizedCaseRecord): DerivedViewSourceCaseRef {
  return {
    case_id: sourceCase.case_id,
    case_type: sourceCase.case_type,
    trace_id: sourceCase.trace_id,
    source_journal_record_refs: sourceCase.evidence.source_journal_record_refs,
    trace_refs: sourceCase.evidence.trace_refs,
    evidence_lineage_refs: sourceCase.evidence.evidence_lineage_refs,
  };
}

function collectSourceCaseRefs(sourceCases: ReadonlyArray<NormalizedCaseRecord>): DerivedViewSourceCaseRef[] {
  return [...sourceCases]
    .sort((left, right) => compareText(left.case_id, right.case_id))
    .map(createSourceCaseRef);
}

function collectTraceRefs(sourceCases: ReadonlyArray<NormalizedCaseRecord>): string[] {
  return [...new Set(sourceCases.flatMap((sourceCase) => sourceCase.evidence.trace_refs))].sort(compareText);
}

function collectEvidenceLineageRefs(sourceCases: ReadonlyArray<NormalizedCaseRecord>): string[] {
  return [...new Set(sourceCases.flatMap((sourceCase) => sourceCase.evidence.evidence_lineage_refs))].sort(compareText);
}

function getSubjectRef<T extends CaseSubjectKind>(
  sourceCase: NormalizedCaseRecord,
  subjectKind: T
): CaseSubjectRef | undefined {
  const refs = sourceCase.subject_refs
    .filter((ref): ref is CaseSubjectRef => ref.subject_kind === subjectKind)
    .sort((left, right) => compareText(left.subject_id, right.subject_id));
  return refs.at(0);
}

function buildSampleStats(cases: ReadonlyArray<NormalizedCaseRecord>): SampleStats {
  let positive_case_count = 0;
  let negative_case_count = 0;
  let neutral_case_count = 0;

  for (const sourceCase of cases) {
    const label = extractOutcomeLabel(sourceCase);
    if (label === "positive") {
      positive_case_count += 1;
    } else if (label === "negative") {
      negative_case_count += 1;
    } else {
      neutral_case_count += 1;
    }
  }

  return {
    positive_case_count,
    negative_case_count,
    neutral_case_count,
  };
}

function extractOutcomeLabel(sourceCase: NormalizedCaseRecord): OutcomeLabel {
  const tokens = [
    ...sourceCase.compressed_case_facts,
    ...sourceCase.compressed_case_inferences,
    ...sourceCase.compressed_case_lessons,
  ];

  const recognized = new Set<OutcomeLabel>();
  for (const token of tokens) {
    if (OUTCOME_TOKEN_POSITIVE.has(token)) {
      recognized.add("positive");
    } else if (OUTCOME_TOKEN_NEGATIVE.has(token)) {
      recognized.add("negative");
    } else if (OUTCOME_TOKEN_NEUTRAL.has(token)) {
      recognized.add("neutral");
    }
  }

  if (recognized.size > 1) {
    fail(`conflicting_outcome_labels:${sourceCase.case_id}`);
  }

  return recognized.values().next().value ?? "neutral";
}

function scoreFromSampleStats(stats: SampleStats): number {
  const sampleCount = stats.positive_case_count + stats.negative_case_count + stats.neutral_case_count;
  if (sampleCount === 0) {
    return 0;
  }
  return (stats.positive_case_count - stats.negative_case_count) / sampleCount;
}

function failurePressureFromSampleStats(stats: SampleStats): number {
  const sampleCount = stats.positive_case_count + stats.negative_case_count + stats.neutral_case_count;
  if (sampleCount === 0) {
    return 0;
  }
  return stats.negative_case_count / sampleCount;
}

function deriveViewStatus(
  viewType: DerivedKnowledgeViewKind,
  sampleCount: number
): { viewStatus: DerivedKnowledgeViewStatus; minimumSampleCount: number; insufficientReason?: string } {
  const minimumSampleCount = DERIVED_VIEW_MINIMUM_SAMPLE_COUNTS[viewType];
  if (sampleCount < minimumSampleCount) {
    return {
      viewStatus: "insufficient_sample",
      minimumSampleCount,
      insufficientReason: `insufficient_sample:${viewType}:${sampleCount}:${minimumSampleCount}`,
    };
  }
  return {
    viewStatus: "ready",
    minimumSampleCount,
  };
}

function buildViewId(input: {
  viewType: DerivedKnowledgeViewKind;
  sampleCount: number;
  viewStatus: DerivedKnowledgeViewStatus;
  sourceCaseIds: ReadonlyArray<string>;
  entryKeys: ReadonlyArray<string>;
}): string {
  return `derived:${input.viewType}:${hashResult(input)}`;
}

function finalizeEntries<TEntry extends { rank_position: number }>(
  entries: TEntry[],
  scoreAccessor: (entry: TEntry) => number,
  sampleCountAccessor: (entry: TEntry) => number,
  keyAccessor: (entry: TEntry) => string
): TEntry[] {
  return entries
    .sort((left, right) => {
      return (
        scoreAccessor(right) - scoreAccessor(left) ||
        sampleCountAccessor(right) - sampleCountAccessor(left) ||
        compareText(keyAccessor(left), keyAccessor(right))
      );
    })
    .map((entry, index) => ({ ...entry, rank_position: index + 1 }));
}

function buildSetupPerformanceEntries(sourceCases: ReadonlyArray<NormalizedCaseRecord>): SetupPerformanceEntry[] {
  const buckets = new Map<string, GroupedCases<SetupTypeRef>>();

  for (const sourceCase of sourceCases) {
    const setupTypeRef = getSubjectRef(sourceCase, "setup_type");
    if (!setupTypeRef) {
      continue;
    }
    const key = setupTypeRef.subject_id;
    const bucket = buckets.get(key) ?? { key, focus: setupTypeRef as SetupTypeRef, cases: [] };
    bucket.cases.push(sourceCase);
    buckets.set(key, bucket);
  }

  return finalizeEntries(
    [...buckets.values()].map((bucket) => {
      const sampleStats = buildSampleStats(bucket.cases);
      const sampleCount = bucket.cases.length;
      const sampleState = deriveViewStatus("setup_performance_view", sampleCount);
      const source_case_refs = collectSourceCaseRefs(bucket.cases);
      return SetupPerformanceEntrySchema.parse({
        setup_type_ref: bucket.focus,
        sample_count: sampleCount,
        minimum_sample_count: sampleState.minimumSampleCount,
        sample_status: sampleState.viewStatus,
        source_case_refs,
        trace_refs: collectTraceRefs(bucket.cases),
        evidence_lineage_refs: collectEvidenceLineageRefs(bucket.cases),
        sample_stats: sampleStats,
        performance_score: scoreFromSampleStats(sampleStats),
        rank_position: 1,
      });
    }),
    (entry) => entry.performance_score,
    (entry) => entry.sample_count,
    (entry) => entry.setup_type_ref.subject_id
  );
}

function buildRegimeMetaPerformanceEntries(
  sourceCases: ReadonlyArray<NormalizedCaseRecord>
): RegimeMetaPerformanceEntry[] {
  const buckets = new Map<
    string,
    GroupedCases<{ market_regime_ref: MarketRegimeRef; meta_ref: MetaRef }>
  >();

  for (const sourceCase of sourceCases) {
    const marketRegimeRef = getSubjectRef(sourceCase, "market_regime");
    const metaRef = getSubjectRef(sourceCase, "meta");
    if (!marketRegimeRef || !metaRef) {
      continue;
    }
    const key = `${marketRegimeRef.subject_id}::${metaRef.subject_id}`;
    const bucket = buckets.get(key) ?? {
      key,
      focus: { market_regime_ref: marketRegimeRef as MarketRegimeRef, meta_ref: metaRef as MetaRef },
      cases: [],
    };
    bucket.cases.push(sourceCase);
    buckets.set(key, bucket);
  }

  return finalizeEntries(
    [...buckets.values()].map((bucket) => {
      const sampleStats = buildSampleStats(bucket.cases);
      const sampleCount = bucket.cases.length;
      const sampleState = deriveViewStatus("regime_meta_performance_view", sampleCount);
      return RegimeMetaPerformanceEntrySchema.parse({
        market_regime_ref: bucket.focus.market_regime_ref,
        meta_ref: bucket.focus.meta_ref,
        sample_count: sampleCount,
        minimum_sample_count: sampleState.minimumSampleCount,
        sample_status: sampleState.viewStatus,
        source_case_refs: collectSourceCaseRefs(bucket.cases),
        trace_refs: collectTraceRefs(bucket.cases),
        evidence_lineage_refs: collectEvidenceLineageRefs(bucket.cases),
        sample_stats: sampleStats,
        performance_score: scoreFromSampleStats(sampleStats),
        rank_position: 1,
      });
    }),
    (entry) => entry.performance_score,
    (entry) => entry.sample_count,
    (entry) => `${entry.market_regime_ref.subject_id}::${entry.meta_ref.subject_id}`
  );
}

function buildKolAccountRankingEntries(
  sourceCases: ReadonlyArray<NormalizedCaseRecord>
): KolAccountRankingEntry[] {
  const buckets = new Map<string, GroupedCases<AccountOrKolRef>>();

  for (const sourceCase of sourceCases) {
    const accountRef = getSubjectRef(sourceCase, "account_or_kol");
    if (!accountRef) {
      continue;
    }
    const key = accountRef.subject_id;
    const bucket = buckets.get(key) ?? { key, focus: accountRef as AccountOrKolRef, cases: [] };
    bucket.cases.push(sourceCase);
    buckets.set(key, bucket);
  }

  return finalizeEntries(
    [...buckets.values()].map((bucket) => {
      const sampleStats = buildSampleStats(bucket.cases);
      const sampleCount = bucket.cases.length;
      const sampleState = deriveViewStatus("kol_account_ranking_view", sampleCount);
      return KolAccountRankingEntrySchema.parse({
        account_or_kol_ref: bucket.focus,
        sample_count: sampleCount,
        minimum_sample_count: sampleState.minimumSampleCount,
        sample_status: sampleState.viewStatus,
        source_case_refs: collectSourceCaseRefs(bucket.cases),
        trace_refs: collectTraceRefs(bucket.cases),
        evidence_lineage_refs: collectEvidenceLineageRefs(bucket.cases),
        sample_stats: sampleStats,
        ranking_score: scoreFromSampleStats(sampleStats),
        rank_position: 1,
      });
    }),
    (entry) => entry.ranking_score,
    (entry) => entry.sample_count,
    (entry) => entry.account_or_kol_ref.subject_id
  );
}

function buildFailureModeEntries(sourceCases: ReadonlyArray<NormalizedCaseRecord>): FailureModeEntry[] {
  const buckets = new Map<string, GroupedCases<FailureModeRef>>();

  for (const sourceCase of sourceCases) {
    const failureModeRef = getSubjectRef(sourceCase, "failure_mode");
    if (!failureModeRef) {
      continue;
    }
    const key = failureModeRef.subject_id;
    const bucket = buckets.get(key) ?? { key, focus: failureModeRef as FailureModeRef, cases: [] };
    bucket.cases.push(sourceCase);
    buckets.set(key, bucket);
  }

  return finalizeEntries(
    [...buckets.values()].map((bucket) => {
      const sampleStats = buildSampleStats(bucket.cases);
      const sampleCount = bucket.cases.length;
      const sampleState = deriveViewStatus("failure_mode_view", sampleCount);
      return FailureModeEntrySchema.parse({
        failure_mode_ref: bucket.focus,
        sample_count: sampleCount,
        minimum_sample_count: sampleState.minimumSampleCount,
        sample_status: sampleState.viewStatus,
        source_case_refs: collectSourceCaseRefs(bucket.cases),
        trace_refs: collectTraceRefs(bucket.cases),
        evidence_lineage_refs: collectEvidenceLineageRefs(bucket.cases),
        sample_stats: sampleStats,
        failure_pressure_score: failurePressureFromSampleStats(sampleStats),
        rank_position: 1,
      });
    }),
    (entry) => entry.failure_pressure_score,
    (entry) => entry.sample_count,
    (entry) => entry.failure_mode_ref.subject_id
  );
}

function buildSignalPatternEntries(sourceCases: ReadonlyArray<NormalizedCaseRecord>): SignalPatternEntry[] {
  const buckets = new Map<
    string,
    GroupedCases<{
      signal_cluster_ref: SignalClusterRef;
      setup_type_ref?: SetupTypeRef;
      market_regime_ref?: MarketRegimeRef;
    }>
  >();

  for (const sourceCase of sourceCases) {
    const signalClusterRef = getSubjectRef(sourceCase, "signal_cluster");
    if (!signalClusterRef) {
      continue;
    }
    const setupTypeRef = getSubjectRef(sourceCase, "setup_type");
    const marketRegimeRef = getSubjectRef(sourceCase, "market_regime");
    const key = [
      signalClusterRef.subject_id,
      setupTypeRef?.subject_id ?? "unknown",
      marketRegimeRef?.subject_id ?? "unknown",
    ].join("::");
    const bucket = buckets.get(key) ?? {
      key,
      focus: {
        signal_cluster_ref: signalClusterRef as SignalClusterRef,
        setup_type_ref: setupTypeRef as SetupTypeRef | undefined,
        market_regime_ref: marketRegimeRef as MarketRegimeRef | undefined,
      },
      cases: [],
    };
    bucket.cases.push(sourceCase);
    buckets.set(key, bucket);
  }

  return finalizeEntries(
    [...buckets.values()].map((bucket) => {
      const sampleStats = buildSampleStats(bucket.cases);
      const sampleCount = bucket.cases.length;
      const sampleState = deriveViewStatus("signal_pattern_view", sampleCount);
      return SignalPatternEntrySchema.parse({
        signal_pattern_key: bucket.key,
        signal_cluster_ref: bucket.focus.signal_cluster_ref,
        setup_type_ref: bucket.focus.setup_type_ref,
        market_regime_ref: bucket.focus.market_regime_ref,
        sample_count: sampleCount,
        minimum_sample_count: sampleState.minimumSampleCount,
        sample_status: sampleState.viewStatus,
        source_case_refs: collectSourceCaseRefs(bucket.cases),
        trace_refs: collectTraceRefs(bucket.cases),
        evidence_lineage_refs: collectEvidenceLineageRefs(bucket.cases),
        sample_stats: sampleStats,
        pattern_score: scoreFromSampleStats(sampleStats),
        rank_position: 1,
      });
    }),
    (entry) => entry.pattern_score,
    (entry) => entry.sample_count,
    (entry) => entry.signal_pattern_key
  );
}

function buildViewBase(input: {
  view_type: DerivedKnowledgeViewKind;
  source_cases: ReadonlyArray<NormalizedCaseRecord>;
  entries: ReadonlyArray<{ sample_count: number; rank_position: number; source_case_refs: DerivedViewSourceCaseRef[]; trace_refs: string[]; evidence_lineage_refs: string[] }>;
}): {
  view_id: string;
  view_status: DerivedKnowledgeViewStatus;
  minimum_sample_count: number;
  insufficient_sample_reason?: string;
  sample_count: number;
  source_case_refs: DerivedViewSourceCaseRef[];
  trace_refs: string[];
  evidence_lineage_refs: string[];
} {
  const source_case_refs = collectSourceCaseRefs(input.source_cases);
  const trace_refs = collectTraceRefs(input.source_cases);
  const evidence_lineage_refs = collectEvidenceLineageRefs(input.source_cases);
  const sample_count = input.source_cases.length;
  const status = deriveViewStatus(input.view_type, sample_count);
  const entryKeys = input.entries.map((entry) => `${entry.rank_position}:${entry.sample_count}:${entry.source_case_refs.map((ref) => ref.case_id).join(",")}`);

  return {
    view_id: buildViewId({
      viewType: input.view_type,
      sampleCount: sample_count,
      viewStatus: status.viewStatus,
      sourceCaseIds: source_case_refs.map((ref) => ref.case_id),
      entryKeys,
    }),
    view_status: status.viewStatus,
    minimum_sample_count: status.minimumSampleCount,
    insufficient_sample_reason: status.insufficientReason,
    sample_count,
    source_case_refs,
    trace_refs,
    evidence_lineage_refs,
  };
}

function buildReadyView<TView>(view: TView): TView {
  const parsed = DerivedKnowledgeViewSchema.safeParse(view);
  if (!parsed.success) {
    fail(`invalid_view:${parsed.error.issues[0]?.path.join(".") ?? "unknown"}`);
  }
  return parsed.data as TView;
}

export function buildSetupPerformanceView(sourceCases: ReadonlyArray<CanonicalCaseRecord>): SetupPerformanceView {
  const normalized = normalizeCases(sourceCases);
  const entries = buildSetupPerformanceEntries(normalized);
  const base = buildViewBase({
    view_type: "setup_performance_view",
    source_cases: normalized.filter((sourceCase) => getSubjectRef(sourceCase, "setup_type") !== undefined),
    entries,
  });
  return buildReadyView(
    SetupPerformanceViewSchema.parse({
      schema_version: "derived.knowledge_view.v1",
      layer: "derived_knowledge_view",
      source_layer: "canonical_case_record",
      authority_class: "non_authoritative",
      recomputable_from_layer: "canonical_case_record",
      view_type: "setup_performance_view",
      ...base,
      entries,
    })
  );
}

export function buildRegimeMetaPerformanceView(
  sourceCases: ReadonlyArray<CanonicalCaseRecord>
): RegimeMetaPerformanceView {
  const normalized = normalizeCases(sourceCases);
  const entries = buildRegimeMetaPerformanceEntries(normalized);
  const sourceCasesForView = normalized.filter(
    (sourceCase) => getSubjectRef(sourceCase, "market_regime") !== undefined && getSubjectRef(sourceCase, "meta") !== undefined
  );
  const base = buildViewBase({
    view_type: "regime_meta_performance_view",
    source_cases: sourceCasesForView,
    entries,
  });
  return buildReadyView(
    RegimeMetaPerformanceViewSchema.parse({
      schema_version: "derived.knowledge_view.v1",
      layer: "derived_knowledge_view",
      source_layer: "canonical_case_record",
      authority_class: "non_authoritative",
      recomputable_from_layer: "canonical_case_record",
      view_type: "regime_meta_performance_view",
      ...base,
      entries,
    })
  );
}

export function buildKolAccountRankingView(sourceCases: ReadonlyArray<CanonicalCaseRecord>): KolAccountRankingView {
  const normalized = normalizeCases(sourceCases);
  const entries = buildKolAccountRankingEntries(normalized);
  const sourceCasesForView = normalized.filter((sourceCase) => getSubjectRef(sourceCase, "account_or_kol") !== undefined);
  const base = buildViewBase({
    view_type: "kol_account_ranking_view",
    source_cases: sourceCasesForView,
    entries,
  });
  return buildReadyView(
    KolAccountRankingViewSchema.parse({
      schema_version: "derived.knowledge_view.v1",
      layer: "derived_knowledge_view",
      source_layer: "canonical_case_record",
      authority_class: "non_authoritative",
      recomputable_from_layer: "canonical_case_record",
      view_type: "kol_account_ranking_view",
      ...base,
      entries,
    })
  );
}

export function buildFailureModeView(sourceCases: ReadonlyArray<CanonicalCaseRecord>): FailureModeView {
  const normalized = normalizeCases(sourceCases);
  const entries = buildFailureModeEntries(normalized);
  const sourceCasesForView = normalized.filter((sourceCase) => getSubjectRef(sourceCase, "failure_mode") !== undefined);
  const base = buildViewBase({
    view_type: "failure_mode_view",
    source_cases: sourceCasesForView,
    entries,
  });
  return buildReadyView(
    FailureModeViewSchema.parse({
      schema_version: "derived.knowledge_view.v1",
      layer: "derived_knowledge_view",
      source_layer: "canonical_case_record",
      authority_class: "non_authoritative",
      recomputable_from_layer: "canonical_case_record",
      view_type: "failure_mode_view",
      ...base,
      entries,
    })
  );
}

export function buildSignalPatternView(sourceCases: ReadonlyArray<CanonicalCaseRecord>): SignalPatternView {
  const normalized = normalizeCases(sourceCases);
  const entries = buildSignalPatternEntries(normalized);
  const sourceCasesForView = normalized.filter((sourceCase) => getSubjectRef(sourceCase, "signal_cluster") !== undefined);
  const base = buildViewBase({
    view_type: "signal_pattern_view",
    source_cases: sourceCasesForView,
    entries,
  });
  return buildReadyView(
    SignalPatternViewSchema.parse({
      schema_version: "derived.knowledge_view.v1",
      layer: "derived_knowledge_view",
      source_layer: "canonical_case_record",
      authority_class: "non_authoritative",
      recomputable_from_layer: "canonical_case_record",
      view_type: "signal_pattern_view",
      ...base,
      entries,
    })
  );
}

export function buildDerivedKnowledgeView(input: {
  sourceCases: ReadonlyArray<CanonicalCaseRecord>;
  viewType: DerivedKnowledgeViewKind;
}): DerivedKnowledgeView {
  switch (input.viewType) {
    case "setup_performance_view":
      return buildSetupPerformanceView(input.sourceCases);
    case "regime_meta_performance_view":
      return buildRegimeMetaPerformanceView(input.sourceCases);
    case "kol_account_ranking_view":
      return buildKolAccountRankingView(input.sourceCases);
    case "failure_mode_view":
      return buildFailureModeView(input.sourceCases);
    case "signal_pattern_view":
      return buildSignalPatternView(input.sourceCases);
    default: {
      const exhaustiveCheck: never = input.viewType;
      return exhaustiveCheck;
    }
  }
}
