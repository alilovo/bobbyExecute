# Market Data Reliability Protocol

This protocol covers market data, quote data, and adapter truth used by the current runtime.

## Current Controls

- Adapter timeouts and resilience helpers are in place.
- Transient failures use bounded retries and circuit-breaker protection where configured.
- Fallback cache support exists for short-lived outages.
- Freshness is tracked on signal and quote inputs.
- Invalid payloads are rejected before they reach scoring or execution.
- Adapter health is exported to the KPI and runtime surfaces.

## Current Gates

- `SignalPack.dataQuality.completeness < 0.7` blocks the run.
- Freshness below the runtime threshold degrades confidence or blocks live execution.
- `crossSourceConfidence` targets `0.85` and is derived when not explicitly provided.
- Live quotes older than 15 seconds are rejected by the live swap path.
- Any malformed or partial payload must fail closed rather than flow into scoring unmarked.

## Current Sources

- DexPaprika
- Moralis
- DexScreener when configured
- RPC verification for truth checks

## Minimum Telemetry

- adapter name
- request start and end time
- retry count
- breaker state
- cache hit or miss
- freshness age
- validation outcome

## Decision Impact

- Stale or invalid data may reduce confidence or block execution.
- Missing primary source with a valid fallback may continue in degraded paper or analysis mode.
- Missing reliable market truth blocks live execution.
