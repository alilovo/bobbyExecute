# Render Deployment Guide

Use this guide for the current bot API on Render.

## What Runs on Render

- `bot/` is the active TypeScript service.
- Build command: `cd bot && npm install && npm run build`
- Start command: `cd bot && npm run start:server`
- Default listen address: `0.0.0.0:3333`

## Recommended Service Settings

- Service type: Web Service
- Runtime: Node
- Root directory: repository root
- Auto deploy: enabled on `main`
- Persistent disk: recommended for `JOURNAL_PATH` and the adjacent runtime state files

## Paper-Safe Production Environment

Recommended for a deployed dashboard/back-end pair that should expose real runtime truth without enabling swaps:

```bash
NODE_ENV=production
LIVE_TRADING=false
DRY_RUN=false
RPC_MODE=real
RPC_URL=<real solana rpc endpoint>
TRADING_ENABLED=false
RUNTIME_POLICY_AUTHORITY=ts-env
PORT=3333
HOST=0.0.0.0
JOURNAL_PATH=/var/data/journal.jsonl
```

Optional hardening:

```bash
MAX_SLIPPAGE_PERCENT=5
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_RECOVERY_MS=60000
REVIEW_POLICY_MODE=required
```

If you want a fully offline rehearsal, use:

```bash
LIVE_TRADING=false
DRY_RUN=true
RPC_MODE=stub
TRADING_ENABLED=false
```

## Controlled Live-Test Environment

Live-test mode is intentionally stricter:

```bash
NODE_ENV=production
LIVE_TRADING=true
DRY_RUN=false
RPC_MODE=real
RPC_URL=<real solana rpc endpoint>
TRADING_ENABLED=true
LIVE_TEST_MODE=true
WALLET_ADDRESS=<wallet address>
CONTROL_TOKEN=<control token>
OPERATOR_READ_TOKEN=<operator read token>
RUNTIME_POLICY_AUTHORITY=ts-env
PORT=3333
HOST=0.0.0.0
JOURNAL_PATH=/var/data/journal.jsonl
```

- `CONTROL_TOKEN` and `OPERATOR_READ_TOKEN` must be distinct.
- Startup fails closed if any live-test prerequisite is missing.
- Keep the journal and control state on persistent storage.

## Verification

After deploy, verify these surfaces:

- `GET /health`
- `GET /runtime/status`
- `GET /kpi/summary`
- `GET /kpi/decisions`
- `GET /kpi/adapters`
- `GET /kpi/metrics`
- `GET /runtime/cycles`
- `GET /runtime/cycles/:traceId/replay`
- `GET /incidents`

If the service is in live-test mode, also verify:

- `POST /emergency-stop`
- `POST /control/live/arm`
- `POST /control/live/disarm`
- `POST /control/reset`

## Deployment Loop

1. Set the environment variables.
2. Deploy the service.
3. Verify the health and KPI endpoints.
4. Confirm the runtime posture in `/runtime/status`.
5. Test the control path before any live-test arming.
