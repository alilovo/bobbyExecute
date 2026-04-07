import { describe, expect, it } from "vitest";
import { buildCanonicalCaseRecord } from "../../src/casebook/casebook-builder.js";
import { buildSetupPerformanceView } from "../../src/derived-views/derived-views-builder.js";
import { buildMachineSafePrior } from "../../src/learning/priors-builder.js";
import { DecisionEnvelopeSchema } from "../../src/core/contracts/decision-envelope.js";
import {
  CasebookPersistenceRecordSchema,
  JournalPersistenceRecordSchema,
  KnowledgePersistenceRecordSchema,
  OpsArtifactRecordSchema,
  PERSISTENCE_LAYER_MANIFEST,
  PERSISTENCE_LAYER_NAMES,
  PERSISTENCE_LAYER_RECORD_SCHEMAS,
  PlaybookPersistenceRecordSchema,
  RegistryEntityRevisionSchema,
} from "../../src/persistence/layered-persistence-baseline.js";

const NOW = "2026-04-06T08:00:00.000Z";

function makeSubjectRef(
  subject_kind:
    | "token"
    | "trade"
    | "meta"
    | "account_or_kol"
    | "signal_cluster"
    | "setup_type"
    | "market_regime"
    | "failure_mode"
    | "review_period",
  subject_id: string
) {
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
}) {
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

function makeCaseRecord(input: {
  case_type: "trade_case" | "meta_shift_case" | "signal_cluster_case" | "kol_influence_case" | "trade_post_mortem_case";
  traceId: string;
  outcome: "positive" | "negative" | "neutral";
  subjectRefs: ReturnType<typeof makeSubjectRef>[];
}) {
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
    compression_version: "layered-persistence-contracts.v1",
  });
}

function buildSharedCaseSet() {
  return [
    makeCaseRecord({
      case_type: "trade_case",
      traceId: "contract-trace-1",
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
      case_type: "trade_case",
      traceId: "contract-trace-2",
      outcome: "positive",
      subjectRefs: [
        makeSubjectRef("token", "token-beta"),
        makeSubjectRef("trade", "trade-beta"),
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
      case_type: "trade_case",
      traceId: "contract-trace-3",
      outcome: "negative",
      subjectRefs: [
        makeSubjectRef("token", "token-gamma"),
        makeSubjectRef("trade", "trade-gamma"),
        makeSubjectRef("setup_type", "setup-alpha"),
        makeSubjectRef("market_regime", "regime-bull"),
        makeSubjectRef("meta", "meta-a"),
        makeSubjectRef("account_or_kol", "kol-alpha"),
        makeSubjectRef("signal_cluster", "cluster-a"),
        makeSubjectRef("failure_mode", "slippage"),
        makeSubjectRef("review_period", "2026-03"),
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

function makePriorInput(sourceView: ReturnType<typeof buildSetupPerformanceView>) {
  return {
    prior_type: "setup_performance_prior" as const,
    subject_key: "setup-alpha",
    source_class: "derived_knowledge_view" as const,
    source_view: sourceView,
    minimum_sample_count: 3,
    minimum_evidence_count: 3,
    review_metadata: makeReviewMetadata("prior-review-trace", "2026-03-18T00:00:00.000Z"),
    effective_until: "2026-04-18T00:00:00.000Z",
  };
}

function makePlaybookRevision(input: {
  playbook_id: string;
  version_id: string;
  prior_version_id: string | null;
}) {
  return {
    schema_version: "playbook.revision.v1",
    layer: "playbook_or_optimization_memory",
    authority_class: "non_authoritative",
    playbook_id: input.playbook_id,
    playbook_kind: "entry_playbook" as const,
    title: `entry:${input.playbook_id}`,
    summary: "entry guidance",
    source_layers: ["canonical_case_record", "derived_knowledge_view"],
    scope_refs: [
      makeSubjectRef("setup_type", "setup-alpha"),
      makeSubjectRef("market_regime", "regime-bull"),
    ],
    guidance: {
      objectives: ["focus on setups backed by reviewed cases"],
      rules: ["require evidence-backed versioning"],
      cautions: ["do not promote guidance into execution authority"],
    },
    version_trace: {
      version_id: input.version_id,
      prior_version_id: input.prior_version_id,
      audit_log_entry_refs: [`journal:${input.playbook_id}:${input.version_id}`],
      evidence_lineage_refs: [`casebook:${input.playbook_id}:evidence`],
    },
    review_metadata: {
      review_state: "approved" as const,
      reviewed_by: "reviewer-playbook",
      reviewed_at: NOW,
      review_note: "approved for structured storage baseline",
    },
  };
}

function makeRegistryRevision(input: { revision_id: string; prior_revision_id: string | null }) {
  return {
    schema_version: "persistence.registry_entity_revision.v1",
    layer: "registry",
    authority_class: "non_authoritative",
    entity_revision_id: input.revision_id,
    prior_entity_revision_id: input.prior_revision_id,
    entity_kind: "setup_type" as const,
    entity_id: "setup-alpha",
    entity_label: "Setup Alpha",
    aliases: ["setup-alpha"],
    source_journal_record_refs: [makeJournalRecordRef("registry-trace", NOW, "registry.index")],
    audit_log_entry_refs: [`journal:${input.revision_id}`],
    evidence_lineage_refs: [`journal:${input.revision_id}:lineage`],
    mirror_role: "non_primary" as const,
  };
}

function makeOpsArtifactRecord() {
  return {
    schema_version: "persistence.ops_artifact.v1",
    layer: "ops",
    authority_class: "non_authoritative",
    record_id: "ops:materialization-state:1",
    artifact_kind: "materialization_state" as const,
    artifact_ref: "casebook/materialization:case-setup-alpha",
    status: "complete" as const,
    source_record_refs: ["registry:setup-alpha:v1", "casebook:case-setup-alpha:v1"],
    audit_log_entry_refs: ["journal:ops:materialization-state:1"],
    evidence_lineage_refs: ["journal:ops:materialization-state:1:lineage"],
    mirror_role: "non_primary" as const,
  };
}

describe("layered persistence contracts", () => {
  it("constructs each layer's typed persistence contract without collapsing truth surfaces", () => {
    const registry = RegistryEntityRevisionSchema.parse(makeRegistryRevision({ revision_id: "registry:setup-alpha:v1", prior_revision_id: null }));
    const journal = JournalPersistenceRecordSchema.parse(
      makeJournalEntry({
        traceId: "journal-trace",
        timestamp: NOW,
        stage: "registry.index",
      })
    );
    const casebook = CasebookPersistenceRecordSchema.parse(
      buildCanonicalCaseRecord({
        case_type: "trade_case",
        trace_id: "case-trace",
        subject_refs: [
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
        decision_time_journal_entries: [
          makeJournalEntry({
            traceId: "case-trace",
            timestamp: "2026-03-17T10:00:00.000Z",
            stage: "worker.event",
          }),
          makeJournalEntry({
            traceId: "case-trace",
            timestamp: "2026-03-17T10:01:00.000Z",
            stage: "worker.gate.integrity",
          }),
          makeJournalEntry({
            traceId: "case-trace",
            timestamp: "2026-03-17T10:02:00.000Z",
            stage: "worker.routing",
          }),
          makeJournalEntry({
            traceId: "case-trace",
            timestamp: "2026-03-17T10:03:00.000Z",
            stage: "worker.cadence.policy",
          }),
        ],
        outcome_time_journal_entries: [
          makeJournalEntry({
            traceId: "case-trace",
            timestamp: "2026-03-17T11:00:00.000Z",
            stage: "worker.transition.lowcap_hunter",
          }),
          makeJournalEntry({
            traceId: "case-trace",
            timestamp: "2026-03-17T11:01:00.000Z",
            stage: "worker.write_effect",
          }),
        ],
        review_time_journal_entries: [
          makeJournalEntry({
            traceId: "case-trace",
            timestamp: "2026-03-17T12:00:00.000Z",
            stage: "worker.model_result",
          }),
        ],
        compressed_case_summary: "summary:trade_case",
        compressed_case_facts: ["performance:positive"],
        compressed_case_inferences: ["performance:positive"],
        compressed_case_lessons: ["performance:positive"],
        compression_version: "layered-persistence-contracts.v1",
      })
    );
    const setupView = buildSetupPerformanceView(buildSharedCaseSet());
    const knowledgeView = KnowledgePersistenceRecordSchema.parse(setupView);
    const prior = KnowledgePersistenceRecordSchema.parse(buildMachineSafePrior(makePriorInput(setupView)));
    const playbook = PlaybookPersistenceRecordSchema.parse(
      makePlaybookRevision({
        playbook_id: "entry:setup-alpha",
        version_id: "entry:setup-alpha:v1",
        prior_version_id: null,
      })
    );
    const ops = OpsArtifactRecordSchema.parse(makeOpsArtifactRecord());

    expect(registry.layer).toBe("registry");
    expect(registry.mirror_role).toBe("non_primary");
    expect(journal.stage).toBe("registry.index");
    expect(casebook.layer).toBe("canonical_case_record");
    expect(casebook.authority_class).toBe("non_authoritative");
    expect(knowledgeView.layer).toBe("derived_knowledge_view");
    expect(prior.layer).toBe("machine_safe_prior");
    expect(playbook.layer).toBe("playbook_or_optimization_memory");
    expect(playbook.review_metadata.review_state).toBe("approved");
    expect(ops.layer).toBe("ops");
    expect(ops.mirror_role).toBe("non_primary");

    expect(DecisionEnvelopeSchema.safeParse(registry).success).toBe(false);
    expect(DecisionEnvelopeSchema.safeParse(journal).success).toBe(false);
    expect(DecisionEnvelopeSchema.safeParse(casebook).success).toBe(false);
    expect(DecisionEnvelopeSchema.safeParse(knowledgeView).success).toBe(false);
    expect(DecisionEnvelopeSchema.safeParse(prior).success).toBe(false);
    expect(DecisionEnvelopeSchema.safeParse(playbook).success).toBe(false);
    expect(DecisionEnvelopeSchema.safeParse(ops).success).toBe(false);
  });

  it("keeps the logical layer map explicit and non-collapsed", () => {
    expect(PERSISTENCE_LAYER_NAMES).toEqual([
      "registry",
      "journal",
      "casebook",
      "knowledge",
      "playbook",
      "ops",
    ]);
    expect(Object.keys(PERSISTENCE_LAYER_MANIFEST).sort()).toEqual(PERSISTENCE_LAYER_NAMES.slice().sort());
    expect(Object.keys(PERSISTENCE_LAYER_RECORD_SCHEMAS).sort()).toEqual(PERSISTENCE_LAYER_NAMES.slice().sort());
    expect(PERSISTENCE_LAYER_MANIFEST.registry.storage_role).toBe("support_only");
    expect(PERSISTENCE_LAYER_MANIFEST.journal.storage_role).toBe("raw_truth");
    expect(PERSISTENCE_LAYER_MANIFEST.casebook.storage_role).toBe("non_primary_projection");
    expect(PERSISTENCE_LAYER_MANIFEST.knowledge.storage_role).toBe("non_primary_projection");
    expect(PERSISTENCE_LAYER_MANIFEST.playbook.storage_role).toBe("non_primary_projection");
    expect(PERSISTENCE_LAYER_MANIFEST.ops.storage_role).toBe("support_only");
  });
});
