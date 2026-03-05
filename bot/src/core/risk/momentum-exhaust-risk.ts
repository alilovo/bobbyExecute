/**
 * M8: Momentum Exhaustion Risk Model.
 */
export function computeMomentumExhaustRisk(
  priceChange24h: number,
  volumeTrend: number
): number {
  if (priceChange24h > 0.5 && volumeTrend < 0) return 0.5;
  if (priceChange24h > 0.3 && volumeTrend < -0.2) return 0.3;
  return 0;
}
