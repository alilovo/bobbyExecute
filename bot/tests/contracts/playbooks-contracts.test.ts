import { describe, expect, it } from "vitest";
import * as coreContracts from "@bot/core/contracts/index.js";
import {
  AbortPlaybookSchema,
  EntryPlaybookSchema,
  KolTrustModelPlaybookSchema,
  PlaybookSchema,
  RegimePlaybookSchema,
  PLAYBOOK_LAYER,
  PLAYBOOK_SCHEMA_VERSION,
} from "@bot/core/contracts/playbooks.js";

const NOW = "2026-04-06T08:00:00.000Z";

function makeScopeRef(subject_kind: "setup_type" | "failure_mode" | "market_regime" | "account_or_kol", subject_id: string) {
  return {
    subject_kind,
    subject_id,
    subject_label: `${subject_kind}:${subject_id}`,
  };
}

function makeRevision(input: {
  playbook_kind: "entry_playbook" | "abort_playbook" | "regime_playbook" | "kol_trust_model_playbook";
  playbook_id: string;
  version_id: string;
  prior_version_id: string | null;
  scope_refs: Array<ReturnType<typeof makeScopeRef>>;
  review_state: "proposed" | "reviewed" | "approved" | "superseded" | "rejected";
  reviewed_by?: string;
  reviewed_at?: string;
  review_note?: string;
}) {
  return {
    schema_version: PLAYBOOK_SCHEMA_VERSION,
    layer: PLAYBOOK_LAYER,
    authority_class: "non_authoritative",
    playbook_id: input.playbook_id,
    playbook_kind: input.playbook_kind,
    title: `${input.playbook_kind}:${input.playbook_id}`,
    summary: `summary:${input.playbook_kind}`,
    source_layers: ["canonical_case_record", "derived_knowledge_view"],
    scope_refs: input.scope_refs,
    guidance: {
      objectives: [`objective:${input.playbook_kind}`],
      rules: [`rule:${input.playbook_kind}`],
      cautions: [`caution:${input.playbook_kind}`],
    },
    version_trace: {
      version_id: input.version_id,
      prior_version_id: input.prior_version_id,
      audit_log_entry_refs: [`journal:${input.playbook_id}:${input.version_id}`],
      evidence_lineage_refs: [`casebook:${input.playbook_id}:evidence`],
    },
    review_metadata: {
      review_state: input.review_state,
      reviewed_by: input.reviewed_by,
      reviewed_at: input.reviewed_at,
      review_note: input.review_note,
    },
  };
}

describe("playbook contracts", () => {
  it("parses the four playbook contract shapes with explicit non-authoritative version trace", () => {
    const entry = makeRevision({
      playbook_kind: "entry_playbook",
      playbook_id: "entry:sol-bull",
      version_id: "entry:sol-bull:v1",
      prior_version_id: null,
      scope_refs: [
        makeScopeRef("setup_type", "breakout"),
        makeScopeRef("market_regime", "bull"),
      ],
      review_state: "approved",
      reviewed_by: "reviewer-entry",
      reviewed_at: NOW,
      review_note: "approved for review",
    });

    const abort = makeRevision({
      playbook_kind: "abort_playbook",
      playbook_id: "abort:slippage",
      version_id: "abort:slippage:v1",
      prior_version_id: null,
      scope_refs: [makeScopeRef("failure_mode", "slippage")],
      review_state: "reviewed",
      reviewed_by: "reviewer-abort",
      reviewed_at: NOW,
    });

    const regime = makeRevision({
      playbook_kind: "regime_playbook",
      playbook_id: "regime:range",
      version_id: "regime:range:v1",
      prior_version_id: null,
      scope_refs: [makeScopeRef("market_regime", "range")],
      review_state: "superseded",
      reviewed_by: "reviewer-regime",
      reviewed_at: NOW,
      review_note: "superseded by later guidance",
    });

    const kol = makeRevision({
      playbook_kind: "kol_trust_model_playbook",
      playbook_id: "kol:alpha",
      version_id: "kol:alpha:v1",
      prior_version_id: null,
      scope_refs: [makeScopeRef("account_or_kol", "kol-alpha")],
      review_state: "rejected",
      reviewed_by: "reviewer-kol",
      reviewed_at: NOW,
      review_note: "insufficient evidence",
    });

    const revisions = [entry, abort, regime, kol];
    const schemas = [
      EntryPlaybookSchema,
      AbortPlaybookSchema,
      RegimePlaybookSchema,
      KolTrustModelPlaybookSchema,
    ];

    for (const [index, revision] of revisions.entries()) {
      const parsed = schemas[index].parse(revision);
      expect(PlaybookSchema.parse(revision)).toStrictEqual(parsed);
      expect(parsed.authority_class).toBe("non_authoritative");
      expect(parsed.layer).toBe("playbook_or_optimization_memory");
      expect(parsed.version_trace.prior_version_id).toBeNull();
      expect(parsed.version_trace.audit_log_entry_refs).toHaveLength(1);
      expect(parsed.version_trace.evidence_lineage_refs).toHaveLength(1);
      expect(parsed).not.toHaveProperty("decisionEnvelope");
      expect(parsed).not.toHaveProperty("execution_authority");
    }
  });

  it("enforces review-state metadata and blocks incomplete transitions", () => {
    const proposed = EntryPlaybookSchema.parse(
      makeRevision({
        playbook_kind: "entry_playbook",
        playbook_id: "entry:range",
        version_id: "entry:range:v1",
        prior_version_id: null,
        scope_refs: [makeScopeRef("setup_type", "reversion")],
        review_state: "proposed",
      })
    );
    expect(proposed.review_metadata.review_state).toBe("proposed");

    expect(() =>
      EntryPlaybookSchema.parse({
        ...makeRevision({
          playbook_kind: "entry_playbook",
          playbook_id: "entry:range",
          version_id: "entry:range:v2",
          prior_version_id: "entry:range:v1",
          scope_refs: [makeScopeRef("setup_type", "reversion")],
          review_state: "approved",
          reviewed_at: NOW,
        }),
      })
    ).toThrow(/reviewed_by_required_for_approved/);

    expect(() =>
      EntryPlaybookSchema.parse({
        ...makeRevision({
          playbook_kind: "entry_playbook",
          playbook_id: "entry:range",
          version_id: "entry:range:v3",
          prior_version_id: "entry:range:v2",
          scope_refs: [makeScopeRef("setup_type", "reversion")],
          review_state: "rejected",
          reviewed_by: "reviewer-entry",
          reviewed_at: NOW,
        }),
      })
    ).toThrow(/review_note_required_for_rejected/);

    expect(() =>
      EntryPlaybookSchema.parse({
        ...makeRevision({
          playbook_kind: "entry_playbook",
          playbook_id: "entry:range",
          version_id: "entry:range:v4",
          prior_version_id: "entry:range:v3",
          scope_refs: [makeScopeRef("setup_type", "reversion")],
          review_state: "proposed",
          reviewed_by: "should-not-be-present",
        }),
      })
    ).toThrow(/reviewed_by_must_be_omitted_for_proposed/);
  });

  it("keeps the core contracts barrel narrow and includes the playbook exports", () => {
    expect(Object.keys(coreContracts)).toEqual(
      expect.arrayContaining([
        "PLAYBOOK_LAYER",
        "PLAYBOOK_SCHEMA_VERSION",
        "PLAYBOOK_SOURCE_LAYERS",
        "PLAYBOOK_KINDS",
        "PLAYBOOK_REVIEW_STATES",
        "PlaybookLayerSchema",
        "PlaybookSourceLayerSchema",
        "PlaybookKindSchema",
        "PlaybookReviewStateSchema",
        "PlaybookGuidanceSchema",
        "PlaybookVersionTraceSchema",
        "PlaybookReviewMetadataSchema",
        "EntryPlaybookSchema",
        "AbortPlaybookSchema",
        "RegimePlaybookSchema",
        "KolTrustModelPlaybookSchema",
        "PlaybookSchema",
        "assertPlaybookRevision",
      ])
    );
  });
});
