/**
 * Pre-authority typed artifact.
 * Contract scaffold only for v2 candidate discovery output.
 */
import { z } from "zod";
import { SourceObservationSourceSchema } from "./source-observation.js";

export const CandidateTokenPrioritySchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

export const CandidateTokenSchema = z.object({
  schema_version: z.literal("candidate_token.v1"),
  token: z.string(),
  symbol: z.string().optional(),
  chain: z.enum(["solana"]),
  discoveryReasons: z.array(z.string()).default([]),
  firstSeenMs: z.number().int().nonnegative(),
  sourceSet: z.array(SourceObservationSourceSchema).default([]),
  evidenceRefs: z.array(z.string()).default([]),
  priority: CandidateTokenPrioritySchema,
});

export type CandidateTokenPriority = z.infer<typeof CandidateTokenPrioritySchema>;
export type CandidateToken = z.infer<typeof CandidateTokenSchema>;
