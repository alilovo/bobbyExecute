/**
 * Internal normalized-token shape.
 * Kept separate from the legacy tokenuniverse schema owner so source callers can
 * depend on a local structural contract without importing the frozen legacy file.
 */
export type TokenSource = "paprika" | "dexscreener" | "moralis";

export interface SourceMappingV1 {
  paprika?: { tokenId: string; poolId?: string };
  dexscreener?: { tokenId: string; pairId?: string };
  moralis?: { tokenAddress: string };
}

export interface NormalizedTokenV1 {
  schema_version: "normalized_token.v1";
  canonical_id: string;
  symbol: string;
  mint: string;
  chain: "solana" | "ethereum" | "base";
  sources: TokenSource[];
  confidence_score: number;
  mappings: SourceMappingV1;
  metadata: {
    name?: string;
    decimals?: number;
    logoUrl?: string;
    tags: string[];
  };
  discovered_at: string;
  last_updated: string;
}
