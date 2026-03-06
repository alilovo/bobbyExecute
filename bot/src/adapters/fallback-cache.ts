/**
 * 60s TTL fallback cache for adapter responses.
 * Returns cached data on adapter failure when not expired.
 */
export interface CacheEntry<T> {
  value: T;
  cachedAt: number;
}

/**
 * Create a fallback cache with TTL.
 */
export function createFallbackCache<T>(ttlMs: number = 60_000): {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  isExpired(key: string): boolean;
  getOrUndefined(key: string): T | undefined;
} {
  const store = new Map<string, CacheEntry<T>>();

  return {
    get(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() - entry.cachedAt > ttlMs) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },

    set(key: string, value: T): void {
      store.set(key, { value, cachedAt: Date.now() });
    },

    isExpired(key: string): boolean {
      const entry = store.get(key);
      if (!entry) return true;
      return Date.now() - entry.cachedAt > ttlMs;
    },

    getOrUndefined(key: string): T | undefined {
      return this.get(key);
    },
  };
}

/**
 * Wrap an async adapter call with fallback cache.
 * On success: cache result. On failure: return cached if not expired.
 */
export async function withFallbackCache<T>(
  cache: ReturnType<typeof createFallbackCache<T>>,
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const result = await fn();
    cache.set(key, result);
    return result;
  } catch {
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    throw new Error(`Adapter failed and no valid cache for ${key}`);
  }
}
