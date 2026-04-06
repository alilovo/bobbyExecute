import { z } from "zod";

export const NonAuthoritativeBoundarySchema = z
  .object({
    authority_class: z.literal("non_authoritative"),
    canonical_decision_truth: z.literal("decisionEnvelope"),
  })
  .strict();

export const KnowledgeModeSchema = z.enum(["observed", "inferred", "learned", "operational"]);

export const SourceScopeSchema = z.enum(["bot", "external", "mixed", "manual"]);

export const EventSourceSchema = z
  .object({
    producer: z.string().min(1),
    source_scope: SourceScopeSchema,
    input_ref: z.string().min(1).optional(),
  })
  .strict();

export const EntityRefSchema = z
  .object({
    entity_type: z.enum(["token", "watch_entity", "candidate", "case", "derived_view", "account", "meta"]),
    entity_id: z.string().min(1),
    entity_key: z.string().min(1).optional(),
    chain: z.enum(["solana"]).optional(),
  })
  .strict();

export const IntegrityHintSchema = z
  .object({
    integrity_band: z.enum(["clean", "mixed", "poor"]).optional(),
    source_reliability: z.number().min(0).max(1).optional(),
    liquidity_integrity: z.number().min(0).max(1).optional(),
    holder_integrity: z.number().min(0).max(1).optional(),
  })
  .strict();

export const DecisionTimeContextMarkerSchema = z
  .object({
    marker_type: z.enum([
      "decision_input_snapshot",
      "watch_state_snapshot",
      "case_context_snapshot",
      "review_context_snapshot",
    ]),
    marker_ref: z.string().min(1),
  })
  .strict();

export const ReplayMetadataSchema = z
  .object({
    replay_version: z.literal("worker_control_replay.v1"),
    sequence_id: z.number().int().nonnegative(),
    dedupe_key: z.string().min(1).optional(),
    cooldown_key: z.string().min(1).optional(),
    batch_key: z.string().min(1).optional(),
    prior_event_refs: z.array(z.string()).default([]),
    source_window_start: z.string().datetime().optional(),
    source_window_end: z.string().datetime().optional(),
    raw_payload_ref: z.string().min(1).optional(),
  })
  .strict();

export type NonAuthoritativeBoundary = z.infer<typeof NonAuthoritativeBoundarySchema>;
export type KnowledgeMode = z.infer<typeof KnowledgeModeSchema>;
export type SourceScope = z.infer<typeof SourceScopeSchema>;
export type EventSource = z.infer<typeof EventSourceSchema>;
export type EntityRef = z.infer<typeof EntityRefSchema>;
export type IntegrityHint = z.infer<typeof IntegrityHintSchema>;
export type DecisionTimeContextMarker = z.infer<typeof DecisionTimeContextMarkerSchema>;
export type ReplayMetadata = z.infer<typeof ReplayMetadataSchema>;
