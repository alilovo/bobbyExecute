import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EntryPlaybookSchema } from "@bot/core/contracts/playbooks.js";

const NOW = "2026-04-06T09:00:00.000Z";

describe("playbook authority boundary", () => {
  it("keeps playbooks non-authoritative and separate from execution authority", () => {
    const playbook = EntryPlaybookSchema.parse({
      schema_version: "playbook.revision.v1",
      layer: "playbook_or_optimization_memory",
      authority_class: "non_authoritative",
      playbook_id: "entry:boundary",
      playbook_kind: "entry_playbook",
      title: "entry:boundary",
      summary: "boundary guidance",
      source_layers: ["canonical_case_record"],
      scope_refs: [
        {
          subject_kind: "setup_type",
          subject_id: "breakout",
          subject_label: "setup_type:breakout",
        },
      ],
      guidance: {
        objectives: ["objective:boundary"],
        rules: ["rule:boundary"],
        cautions: [],
      },
      version_trace: {
        version_id: "entry:boundary:v1",
        prior_version_id: null,
        audit_log_entry_refs: ["journal:boundary:v1"],
        evidence_lineage_refs: ["casebook:boundary:evidence"],
      },
      review_metadata: {
        review_state: "approved",
        reviewed_by: "reviewer-boundary",
        reviewed_at: NOW,
      },
    });

    expect(playbook.authority_class).toBe("non_authoritative");
    expect(playbook).not.toHaveProperty("execution_authority");
    expect(playbook).not.toHaveProperty("decisionEnvelope");
    expect(() =>
      EntryPlaybookSchema.parse({
        ...playbook,
        authority_class: "authoritative",
      })
    ).toThrow();
  });

  it("leaves decisionEnvelope untouched while adding the playbook plane", () => {
    const decisionEnvelopePath = resolve(process.cwd(), "src/core/contracts/decision-envelope.ts");
    const decisionEnvelopeText = readFileSync(decisionEnvelopePath, "utf8");

    expect(decisionEnvelopeText).toContain('schemaVersion: z.literal("decision.envelope.v1")');
    expect(decisionEnvelopeText).toContain('schemaVersion: z.literal("decision.envelope.v2")');
    expect(decisionEnvelopeText).toContain('schemaVersion: z.literal("decision.envelope.v3")');
    expect(decisionEnvelopeText).not.toContain("playbook.revision.v1");
    expect(decisionEnvelopeText).not.toContain("playbook_or_optimization_memory");
  });
});
