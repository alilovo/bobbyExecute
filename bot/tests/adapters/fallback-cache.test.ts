/**
 * Fallback cache - 60s TTL, cache hit on adapter failure.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createFallbackCache, withFallbackCache } from "@bot/adapters/fallback-cache.js";

describe("createFallbackCache", () => {
  it("returns undefined for missing key", () => {
    const cache = createFallbackCache(60_000);
    expect(cache.get("x")).toBeUndefined();
  });

  it("returns value after set within TTL", () => {
    const cache = createFallbackCache(60_000);
    cache.set("k1", { id: 1 });
    expect(cache.get("k1")).toEqual({ id: 1 });
  });

  it("returns undefined after TTL expired", async () => {
    const cache = createFallbackCache(50);
    cache.set("k1", "v1");
    expect(cache.get("k1")).toBe("v1");
    await new Promise((r) => setTimeout(r, 60));
    expect(cache.get("k1")).toBeUndefined();
  });

  it("isExpired returns true for missing key", () => {
    const cache = createFallbackCache(60_000);
    expect(cache.isExpired("x")).toBe(true);
  });

  it("isExpired returns false within TTL", () => {
    const cache = createFallbackCache(60_000);
    cache.set("k1", "v1");
    expect(cache.isExpired("k1")).toBe(false);
  });
});

describe("withFallbackCache", () => {
  let cache: ReturnType<typeof createFallbackCache<string>>;

  beforeEach(() => {
    cache = createFallbackCache(60_000);
  });

  it("returns fn result and caches on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withFallbackCache(cache, "key", fn);
    expect(result).toBe("ok");
    expect(cache.get("key")).toBe("ok");
  });

  it("returns cached value on failure when cache hit", async () => {
    cache.set("key", "cached");
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    const result = await withFallbackCache(cache, "key", fn);
    expect(result).toBe("cached");
  });

  it("throws on failure when no cache", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(withFallbackCache(cache, "key", fn)).rejects.toThrow("fail");
  });
});
