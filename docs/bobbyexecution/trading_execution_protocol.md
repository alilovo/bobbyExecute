# Trading Execution Protocol

This protocol defines the minimum safe execution path for BobbyExecution.

## Execution readiness gate

Live execution is only eligible if all are true:

- `LIVE_TRADING=true`
- `RPC_MODE=real`
- real quote service exists
- real swap execution exists
- route validation exists
- simulation or preflight check exists
- slippage enforcement exists
- persistent action / decision log exists
- bot-side kill switch exists
- dashboard can reflect execution and failure state

If any condition fails, execution must remain `dryRun`.

## Required execution flow

1. build `TradeIntent`
2. validate policy rules
3. validate risk limits
4. validate chaos / manipulation status
5. fetch live quote
6. validate route
7. enforce max slippage
8. simulate or preflight
9. execute live swap
10. confirm transaction through real RPC
11. reconcile expected vs actual result
12. persist journal and action log
13. project result to dashboard / KPI endpoint

## Required controls

### Quote and route
- quote must have freshness threshold
- route must match supported venue and token pair
- quote failure blocks live execution

### Slippage
- slippage must be enforced at execution time, not only declared in intent
- max slippage breach blocks execution

### Confirmation
- transaction must be confirmed through real RPC
- missing confirmation triggers degraded / failed state, never silent success

### Reconciliation
- compare intended amount, quoted amount, and observed result
- journal any deviation above threshold

## Prohibited behavior

- no `success: true` default for paper or live paths without explicit result evaluation
- no live swap path that throws “not implemented”
- no live execution when verification uses fake balances or fake receipts

## Required artifacts

- `ExecutionReport`
- `RpcVerificationReport`
- `JournalEntry`
- `ActionLogEntry`
- `KpiDecisionProjection`

---

## Authority / Related Docs

- Canonical governance (execution authority): [`governance/SoT.md §8–§11`](../../governance/SoT.md)
- Risk and chaos governance: [`risk_and_chaos_governance.md`](risk_and_chaos_governance.md)
- Production readiness checklist: [`production_readiness_checklist.md`](production_readiness_checklist.md)
- Domain index: [`docs/bobbyexecution/README.md`](README.md)
