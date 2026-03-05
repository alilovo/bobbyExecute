/**
 * M9: Fallback Policy - degrade when primary unavailable.
 */
export interface FallbackInput {
  primaryAvailable: boolean;
  fallbackAvailable?: boolean;
}

export function evaluateFallback(input: FallbackInput): {
  usePrimary: boolean;
  useFallback: boolean;
  degraded: boolean;
} {
  if (input.primaryAvailable) {
    return { usePrimary: true, useFallback: false, degraded: false };
  }
  if (input.fallbackAvailable) {
    return { usePrimary: false, useFallback: true, degraded: true };
  }
  return { usePrimary: false, useFallback: false, degraded: true };
}
