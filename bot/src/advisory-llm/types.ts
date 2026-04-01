/**
 * Advisory-only LLM types — read-only annotation of canonical decisions.
 * No trading authority.
 */
import type { DecisionEnvelope } from "../core/contracts/decision-envelope.js";

/** Sealed input: canonical v3 envelope only (no runtime state, no adapters). */
export type DecisionEnvelopeV3 = Extract<DecisionEnvelope, { schemaVersion: "decision.envelope.v3" }>;

export interface AdvisoryEvidencePack {
  decision: DecisionEnvelopeV3;
}

export interface AdvisoryLLMResponse {
  summary: string;
  reasoning: string;
  riskNotes?: string[];
  anomalies?: string[];
  /** 0–1 advisory confidence (not trading confidence). */
  confidence: number;
  provider: string;
  model: string;
}

export interface AdvisoryLLMProvider {
  readonly id: "openai" | "xai";
  generate(pack: AdvisoryEvidencePack): Promise<AdvisoryLLMResponse>;
}

export interface AdvisoryCallAuditLog {
  traceId: string;
  provider: string;
  model: string;
  latencyMs: number;
  success: boolean;
  cacheKey?: string;
  error?: string;
}
