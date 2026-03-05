/**
 * M6: ChaosResult contract - Zod schema.
 */
import { z } from "zod";

export const ChaosResultSchema = z.object({
  hit: z.boolean(),
  severity: z.number().min(0).max(1),
  reasonCode: z.string().optional(),
  evidence: z.record(z.unknown()).optional(),
});

export type ChaosResult = z.infer<typeof ChaosResultSchema>;
