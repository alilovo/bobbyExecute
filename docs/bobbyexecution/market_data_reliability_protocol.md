# Market Data Reliability Protocol

This protocol defines the minimum reliability bar for all market-data-dependent decisions.

## Required controls

### Timeouts
- every adapter request must have a hard timeout

### Retries
- retry on transient network failures
- retry on 429 and 5xx with bounded backoff
- do not retry invalid 4xx requests unless explicitly safe

### Fallbacks
- support secondary endpoints or providers where possible
- support short-lived cache fallback for transient outages

### Freshness
- every market payload must carry or derive freshness
- stale payloads must be rejected or heavily degraded

### Validation
- parse and validate contracts before use
- invalid payloads must not flow into scoring unmarked

### Health reporting
- adapter success / failure must update a health state
- circuit breaker state must be exportable to KPI endpoints

## BobbyExecution-specific current gaps

The current audit identified these required fixes:

- add retry on 5xx
- add fallback cache
- add explicit freshness checks
- add secondary endpoint / provider logic
- expose adapter health to dashboard consumers

## Decision impact rules

- stale or invalid data may reduce confidence or block execution
- missing primary source with valid fallback may allow degraded scoring
- missing reliable market truth blocks live execution

## Minimum log fields

- adapter name
- request start / end time
- outcome
- retry count
- breaker state
- freshness age
- cache hit / miss

---

## Authority / Related Docs

- Canonical governance (market data / adapters): [`governance/SoT.md §6–§7`](../../governance/SoT.md)
- Trading execution protocol: [`trading_execution_protocol.md`](trading_execution_protocol.md)
- Production readiness checklist: [`production_readiness_checklist.md`](production_readiness_checklist.md)
- Archive: [`archive/README.md`](../../archive/README.md)
- Domain index: [`docs/bobbyexecution/README.md`](README.md)
