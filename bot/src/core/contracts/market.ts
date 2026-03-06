/**
 * Market data contracts - normalized from DexPaprika.
 * PROPOSED for onchain trading bot.
 */
import { z } from "zod";

export const MarketSnapshotSchema = z.object({
  traceId: z.string(),
  timestamp: z.string().datetime(),
  source: z.enum(["dexpaprika", "dexscreener"]),
  decisionHash: z.string().optional(),
  resultHash: z.string().optional(),
  poolId: z.string(),
  baseToken: z.string(),
  quoteToken: z.string(),
  priceUsd: z.number().positive(),
  volume24h: z.number().nonnegative(),
  liquidity: z.number().nonnegative(),
  rawPayloadHash: z.string().optional(),
  /** Age of data in ms at mapping time. 0 = just fetched. */
  freshnessMs: z.number().nonnegative().optional(),
});

export type MarketSnapshot = z.infer<typeof MarketSnapshotSchema>;
