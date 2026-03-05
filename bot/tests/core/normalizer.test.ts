/**
 * M5: Normalizer tests.
 */
import { describe, expect, it } from "vitest";
import { normalizeToTokenV1 } from "@bot/core/normalize/normalizer.js";

const now = new Date().toISOString();

describe("normalizeToTokenV1", () => {
  it("produces valid NormalizedTokenV1", () => {
    const out = normalizeToTokenV1(
      {
        mint: "ABC123",
        symbol: "TEST",
        chain: "solana",
        source: "dexscreener",
        pairId: "pair1",
      },
      now,
      0.85
    );
    expect(out.schema_version).toBe("normalized_token.v1");
    expect(out.canonical_id).toBe("dexscreener:solana:abc123");
    expect(out.mint).toBe("ABC123");
    expect(out.symbol).toBe("TEST");
    expect(out.confidence_score).toBe(0.85);
  });

  it("lowercases chain in canonical_id", () => {
    const out = normalizeToTokenV1(
      { mint: "XyZ", symbol: "T", source: "paprika", chain: "Solana" },
      now,
      0.5
    );
    expect(out.canonical_id).toContain("solana:xyz");
  });
});
