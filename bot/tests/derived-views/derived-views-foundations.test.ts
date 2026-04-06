import { describe, expect, it } from "vitest";
import {
  buildFailureModeView,
  buildKolAccountRankingView,
  buildRegimeMetaPerformanceView,
  buildSetupPerformanceView,
  buildSignalPatternView,
} from "../../src/derived-views/derived-views-builder.js";
import {
  DerivedKnowledgeViewSchema,
  type CanonicalCaseType,
  type CaseSubjectRef,
} from "../../src/core/contracts/derived-views.js";
import { buildCanonicalCaseRecord } from "../../src/casebook/casebook-builder.js";
import type { CanonicalCaseRecord } from "../../src/core/contracts/casebook.js";
import {
  buildDecisionEnvelopeFixtureSet,
  decisionEnvelopeSemantics,
} from "../fixtures/decision-envelope.fixtures.js";

function makeSubjectRef(subject_kind: CaseSubjectRef["subject_kind"], subject_id: string): CaseSubjectRef {
  return {
    subject_kind,
    subject_id,
    subject_label: `${subject_kind}:${subject_id}`,
  };
}

function makeJournalEntry(input: {
  traceId: string;
  timestamp: string;
  stage: string;
  blocked?: boolean;
  reason?: string;
}): {
  traceId: string;
  timestamp: string;
  stage: string;
  decisionHash: string;
  resultHash: string;
  input: Record<string, string>;
  output: Record<string, string>;
  blocked?: boolean;
  reason?: string;
  eventHash: string;
} {
  return {
    traceId: input.traceId,
    timestamp: input.timestamp,
    stage: input.stage,
    decisionHash: `decision:${input.traceId}:${input.stage}:${input.timestamp}`,
    resultHash: `result:${input.traceId}:${input.stage}:${input.timestamp}`,
    input: { traceId: input.traceId, stage: input.stage, timestamp: input.timestamp },
    output: { traceId: input.traceId, stage: input.stage, timestamp: input.timestamp },
    blocked: input.blocked,
    reason: input.reason,
    eventHash: `event:${input.traceId}:${input.stage}:${input.timestamp}`,
  };
}

function makeCaseRecord(input: {
  case_type: CanonicalCaseType;
  traceId: string;
  outcome: "positive" | "negative" | "neutral";
  subjectRefs: CaseSubjectRef[];
}): CanonicalCaseRecord {
  return buildCanonicalCaseRecord({
    case_type: input.case_type,
    trace_id: input.traceId,
    subject_refs: input.subjectRefs,
    decision_time_journal_entries: [
      makeJournalEntry({
        traceId: input.traceId,
        timestamp: "2026-03-17T10:00:00.000Z",
        stage: "worker.event",
      }),
      makeJournalEntry({
        traceId: input.traceId,
        timestamp: "2026-03-17T10:01:00.000Z",
        stage: "worker.gate.integrity",
      }),
      makeJournalEntry({
        traceId: input.traceId,
        timestamp: "2026-03-17T10:02:00.000Z",
        stage: "worker.routing",
      }),
      makeJournalEntry({
        traceId: input.traceId,
        timestamp: "2026-03-17T10:03:00.000Z",
        stage: "worker.cadence.policy",
      }),
    ],
    outcome_time_journal_entries: [
      makeJournalEntry({
        traceId: input.traceId,
        timestamp: "2026-03-17T11:00:00.000Z",
        stage: "worker.transition.lowcap_hunter",
      }),
      makeJournalEntry({
        traceId: input.traceId,
        timestamp: "2026-03-17T11:01:00.000Z",
        stage: "worker.write_effect",
      }),
    ],
    review_time_journal_entries: [
      makeJournalEntry({
        traceId: input.traceId,
        timestamp: "2026-03-17T12:00:00.000Z",
        stage: "worker.model_result",
      }),
    ],
    compressed_case_summary: `summary:${input.case_type}:${input.outcome}`,
    compressed_case_facts: [`performance:${input.outcome}`],
    compressed_case_inferences: [`performance:${input.outcome}`],
    compressed_case_lessons: [`performance:${input.outcome}`],
    compression_version: "derived-view-test.v1",
  });
}

function buildSharedCaseSet(): CanonicalCaseRecord[] {
  return [
    makeCaseRecord({
      case_type: "trade_case",
      traceId: "derived-trace-1",
      outcome: "positive",
      subjectRefs: [
        makeSubjectRef("token", "token-alpha"),
        makeSubjectRef("trade", "trade-alpha"),
        makeSubjectRef("setup_type", "setup-alpha"),
        makeSubjectRef("market_regime", "regime-bull"),
        makeSubjectRef("meta", "meta-a"),
        makeSubjectRef("account_or_kol", "kol-alpha"),
        makeSubjectRef("signal_cluster", "cluster-a"),
        makeSubjectRef("failure_mode", "slippage"),
        makeSubjectRef("review_period", "2026-03"),
      ],
    }),
    makeCaseRecord({
      case_type: "meta_shift_case",
      traceId: "derived-trace-2",
      outcome: "negative",
      subjectRefs: [
        makeSubjectRef("meta", "meta-a"),
        makeSubjectRef("market_regime", "regime-bull"),
        makeSubjectRef("setup_type", "setup-alpha"),
        makeSubjectRef("account_or_kol", "kol-alpha"),
        makeSubjectRef("signal_cluster", "cluster-a"),
        makeSubjectRef("failure_mode", "slippage"),
        makeSubjectRef("review_period", "2026-03"),
      ],
    }),
    makeCaseRecord({
      case_type: "trade_post_mortem_case",
      traceId: "derived-trace-3",
      outcome: "positive",
      subjectRefs: [
        makeSubjectRef("trade", "trade-beta"),
        makeSubjectRef("failure_mode", "slippage"),
        makeSubjectRef("review_period", "2026-03"),
        makeSubjectRef("setup_type", "setup-alpha"),
        makeSubjectRef("meta", "meta-a"),
        makeSubjectRef("market_regime", "regime-bull"),
        makeSubjectRef("account_or_kol", "kol-alpha"),
        makeSubjectRef("signal_cluster", "cluster-a"),
      ],
    }),
  ];
}

describe("derived knowledge views", () => {
  it("builds the five derived views with explicit non-authoritative typed shape", () => {
    const cases = buildSharedCaseSet();
    const views = [
      buildSetupPerformanceView(cases),
      buildRegimeMetaPerformanceView(cases),
      buildKolAccountRankingView(cases),
      buildFailureModeView(cases),
      buildSignalPatternView(cases),
    ];

    for (const view of views) {
      const parsed = DerivedKnowledgeViewSchema.parse(view);
      expect(parsed.layer).toBe("derived_knowledge_view");
      expect(parsed.source_layer).toBe("canonical_case_record");
      expect(parsed.authority_class).toBe("non_authoritative");
      expect(parsed.view_status).toBe("ready");
      expect(parsed.sample_count).toBe(3);
      expect(parsed.source_case_refs).toHaveLength(3);
      expect(parsed.trace_refs).toEqual(["derived-trace-1", "derived-trace-2", "derived-trace-3"]);
      expect(parsed.evidence_lineage_refs.length).toBeGreaterThan(0);
      expect(parsed).not.toHaveProperty("decisionEnvelope");
      expect(parsed).not.toHaveProperty("prior");
      expect(parsed).not.toHaveProperty("playbook");
    }
  });

  it("recomputes the same view from cloned lower-layer inputs and preserves lineage", () => {
    const cases = buildSharedCaseSet();
    const first = buildSetupPerformanceView(cases);
    const second = buildSetupPerformanceView(structuredClone(cases));

    expect(first).toStrictEqual(second);
    expect(first.view_id).toBe(second.view_id);
    expect(first.entries).toHaveLength(1);
    expect(first.entries[0].sample_status).toBe("ready");
    expect(first.entries[0].source_case_refs.map((ref) => ref.case_id)).toEqual(
      cases.map((sourceCase) => sourceCase.case_id).sort()
    );
    expect(first.entries[0].source_case_refs[0].source_journal_record_refs).toHaveLength(7);
    expect(first.entries[0].evidence_lineage_refs.length).toBeGreaterThan(0);
  });

  it("returns explicit insufficient-sample output when source cases are too sparse", () => {
    const [singleCase] = buildSharedCaseSet();
    const view = buildSetupPerformanceView([singleCase]);

    expect(view.view_status).toBe("insufficient_sample");
    expect(view.sample_count).toBe(1);
    expect(view.minimum_sample_count).toBe(3);
    expect(view.insufficient_sample_reason).toContain("setup_performance_view");
    expect(view.entries[0].sample_status).toBe("insufficient_sample");
    expect(view.entries[0].sample_count).toBe(1);
  });

  it("keeps decision truth untouched and derived scope free of priors and playbooks", async () => {
    const fixtures = await buildDecisionEnvelopeFixtureSet();
    const before = decisionEnvelopeSemantics(fixtures.allowEnvelope);
    const view = buildSignalPatternView(buildSharedCaseSet());

    expect(decisionEnvelopeSemantics(fixtures.allowEnvelope)).toStrictEqual(before);
    expect(view).not.toHaveProperty("decisionEnvelope");
    expect(view).not.toHaveProperty("prior");
    expect(view).not.toHaveProperty("playbook");
    expect(view.entries[0].signal_pattern_key).toBe("cluster-a::setup-alpha::regime-bull");
    expect(view.entries[0].rank_position).toBe(1);
  });
});
