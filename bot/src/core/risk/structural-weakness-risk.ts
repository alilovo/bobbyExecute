/**
 * M8: Structural Weakness Risk Model.
 */
export function computeStructuralWeaknessRisk(
  sourceCount: number,
  crossSourceVariance: number
): number {
  if (sourceCount < 2) return 0.5;
  return Math.min(1, crossSourceVariance * 2);
}
