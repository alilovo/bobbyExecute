/**
 * M6: Cross-dex divergence signal.
 */
import type { ChaosResult } from "../contracts/chaos-result.js";

export interface DivergenceInput {
  prices: number[];
  threshold?: number;
}

export function detectCrossDexDivergence(input: DivergenceInput): ChaosResult {
  const threshold = input.threshold ?? 0.2;
  if (input.prices.length < 2) return { hit: false, severity: 0 };
  const max = Math.max(...input.prices);
  const min = Math.min(...input.prices);
  if (min <= 0) return { hit: false, severity: 0 };
  const divergence = (max - min) / min;
  if (divergence > threshold) {
    return {
      hit: true,
      severity: Math.min(1, divergence),
      reasonCode: "CROSS_DEX_DIVERGENCE",
      evidence: { divergence, max, min },
    };
  }
  return { hit: false, severity: 0 };
}
