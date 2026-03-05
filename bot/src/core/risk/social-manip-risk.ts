/**
 * M8: Social Manipulation Risk Model.
 */
export function computeSocialManipRisk(
  holderGrowth: number,
  volumeSpike: number,
  opts?: { maxSpike?: number }
): number {
  const max = opts?.maxSpike ?? 5;
  if (volumeSpike > max && holderGrowth < 0.1) return Math.min(1, (volumeSpike - max) / 5);
  return 0;
}
