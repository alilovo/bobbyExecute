import { describe, expect, it } from "vitest";
import { InMemoryJournalWriter } from "../../src/journal-writer/writer.js";
import {
  appendCanonicalCaseJournal,
  buildCanonicalCaseJournalEntry,
  buildCanonicalCaseRecord,
  reconstructCanonicalCaseReplay,
} from "../../src/casebook/casebook-builder.js";
import {
  CASEBOOK_LAYERS,
  CanonicalCaseRecordSchema,
  type CanonicalCaseType,
  type CaseSubjectRef,
} from "../../src/core/contracts/casebook.js";
import type { JournalEntry } from "../../src/core/contracts/journal.js";
import {
  buildDecisionEnvelopeFixtureSet,
  decisionEnvelopeSemantics,
} from "../fixtures/decision-envelope.fixtures.js";

function makeJournalEntry(input: {
  traceId: string;
  timestamp: string;
  stage: string;
  decisionHash?: string;
  resultHash?: string;
  blocked?: boolean;
  reason?: string;
  eventHash?: string;
  input?: unknown;
  output?: unknown;
}): JournalEntry {
  return {
    traceId: input.traceId,
    timestamp: input.timestamp,
    stage: input.stage,
    decisionHash: input.decisionHash ?? `decision:${input.stage}:${input.timestamp}`,
    resultHash: input.resultHash ?? `result:${input.stage}:${input.timestamp}`,
    input: input.input ?? { stage: input.stage, timestamp: input.timestamp },
    output: input.output ?? { stage: input.stage, timestamp: input.timestamp },
    blocked: input.blocked,
    reason: input.reason,
    eventHash: input.eventHash ?? `event:${input.traceId}:${input.stage}:${input.timestamp}`,
  };
}

function makeSubjectRef(subject_kind: CaseSubjectRef["subject_kind"], subject_id: string): CaseSubjectRef {
  return {
    subject_kind,
    subject_id,
    subject_label: `${subject_kind}:${subject_id}`,
  };
}

function makeCasePhases(traceId: string) {
  return {
    decision_time_journal_entries: [
      makeJournalEntry({
        traceId,
        timestamp: "2026-03-17T10:00:00.000Z",
        stage: "worker.event",
      }),
      makeJournalEntry({
        traceId,
        timestamp: "2026-03-17T10:01:00.000Z",
        stage: "worker.gate.integrity",
        blocked: false,
      }),
      makeJournalEntry({
        traceId,
        timestamp: "2026-03-17T10:02:00.000Z",
        stage: "worker.routing",
      }),
      makeJournalEntry({
        traceId,
        timestamp: "2026-03-17T10:03:00.000Z",
        stage: "worker.cadence.policy",
      }),
    ],
    outcome_time_journal_entries: [
      makeJournalEntry({
        traceId,
        timestamp: "2026-03-17T11:00:00.000Z",
        stage: "worker.transition.lowcap_hunter",
      }),
      makeJournalEntry({
        traceId,
        timestamp: "2026-03-17T11:01:00.000Z",
        stage: "worker.write_effect",
      }),
    ],
    review_time_journal_entries: [
      makeJournalEntry({
        traceId,
        timestamp: "2026-03-17T12:00:00.000Z",
        stage: "worker.model_result",
      }),
    ],
  };
}

function makeCaseInput(case_type: CanonicalCaseType, traceId: string, subject_refs: CaseSubjectRef[]) {
  return {
    case_type,
    trace_id: traceId,
    subject_refs,
    ...makeCasePhases(traceId),
    compressed_case_summary: `summary:${case_type}`,
    compressed_case_facts: [`fact:${case_type}`],
    compressed_case_inferences: [`inference:${case_type}`],
    compressed_case_lessons: [`lesson:${case_type}`],
    compression_version: "casebook.compress.v1",
  };
}

describe("casebook foundations", () => {
  it("builds each canonical case contract with explicit narrow structure", () => {
    const cases: Array<{
      case_type: CanonicalCaseType;
      traceId: string;
      subject_refs: CaseSubjectRef[];
    }> = [
      {
        case_type: "trade_case",
        traceId: "case-trade",
        subject_refs: [makeSubjectRef("token", "token-alpha"), makeSubjectRef("trade", "trade-alpha")],
      },
      {
        case_type: "meta_shift_case",
        traceId: "case-meta",
        subject_refs: [makeSubjectRef("meta", "cluster-a"), makeSubjectRef("market_regime", "regime-range")],
      },
      {
        case_type: "signal_cluster_case",
        traceId: "case-cluster",
        subject_refs: [
          makeSubjectRef("signal_cluster", "cluster-a"),
          makeSubjectRef("setup_type", "reacceleration"),
          makeSubjectRef("review_period", "2026-03"),
        ],
      },
      {
        case_type: "kol_influence_case",
        traceId: "case-kol",
        subject_refs: [
          makeSubjectRef("account_or_kol", "kol-alpha"),
          makeSubjectRef("signal_cluster", "cluster-b"),
        ],
      },
      {
        case_type: "trade_post_mortem_case",
        traceId: "case-post-mortem",
        subject_refs: [
          makeSubjectRef("trade", "trade-beta"),
          makeSubjectRef("failure_mode", "slippage"),
          makeSubjectRef("review_period", "2026-03"),
        ],
      },
    ];

    for (const item of cases) {
      const record = buildCanonicalCaseRecord(makeCaseInput(item.case_type, item.traceId, item.subject_refs));
      const parsed = CanonicalCaseRecordSchema.parse(record);

      expect(parsed.case_type).toBe(item.case_type);
      expect(parsed.layer).toBe("canonical_case_record");
      expect(parsed.source_layer).toBe("raw_journal_truth");
      expect(parsed.authority_class).toBe("non_authoritative");
      expect(parsed.subject_refs.map((ref) => ref.subject_kind)).toEqual(
        [...item.subject_refs].map((ref) => ref.subject_kind).sort()
      );
      expect(parsed.compressed_case_summary).toBe(`summary:${item.case_type}`);
      expect(parsed.compression_version).toBe("casebook.compress.v1");
      expect(parsed).not.toHaveProperty("decisionEnvelope");
    }
  });

  it("keeps time-phase knowledge separated and fails closed on review-only leakage into decision_time", () => {
    const input = makeCaseInput("trade_case", "case-phase-boundary", [
      makeSubjectRef("token", "token-phase"),
      makeSubjectRef("trade", "trade-phase"),
    ]);

    expect(() =>
      buildCanonicalCaseRecord({
        ...input,
        decision_time_journal_entries: [
          ...input.decision_time_journal_entries.slice(0, 2),
          input.review_time_journal_entries[0],
        ],
      })
    ).toThrow(/CASEBOOK_BUILD_FAILED:decision_time:disallowed_stage:.*worker\.model_result/);
  });

  it("preserves journal evidence linkage and can replay the assembled case", async () => {
    const input = makeCaseInput("signal_cluster_case", "case-replay", [
      makeSubjectRef("signal_cluster", "cluster-replay"),
      makeSubjectRef("setup_type", "setup-replay"),
      makeSubjectRef("review_period", "2026-03"),
    ]);
    const record = buildCanonicalCaseRecord(input);
    const writer = new InMemoryJournalWriter();

    await appendCanonicalCaseJournal(writer, record);
    const replay = reconstructCanonicalCaseReplay(writer.list());

    expect(replay.traceId).toBe("case-replay");
    expect(replay.caseType).toBe("signal_cluster_case");
    expect(replay.caseRecord).toStrictEqual(record);
    expect(buildCanonicalCaseJournalEntry(record).stage).toBe("casebook.canonical_case");
    expect(record.evidence.source_journal_record_refs).toHaveLength(7);
    expect(record.evidence.event_refs).toHaveLength(1);
    expect(record.evidence.gate_refs).toHaveLength(1);
    expect(record.evidence.routing_refs).toHaveLength(1);
    expect(record.evidence.transition_refs).toHaveLength(1);
    expect(record.evidence.cadence_refs).toHaveLength(1);
    expect(record.evidence.write_effect_refs).toHaveLength(1);
    expect(record.evidence.trace_refs).toEqual(["case-replay"]);
    expect(record.evidence.evidence_lineage_refs.some((ref) => ref.includes("worker.model_result"))).toBe(true);
  });

  it("is deterministic, fails closed on missing evidence, and leaves decision truth untouched", async () => {
    const fixtures = await buildDecisionEnvelopeFixtureSet();
    const before = decisionEnvelopeSemantics(fixtures.allowEnvelope);
    const input = makeCaseInput("trade_post_mortem_case", "case-determinism", [
      makeSubjectRef("trade", "trade-determinism"),
      makeSubjectRef("failure_mode", "slippage"),
      makeSubjectRef("review_period", "2026-03"),
    ]);

    const first = buildCanonicalCaseRecord(input);
    const second = buildCanonicalCaseRecord(structuredClone(input));

    expect(first).toStrictEqual(second);
    expect(() =>
      buildCanonicalCaseRecord({
        ...input,
        outcome_time_journal_entries: [],
      })
    ).toThrow(/CASEBOOK_BUILD_FAILED:outcome_time:missing_entries/);
    expect(first).not.toHaveProperty("derived_knowledge_view");
    expect(first).not.toHaveProperty("playbook_or_optimization_memory");
    expect(first).not.toHaveProperty("decisionEnvelope");
    expect(decisionEnvelopeSemantics(fixtures.allowEnvelope)).toStrictEqual(before);
  });
});
