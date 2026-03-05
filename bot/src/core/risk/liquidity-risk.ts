/**
 * M8: Liquidity Risk Model.
 */
export function computeLiquidityRisk(
  liquidityUsd: number,
  volume24h: number,
  opts?: { minLiquidity?: number }
): number {
  const min = opts?.minLiquidity ?? 10_000;
  if (liquidityUsd <= 0) return 1;
  if (liquidityUsd >= min * 10) return 0;
  return 1 - Math.min(1, liquidityUsd / (min * 5));
}
