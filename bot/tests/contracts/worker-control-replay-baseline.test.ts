import { describe, expect, it } from "vitest";
import {
  WorkerJournalRecordSchema,
  type WorkerJournalRecord,
} from "@bot/intelligence/worker-control/contracts/index.js";

const NOW = "2026-04-06T07:00:00.000Z";

function parseRecord(record: unknown): WorkerJournalRecord {
  return WorkerJournalRecordSchema.parse(record);
}

describe("worker-control replay baseline sufficiency", () => {
  it("reconstructs promotion flow from journal records", () => {
    const records = [
      parseRecord({
        schema_version: "worker_journal_event_record.v1",
        record_kind: "event_record",
        journal_event_id: "jrnl-event-promotion-001",
        trace_id: "trace-promotion-001",
        event_id: "event-promotion-001",
        payload: {
          schema_version: "worker_control_event.v1",
          event_id: "event-promotion-001",
          trace_id: "trace-promotion-001",
          worker_kind: "low_cap_hunter",
          event_type: "promotion",
          source: { producer: "low-cap-hunter-worker", source_scope: "bot" },
          entity_refs: [{ entity_type: "token", entity_id: "token-sol", chain: "solana" }],
          observed_at: NOW,
          evidence_refs: ["evidence-promotion-001"],
          severity: "high",
          confidence_hint: 0.84,
          integrity_hint: { integrity_band: "clean", source_reliability: 0.9 },
          knowledge_mode: "observed",
          decision_time_context_marker: {
            marker_type: "decision_input_snapshot",
            marker_ref: "decision-context-promotion-001",
          },
          replay_metadata: {
            replay_version: "worker_control_replay.v1",
            sequence_id: 20,
            prior_event_refs: [],
            dedupe_key: "lowcap:token-sol:promotion:15m",
          },
        },
        journaled_at: NOW,
        authority_class: "non_authoritative",
        canonical_decision_truth: "decisionEnvelope",
      }),
      parseRecord({
        schema_version: "worker_journal_gate_evaluation_record.v1",
        record_kind: "gate_evaluation_record",
        journal_gate_eval_id: "jrnl-gate-promotion-001",
        trace_id: "trace-promotion-001",
        event_id: "event-promotion-001",
        payload: {
          schema_version: "worker_gate_evaluation.v1",
          gate_eval_id: "gate-promotion-001",
          trace_id: "trace-promotion-001",
          event_id: "event-promotion-001",
          stage_evaluations: [
            { stage: "validity", stage_result: "pass" },
            { stage: "integrity", stage_result: "pass" },
            { stage: "model_promotion", stage_result: "pass" },
            { stage: "post_model_routing", stage_result: "pass" },
          ],
          overall_result: "pass",
          evaluated_at: NOW,
          authority_class: "non_authoritative",
          canonical_decision_truth: "decisionEnvelope",
        },
        journaled_at: NOW,
        authority_class: "non_authoritative",
        canonical_decision_truth: "decisionEnvelope",
      }),
      parseRecord({
        schema_version: "worker_journal_model_routing_record.v1",
        record_kind: "model_routing_record",
        journal_route_id: "jrnl-route-promotion-001",
        trace_id: "trace-promotion-001",
        event_id: "event-promotion-001",
        payload: {
          schema_version: "worker_model_routing.v1",
          route_decision_id: "route-promotion-001",
          trace_id: "trace-promotion-001",
          event_id: "event-promotion-001",
          route_class: "route_c_deep_adjudication",
          route_reason_code: "high_value_promotion",
          advisory_route: true,
          requested_model: { provider: "openai", model: "gpt-5.4" },
          route_basis_stages: ["model_promotion", "post_model_routing"],
          cooldown_override: false,
          requested_at: NOW,
          authority_class: "non_authoritative",
          canonical_decision_truth: "decisionEnvelope",
        },
        journaled_at: NOW,
        authority_class: "non_authoritative",
        canonical_decision_truth: "decisionEnvelope",
      }),
      parseRecord({
        schema_version: "worker_journal_model_result_record.v1",
        record_kind: "model_result_record",
        journal_model_result_id: "jrnl-model-result-promotion-001",
        trace_id: "trace-promotion-001",
        event_id: "event-promotion-001",
        payload: {
          schema_version: "worker_model_output.v1",
          assessment_id: "assessment-promotion-001",
          trace_id: "trace-promotion-001",
          event_id: "event-promotion-001",
          advisory_label: "promote_watchlist",
          normalized_result_type: "candidate_assessment",
          confidence: 0.89,
          uncertainty: 0.1,
          limitations: ["advisory_scope_only"],
          provenance: {
            model_provider: "openai",
            model_name: "gpt-5.4",
            input_context_refs: ["context-pack-promotion-001"],
            completed_at: NOW,
          },
          non_authority_notice: "advisory_only_no_execution_authority",
          authority_class: "non_authoritative",
          canonical_decision_truth: "decisionEnvelope",
        },
        journaled_at: NOW,
        authority_class: "non_authoritative",
        canonical_decision_truth: "decisionEnvelope",
      }),
      parseRecord({
        schema_version: "worker_journal_resulting_write_record.v1",
        record_kind: "resulting_write_record",
        journal_write_effect_id: "jrnl-write-promotion-001",
        trace_id: "trace-promotion-001",
        event_id: "event-promotion-001",
        payload: {
          schema_version: "worker_write_effect.v1",
          write_effect_id: "write-effect-promotion-001",
          trace_id: "trace-promotion-001",
          source_event_id: "event-promotion-001",
          effect_type: "watchlist_update",
          target_ref: { target_type: "watchlist", target_id: "watchlist-sol" },
          write_reason_code: "model_positive_assessment",
          written_at: NOW,
          journal_truth_anchor: "journal",
          authority_class: "non_authoritative",
          canonical_decision_truth: "decisionEnvelope",
        },
        journaled_at: NOW,
        authority_class: "non_authoritative",
        canonical_decision_truth: "decisionEnvelope",
      }),
    ];

    const event = records.find((record) => record.record_kind === "event_record");
    const gate = records.find((record) => record.record_kind === "gate_evaluation_record");
    const route = records.find((record) => record.record_kind === "model_routing_record");
    const write = records.find((record) => record.record_kind === "resulting_write_record");

    expect(event).toBeDefined();
    expect(gate).toBeDefined();
    expect(route).toBeDefined();
    expect(write).toBeDefined();

    if (gate?.record_kind === "gate_evaluation_record") {
      const stages = gate.payload.stage_evaluations.map((evaluation) => evaluation.stage);
      expect(stages).toContain("validity");
      expect(stages).toContain("model_promotion");
      expect(stages).toContain("post_model_routing");
    }

    if (route?.record_kind === "model_routing_record") {
      expect(route.payload.route_class).toBe("route_c_deep_adjudication");
      expect(route.payload.route_basis_stages).toContain("model_promotion");
    }
  });

  it("reconstructs suppression basis and no-write flow from journal records", () => {
    const records = [
      parseRecord({
        schema_version: "worker_journal_event_record.v1",
        record_kind: "event_record",
        journal_event_id: "jrnl-event-suppression-001",
        trace_id: "trace-suppression-001",
        event_id: "event-suppression-001",
        payload: {
          schema_version: "worker_control_event.v1",
          event_id: "event-suppression-001",
          trace_id: "trace-suppression-001",
          worker_kind: "shadow_intelligence",
          event_type: "suppression_control",
          source: { producer: "shadow-intelligence-worker", source_scope: "bot" },
          entity_refs: [{ entity_type: "watch_entity", entity_id: "watch-sol-2", chain: "solana" }],
          observed_at: NOW,
          evidence_refs: ["evidence-suppression-001"],
          severity: "low",
          confidence_hint: 0.53,
          integrity_hint: { integrity_band: "mixed", source_reliability: 0.63 },
          knowledge_mode: "observed",
          decision_time_context_marker: {
            marker_type: "watch_state_snapshot",
            marker_ref: "watch-state-suppression-001",
          },
          replay_metadata: {
            replay_version: "worker_control_replay.v1",
            sequence_id: 30,
            prior_event_refs: ["event-suppression-000"],
            cooldown_key: "shadow_cd:watch-sol-2:normal_transition",
          },
        },
        journaled_at: NOW,
        authority_class: "non_authoritative",
        canonical_decision_truth: "decisionEnvelope",
      }),
      parseRecord({
        schema_version: "worker_journal_gate_evaluation_record.v1",
        record_kind: "gate_evaluation_record",
        journal_gate_eval_id: "jrnl-gate-suppression-001",
        trace_id: "trace-suppression-001",
        event_id: "event-suppression-001",
        payload: {
          schema_version: "worker_gate_evaluation.v1",
          gate_eval_id: "gate-suppression-001",
          trace_id: "trace-suppression-001",
          event_id: "event-suppression-001",
          stage_evaluations: [
            { stage: "validity", stage_result: "pass" },
            {
              stage: "cooldown",
              stage_result: "suppress",
              reason_code: "cooldown_active",
              cooldown_key: "shadow_cd:watch-sol-2:normal_transition",
            },
          ],
          overall_result: "suppress",
          evaluated_at: NOW,
          authority_class: "non_authoritative",
          canonical_decision_truth: "decisionEnvelope",
        },
        journaled_at: NOW,
        authority_class: "non_authoritative",
        canonical_decision_truth: "decisionEnvelope",
      }),
      parseRecord({
        schema_version: "worker_journal_suppression_record.v1",
        record_kind: "suppression_record",
        journal_suppression_id: "jrnl-suppression-001",
        trace_id: "trace-suppression-001",
        event_id: "event-suppression-001",
        payload: {
          schema_version: "worker_suppression.v1",
          suppression_id: "suppression-001",
          trace_id: "trace-suppression-001",
          event_id: "event-suppression-001",
          suppression_type: "cooldown",
          suppression_reason_code: "cooldown_active",
          cooldown_key: "shadow_cd:watch-sol-2:normal_transition",
          blocking_evidence_refs: ["evidence-suppression-001"],
          suppressed_at: NOW,
          authority_class: "non_authoritative",
          canonical_decision_truth: "decisionEnvelope",
        },
        journaled_at: NOW,
        authority_class: "non_authoritative",
        canonical_decision_truth: "decisionEnvelope",
      }),
      parseRecord({
        schema_version: "worker_journal_resulting_write_record.v1",
        record_kind: "resulting_write_record",
        journal_write_effect_id: "jrnl-write-suppression-001",
        trace_id: "trace-suppression-001",
        event_id: "event-suppression-001",
        payload: {
          schema_version: "worker_write_effect.v1",
          write_effect_id: "write-effect-suppression-001",
          trace_id: "trace-suppression-001",
          source_event_id: "event-suppression-001",
          effect_type: "no_write",
          write_reason_code: "suppressed_by_cooldown",
          written_at: NOW,
          journal_truth_anchor: "journal",
          authority_class: "non_authoritative",
          canonical_decision_truth: "decisionEnvelope",
        },
        journaled_at: NOW,
        authority_class: "non_authoritative",
        canonical_decision_truth: "decisionEnvelope",
      }),
    ];

    const suppression = records.find((record) => record.record_kind === "suppression_record");
    const write = records.find((record) => record.record_kind === "resulting_write_record");

    expect(suppression).toBeDefined();
    expect(write).toBeDefined();

    if (suppression?.record_kind === "suppression_record") {
      expect(suppression.payload.suppression_type).toBe("cooldown");
      expect(suppression.payload.cooldown_key).toBe("shadow_cd:watch-sol-2:normal_transition");
    }

    if (write?.record_kind === "resulting_write_record") {
      expect(write.payload.effect_type).toBe("no_write");
    }
  });
});
