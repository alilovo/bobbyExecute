/**
 * M9: Confidence Policy - thresholds from config.
 */
export interface ConfidencePolicyConfig {
  minConfidence?: number;
  minCrossSource?: number;
}

export function evaluateConfidence(
  confidence: number,
  crossSourceConfidence: number,
  config?: ConfidencePolicyConfig
): { allow: boolean; reason?: string } {
  const minConf = config?.minConfidence ?? 0.5;
  const minCross = config?.minCrossSource ?? 0.85;
  if (confidence < minConf) {
    return { allow: false, reason: `Confidence ${confidence} < ${minConf}` };
  }
  if (crossSourceConfidence < minCross) {
    return { allow: false, reason: `CrossSource ${crossSourceConfidence} < ${minCross}` };
  }
  return { allow: true };
}
