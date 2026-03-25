# Trading Execution Protocol

This protocol defines the minimum safe execution path for BobbyExecution.

## Execution Readiness Gate

Live execution is only eligible if all of these are true:

- `LIVE_TRADING=true`
- `RPC_MODE=real`
- `TRADING_ENABLED=true`
- `LIVE_TEST_MODE=true`
- real quote service is available
- real swap execution is available
- route validation passes
- slippage enforcement passes
- persistent action and decision logs exist
- bot-side kill switch exists
- dashboard can reflect execution and failure state

If any condition fails, execution must remain dry, paper, or blocked as appropriate.

## Required Execution Flow

1. build `TradeIntent`
2. validate policy rules
3. validate risk limits
4. validate chaos and manipulation status
5. fetch a live quote
6. validate the route and freshness
7. enforce max slippage
8. simulate or preflight when required
9. execute the swap path
10. confirm the transaction through real RPC
11. reconcile intended, quoted, and observed result
12. persist journal and action log entries
13. project result to the KPI and runtime endpoints

## Current Live Semantics

- `TradeIntent.executionMode` supports `dry`, `paper`, and `live`.
- `dryRun=true` stays non-live.
- Live mode must fail closed if signing, send, or verification dependencies are missing.
- The live swap path rejects stale quotes and ambiguous confirmations.
- A successful live result must have concrete transaction evidence.

## Required Controls

### Quote and Route

- Quote freshness must be enforced at execution time.
- Route and token pair must match the supported venue.
- Quote failure blocks live execution.

### Slippage

- Slippage must be enforced at execution time, not only declared in intent.
- Max slippage breach blocks execution.

### Confirmation

- Transaction must be confirmed through real RPC.
- Missing confirmation triggers a degraded or failed state, never silent success.

### Reconciliation

- Compare intended amount, quoted amount, and observed result.
- Journal any deviation that matters to the operator or reviewer.

## Prohibited Behavior

- no live swap path that throws "not implemented"
- no silent success for paper or live paths without explicit result evaluation
- no live execution when verification uses fake balances or fake receipts
- no fallback from live into paper that is hidden from the operator

## Required Artifacts

- `ExecutionReport`
- `RpcVerificationReport`
- `JournalEntry`
- `ActionLogEntry`
- `KpiDecision`
