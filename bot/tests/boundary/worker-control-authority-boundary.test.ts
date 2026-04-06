import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AdvisoryModelOutputEnvelopeSchema,
  WriteEffectEnvelopeSchema,
  WorkerControlEventEnvelopeSchema,
} from "@bot/intelligence/worker-control/contracts/index.js";

const NOW = "2026-04-06T07:00:00.000Z";

describe("worker-control authority boundary", () => {
  it("keeps model output explicitly advisory and non-authoritative", () => {
    const advisory = AdvisoryModelOutputEnvelopeSchema.parse({
      schema_version: "worker_model_output.v1",
      assessment_id: "assessment-boundary-001",
      trace_id: "trace-boundary-001",
      event_id: "event-boundary-001",
      advisory_label: "inconclusive_transition",
      normalized_result_type: "inconclusive",
      confidence: 0.41,
      uncertainty: 0.59,
      limitations: ["signal_conflict"],
      provenance: {
        model_provider: "openai",
        model_name: "gpt-5.4-mini",
        input_context_refs: ["context-boundary-001"],
        completed_at: NOW,
      },
      non_authority_notice: "advisory_only_no_execution_authority",
      authority_class: "non_authoritative",
      canonical_decision_truth: "decisionEnvelope",
    });

    expect(advisory.authority_class).toBe("non_authoritative");
    expect(advisory.non_authority_notice).toBe("advisory_only_no_execution_authority");

    expect(() =>
      AdvisoryModelOutputEnvelopeSchema.parse({
        ...advisory,
        authority_class: "authoritative",
      })
    ).toThrow();
  });

  it("keeps write effects non-canonical and anchored below decision truth", () => {
    const effect = WriteEffectEnvelopeSchema.parse({
      schema_version: "worker_write_effect.v1",
      write_effect_id: "write-boundary-001",
      trace_id: "trace-boundary-001",
      source_event_id: "event-boundary-001",
      effect_type: "review_queue_insert",
      target_ref: { target_type: "review_queue", target_id: "review-queue-001" },
      write_reason_code: "requires_human_review",
      written_at: NOW,
      journal_truth_anchor: "journal",
      authority_class: "non_authoritative",
      canonical_decision_truth: "decisionEnvelope",
    });

    expect(effect.canonical_decision_truth).toBe("decisionEnvelope");
    expect(effect.journal_truth_anchor).toBe("journal");

    expect(() =>
      WriteEffectEnvelopeSchema.parse({
        ...effect,
        canonical_decision_truth: "worker_overlay",
      })
    ).toThrow();
  });

  it("does not introduce authority-carrier fields into worker overlays", () => {
    const event = WorkerControlEventEnvelopeSchema.parse({
      schema_version: "worker_control_event.v1",
      event_id: "event-boundary-002",
      trace_id: "trace-boundary-002",
      worker_kind: "shadow_intelligence",
      event_type: "suppression_control",
      source: { producer: "shadow-worker", source_scope: "bot" },
      entity_refs: [{ entity_type: "watch_entity", entity_id: "watch-entity-1", chain: "solana" }],
      observed_at: NOW,
      evidence_refs: [],
      severity: "low",
      confidence_hint: 0.5,
      integrity_hint: { integrity_band: "mixed", source_reliability: 0.6 },
      knowledge_mode: "observed",
      decision_time_context_marker: {
        marker_type: "watch_state_snapshot",
        marker_ref: "watch-state-boundary-1",
      },
      replay_metadata: {
        replay_version: "worker_control_replay.v1",
        sequence_id: 9,
        prior_event_refs: [],
      },
    });

    const keys = Object.keys(event);
    expect(keys).not.toContain("execution_authority");
    expect(keys).not.toContain("signer_authority");
    expect(keys).not.toContain("governance_authority");
    expect(keys).not.toContain("runtime_authority");
  });

  it("preserves canonical decision truth by leaving decisionEnvelope contract unchanged", () => {
    const decisionEnvelopePath = resolve(process.cwd(), "src/core/contracts/decision-envelope.ts");
    const workerControlContractsPath = resolve(
      process.cwd(),
      "src/intelligence/worker-control/contracts/worker-control.contracts.v1.ts"
    );
    const decisionEnvelopeText = readFileSync(decisionEnvelopePath, "utf8");
    const workerControlContractsText = readFileSync(workerControlContractsPath, "utf8");

    expect(decisionEnvelopeText).toContain('schemaVersion: z.literal("decision.envelope.v1")');
    expect(decisionEnvelopeText).toContain('schemaVersion: z.literal("decision.envelope.v2")');
    expect(decisionEnvelopeText).toContain('schemaVersion: z.literal("decision.envelope.v3")');
    expect(decisionEnvelopeText).not.toContain("worker-control");
    expect(decisionEnvelopeText).not.toContain("worker_control_event.v1");
    expect(workerControlContractsText).not.toContain("decision.envelope.v");
  });
});
