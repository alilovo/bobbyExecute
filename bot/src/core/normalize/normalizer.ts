/**
 * M5: Normalizer - maps adapter responses to NormalizedTokenV1.
 */
import type { NormalizedTokenV1 } from "../contracts/normalized-token.js";

export interface AdapterTokenInput {
  mint: string;
  symbol: string;
  chain?: string;
  source: "paprika" | "dexscreener" | "moralis";
  sourceId?: string;
  pairId?: string;
  name?: string;
  decimals?: number;
}

function generateCanonicalId(chain: string, mint: string): string {
  return `${chain.toLowerCase()}:${mint.toLowerCase()}`;
}

/**
 * Normalize adapter token input to NormalizedTokenV1.
 */
export function normalizeToTokenV1(
  input: AdapterTokenInput,
  timestamp: string,
  confidenceScore: number
): NormalizedTokenV1 {
  const chain = (input.chain ?? "solana").toLowerCase();
  const canonicalId = `${input.source}:${generateCanonicalId(chain, input.mint)}`;

  const mappings: NormalizedTokenV1["mappings"] = {};
  if (input.source === "paprika") {
    mappings.paprika = { tokenId: input.sourceId ?? input.mint, poolId: input.pairId };
  } else if (input.source === "dexscreener") {
    mappings.dexscreener = { tokenId: input.mint, pairId: input.pairId };
  } else if (input.source === "moralis") {
    mappings.moralis = { tokenAddress: input.mint };
  }

  return {
    schema_version: "normalized_token.v1",
    canonical_id: canonicalId,
    symbol: input.symbol,
    mint: input.mint,
    chain: chain as "solana" | "ethereum" | "base",
    sources: [input.source],
    confidence_score: Math.max(0, Math.min(1, confidenceScore)),
    mappings,
    metadata: {
      name: input.name,
      decimals: input.decimals,
      tags: [],
    },
    discovered_at: timestamp,
    last_updated: timestamp,
  };
}
