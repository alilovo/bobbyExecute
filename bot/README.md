# BobbyExecution Bot

Active TypeScript runtime for the repository.

## Current Behavior

- Ingest -> Signal -> Risk -> Execute -> Verify -> Journal -> Monitor
- Deterministic scoring, pattern recognition, and fail-closed control
- Persistent action logs, journal entries, cycle summaries, incidents, and execution evidence
- Guarded live-test round control with runtime truth surfaces for the dashboard
- Runtime behavior is now controlled through persisted runtime config plus operator control endpoints.

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

- Environment variables remain boot-only: secrets, database/KV URLs, service wiring, host/port, and hard defaults.
- Runtime behavior moves through `GET/POST /control/runtime-config`, `GET /control/runtime-status`, and related control routes.
- `RUNTIME_POLICY_AUTHORITY=ts-env` is still the current boot-time authority gate.
- `src/config/agents.yaml`, `src/config/guardrails.yaml`, and `src/config/permissions.yaml` are reference policy files, not runtime authority.
- Safe local defaults remain:

  ```bash
  LIVE_TRADING=false
  DRY_RUN=true
  RPC_MODE=stub
  TRADING_ENABLED=false
  ```

- `PORT` defaults to `3333` and `HOST` defaults to `0.0.0.0`.
- Controlled live-test mode still requires the boot prerequisites above, but operator mutations now happen through the control API instead of env edits.

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
- `GET /control/runtime-config`
- `GET /control/runtime-status`
- Public bot service is read-only for mutations.
- Private control service mutation surfaces:
  - `POST /emergency-stop`
  - `POST /control/pause`
  - `POST /control/resume`
  - `POST /control/halt`
  - `POST /control/reset`
  - `POST /control/live/arm`
  - `POST /control/live/disarm`
  - `POST /control/mode`
  - `POST /control/kill-switch`
  - `POST /control/runtime-config`
  - `POST /control/reload`
- `GET /control/history`

## Operational Notes

- `/kpi/*` and `/runtime/*` expose bot truth for the dashboard and operators.
- `POST /emergency-stop` halts the runtime and persists the incident trail.
- `POST /control/reset` clears the kill switch and returns the round to a safe preflighted state.
- `/control/runtime-config` is the first-class runtime behavior control surface for mode, pause, kill switch, filters, thresholds, and reload state on the private control service.
- If the control token or operator read token is missing, the protected routes fail closed.

## Related Docs

- [`../README.md`](../README.md)
- [`../docs/bobbyexecution/README.md`](../docs/bobbyexecution/README.md)
- [`../RENDER_DEPLOYMENT.md`](../RENDER_DEPLOYMENT.md)
