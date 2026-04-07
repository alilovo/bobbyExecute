/**
 * Playbook / optimization memory contracts.
 *
 * Versioned operational guidance derived from lower layers.
 * Playbooks remain non-authoritative and never replace journal truth, cases, or validated priors.
 */
import { z } from "zod";
import { CaseSubjectRefSchema, type CaseSubjectKind } from "./casebook.js";

export const PLAYBOOK_LAYER = "playbook_or_optimization_memory" as const;
export const PLAYBOOK_SCHEMA_VERSION = "playbook.revision.v1" as const;

export const PLAYBOOK_SOURCE_LAYERS = [
  "raw_journal_truth",
  "canonical_case_record",
  "derived_knowledge_view",
  "machine_safe_prior",
] as const;
export type PlaybookSourceLayer = (typeof PLAYBOOK_SOURCE_LAYERS)[number];
export const PlaybookSourceLayerSchema = z.enum(PLAYBOOK_SOURCE_LAYERS);

export const PLAYBOOK_KINDS = [
  "entry_playbook",
  "abort_playbook",
  "regime_playbook",
  "kol_trust_model_playbook",
] as const;
export type PlaybookKind = (typeof PLAYBOOK_KINDS)[number];
export const PlaybookKindSchema = z.enum(PLAYBOOK_KINDS);

export const PLAYBOOK_REVIEW_STATES = [
  "proposed",
  "reviewed",
  "approved",
  "superseded",
  "rejected",
] as const;
export type PlaybookReviewState = (typeof PLAYBOOK_REVIEW_STATES)[number];
export const PlaybookReviewStateSchema = z.enum(PLAYBOOK_REVIEW_STATES);

export const PlaybookLayerSchema = z.literal(PLAYBOOK_LAYER);

export const PlaybookGuidanceSchema = z
  .object({
    objectives: z.array(z.string().min(1)).min(1),
    rules: z.array(z.string().min(1)).min(1),
    cautions: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type PlaybookGuidance = z.infer<typeof PlaybookGuidanceSchema>;

export const PlaybookVersionTraceSchema = z
  .object({
    version_id: z.string().min(1),
    prior_version_id: z.string().min(1).nullable(),
    audit_log_entry_refs: z.array(z.string().min(1)).min(1),
    evidence_lineage_refs: z.array(z.string().min(1)).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.prior_version_id != null && value.prior_version_id === value.version_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["prior_version_id"],
        message: "prior_version_id_must_not_match_version_id",
      });
    }
  });
export type PlaybookVersionTrace = z.infer<typeof PlaybookVersionTraceSchema>;

export const PlaybookReviewMetadataSchema = z
  .object({
    review_state: PlaybookReviewStateSchema,
    reviewed_by: z.string().min(1).optional(),
    reviewed_at: z.string().datetime().optional(),
    review_note: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const noteRequired = value.review_state === "rejected" || value.review_state === "superseded";

    if (value.review_state === "proposed") {
      if (value.reviewed_by != null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reviewed_by"],
          message: "reviewed_by_must_be_omitted_for_proposed",
        });
      }
      if (value.reviewed_at != null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reviewed_at"],
          message: "reviewed_at_must_be_omitted_for_proposed",
        });
      }
    } else {
      if (value.reviewed_by == null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reviewed_by"],
          message: `reviewed_by_required_for_${value.review_state}`,
        });
      }
      if (value.reviewed_at == null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reviewed_at"],
          message: `reviewed_at_required_for_${value.review_state}`,
        });
      }
    }

    if (noteRequired && value.review_note == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["review_note"],
        message: `review_note_required_for_${value.review_state}`,
      });
    }
  });
export type PlaybookReviewMetadata = z.infer<typeof PlaybookReviewMetadataSchema>;

const PlaybookBaseSchema = z
  .object({
    schema_version: z.literal(PLAYBOOK_SCHEMA_VERSION),
    layer: PlaybookLayerSchema,
    authority_class: z.literal("non_authoritative"),
    playbook_id: z.string().min(1),
    playbook_kind: PlaybookKindSchema,
    title: z.string().min(1),
    summary: z.string().min(1),
    source_layers: z.array(PlaybookSourceLayerSchema).min(1),
    scope_refs: z.array(CaseSubjectRefSchema).min(1),
    guidance: PlaybookGuidanceSchema,
    version_trace: PlaybookVersionTraceSchema,
    review_metadata: PlaybookReviewMetadataSchema,
  })
  .strict();

function hasRequiredScopeKinds(
  scopeRefs: readonly { subject_kind: CaseSubjectKind }[],
  requiredKinds: readonly CaseSubjectKind[]
): boolean {
  return requiredKinds.every((kind) => scopeRefs.some((ref) => ref.subject_kind === kind));
}

function createPlaybookSchema(playbookKind: PlaybookKind, requiredKinds: readonly CaseSubjectKind[]) {
  return PlaybookBaseSchema.extend({
    playbook_kind: z.literal(playbookKind),
  }).superRefine((value, context) => {
    if (!hasRequiredScopeKinds(value.scope_refs, requiredKinds)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scope_refs"],
        message: `missing_required_scope_kind:${playbookKind}`,
      });
    }
  });
}

export const EntryPlaybookSchema = createPlaybookSchema("entry_playbook", ["setup_type"]);
export const AbortPlaybookSchema = createPlaybookSchema("abort_playbook", ["failure_mode"]);
export const RegimePlaybookSchema = createPlaybookSchema("regime_playbook", ["market_regime"]);
export const KolTrustModelPlaybookSchema = createPlaybookSchema(
  "kol_trust_model_playbook",
  ["account_or_kol"]
);

export const PlaybookSchema = z.union([
  EntryPlaybookSchema,
  AbortPlaybookSchema,
  RegimePlaybookSchema,
  KolTrustModelPlaybookSchema,
]);
export type PlaybookRevision = z.infer<typeof PlaybookSchema>;

export function assertPlaybookRevision(value: unknown, source = "unknown"): PlaybookRevision {
  const result = PlaybookSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  const reason = result.error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}:${issue.message}`;
    })
    .join(";");

  throw new Error(`INVALID_PLAYBOOK_REVISION:${source}:${reason}`);
}
