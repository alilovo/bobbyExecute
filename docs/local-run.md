# Local Run

This repository can run locally without Render when you keep the local safe-boot path fail-closed:

- bot/control/runtime code reads `process.env` directly; there is no dotenv auto-loader for the `bot/` processes.
- `dashboard/.env.local` is auto-loaded by Next and is the authoritative dashboard file for local development.
- when `DATABASE_URL` and `REDIS_URL` are unset, runtime config state is in-memory, but runtime visibility falls back to a shared file-backed local path (`data/runtime-visibility.json` by default, or `RUNTIME_VISIBILITY_PATH` if set).
- the dashboard can talk to the local control service through `CONTROL_SERVICE_URL`.
- for local safe-boot / paper mode, `OPERATOR_READ_TOKEN` stays blank and the dashboard falls back to `CONTROL_TOKEN` for GET/HEAD control requests.
- the signer is optional for safe boot and required only for live-limited readiness.

## Canonical Local Modes

### Mode A. Local Safe Boot

Use this mode to bring up the real local services with no live execution:

- `LIVE_TRADING=false`
- `DRY_RUN=true`
- `TRADING_ENABLED=false`
- `LIVE_TEST_MODE=false`
- `RPC_MODE=stub`
- `SIGNER_MODE=disabled`
- `MORALIS_ENABLED=false`
- `NEXT_PUBLIC_USE_MOCK=false`
- `OPERATOR_READ_TOKEN=` (blank in paper-safe mode; the dashboard falls back to `CONTROL_TOKEN`)

The dashboard should point at the local bot API and local control service:

- `NEXT_PUBLIC_API_URL=http://127.0.0.1:3333`
- `CONTROL_SERVICE_URL=http://127.0.0.1:3334`
- `CONTROL_TOKEN=<shared-local-token>`
- `OPERATOR_READ_TOKEN=<distinct-local-read-token>`

Leave these unset for the safe-boot path:

- `DATABASE_URL`
- `REDIS_URL`
- `SIGNER_URL`
- `SIGNER_AUTH_TOKEN`
- `SIGNER_KEY_ID`
- `WALLET_ADDRESS`

### Mode B. Local Paper-Like Mode

This is the same local service graph, but with paper execution semantics instead of dry-run semantics:

- `LIVE_TRADING=false`
- `DRY_RUN=false`
- `TRADING_ENABLED=false`
- `LIVE_TEST_MODE=false`
- `SIGNER_MODE=disabled`
- `WALLET_ADDRESS=<local-paper-wallet-placeholder>`
- `CONTROL_TOKEN=<shared-local-token>`
- `OPERATOR_READ_TOKEN=` (blank in local paper mode)

Everything else stays local-safe. No real swaps are executed.
The worker is the actual runtime loop; the public server alone is only the read surface.
For a truthful three-process papertrade boot, keep `DATABASE_URL` and `REDIS_URL` unset in all three `bot/` shells, keep `OPERATOR_READ_TOKEN` blank in the paper-safe dashboard path, and set the same `RUNTIME_VISIBILITY_PATH` value in all three shells if you want to avoid cwd-relative ambiguity. When `DATABASE_URL` is unset, `start:control`, `start:worker`, and `start:server` still share runtime visibility through the file-backed local default at `data/runtime-visibility.json` or the explicit `RUNTIME_VISIBILITY_PATH`.

Truthful local papertrade means the following surfaces agree:

- `bot/src/server/routes/health.ts` sees the same worker visibility snapshot as the control plane.
- `bot/src/server/routes/control.ts` returns the same runtime visibility and runtime config status for the local environment.
- `dashboard/.env.local` points the dashboard at the same local API and control base URLs that the `bot/` processes are serving.
- the runtime visibility file changes after the worker loop runs and the timestamped snapshot is fresh, not recycled from a previous boot.

### Mode C. Local Live-Limited Readiness

Only use this once the control service, signer, RPC, wallet, and preflight prerequisites exist locally:

- `LIVE_TRADING=true`
- `DRY_RUN=false`
- `TRADING_ENABLED=true`
- `LIVE_TEST_MODE=true`
- `RPC_MODE=real`
- `RPC_URL=<real Solana RPC URL>`
- `SIGNER_MODE=remote`
- `SIGNER_URL=http://127.0.0.1:8787/sign`
- `SIGNER_AUTH_TOKEN=<shared-signer-token>`
- `SIGNER_WALLET_PRIVATE_KEY=<local signer secret>`
- `SIGNER_WALLET_ADDRESS=<matching-public-wallet>`
- `WALLET_ADDRESS=<matching-public-wallet>`
- `JUPITER_API_KEY=<required>`
- `CONTROL_TOKEN=<shared-control-token>`
- `OPERATOR_READ_TOKEN=<distinct-read-token>`
- `DISCOVERY_PROVIDER=dexscreener`
- `MARKET_DATA_PROVIDER=dexpaprika`
- `STREAMING_PROVIDER=dexpaprika`
- `MORALIS_ENABLED=false`
- `ROLLOUT_POSTURE=micro_live`

If any of the required live-limited prerequisites are missing, the bot fails closed and `npm run live:preflight` should report the blocker instead of arming live mode.

Live-limited refusal is expected when any of the following are true:

- `RPC_MODE` is not `real`
- `RPC_URL` is missing or blank
- `DRY_RUN=true`
- `LIVE_TRADING=false`
- `TRADING_ENABLED=false`
- `LIVE_TEST_MODE=false`
- `SIGNER_MODE` is not `remote`
- `SIGNER_URL` is missing
- `SIGNER_AUTH_TOKEN` is missing
- `WALLET_ADDRESS` is missing
- `CONTROL_TOKEN` is missing
- `OPERATOR_READ_TOKEN` is missing or matches `CONTROL_TOKEN`
- `JUPITER_API_KEY` is missing
- `MORALIS_ENABLED=true` without `MORALIS_API_KEY`
- `ROLLOUT_POSTURE` is `paper_only` or `paused_or_rolled_back`
- worker boot-critical state is incomplete or invalid

## Local Service Map

| Service | Purpose | Startup command | Required envs | Local host / port | Status |
| --- | --- | --- | --- | --- | --- |
| Control | Authenticated runtime/config control plane | `cd bot` then `npm run start:control` | `CONTROL_TOKEN`, `PORT=3334`, `HOST=127.0.0.1`, safe-boot envs above, same `RUNTIME_VISIBILITY_PATH` as the other bot shells if you set one | `127.0.0.1:3334` | Real local service |
| Worker | Runtime loop and heartbeat publisher | `cd bot` then `npm run start:worker` | `WALLET_ADDRESS`, `SIGNER_MODE=disabled`, safe-boot envs above, same `RUNTIME_VISIBILITY_PATH` as the other bot shells if you set one | n/a | Real local service |
| Bot/runtime | Public KPI / health / decision surface | `cd bot` then `npm run start:server` | `PORT=3333`, `HOST=127.0.0.1`, safe-boot envs above, same `RUNTIME_VISIBILITY_PATH` as the other bot shells if you set one | `127.0.0.1:3333` | Real local service |
| Dashboard | Operator UI and API proxy | `cd dashboard` then `npm run dev` for local development, or `npm run build && npm run start` for production-like local mode | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_USE_MOCK=false`, `CONTROL_SERVICE_URL`, `CONTROL_TOKEN`; `OPERATOR_READ_TOKEN` stays blank in paper-safe mode and is only used when you intentionally wire a distinct read token | `127.0.0.1:3000` | Real local service |
| Signer | Remote signing boundary | `cd signer` then `npm run start` | `SIGNER_AUTH_TOKEN`, `SIGNER_WALLET_PRIVATE_KEY`, `SIGNER_WALLET_ADDRESS`, `SIGNER_HOST=127.0.0.1`, `SIGNER_PORT=8787` | `127.0.0.1:8787` | Required for live-limited only |

## Start Order

1. Control service.
2. Worker runtime loop.
3. Bot/runtime public server.
4. Dashboard.
5. Health, control, and preflight checks.

## Env Authority

Use these files as follows:

- `dashboard/.env.local`: authoritative local dashboard env file. Next auto-loads it.
- `bot/` shell environment: authoritative for `npm run start:control`, `npm run start:worker`, and `npm run start:server`.
- `.env.example` and `.env.live-local.example`: reference templates only. They are not auto-loaded by the `bot/` processes.
- root `.env`: reference snapshot only unless you explicitly source it before launching commands.

If you choose a file-backed local visibility path, prefer an absolute `RUNTIME_VISIBILITY_PATH` and set it identically in all three `bot/` shells.

## Exact Commands

### One-time install

```powershell
cd bot
npm install
npm run build

cd ..\dashboard
npm install

cd ..\signer
npm install
```

### Safe boot

Build `bot` first, or the `start:*` commands will run stale or missing `dist/` output.

```powershell
cd bot
$env:NODE_ENV = "development"
$env:RUNTIME_CONFIG_ENV = "development"
$env:HOST = "127.0.0.1"
$env:PORT = "3334"
$env:CONTROL_TOKEN = "local-control-token"
$env:LIVE_TRADING = "false"
$env:DRY_RUN = "true"
$env:TRADING_ENABLED = "false"
$env:LIVE_TEST_MODE = "false"
$env:SIGNER_MODE = "disabled"
$env:RPC_MODE = "stub"
$env:MORALIS_ENABLED = "false"
$env:RUNTIME_VISIBILITY_PATH = "C:\\workspace\\main_projects\\dotBot\\bobbyExecute\\bot\\data\\runtime-visibility.papertrade.json"
npm run start:control
```

```powershell
cd bot
$env:NODE_ENV = "development"
$env:RUNTIME_CONFIG_ENV = "development"
$env:HOST = "127.0.0.1"
$env:PORT = "3333"
$env:CONTROL_TOKEN = "local-control-token"
$env:OPERATOR_READ_TOKEN = "local-operator-read-token"
$env:LIVE_TRADING = "false"
$env:DRY_RUN = "true"
$env:TRADING_ENABLED = "false"
$env:LIVE_TEST_MODE = "false"
$env:SIGNER_MODE = "disabled"
$env:RPC_MODE = "stub"
$env:MORALIS_ENABLED = "false"
$env:RUNTIME_VISIBILITY_PATH = "C:\\workspace\\main_projects\\dotBot\\bobbyExecute\\bot\\data\\runtime-visibility.papertrade.json"
npm run start:server
```

```powershell
cd bot
$env:NODE_ENV = "development"
$env:RUNTIME_CONFIG_ENV = "development"
$env:LIVE_TRADING = "false"
$env:DRY_RUN = "false"
$env:TRADING_ENABLED = "false"
$env:LIVE_TEST_MODE = "false"
$env:SIGNER_MODE = "disabled"
$env:WALLET_ADDRESS = "11111111111111111111111111111111"
$env:RPC_MODE = "stub"
$env:MORALIS_ENABLED = "false"
$env:RUNTIME_VISIBILITY_PATH = "C:\\workspace\\main_projects\\dotBot\\bobbyExecute\\bot\\data\\runtime-visibility.papertrade.json"
npm run start:worker
```

```powershell
cd dashboard
$env:NEXT_PUBLIC_API_URL = "http://127.0.0.1:3333"
$env:NEXT_PUBLIC_USE_MOCK = "false"
$env:CONTROL_SERVICE_URL = "http://127.0.0.1:3334"
$env:CONTROL_TOKEN = "local-control-token"
npm run dev
```

### Paper-like mode

Use the same start order as safe boot, but set:

```powershell
$env:LIVE_TRADING = "false"
$env:DRY_RUN = "false"
$env:TRADING_ENABLED = "false"
$env:LIVE_TEST_MODE = "false"
$env:SIGNER_MODE = "disabled"
$env:WALLET_ADDRESS = "11111111111111111111111111111111"
```

### Local live-limited readiness

Start the services in the standard local order, with the signer inserted after control:

1. Copy [`.env.live-local.example`](../.env.live-local.example) to a local env file and fill in the required secrets and RPC URL.
2. Use the same live-local values for control, bot, dashboard, and signer, but override `PORT` / `HOST` per service at launch.

```powershell
cd bot
$env:NODE_ENV = "production"
$env:RUNTIME_CONFIG_ENV = "local-live"
$env:HOST = "127.0.0.1"
$env:PORT = "3334"
$env:CONTROL_TOKEN = "local-control-token"
$env:LIVE_TRADING = "true"
$env:DRY_RUN = "false"
$env:TRADING_ENABLED = "true"
$env:LIVE_TEST_MODE = "true"
$env:RPC_MODE = "real"
$env:RPC_URL = "<real-solana-rpc-url>"
$env:SIGNER_MODE = "remote"
$env:SIGNER_URL = "http://127.0.0.1:8787/sign"
$env:SIGNER_AUTH_TOKEN = "local-signer-token"
$env:SIGNER_KEY_ID = "local-key-1"
$env:WALLET_ADDRESS = "<matching-public-wallet>"
$env:JUPITER_API_KEY = "<required>"
$env:DISCOVERY_PROVIDER = "dexscreener"
$env:MARKET_DATA_PROVIDER = "dexpaprika"
$env:STREAMING_PROVIDER = "dexpaprika"
$env:MORALIS_ENABLED = "false"
$env:OPERATOR_READ_TOKEN = "local-operator-read-token"
$env:ROLLOUT_POSTURE = "micro_live"
npm run start:control
```

```powershell
cd signer
$env:SIGNER_AUTH_TOKEN = "local-signer-token"
$env:SIGNER_WALLET_PRIVATE_KEY = "<matching-secret-key>"
$env:SIGNER_WALLET_ADDRESS = "<matching-public-wallet>"
$env:SIGNER_PORT = "8787"
$env:SIGNER_HOST = "127.0.0.1"
npm run start
```

```powershell
cd bot
$env:NODE_ENV = "production"
$env:RUNTIME_CONFIG_ENV = "local-live"
$env:HOST = "127.0.0.1"
$env:PORT = "3333"
$env:LIVE_TRADING = "true"
$env:DRY_RUN = "false"
$env:TRADING_ENABLED = "true"
$env:LIVE_TEST_MODE = "true"
$env:RPC_MODE = "real"
$env:RPC_URL = "<real-solana-rpc-url>"
$env:SIGNER_MODE = "remote"
$env:SIGNER_URL = "http://127.0.0.1:8787/sign"
$env:SIGNER_AUTH_TOKEN = "local-signer-token"
$env:SIGNER_KEY_ID = "local-key-1"
$env:WALLET_ADDRESS = "<matching-public-wallet>"
$env:JUPITER_API_KEY = "<required>"
$env:DISCOVERY_PROVIDER = "dexscreener"
$env:MARKET_DATA_PROVIDER = "dexpaprika"
$env:STREAMING_PROVIDER = "dexpaprika"
$env:MORALIS_ENABLED = "false"
$env:OPERATOR_READ_TOKEN = "local-operator-read-token"
$env:ROLLOUT_POSTURE = "micro_live"
npm run start:server
```

```powershell
cd dashboard
$env:NEXT_PUBLIC_API_URL = "http://127.0.0.1:3333"
$env:NEXT_PUBLIC_USE_MOCK = "false"
$env:CONTROL_SERVICE_URL = "http://127.0.0.1:3334"
$env:CONTROL_TOKEN = "local-control-token"
$env:OPERATOR_READ_TOKEN = "local-operator-read-token"
npm run build
npm run start
```

Then verify live readiness:

```powershell
cd bot
npm run live:preflight
```

Expected success signals:

- `loadConfig()` accepts the live env set without throwing.
- `npm run live:preflight` exits cleanly.
- the preflight report shows `executionMode: "live"`, `rpcMode: "real"`, `liveTestEnabled: true`, `rolloutPosture: "micro_live"`, `preflightGate: "micro_live"`, and `blockers: []`.
- the persisted preflight evidence file is marked `ready`.

If the real RPC or live secrets are still missing, the preflight must refuse and write blocked evidence instead.

Expected refusal signals:

- missing or blank `RPC_URL`
- missing signer credentials or wallet material
- missing `JUPITER_API_KEY`
- missing `CONTROL_TOKEN` or `OPERATOR_READ_TOKEN`
- `CONTROL_TOKEN` and `OPERATOR_READ_TOKEN` being identical
- `DRY_RUN=true` while `LIVE_TRADING=true`
- `ROLLOUT_POSTURE=paper_only` or `ROLLOUT_POSTURE=paused_or_rolled_back`
- worker boot-critical artifacts missing or invalid

## Quick Checks

```powershell
Invoke-WebRequest http://127.0.0.1:3333/health | Select-Object -ExpandProperty Content
Invoke-WebRequest -Headers @{ Authorization = "Bearer local-control-token" } http://127.0.0.1:3334/control/status | Select-Object -ExpandProperty Content
Invoke-WebRequest -Headers @{ Authorization = "Bearer local-control-token" } http://127.0.0.1:3334/control/runtime-config | Select-Object -ExpandProperty Content
Invoke-WebRequest http://127.0.0.1:3000/api/auth/session | Select-Object -ExpandProperty Content
```

Open the dashboard at `http://127.0.0.1:3000/overview` after the dashboard server starts.

Truthful local papertrade symptoms:

- `GET /health` shows a worker snapshot, but `GET /control/status` shows a different runtime environment or a missing worker.
- `GET /control/runtime-config` reports a different `runtimeConfig.environment` than the server health response.
- the `runtime-visibility.papertrade.json` file does not update after worker startup.
- the dashboard points at a different `NEXT_PUBLIC_API_URL` or `CONTROL_SERVICE_URL` than the local bot ports.
- `NEXT_PUBLIC_USE_MOCK=true` is set anywhere in the local dashboard path.
