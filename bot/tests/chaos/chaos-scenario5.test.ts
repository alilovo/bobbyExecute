/**
 * Chaos scenario 5 - Stale Data real detection.
 */
import { describe, expect, it } from "vitest";
import { ALL_SCENARIOS } from "@bot/chaos/chaos-suite.js";

describe("Chaos scenario 5 (Stale Data)", () => {
  const scenario5 = ALL_SCENARIOS.find((s) => s.id === 5)!;

  it("passes when freshnessMs is 0", async () => {
    const passed = await scenario5.run({ freshnessMs: 0 });
    expect(passed).toBe(true);
  });

  it("passes when freshnessMs below 30s", async () => {
    const passed = await scenario5.run({ freshnessMs: 20_000 });
    expect(passed).toBe(true);
  });

  it("fails when freshnessMs exceeds 30s", async () => {
    const passed = await scenario5.run({ freshnessMs: 35_000 });
    expect(passed).toBe(false);
  });
});
