import { describe, expect, it } from "vitest";
import {
  EntryPlaybookSchema,
  type PlaybookRevision,
} from "../../src/core/contracts/playbooks.js";
import {
  derivePlaybookRevisionViews,
  InMemoryPlaybookLedger,
} from "../../src/learning/playbooks.js";

const NOW = "2026-04-06T08:30:00.000Z";

function makeScopeRef(subject_kind: "setup_type" | "failure_mode" | "market_regime" | "account_or_kol", subject_id: string) {
  return {
    subject_kind,
    subject_id,
    subject_label: `${subject_kind}:${subject_id}`,
  };
}

function makeEntryRevision(input: {
  playbook_id: string;
  version_id: string;
  prior_version_id: string | null;
  review_state: "proposed" | "reviewed" | "approved" | "superseded" | "rejected";
  summary: string;
}): PlaybookRevision {
  return EntryPlaybookSchema.parse({
    schema_version: "playbook.revision.v1",
    layer: "playbook_or_optimization_memory",
    authority_class: "non_authoritative",
    playbook_id: input.playbook_id,
    playbook_kind: "entry_playbook",
    title: `entry:${input.playbook_id}`,
    summary: input.summary,
    source_layers: ["canonical_case_record", "machine_safe_prior"],
    scope_refs: [
      makeScopeRef("setup_type", "breakout"),
      makeScopeRef("market_regime", "bull"),
    ],
    guidance: {
      objectives: ["objective:entry"],
      rules: ["rule:entry"],
      cautions: ["caution:entry"],
    },
    version_trace: {
      version_id: input.version_id,
      prior_version_id: input.prior_version_id,
      audit_log_entry_refs: [`journal:${input.playbook_id}:${input.version_id}`],
      evidence_lineage_refs: [
        `casebook:${input.playbook_id}:evidence`,
        `prior:${input.playbook_id}:${input.version_id}`,
      ],
    },
    review_metadata: {
      review_state: input.review_state,
      reviewed_by:
        input.review_state === "proposed" ? undefined : "reviewer-playbook",
      reviewed_at: input.review_state === "proposed" ? undefined : NOW,
      review_note:
        input.review_state === "rejected" || input.review_state === "superseded"
          ? "explicit terminal state"
          : undefined,
    },
  });
}

describe("playbook ledger", () => {
  it("keeps revisions append-only and preserves prior guidance in the history", () => {
    const ledger = new InMemoryPlaybookLedger();
    const first = makeEntryRevision({
      playbook_id: "entry:sol-bull",
      version_id: "entry:sol-bull:v1",
      prior_version_id: null,
      review_state: "approved",
      summary: "initial guidance",
    });
    const second = makeEntryRevision({
      playbook_id: "entry:sol-bull",
      version_id: "entry:sol-bull:v2",
      prior_version_id: "entry:sol-bull:v1",
      review_state: "approved",
      summary: "updated guidance",
    });

    ledger.append(first);
    ledger.append(second);

    expect(ledger.list("entry:sol-bull")).toHaveLength(2);
    expect(ledger.get("entry:sol-bull", "entry:sol-bull:v1")?.summary).toBe("initial guidance");
    expect(ledger.getLatest("entry:sol-bull")?.version_trace.version_id).toBe("entry:sol-bull:v2");

    const views = ledger.listViews("entry:sol-bull");
    expect(views).toHaveLength(2);
    expect(views[0].effective_review_state).toBe("superseded");
    expect(views[0].superseded_by_version_id).toBe("entry:sol-bull:v2");
    expect(views[1].effective_review_state).toBe("approved");
  });

  it("rejects silent overwrite and non-linear history jumps", () => {
    const ledger = new InMemoryPlaybookLedger();
    const first = makeEntryRevision({
      playbook_id: "entry:range",
      version_id: "entry:range:v1",
      prior_version_id: null,
      review_state: "reviewed",
      summary: "initial guidance",
    });
    const second = makeEntryRevision({
      playbook_id: "entry:range",
      version_id: "entry:range:v2",
      prior_version_id: "entry:range:v1",
      review_state: "approved",
      summary: "updated guidance",
    });
    ledger.append(first);
    ledger.append(second);

    const overwriteAttempt = structuredClone(second);
    overwriteAttempt.summary = "tampered summary";

    expect(() => ledger.append(overwriteAttempt)).toThrow(/duplicate_version_id:entry:range:entry:range:v2/);
    expect(ledger.list("entry:range")).toHaveLength(2);
    expect(ledger.getLatest("entry:range")?.summary).toBe("updated guidance");

    const skippedVersion = makeEntryRevision({
      playbook_id: "entry:range",
      version_id: "entry:range:v3",
      prior_version_id: "entry:range:v1",
      review_state: "approved",
      summary: "non-linear update",
    });

    expect(() => ledger.append(skippedVersion)).toThrow(/non_linear_history:entry:range:entry:range:v1:entry:range:v2/);
    expect(ledger.list("entry:range")).toHaveLength(2);
  });

  it("keeps review-state views explicit for rejected and superseded guidance", () => {
    const revisions = [
      makeEntryRevision({
        playbook_id: "entry:alpha",
        version_id: "entry:alpha:v1",
        prior_version_id: null,
        review_state: "rejected",
        summary: "rejected guidance",
      }),
      makeEntryRevision({
        playbook_id: "entry:alpha",
        version_id: "entry:alpha:v2",
        prior_version_id: "entry:alpha:v1",
        review_state: "approved",
        summary: "replacement guidance",
      }),
    ];

    const views = derivePlaybookRevisionViews(revisions);
    expect(views[0].effective_review_state).toBe("rejected");
    expect(views[0].superseded_by_version_id).toBeUndefined();
    expect(views[1].effective_review_state).toBe("approved");
  });
});
