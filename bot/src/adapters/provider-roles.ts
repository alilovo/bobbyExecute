import type { WalletSnapshot } from "../core/contracts/wallet.js";
import { mapTokenToMarketSnapshot } from "./dexpaprika/mapper.js";
import type { DexPaprikaTokenResponse } from "./dexpaprika/types.js";
import { mapMoralisToWalletSnapshot } from "./moralis/mapper.js";
import type { MoralisTokenBalance } from "./moralis/types.js";
import type { MarketAdapterFetch } from "./orchestrator/adapter-orchestrator.js";

export const PRIMARY_MARKET_PROVIDER_ID = "dexpaprika" as const;
export const PRIMARY_WALLET_PROVIDER_ID = "moralis" as const;
export const OPTIONAL_INTELLIGENCE_PROVIDER_ID = "dexcheck" as const;

export const CANONICAL_PROVIDER_ROLE_SPLIT = {
  dexpaprika: {
    providerId: PRIMARY_MARKET_PROVIDER_ID,
    plane: "market",
    priority: "primary",
    requiredForPaperRuntime: true,
    responsibilities: [
      "token ingest",
      "pool ingest",
      "pair ingest",
      "swap ingest",
      "liquidity ingest",
      "price ingest",
      "volume ingest",
      "paper-mode market truth",
      "market freshness baseline",
    ],
  },
  moralis: {
    providerId: PRIMARY_WALLET_PROVIDER_ID,
    plane: "wallet",
    priority: "primary",
    requiredForPaperRuntime: true,
    responsibilities: [
      "wallet snapshots",
      "holder metrics",
      "top holders",
      "historical holders",
      "token search",
      "pair enrichment",
      "solana enrichment",
      "secondary market cross-check",
    ],
  },
  dexcheck: {
    providerId: OPTIONAL_INTELLIGENCE_PROVIDER_ID,
    plane: "intelligence",
    priority: "optional",
    requiredForPaperRuntime: false,
    responsibilities: [
      "whale tracking",
      "top trader signals",
      "wallet signals",
      "smart-money signals",
      "websocket analytics",
    ],
  },
} as const;

export function getPaperMarketAdapterRoleViolations(
  adapters: readonly Pick<MarketAdapterFetch, "id">[]
): string[] {
  const violations: string[] = [];

  if (adapters.length === 0) {
    violations.push(
      "Paper runtime requires at least one market adapter and must begin with DexPaprika."
    );
    return violations;
  }

  if (adapters[0]?.id !== PRIMARY_MARKET_PROVIDER_ID) {
    violations.push(
      "Paper runtime market ingest must start with DexPaprika as the primary market adapter."
    );
  }

  if (adapters.some((adapter) => adapter.id === OPTIONAL_INTELLIGENCE_PROVIDER_ID)) {
    violations.push("DexCheck is intelligence-only and cannot be wired into paper market ingest.");
  }

  return violations;
}

export function assertCanonicalPaperMarketAdapters(
  adapters: readonly Pick<MarketAdapterFetch, "id">[]
): void {
  const violations = getPaperMarketAdapterRoleViolations(adapters);
  if (violations.length > 0) {
    throw new Error(violations.join(" "));
  }
}

export function getPaperWalletProviderViolation(
  wallet: Pick<WalletSnapshot, "source">
): string | null {
  if (wallet.source !== PRIMARY_WALLET_PROVIDER_ID) {
    return "Paper runtime wallet and holder intake must come from Moralis.";
  }

  return null;
}

export function createCanonicalPaperMarketAdapters(params: {
  dexpaprika: {
    getTokenWithHash: (tokenId: string) => Promise<{
      raw: unknown;
      rawPayloadHash: string;
    }>;
  };
  tokenId: string;
}): MarketAdapterFetch[] {
  return [
    {
      id: PRIMARY_MARKET_PROVIDER_ID,
      fetch: async () => {
        const timestamp = new Date().toISOString();
        const traceId = `paper-${PRIMARY_MARKET_PROVIDER_ID}-${timestamp}`;
        const token = await params.dexpaprika.getTokenWithHash(params.tokenId);
        const tokenRaw = token.raw as {
          id: string;
          name?: string;
          symbol: string;
          chain?: string;
          decimals?: number;
          summary?: {
            price_usd?: number;
            "24h"?: { volume?: number; volume_usd?: number };
            liquidity_usd?: number;
          };
        };

        return mapTokenToMarketSnapshot(
          {
            id: tokenRaw.id,
            name: tokenRaw.name ?? tokenRaw.symbol,
            symbol: tokenRaw.symbol,
            chain: tokenRaw.chain ?? "solana",
            decimals: tokenRaw.decimals ?? 9,
            summary: tokenRaw.summary,
          } satisfies DexPaprikaTokenResponse,
          traceId,
          timestamp,
          token.rawPayloadHash
        );
      },
    },
  ];
}

export function createCanonicalPaperWalletSnapshotFetcher(params: {
  moralis: {
    getBalancesWithHash: (walletAddress: string) => Promise<{
      raw: unknown;
      rawPayloadHash: string;
    }>;
  };
  walletAddress: string;
}): () => Promise<WalletSnapshot> {
  return async () => {
    const timestamp = new Date().toISOString();
    const traceId = `paper-${PRIMARY_WALLET_PROVIDER_ID}-${timestamp}`;
    const wallet = await params.moralis.getBalancesWithHash(params.walletAddress);

    return mapMoralisToWalletSnapshot(
      wallet.raw as {
        result?: MoralisTokenBalance[];
      },
      params.walletAddress,
      traceId,
      timestamp,
      wallet.rawPayloadHash
    );
  };
}
