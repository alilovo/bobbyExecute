/**
 * Stale Data detection - chaos scenario 5.
 */
import { describe, expect, it } from "vitest";
import { detectStaleData } from "@bot/chaos/signals/stale-data.js";

describe("detectStaleData", () => {
  it("no hit when freshnessMs is 0", () => {
    const r = detectStaleData({ freshnessMs: 0 });
    expect(r.hit).toBe(false);
  });

  it("no hit when freshnessMs below max", () => {
    const r = detectStaleData({ freshnessMs: 20_000, maxAgeMs: 30_000 });
    expect(r.hit).toBe(false);
  });

  it("hit when freshnessMs exceeds max", () => {
    const r = detectStaleData({ freshnessMs: 35_000, maxAgeMs: 30_000 });
    expect(r.hit).toBe(true);
  });

  it("uses default maxAgeMs 30000", () => {
    const r = detectStaleData({ freshnessMs: 31_000 });
    expect(r.hit).toBe(true);
    expect(r.maxAgeMs).toBe(30_000);
  });
});
