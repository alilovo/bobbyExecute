/**
 * Pre-authority typed artifact.
 * Contract scaffold only for v2 universe inclusion results.
 */
import { z } from "zod";

export const UniverseBuildResultSchema = z.object({
  schema_version: z.literal("universe_build_result.v1"),
  token: z.string(),
  chain: z.enum(["solana"]),
  included: z.boolean(),
  exclusionReasons: z.array(z.string()).default([]),
  normalizedFeatures: z.record(z.number()).default({}),
  sourceCoverage: z.record(z.number().int().nonnegative()).default({}),
});

export type UniverseBuildResult = z.infer<typeof UniverseBuildResultSchema>;
