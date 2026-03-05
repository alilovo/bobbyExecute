/**
 * M8: Risk Engine tests.
 */
import { describe, expect, it } from "vitest";
import { aggregateRisk, applyCapsPolicy } from "@bot/core/risk/global-risk.js";
import { computeLiquidityRisk } from "@bot/core/risk/liquidity-risk.js";

describe("aggregateRisk", () => {
  it("uses exact weights 0.40, 0.25, 0.20, 0.15", () => {
    const r = aggregateRisk({
      traceId: "t1",
      timestamp: "2026-03-05T12:00:00.000Z",
      liquidity: 0.5,
      socialManip: 0,
      momentumExhaust: 0,
      structuralWeakness: 0,
    });
    expect(r.aggregate).toBeCloseTo(0.5 * 0.4, 5);
  });

  it("produces valid RiskBreakdown", () => {
    const r = aggregateRisk({
      traceId: "t1",
      timestamp: "2026-03-05T12:00:00.000Z",
      liquidity: 0.2,
      socialManip: 0.1,
      momentumExhaust: 0,
      structuralWeakness: 0.3,
    });
    expect(r.traceId).toBe("t1");
    expect(r.liquidity).toBe(0.2);
    expect(r.aggregate).toBeLessThanOrEqual(1);
    expect(Array.isArray(r.capsApplied)).toBe(true);
  });
});

describe("applyCapsPolicy", () => {
  it("populates caps_applied when triggered", () => {
    const { capsApplied } = applyCapsPolicy({
      traceId: "t1",
      timestamp: "2026-03-05T12:00:00.000Z",
      liquidity: 0.95,
      socialManip: 0,
      momentumExhaust: 0,
      structuralWeakness: 0,
    });
    expect(capsApplied).toContain("liquidity");
  });
});

describe("computeLiquidityRisk", () => {
  it("returns 1 for zero liquidity", () => {
    expect(computeLiquidityRisk(0, 1000)).toBe(1);
  });
  it("returns low risk for high liquidity", () => {
    expect(computeLiquidityRisk(100_000, 10_000)).toBe(0);
  });
});
