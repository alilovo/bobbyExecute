# Production Readiness Checklist

Use this before any controlled live-test or any rollout beyond paper mode.

## Implemented In Current Code

- [x] Deterministic ingest -> signal -> risk -> execute -> verify -> journal -> monitor pipeline
- [x] Persistent action log, journal, runtime cycle summaries, incidents, and execution evidence
- [x] Runtime truth surfaces: `/health`, `/runtime/status`, `/runtime/cycles`, `/incidents`, `/kpi/*`
- [x] Live-control round state with arm, disarm, halt, reset, and emergency stop
- [x] Adapter circuit breaker, freshness checks, and fail-closed config validation
- [x] Real quote and live swap path guarded by RPC verification and live prerequisites

## Verify Before Controlled Live-Test

- [ ] `cd bot && npm run premerge`
- [ ] `cd bot && npm run build`
- [ ] `cd bot && npm run live:preflight`
- [ ] `LIVE_TRADING=true`
- [ ] `DRY_RUN=false`
- [ ] `RPC_MODE=real`
- [ ] `TRADING_ENABLED=true`
- [ ] `LIVE_TEST_MODE=true`
- [ ] `WALLET_ADDRESS` is set
- [ ] `CONTROL_TOKEN` and `OPERATOR_READ_TOKEN` are set and distinct
- [ ] `JOURNAL_PATH` points to persistent storage
- [ ] `GET /health`, `/runtime/status`, `/kpi/summary`, `/kpi/decisions`, `/kpi/adapters`, and `/kpi/metrics` are healthy
- [ ] `POST /emergency-stop` and `POST /control/reset` behave as documented
- [ ] the dashboard reflects the same runtime truth as the bot
- [ ] dry or paper rehearsal has been reviewed in the journal and replay endpoints

## No-Go Conditions

- live config validation fails
- any live prerequisite is missing
- control tokens are absent or identical
- runtime status is `error` or adapter health is degraded for live
- quote or verification handling falls back silently
- kill switch is active and not reset
- uncontrolled live trading is being attempted

Controlled live-test only. Uncontrolled live trading remains out of scope.
