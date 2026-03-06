/**
 * Stale Data detection for Chaos scenario 5.
 * Hits when data freshness exceeds max age (default 30s).
 */
const DEFAULT_MAX_AGE_MS = 30_000;

export interface StaleDataResult {
  hit: boolean;
  freshnessMs?: number;
  maxAgeMs: number;
}

/**
 * Detect stale data. Hit when freshnessMs > maxAgeMs.
 */
export function detectStaleData(ctx: {
  freshnessMs?: number;
  maxAgeMs?: number;
}): StaleDataResult {
  const maxAgeMs = ctx.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const freshnessMs = ctx.freshnessMs ?? 0;
  const hit = freshnessMs > maxAgeMs;
  return { hit, freshnessMs, maxAgeMs };
}
