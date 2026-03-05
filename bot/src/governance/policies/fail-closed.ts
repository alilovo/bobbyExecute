/**
 * M9: FailClosed Policy - deny when completeness < threshold.
 */
export interface FailClosedInput {
  completeness: number;
  threshold?: number;
  criticalSourcesMissing?: string[];
}

export function evaluateFailClosed(input: FailClosedInput): { allow: boolean; reason?: string } {
  const threshold = input.threshold ?? 0.7;
  if (input.completeness < threshold) {
    return {
      allow: false,
      reason: `FailClosed: completeness ${input.completeness} < ${threshold}`,
    };
  }
  if (input.criticalSourcesMissing && input.criticalSourcesMissing.length > 0) {
    return {
      allow: false,
      reason: `FailClosed: missing sources [${input.criticalSourcesMissing.join(", ")}]`,
    };
  }
  return { allow: true };
}
