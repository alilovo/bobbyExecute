/**
 * M5: Cross-Source Validator tests.
 */
import { describe, expect, it } from "vitest";
import {
  validateCrossSource,
  hasDiscrepancy,
} from "@bot/core/validate/cross-source-validator.js";

const now = new Date().toISOString();

const makeToken = (sources: string[]) => ({
  schema_version: "normalized_token.v1" as const,
  canonical_id: "test:solana:m1",
  symbol: "T",
  mint: "m1",
  chain: "solana" as const,
  sources,
  confidence_score: 0.8,
  mappings: {},
  metadata: {},
  discovered_at: now,
  last_updated: now,
});

describe("validateCrossSource", () => {
  it("reduces confidence for single source", () => {
    const tokens = [makeToken(["dexscreener"])];
    const results = validateCrossSource(tokens);
    expect(results[0].confidencePenalty).toBe(0.1);
    expect(results[0].validated.confidence_score).toBeLessThan(0.8);
  });

  it("returns validated tokens", () => {
    const tokens = [makeToken(["dexscreener", "paprika"])];
    const results = validateCrossSource(tokens);
    expect(results[0].validated).toBeDefined();
  });
});

describe("hasDiscrepancy", () => {
  it("flags large delta as discrepancy", () => {
    const { discrepancy, delta } = hasDiscrepancy(100, 50, 0.2);
    expect(delta).toBeGreaterThan(0.2);
    expect(discrepancy).toBe(true);
  });

  it("passes small delta", () => {
    const { discrepancy } = hasDiscrepancy(100, 95, 0.2);
    expect(discrepancy).toBe(false);
  });
});
