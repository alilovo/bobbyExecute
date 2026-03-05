/**
 * M3: Adapter factory with Circuit Breaker integration.
 * Creates CircuitBreaker + HTTP adapters wired for fail-closed behavior.
 */
import { CircuitBreaker } from "../governance/circuit-breaker.js";
import { DexPaprikaClient } from "./dexpaprika/client.js";
import { MoralisClient } from "./moralis/client.js";
import { DexScreenerClient } from "./dexscreener/client.js";
import type { ResilientFetchOptions } from "./http-resilience.js";
import type { CircuitBreakerConfig } from "../governance/circuit-breaker.js";
import type { Clock } from "../core/clock.js";

export const ADAPTER_IDS = ["dexpaprika", "moralis", "dexscreener"] as const;

export interface AdaptersWithCbConfig {
  /** Circuit breaker config. Default: failureThreshold 5, recoveryTimeMs 60000 */
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
  /** Optional clock for tests */
  clock?: Clock;
  /** DexPaprika baseUrl etc. */
  dexpaprika?: { baseUrl?: string; network?: string };
  /** Moralis baseUrl, apiKey, chain */
  moralis?: { baseUrl?: string; apiKey?: string; chain?: string };
  /** DexScreener baseUrl */
  dexscreener?: { baseUrl?: string };
  /** Shared resilience options (timeout, maxRetries) - circuitBreaker is set automatically */
  resilience?: Omit<ResilientFetchOptions, "circuitBreaker" | "adapterId">;
}

export interface AdaptersWithCbResult {
  circuitBreaker: CircuitBreaker;
  dexpaprika: DexPaprikaClient;
  moralis: MoralisClient;
  dexscreener: DexScreenerClient;
}

/**
 * Creates CircuitBreaker and HTTP adapters with circuit breaker wired.
 * Consecutive failures open the breaker; requireHealthy blocks when open (fail-closed).
 */
export function createAdaptersWithCircuitBreaker(
  config: AdaptersWithCbConfig = {}
): AdaptersWithCbResult {
  const cb = new CircuitBreaker([...ADAPTER_IDS], config.circuitBreakerConfig, config.clock);

  const resilience = config.resilience ?? {};
  const dexpaprika = new DexPaprikaClient({
    ...config.dexpaprika,
    resilience: { ...resilience, circuitBreaker: cb, adapterId: "dexpaprika" },
  });
  const moralis = new MoralisClient({
    ...config.moralis,
    resilience: { ...resilience, circuitBreaker: cb, adapterId: "moralis" },
  });
  const dexscreener = new DexScreenerClient({
    ...config.dexscreener,
    resilience: { ...resilience, circuitBreaker: cb, adapterId: "dexscreener" },
  });

  return { circuitBreaker: cb, dexpaprika, moralis, dexscreener };
}
