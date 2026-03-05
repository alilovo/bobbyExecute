/**
 * M8: RiskBreakdown contract - Zod schema for risk aggregation.
 */
import { z } from "zod";

export const RiskBreakdownSchema = z.object({
  traceId: z.string(),
  timestamp: z.string().datetime(),
  liquidity: z.number().min(0).max(1),
  socialManip: z.number().min(0).max(1),
  momentumExhaust: z.number().min(0).max(1),
  structuralWeakness: z.number().min(0).max(1),
  aggregate: z.number().min(0).max(1),
  capsApplied: z.array(z.string()),
});

export type RiskBreakdown = z.infer<typeof RiskBreakdownSchema>;
