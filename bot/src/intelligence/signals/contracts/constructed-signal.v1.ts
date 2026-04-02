/**
 * Pre-authority constructed signal artifact.
 * Descriptive only, bounded, and explicitly non-authoritative.
 */
import { z } from "zod";

export const ConstructedSignalDirectionSchema = z.enum([
  "bullish",
  "bearish",
  "neutral",
]);

export const ConstructedSignalStatusSchema = z.enum([
  "present",
  "partial",
  "missing",
]);

export const ConstructedSignalTypeSchema = z.enum([
  "structure_weakness",
  "reclaim_attempt",
  "possible_structure_shift",
  "participation_improvement",
  "liquidity_fragility",
  "manipulation_caution",
  "downside_continuation_risk",
]);

export const ConstructedSignalV1Schema = z.object({
  schema_version: z.literal("constructed_signal.v1"),
  signalType: ConstructedSignalTypeSchema,
  direction: ConstructedSignalDirectionSchema,
  strength: z.number().min(0).max(1).nullable().default(null),
  confidence: z.number().min(0).max(1).nullable().default(null),
  evidenceRefs: z.array(z.string()).default([]),
  missingInputs: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
  status: ConstructedSignalStatusSchema,
});

export type ConstructedSignalDirection = z.infer<typeof ConstructedSignalDirectionSchema>;
export type ConstructedSignalStatus = z.infer<typeof ConstructedSignalStatusSchema>;
export type ConstructedSignalType = z.infer<typeof ConstructedSignalTypeSchema>;
export type ConstructedSignalV1 = z.infer<typeof ConstructedSignalV1Schema>;

export function assertConstructedSignalV1(value: unknown, source = "unknown"): ConstructedSignalV1 {
  const result = ConstructedSignalV1Schema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  const reason = result.error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}:${issue.message}`;
    })
    .join(";");

  throw new Error(`INVALID_CONSTRUCTED_SIGNAL:${source}:${reason}`);
}
