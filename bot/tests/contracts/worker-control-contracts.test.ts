import { describe, expect, it } from "vitest";
import {
  AdvisoryModelOutputEnvelopeSchema,
  GateEvaluationRecordSchema,
  ModelRoutingResultSchema,
  STQPlaceholderContractSchema,
  WorkerControlEventEnvelopeSchema,
  WorkerJournalEventRecordSchema,
  WorkerJournalGateEvaluationRecordSchema,
  WorkerJournalModelResultRecordSchema,
  WorkerJournalModelRoutingRecordSchema,
  WorkerJournalResultingWriteRecordSchema,
  WorkerJournalSuppressionRecordSchema,
  WorkerJournalRecordSchema,
  WorkerStateTransitionSchema,
  WriteEffectEnvelopeSchema,
  SuppressionRecordSchema,
} from "@bot/intelligence/worker-control/contracts/index.js";

const NOW = "2026-04-06T07:00:00.000Z";
const WINDOW_START = "2026-04-06T06:45:00.000Z";
const WINDOW_END = "2026-04-06T07:00:00.000Z";

function buildLowCapEvent() {
  return {
    schema_version: "worker_control_event.v1" as const,
    event_id: "event-lowcap-001",
    trace_id: "trace-lowcap-001",
    worker_kind: "low_cap_hunter" as const,
    event_type: "promotion" as const,
    source: {
      producer: "low-cap-hunter-worker",
      source_scope: "bot" as const,
    },
    entity_refs: [{ entity_type: "token" as const, entity_id: "token-sol", chain: "solana" as const }],
    observed_at: NOW,
    evidence_refs: ["evidence-001"],
    severity: "high" as const,
    confidence_hint: 0.81,
    integrity_hint: {
      integrity_band: "clean" as const,
      source_reliability: 0.87,
      liquidity_integrity: 0.77,
      holder_integrity: 0.79,
    },
    knowledge_mode: "observed" as const,
    decision_time_context_marker: {
      marker_type: "decision_input_snapshot" as const,
      marker_ref: "decision-context-001",
    },
    replay_metadata: {
      replay_version: "worker_control_replay.v1" as const,
      sequence_id: 1,
      prior_event_refs: [],
      source_window_start: WINDOW_START,
      source_window_end: WINDOW_END,
      dedupe_key: "lowcap:token-sol:promotion:15m",
    },
  };
}

function buildShadowEvent() {
  return {
    schema_version: "worker_control_event.v1" as const,
    event_id: "event-shadow-001",
    trace_id: "trace-shadow-001",
    worker_kind: "shadow_intelligence" as const,
    event_type: "transition" as const,
    source: {
      producer: "shadow-intelligence-worker",
      source_scope: "bot" as const,
    },
    entity_refs: [{ entity_type: "watch_entity" as const, entity_id: "watch-sol-1", chain: "solana" as const }],
    observed_at: NOW,
    evidence_refs: ["evidence-shadow-001"],
    severity: "medium" as const,
    confidence_hint: 0.66,
    integrity_hint: { integrity_band: "mixed" as const, source_reliability: 0.7 },
    knowledge_mode: "observed" as const,
    decision_time_context_marker: {
      marker_type: "watch_state_snapshot" as const,
      marker_ref: "watch-state-001",
    },
    replay_metadata: {
      replay_version: "worker_control_replay.v1" as const,
      sequence_id: 3,
      prior_event_refs: ["event-shadow-000"],
      source_window_start: WINDOW_START,
      source_window_end: WINDOW_END,
      cooldown_key: "shadow_cd:watch-sol-1:transition",
    },
  };
}

describe("worker-control contracts", () => {
  it("constructs baseline event envelope variants", () => {
    const lowCap = WorkerControlEventEnvelopeSchema.parse(buildLowCapEvent());
    const shadow = WorkerControlEventEnvelopeSchema.parse(buildShadowEvent());

    expect(lowCap.worker_kind).toBe("low_cap_hunter");
    expect(lowCap.event_type).toBe("promotion");
    expect(shadow.worker_kind).toBe("shadow_intelligence");
    expect(shadow.event_type).toBe("transition");
  });

  it("represents deterministic gate stage evaluation for all required stages", () => {
    const gateEval = GateEvaluationRecordSchema.parse({
      schema_version: "worker_gate_evaluation.v1",
      gate_eval_id: "gate-eval-001",
      trace_id: "trace-lowcap-001",
      event_id: "event-lowcap-001",
      stage_evaluations: [
        { stage: "validity", stage_result: "pass" },
        { stage: "integrity", stage_result: "pass" },
        { stage: "convergence_relevance", stage_result: "pass" },
        { stage: "dedupe", stage_result: "pass" },
        { stage: "cooldown", stage_result: "pass" },
        { stage: "batch_debounce", stage_result: "defer", batch_key: "batch-lowcap-01" },
        { stage: "model_promotion", stage_result: "pass" },
        { stage: "post_model_routing", stage_result: "pass" },
      ],
      overall_result: "pass",
      evaluated_at: NOW,
      authority_class: "non_authoritative",
      canonical_decision_truth: "decisionEnvelope",
    });

    expect(gateEval.stage_evaluations).toHaveLength(8);
  });

  it("represents advisory routing classes", () => {
    const routes = [
      {
        route_class: "route_a_no_model",
        requested_model: undefined,
      },
      {
        route_class: "route_b_small_adjudication",
        requested_model: { provider: "openai", model: "gpt-5.4-mini" },
      },
      {
        route_class: "route_c_deep_adjudication",
        requested_model: { provider: "openai", model: "gpt-5.4" },
      },
    ] as const;

    for (const route of routes) {
      const parsed = ModelRoutingResultSchema.parse({
        schema_version: "worker_model_routing.v1",
        route_decision_id: `route-${route.route_class}`,
        trace_id: "trace-lowcap-001",
        event_id: "event-lowcap-001",
        route_class: route.route_class,
        route_reason_code: "promotion_gate_passed",
        advisory_route: true,
        requested_model: route.requested_model,
        route_basis_stages: ["model_promotion", "post_model_routing"],
        cooldown_override: false,
        requested_at: NOW,
        authority_class: "non_authoritative",
        canonical_decision_truth: "decisionEnvelope",
      });

      expect(parsed.route_class).toBe(route.route_class);
    }
  });

  it("represents worker state transitions for low-cap and shadow workers", () => {
    const lowCapTransition = WorkerStateTransitionSchema.parse({
      schema_version: "worker_state_transition.v1",
      transition_id: "lowcap-transition-001",
      trace_id: "trace-lowcap-001",
      event_id: "event-lowcap-001",
      worker_kind: "low_cap_hunter",
      from_state: "candidate",
      to_state: "promoted",
      transition_reason_code: "gate_promotion_pass",
      transitioned_at: NOW,
    });

    const shadowTransition = WorkerStateTransitionSchema.parse({
      schema_version: "worker_state_transition.v1",
      transition_id: "shadow-transition-001",
      trace_id: "trace-shadow-001",
      event_id: "event-shadow-001",
      worker_kind: "shadow_intelligence",
      from_state: "notable_change",
      to_state: "transition_detected",
      transition_reason_code: "transition_threshold_crossed",
      transitioned_at: NOW,
    });

    expect(lowCapTransition.worker_kind).toBe("low_cap_hunter");
    expect(shadowTransition.worker_kind).toBe("shadow_intelligence");
  });

  it("represents journal record families and STQ placeholder contract", () => {
    const event = WorkerControlEventEnvelopeSchema.parse(buildLowCapEvent());

    const gate = GateEvaluationRecordSchema.parse({
      schema_version: "worker_gate_evaluation.v1",
      gate_eval_id: "gate-eval-002",
      trace_id: event.trace_id,
      event_id: event.event_id,
      stage_evaluations: [{ stage: "validity", stage_result: "pass" }],
      overall_result: "pass",
      evaluated_at: NOW,
      authority_class: "non_authoritative",
      canonical_decision_truth: "decisionEnvelope",
    });

    const route = ModelRoutingResultSchema.parse({
      schema_version: "worker_model_routing.v1",
      route_decision_id: "route-001",
      trace_id: event.trace_id,
      event_id: event.event_id,
      route_class: "route_b_small_adjudication",
      route_reason_code: "borderline_candidate",
      advisory_route: true,
      requested_model: { provider: "openai", model: "gpt-5.4-mini" },
      route_basis_stages: ["model_promotion"],
      cooldown_override: false,
      requested_at: NOW,
      authority_class: "non_authoritative",
      canonical_decision_truth: "decisionEnvelope",
    });

    const modelResult = AdvisoryModelOutputEnvelopeSchema.parse({
      schema_version: "worker_model_output.v1",
      assessment_id: "assessment-001",
      trace_id: event.trace_id,
      event_id: event.event_id,
      advisory_label: "candidate_watchlist_fit",
      normalized_result_type: "candidate_assessment",
      confidence: 0.72,
      uncertainty: 0.21,
      limitations: ["limited_social_coverage"],
      provenance: {
        model_provider: "openai",
        model_name: "gpt-5.4-mini",
        input_context_refs: ["context-pack-001"],
        completed_at: NOW,
      },
      non_authority_notice: "advisory_only_no_execution_authority",
      authority_class: "non_authoritative",
      canonical_decision_truth: "decisionEnvelope",
    });

    const suppression = SuppressionRecordSchema.parse({
      schema_version: "worker_suppression.v1",
      suppression_id: "suppression-001",
      trace_id: event.trace_id,
      event_id: event.event_id,
      suppression_type: "cooldown",
      suppression_reason_code: "cooldown_active",
      cooldown_key: "lowcap_cd:token-sol:promotion",
      blocking_evidence_refs: [],
      suppressed_at: NOW,
      authority_class: "non_authoritative",
      canonical_decision_truth: "decisionEnvelope",
    });

    const writeEffect = WriteEffectEnvelopeSchema.parse({
      schema_version: "worker_write_effect.v1",
      write_effect_id: "write-effect-001",
      trace_id: event.trace_id,
      source_event_id: event.event_id,
      effect_type: "watchlist_update",
      target_ref: { target_type: "watchlist", target_id: "watchlist-token-sol" },
      write_reason_code: "model_positive_assessment",
      written_at: NOW,
      journal_truth_anchor: "journal",
      authority_class: "non_authoritative",
      canonical_decision_truth: "decisionEnvelope",
    });

    const stq = STQPlaceholderContractSchema.parse({
      schema_version: "stq_placeholder.v1",
      stq_id: "stq-001",
      trace_id: event.trace_id,
      event_id: event.event_id,
      worker_kind: "low_cap_hunter",
      day_type: "D2_active_continuation_day",
      time_window: "T2_expansion_window",
      stq_score: 72,
      cadence_hint: "30m",
      status: "placeholder_only",
      advisory_only: true,
      notes: ["placeholder_only_for_pr01"],
      authority_class: "non_authoritative",
      canonical_decision_truth: "decisionEnvelope",
    });

    const eventRecord = WorkerJournalEventRecordSchema.parse({
      schema_version: "worker_journal_event_record.v1",
      record_kind: "event_record",
      journal_event_id: "jrnl-event-001",
      trace_id: event.trace_id,
      event_id: event.event_id,
      payload: event,
      journaled_at: NOW,
      authority_class: "non_authoritative",
      canonical_decision_truth: "decisionEnvelope",
    });

    const gateRecord = WorkerJournalGateEvaluationRecordSchema.parse({
      schema_version: "worker_journal_gate_evaluation_record.v1",
      record_kind: "gate_evaluation_record",
      journal_gate_eval_id: "jrnl-gate-001",
      trace_id: event.trace_id,
      event_id: event.event_id,
      payload: gate,
      journaled_at: NOW,
      authority_class: "non_authoritative",
      canonical_decision_truth: "decisionEnvelope",
    });

    const routeRecord = WorkerJournalModelRoutingRecordSchema.parse({
      schema_version: "worker_journal_model_routing_record.v1",
      record_kind: "model_routing_record",
      journal_route_id: "jrnl-route-001",
      trace_id: event.trace_id,
      event_id: event.event_id,
      payload: route,
      journaled_at: NOW,
      authority_class: "non_authoritative",
      canonical_decision_truth: "decisionEnvelope",
    });

    const resultRecord = WorkerJournalModelResultRecordSchema.parse({
      schema_version: "worker_journal_model_result_record.v1",
      record_kind: "model_result_record",
      journal_model_result_id: "jrnl-model-result-001",
      trace_id: event.trace_id,
      event_id: event.event_id,
      payload: modelResult,
      journaled_at: NOW,
      authority_class: "non_authoritative",
      canonical_decision_truth: "decisionEnvelope",
    });

    const suppressionRecord = WorkerJournalSuppressionRecordSchema.parse({
      schema_version: "worker_journal_suppression_record.v1",
      record_kind: "suppression_record",
      journal_suppression_id: "jrnl-suppression-001",
      trace_id: event.trace_id,
      event_id: event.event_id,
      payload: suppression,
      journaled_at: NOW,
      authority_class: "non_authoritative",
      canonical_decision_truth: "decisionEnvelope",
    });

    const writeRecord = WorkerJournalResultingWriteRecordSchema.parse({
      schema_version: "worker_journal_resulting_write_record.v1",
      record_kind: "resulting_write_record",
      journal_write_effect_id: "jrnl-write-001",
      trace_id: event.trace_id,
      event_id: event.event_id,
      payload: writeEffect,
      journaled_at: NOW,
      authority_class: "non_authoritative",
      canonical_decision_truth: "decisionEnvelope",
    });

    const allRecords = [eventRecord, gateRecord, routeRecord, resultRecord, suppressionRecord, writeRecord];
    for (const record of allRecords) {
      expect(WorkerJournalRecordSchema.parse(record).record_kind).toBe(record.record_kind);
    }

    expect(stq.status).toBe("placeholder_only");
  });
});
