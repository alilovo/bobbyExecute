/**
 * M6: Chaos signal detection tests.
 */
import { describe, expect, it } from "vitest";
import { detectLiquidityDrain } from "@bot/chaos/signals/liquidity-delta.js";
import { detectCrossDexDivergence } from "@bot/chaos/signals/cross-dex-divergence.js";
import { detectPumpVelocityNoHolders } from "@bot/chaos/signals/pump-velocity.js";

describe("detectLiquidityDrain", () => {
  it("returns hit when liquidity drops > threshold", () => {
    const r = detectLiquidityDrain({
      currentLiquidity: 60_000,
      prevLiquidity: 100_000,
      threshold: 0.3,
    });
    expect(r.hit).toBe(true);
    expect(r.reasonCode).toBe("LIQUIDITY_DRAIN");
  });

  it("returns no hit when delta below threshold", () => {
    const r = detectLiquidityDrain({
      currentLiquidity: 95_000,
      prevLiquidity: 100_000,
    });
    expect(r.hit).toBe(false);
  });
});

describe("detectCrossDexDivergence", () => {
  it("returns hit when price divergence exceeds threshold", () => {
    const r = detectCrossDexDivergence({ prices: [100, 150], threshold: 0.2 });
    expect(r.hit).toBe(true);
    expect(r.reasonCode).toBe("CROSS_DEX_DIVERGENCE");
  });

  it("returns no hit for aligned prices", () => {
    const r = detectCrossDexDivergence({ prices: [100, 105] });
    expect(r.hit).toBe(false);
  });
});

describe("detectPumpVelocityNoHolders", () => {
  it("returns hit when pump with no holder growth", () => {
    const r = detectPumpVelocityNoHolders({
      priceChange24h: 0.6,
      holderGrowth: 0.05,
      volumeSpike: 4,
    });
    expect(r.hit).toBe(true);
  });

  it("returns no hit when holder growth present", () => {
    const r = detectPumpVelocityNoHolders({
      priceChange24h: 0.6,
      holderGrowth: 0.2,
      volumeSpike: 4,
    });
    expect(r.hit).toBe(false);
  });
});
