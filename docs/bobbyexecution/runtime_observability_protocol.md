# Runtime Observability Protocol

This protocol defines the minimum runtime visibility required for BobbyExecution and the dashboard.

## Required telemetry layers

### 1. Action and decision logs
Persist:
- trade intents
- gate outcomes
- execution attempts
- verification results
- blocked reasons
- emergency stop actions

### 2. Metrics
Track:
- adapter latency
- retry count
- breaker state
- data quality
- chaos pass rate
- blocked trades
- successful confirmations
- failed confirmations

### 3. Correlation
Every major event must carry:
- `run_id`
- `trace_id`
- `intent_id`
- optional `tx_signature`

## Required dashboard-facing KPIs

- system health
- adapter health
- decision summary
- blocked reason summary
- chaos pass status
- latest execution attempts
- verification outcomes
- kill-switch status

## Bridge requirement

The dashboard must be able to consume **bot-generated runtime truth**, not only `dor-bot` local memory.

Minimum bridge outputs:

- `/health`
- `/kpi/summary`
- `/kpi/decisions`
- `/kpi/adapters`
- `/kpi/runtime-safety`

## Current audit gaps

- action log is in-memory only
- metrics are mostly in-memory
- adapter health is not written
- no unified run_id chain
- no native bot → dashboard bridge

## Alert triggers

Alert when:

- circuit breaker is open
- chaos critical scenario fails
- RPC verification fails
- data quality drops below threshold
- repeated execution errors exceed threshold
