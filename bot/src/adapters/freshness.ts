/**
 * Freshness validation for adapter responses.
 * Rejects data older than maxStalenessMs.
 */
const DEFAULT_MAX_STALENESS_MS = 30_000;

/**
 * Parse timestamp from API response. Supports ISO string, Unix seconds, Unix ms.
 */
export function parseDataTimestamp(raw: unknown): number | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const v = o.last_updated ?? o.updated_at ?? o.updatedAt ?? o.timestamp;
  if (v == null) return undefined;
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
  if (typeof v === "string") {
    const n = Date.parse(v);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

/**
 * Validate freshness. Throws if data is stale.
 */
export function validateFreshness(
  raw: unknown,
  maxStalenessMs: number = DEFAULT_MAX_STALENESS_MS
): void {
  const ts = parseDataTimestamp(raw);
  if (ts == null) return;
  const ageMs = Date.now() - ts;
  if (ageMs > maxStalenessMs) {
    throw new Error(`Stale data: age ${Math.round(ageMs / 1000)}s exceeds max ${maxStalenessMs / 1000}s`);
  }
}
