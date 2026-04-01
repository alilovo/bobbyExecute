/**
 * Strict output validation — invalid payloads are discarded (fail-safe).
 */
import { z } from "zod";
import type { AdvisoryLLMResponse } from "./types.js";

export const AdvisoryLLMResponseSchema = z.object({
  summary: z.string().min(1).max(16_000),
  reasoning: z.string().min(1).max(32_000),
  riskNotes: z.array(z.string().max(2000)).max(50).optional(),
  anomalies: z.array(z.string().max(2000)).max(50).optional(),
  confidence: z.number().min(0).max(1),
  provider: z.string().min(1).max(64),
  model: z.string().min(1).max(128),
});

export function parseAdvisoryLLMResponse(raw: unknown): AdvisoryLLMResponse | null {
  const r = AdvisoryLLMResponseSchema.safeParse(raw);
  return r.success ? r.data : null;
}
