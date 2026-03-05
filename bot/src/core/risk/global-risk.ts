/**
 * M8: Global Risk Aggregator - weights 0.40, 0.25, 0.20, 0.15.
 */
import type { RiskBreakdown } from "../contracts/riskbreakdown.js";

const W_LIQUIDITY = 0.4;
const W_SOCIAL_MANIP = 0.25;
const W_MOMENTUM_EXHAUST = 0.2;
const W_STRUCTURAL = 0.15;

export interface RiskInputs {
  traceId: string;
  timestamp: string;
  liquidity: number;
  socialManip: number;
  momentumExhaust: number;
  structuralWeakness: number;
}

export interface CapsPolicyResult {
  scores: RiskInputs;
  capsApplied: string[];
}

export function applyCapsPolicy(inputs: RiskInputs, caps?: Record<string, number>): CapsPolicyResult {
  const applied: string[] = [];
  const defaultCaps: Record<string, number> = {
    liquidity: 0.8,
    socialManip: 0.9,
    momentumExhaust: 0.7,
    structuralWeakness: 0.85,
  };
  const limits = { ...defaultCaps, ...caps };

  let liquidity = Math.min(inputs.liquidity, limits.liquidity);
  if (liquidity < inputs.liquidity) applied.push("liquidity");

  let socialManip = Math.min(inputs.socialManip, limits.socialManip);
  if (socialManip < inputs.socialManip) applied.push("socialManip");

  let momentumExhaust = Math.min(inputs.momentumExhaust, limits.momentumExhaust);
  if (momentumExhaust < inputs.momentumExhaust) applied.push("momentumExhaust");

  let structuralWeakness = Math.min(inputs.structuralWeakness, limits.structuralWeakness);
  if (structuralWeakness < inputs.structuralWeakness) applied.push("structuralWeakness");

  return {
    scores: {
      ...inputs,
      liquidity,
      socialManip,
      momentumExhaust,
      structuralWeakness,
    },
    capsApplied: applied,
  };
}

export function aggregateRisk(inputs: RiskInputs): RiskBreakdown {
  const { scores, capsApplied } = applyCapsPolicy(inputs);
  const aggregate =
    scores.liquidity * W_LIQUIDITY +
    scores.socialManip * W_SOCIAL_MANIP +
    scores.momentumExhaust * W_MOMENTUM_EXHAUST +
    scores.structuralWeakness * W_STRUCTURAL;

  return {
    traceId: scores.traceId,
    timestamp: scores.timestamp,
    liquidity: scores.liquidity,
    socialManip: scores.socialManip,
    momentumExhaust: scores.momentumExhaust,
    structuralWeakness: scores.structuralWeakness,
    aggregate: Math.min(1, aggregate),
    capsApplied,
  };
}
