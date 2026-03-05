/**
 * M6: Liquidity delta signal - detect drain.
 */
import type { ChaosResult } from "../contracts/chaos-result.js";

export interface LiquidityInput {
  currentLiquidity: number;
  prevLiquidity?: number;
  threshold?: number;
}

export function detectLiquidityDrain(input: LiquidityInput): ChaosResult {
  const threshold = input.threshold ?? 0.3;
  if (!input.prevLiquidity || input.prevLiquidity <= 0) {
    return { hit: false, severity: 0 };
  }
  const delta = (input.prevLiquidity - input.currentLiquidity) / input.prevLiquidity;
  if (delta > threshold) {
    return {
      hit: true,
      severity: Math.min(1, delta),
      reasonCode: "LIQUIDITY_DRAIN",
      evidence: { delta, current: input.currentLiquidity, prev: input.prevLiquidity },
    };
  }
  return { hit: false, severity: 0 };
}
