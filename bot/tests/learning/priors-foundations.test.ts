import { describe, expect, it } from "vitest";
import {
  buildFailureModeView,
  buildKolAccountRankingView,
  buildRegimeMetaPerformanceView,
  buildSetupPerformanceView,
  buildSignalPatternView,
} from "../../src/derived-views/derived-views-builder.js";
import {
  MachineSafePriorPromotionInputSchema,
  MachineSafePriorRecordSchema,
} from "../../src/core/contracts/priors.js";
import { buildMachineSafePrior } from "../../src/learning/priors-builder.js";
import { buildCanonicalCaseRecord } from "../../src/casebook/casebook-builder.js";
import type { CanonicalCaseRecord } from "../../src/core/contracts/casebook.js";
import {
  buildDecisionEnvelopeFixtureSet,
  decisionEnvelopeSemantics,
} from "../fixtures/decision-envelope.fixtures.js";

function makeSubjectRef(subject_kind: "token" | "trade" | "meta" | "account_or_kol" | "signal_cluster" | "setup_type" | "market_regime" | "failure_mode" | "review_period", subject_id: string) {
  return {
    subject_kind,
    subject_id,
    subject_label: `${subject_kind}:${subject_id}`,
  };
}

function makeJournalRecordRef(traceId: string, timestamp: string, stage: string) {
  return {
    trace_id: traceId,
    timestamp,
    stage,
    event_hash: `event:${traceId}:${stage}:${timestamp}`,
    decision_hash: `decision:${traceId}:${stage}:${timestamp}`,
    result_hash: `result:${traceId}:${stage}:${timestamp}`,
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
  case_type: "trade_case" | "meta_shift_case" | "signal_cluster_case" | "kol_influence_case" | "trade_post_mortem_case";
  traceId: string;
  outcome: "positive" | "negative" | "neutral";
  subjectRefs: ReturnType<typeof makeSubjectRef>[];
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
    compression_version: "prior-test.v1",
  });
}

function buildSharedCaseSet(): CanonicalCaseRecord[] {
  return [
    makeCaseRecord({
      case_type: "trade_case",
      traceId: "prior-trace-1",
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
      traceId: "prior-trace-2",
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
      traceId: "prior-trace-3",
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

function makeReviewMetadata(traceId: string, reviewedAt: string) {
  return {
    review_state: "reviewed" as const,
    reviewed_by: "reviewer-governance",
    reviewed_at: reviewedAt,
    review_journal_record_refs: [makeJournalRecordRef(traceId, reviewedAt, "prior.review")],
  };
}

function makePriorInput(input: {
  prior_type:
    | "setup_performance_prior"
    | "regime_meta_performance_prior"
    | "kol_account_ranking_prior"
    | "failure_mode_prior"
    | "signal_pattern_prior";
  subject_key: string;
  source_view: ReturnType<
    | typeof buildSetupPerformanceView
    | typeof buildRegimeMetaPerformanceView
    | typeof buildKolAccountRankingView
    | typeof buildFailureModeView
    | typeof buildSignalPatternView
  >;
  minimum_sample_count: number;
  minimum_evidence_count: number;
  review_trace_id?: string;
}) {
  const reviewedAt = "2026-03-18T00:00:00.000Z";
  return {
    prior_type: input.prior_type,
    subject_key: input.subject_key,
    source_class: "derived_knowledge_view" as const,
    source_view: input.source_view,
    minimum_sample_count: input.minimum_sample_count,
    minimum_evidence_count: input.minimum_evidence_count,
    review_metadata: makeReviewMetadata(input.review_trace_id ?? input.subject_key, reviewedAt),
    effective_until: "2026-04-18T00:00:00.000Z",
  };
}

describe("machine-safe priors", () => {
  it("constructs validated priors from reviewed derived views with explicit non-authoritative shape", () => {
    const cases = buildSharedCaseSet();
    const views = {
      setup: buildSetupPerformanceView(cases),
      regime: buildRegimeMetaPerformanceView(cases),
      kol: buildKolAccountRankingView(cases),
      failure: buildFailureModeView(cases),
      signal: buildSignalPatternView(cases),
    } as const;

    const priors = [
      buildMachineSafePrior(
        makePriorInput({
          prior_type: "setup_performance_prior",
          subject_key: "setup-alpha",
          source_view: views.setup,
          minimum_sample_count: 3,
          minimum_evidence_count: 3,
        })
      ),
      buildMachineSafePrior(
        makePriorInput({
          prior_type: "regime_meta_performance_prior",
          subject_key: "regime-bull::meta-a",
          source_view: views.regime,
          minimum_sample_count: 3,
          minimum_evidence_count: 3,
        })
      ),
      buildMachineSafePrior(
        makePriorInput({
          prior_type: "kol_account_ranking_prior",
          subject_key: "kol-alpha",
          source_view: views.kol,
          minimum_sample_count: 3,
          minimum_evidence_count: 3,
        })
      ),
      buildMachineSafePrior(
        makePriorInput({
          prior_type: "failure_mode_prior",
          subject_key: "slippage",
          source_view: views.failure,
          minimum_sample_count: 2,
          minimum_evidence_count: 2,
        })
      ),
      buildMachineSafePrior(
        makePriorInput({
          prior_type: "signal_pattern_prior",
          subject_key: "cluster-a::setup-alpha::regime-bull",
          source_view: views.signal,
          minimum_sample_count: 3,
          minimum_evidence_count: 3,
        })
      ),
    ];

    for (const prior of priors) {
      const parsed = MachineSafePriorRecordSchema.parse(prior);
      expect(parsed.layer).toBe("machine_safe_prior");
      expect(parsed.source_layer).toBe("derived_knowledge_view");
      expect(parsed.recomputable_from_layer).toBe("derived_knowledge_view");
      expect(parsed.authority_class).toBe("non_authoritative");
      expect(parsed.validation_state).toBe("validated");
      expect(parsed.promotion_gate_result.gate_status).toBe("approved");
      expect(parsed.advisory_classification).toBe("advisory_only");
      expect(parsed.bot_safe_classification).toBe("bot_safe");
      expect(parsed.evidence_lineage.source_class).toBe("derived_knowledge_view");
      expect(parsed.evidence_lineage.source_case_refs.length).toBeGreaterThan(0);
      expect(parsed.evidence_lineage.source_journal_record_refs.length).toBeGreaterThan(0);
      expect(parsed).not.toHaveProperty("decisionEnvelope");
      expect(parsed).not.toHaveProperty("playbook");
    }

    expect(priors.map((prior) => prior.prior_type)).toEqual([
      "setup_performance_prior",
      "regime_meta_performance_prior",
      "kol_account_ranking_prior",
      "failure_mode_prior",
      "signal_pattern_prior",
    ]);
  });

  it("recomputes the same prior from the same reviewed inputs", () => {
    const priorInput = makePriorInput({
      prior_type: "setup_performance_prior",
      subject_key: "setup-alpha",
      source_view: buildSetupPerformanceView(buildSharedCaseSet()),
      minimum_sample_count: 3,
      minimum_evidence_count: 3,
    });

    const first = buildMachineSafePrior(priorInput);
    const second = buildMachineSafePrior(structuredClone(priorInput));

    expect(first).toStrictEqual(second);
    expect(first.prior_id).toBe(second.prior_id);
    expect(first.evidence_lineage.source_view_ref.view_id).toBe(second.evidence_lineage.source_view_ref.view_id);
    expect(first.evidence_lineage.source_case_refs.map((ref) => ref.case_id)).toEqual(
      second.evidence_lineage.source_case_refs.map((ref) => ref.case_id)
    );
  });

  it("rejects forbidden source classes and insufficient evidence", () => {
    expect(() =>
      buildMachineSafePrior({
        prior_type: "setup_performance_prior",
        subject_key: "setup-alpha",
        source_class: "raw_model_output",
        minimum_sample_count: 3,
        minimum_evidence_count: 3,
        review_metadata: makeReviewMetadata("forbidden-source", "2026-03-18T00:00:00.000Z"),
        effective_until: "2026-04-18T00:00:00.000Z",
      })
    ).toThrow(/forbidden_source_class:raw_model_output/);

    const sparseView = buildSetupPerformanceView([buildSharedCaseSet()[0]]);

    expect(() =>
      buildMachineSafePrior(
        makePriorInput({
          prior_type: "setup_performance_prior",
          subject_key: "setup-alpha",
          source_view: sparseView,
          minimum_sample_count: 3,
          minimum_evidence_count: 3,
          review_trace_id: "sparse-evidence",
        })
      )
    ).toThrow(/insufficient_evidence/);
  });

  it("keeps decision truth untouched and stays below canonical runtime authority", async () => {
    const fixtures = await buildDecisionEnvelopeFixtureSet();
    const before = decisionEnvelopeSemantics(fixtures.allowEnvelope);
    const prior = buildMachineSafePrior(
      makePriorInput({
        prior_type: "signal_pattern_prior",
        subject_key: "cluster-a::setup-alpha::regime-bull",
        source_view: buildSignalPatternView(buildSharedCaseSet()),
        minimum_sample_count: 3,
        minimum_evidence_count: 3,
      })
    );

    expect(decisionEnvelopeSemantics(fixtures.allowEnvelope)).toStrictEqual(before);
    expect(prior).not.toHaveProperty("decisionEnvelope");
    expect(prior).not.toHaveProperty("prior");
    expect(prior).not.toHaveProperty("playbook");
  });
});
