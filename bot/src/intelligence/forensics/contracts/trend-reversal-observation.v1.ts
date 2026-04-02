/**
 * Pre-authority typed artifact for trend reversal observation.
 * Observational only, replayable, and explicitly non-authoritative.
 */
import { z } from "zod";

export const TrendReversalObservationStateSchema = z.enum([
  "dead_bounce",
  "reclaim_attempt",
  "weak_reclaim",
  "structure_shift_possible",
  "structure_shift_confirming",
  "invalidated",
]);

export const TrendReversalObservationSourceCoverageEntrySchema = z.object({
  status: z.string(),
  isStale: z.boolean(),
});

export const TrendReversalObservationStructureSignalsSchema = z.object({
  higherLowForming: z.boolean().nullable().default(null),
  reclaimingLevel: z.boolean().nullable().default(null),
  rejectionAtResistance: z.boolean().nullable().default(null),
  breakdownInvalidation: z.boolean().nullable().default(null),
});

export const TrendReversalObservationParticipationSignalsSchema = z.object({
  buyerStrengthIncreasing: z.boolean().nullable().default(null),
  volumeExpansion: z.boolean().nullable().default(null),
  holderGrowthVisible: z.boolean().nullable().default(null),
});

export const TrendReversalObservationRiskSignalsSchema = z.object({
  liquidityDrop: z.boolean().nullable().default(null),
  distributionRisk: z.boolean().nullable().default(null),
  exhaustionWickPattern: z.boolean().nullable().default(null),
});

export const TrendReversalObservationV1Schema = z.object({
  schema_version: z.literal("trend_reversal_observation.v1"),
  token: z.string(),
  chain: z.enum(["solana"]),
  observedAt: z.string().datetime(),
  inputRef: z.string(),
  state: TrendReversalObservationStateSchema,
  confidence: z.number().min(0).max(1),
  structureSignals: TrendReversalObservationStructureSignalsSchema,
  participationSignals: TrendReversalObservationParticipationSignalsSchema,
  riskSignals: TrendReversalObservationRiskSignalsSchema,
  invalidationReasons: z.array(z.string()).default([]),
  evidenceRefs: z.array(z.string()).default([]),
  missingFields: z.array(z.string()).default([]),
  sourceCoverage: z.record(TrendReversalObservationSourceCoverageEntrySchema).default({}),
});

export type TrendReversalObservationState = z.infer<typeof TrendReversalObservationStateSchema>;
export type TrendReversalObservationSourceCoverageEntry = z.infer<
  typeof TrendReversalObservationSourceCoverageEntrySchema
>;
export type TrendReversalObservationStructureSignals = z.infer<
  typeof TrendReversalObservationStructureSignalsSchema
>;
export type TrendReversalObservationParticipationSignals = z.infer<
  typeof TrendReversalObservationParticipationSignalsSchema
>;
export type TrendReversalObservationRiskSignals = z.infer<typeof TrendReversalObservationRiskSignalsSchema>;
export type TrendReversalObservationV1 = z.infer<typeof TrendReversalObservationV1Schema>;

export function assertTrendReversalObservationV1(
  value: unknown,
  source = "unknown"
): TrendReversalObservationV1 {
  const result = TrendReversalObservationV1Schema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  const reason = result.error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}:${issue.message}`;
    })
    .join(";");

  throw new Error(`INVALID_TREND_REVERSAL_OBSERVATION:${source}:${reason}`);
}
