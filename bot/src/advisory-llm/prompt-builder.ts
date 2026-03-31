/**
 * Deterministic prompt from sealed evidence only (canonical v3 JSON).
 */
import type { AdvisoryEvidencePack } from "./types.js";

export function buildAdvisoryPrompt(pack: AdvisoryEvidencePack): string {
  const payload = JSON.stringify(pack.decision);
  return [
    "You are a read-only auditor. Explain the following canonical trading decision envelope (v3).",
    "Do not suggest trades, overrides, or policy changes. Do not invent data beyond the JSON.",
    "Respond with a single JSON object matching this TypeScript shape exactly:",
    "{ summary: string; reasoning: string; riskNotes?: string[]; anomalies?: string[]; confidence: number (0-1); provider: string; model: string }",
    "Set provider and model to the values you are instructed to use by the caller (echo them in the JSON).",
    "Canonical decision JSON:",
    payload,
  ].join("\n\n");
}
