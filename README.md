# dotBot / BobbyExecute

Governance-first Solana trading bot with deterministic execution, append-only journaling, and guarded live-test control surfaces.

## Current State

- `bot/` is the active TypeScript runtime.
- Dry and paper are the normal local modes.
- Live-test support is guarded, bounded, and operator-visible.
- The repository does not claim uncontrolled live trading readiness.

## Canonical Docs

- [`governance/SoT.md`](governance/SoT.md)
- [`docs/bobbyexecution/README.md`](docs/bobbyexecution/README.md)
- [`bot/README.md`](bot/README.md)
- [`RENDER_DEPLOYMENT.md`](RENDER_DEPLOYMENT.md)
- [`docs/bobbyexecution/production_readiness_checklist.md`](docs/bobbyexecution/production_readiness_checklist.md)
- [`docs/bobbyexecution/live_test_runbook.md`](docs/bobbyexecution/live_test_runbook.md)
- [`docs/bobbyexecution/incident_and_killswitch_runbook.md`](docs/bobbyexecution/incident_and_killswitch_runbook.md)
- [`docs/bobbyexecution/trading_execution_protocol.md`](docs/bobbyexecution/trading_execution_protocol.md)
- [`docs/bobbyexecution/market_data_reliability_protocol.md`](docs/bobbyexecution/market_data_reliability_protocol.md)
- [`docs/bobbyexecution/risk_and_chaos_governance.md`](docs/bobbyexecution/risk_and_chaos_governance.md)
- [`docs/bobbyexecution/runtime_observability_protocol.md`](docs/bobbyexecution/runtime_observability_protocol.md)
- [`docs/architecture/master-trading-bot-intelligence-spec.md`](docs/architecture/master-trading-bot-intelligence-spec.md)
- [`docs/trading/trading-edge_chaos-scenarios.md`](docs/trading/trading-edge_chaos-scenarios.md)

## Fast Start

1. Copy [`.env.example`](.env.example) to `.env` in the repo root.
2. Keep the safe defaults for local work:

   ```bash
   LIVE_TRADING=false
   DRY_RUN=true
   RPC_MODE=stub
   TRADING_ENABLED=false
   ```

3. Install dependencies:

   ```bash
   cd bot
   npm install
   ```

4. Run the offline gate:

   ```bash
   npm run premerge
   ```

5. Build the runtime:

   ```bash
   npm run build
   ```

6. Start the API server:

   ```bash
   npm run start:server
   ```

7. Check `GET /health`, `GET /kpi/summary`, and `GET /runtime/status`.
8. Use `POST /emergency-stop` or `POST /control/reset` for control-path testing.

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

Control routes require `x-control-token` or `Authorization: Bearer <token>` for the control token. Operator read surfaces require the operator read token. Missing tokens fail closed with `403`.

## Repo Layout

```text
/
├─ governance/   canonical governance layer
├─ docs/         operational and architecture docs
├─ bot/          active TypeScript runtime
├─ ops/          team artifacts and internal process docs
├─ packages/     skill manifests and instructions
└─ dor-bot/      legacy Python reference tree
```
