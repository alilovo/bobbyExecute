# BobbyExecution Bot

Active TypeScript runtime for the repository.

## Current Behavior

- Ingest -> Signal -> Risk -> Execute -> Verify -> Journal -> Monitor
- Deterministic scoring, pattern recognition, and fail-closed control
- Persistent action logs, journal entries, cycle summaries, incidents, and execution evidence
- Guarded live-test round control with runtime truth surfaces for the dashboard

## Commands

Run from `bot/`:

```bash
npm install
npm run lint
npm test
npm run test:golden
npm run test:chaos
npm run test:integration
npm run test:e2e
npm run test:config
npm run build
npm run premerge
npm run start:server
npm run live:preflight
npm run live:test
```

## Config and Authority

- Config is loaded from environment variables through `src/config/config-schema.ts`.
- `RUNTIME_POLICY_AUTHORITY=ts-env` is the only runtime-authoritative mode.
- `src/config/agents.yaml`, `src/config/guardrails.yaml`, and `src/config/permissions.yaml` are reference policy files, not runtime authority.
- Safe local defaults remain:

  ```bash
  LIVE_TRADING=false
  DRY_RUN=true
  RPC_MODE=stub
  TRADING_ENABLED=false
  ```

- `PORT` defaults to `3333` and `HOST` defaults to `0.0.0.0`.
- Controlled live-test mode additionally requires `LIVE_TRADING=true`, `DRY_RUN=false`, `RPC_MODE=real`, `TRADING_ENABLED=true`, `LIVE_TEST_MODE=true`, `WALLET_ADDRESS`, `CONTROL_TOKEN`, and `OPERATOR_READ_TOKEN`.

## Runtime Surfaces

- `GET /health`
- `GET /kpi/summary`
- `GET /kpi/decisions`
- `GET /kpi/adapters`
- `GET /kpi/metrics`
- `GET /runtime/status`
- `GET /runtime/cycles`
- `GET /runtime/cycles/:traceId/replay`
- `GET /incidents`
- `POST /emergency-stop`
- `POST /control/pause`
- `POST /control/resume`
- `POST /control/halt`
- `POST /control/reset`
- `POST /control/live/arm`
- `POST /control/live/disarm`

## Operational Notes

- `/kpi/*` and `/runtime/*` expose bot truth for the dashboard and operators.
- `POST /emergency-stop` halts the runtime and persists the incident trail.
- `POST /control/reset` clears the kill switch and returns the round to a safe preflighted state.
- If the control token or operator read token is missing, the protected routes fail closed.

## Related Docs

- [`../README.md`](../README.md)
- [`../docs/bobbyexecution/README.md`](../docs/bobbyexecution/README.md)
- [`../RENDER_DEPLOYMENT.md`](../RENDER_DEPLOYMENT.md)
