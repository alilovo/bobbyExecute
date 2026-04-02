/**
 * Pre-decision score component artifact.
 * Signed, bounded, and explicitly non-authoritative.
 */
import { z } from "zod";

export const ScoreComponentIdSchema = z.enum([
  "structure",
  "participation",
  "fragility",
  "manipulation_caution",
  "reversal_quality",
  "downside_continuation_risk",
]);

export const ScoreComponentStatusSchema = z.enum([
  "present",
  "partial",
  "missing",
]);

export const ScoreComponentV1Schema = z.object({
  schema_version: z.literal("score_component.v1"),
  componentId: ScoreComponentIdSchema,
  score: z.number().min(-1).max(1).nullable().default(null),
  confidence: z.number().min(0).max(1).nullable().default(null),
  sourceSignalTypes: z.array(z.string()).default([]),
  evidenceRefs: z.array(z.string()).default([]),
  missingInputs: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
  status: ScoreComponentStatusSchema,
});

export type ScoreComponentId = z.infer<typeof ScoreComponentIdSchema>;
export type ScoreComponentStatus = z.infer<typeof ScoreComponentStatusSchema>;
export type ScoreComponentV1 = z.infer<typeof ScoreComponentV1Schema>;

export function assertScoreComponentV1(
  value: unknown,
  source = "unknown"
): ScoreComponentV1 {
  const result = ScoreComponentV1Schema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  const reason = result.error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}:${issue.message}`;
    })
    .join(";");

  throw new Error(`INVALID_SCORE_COMPONENT:${source}:${reason}`);
}
