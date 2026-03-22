# Onchain Trading Bot

Production-grade Onchain Trading Bot Architecture transplanting patterns from [OrchestrAI_Labs](https://github.com/baum777/OrchestrAI_Labs).

## Current State

- `bot/` is the active TypeScript runtime for local development, tests, and guarded live-test startup.
- Dry and paper modes are the normal local paths.
- Live-test startup is fail-closed, bounded, and operator-visible.
- Uncontrolled live trading is not claimed by this repository.

## Stack

- **TypeScript** (Node 22+)
- **Zod** for schemas
- **Pino** for JSON logging
- **Vitest** for tests

## Adapters

- **DexPaprika** – DEX pricing, pools, liquidity
- **Moralis** – wallet portfolio, token balances
- **RPC Verify** – truth layer (token/balance/receipt checks)

## Architecture

```
Ingest → Research → Signal → Risk → Execute → Verify → Journal → Monitor
```

### Tool Layering (Hard Rule)

All actions route through `ToolRouter`:
- `market.dexPaprika.*` → market.read / market.trending
- `wallet.moralis.*` → wallet.read
- `chain.rpcVerify.*` → chain.verify
- `trade.dex.*` → trade.quote / trade.execute

### Governance (Fail-Closed)

- Permission enforcement
- Review gates with commit tokens
- Circuit breaker for adapters
- Guardrails (slippage, allowlist/denylist)

### Determinism

- Clock abstraction (`FakeClock` for tests)
- Canonicalization + SHA-256 hashing
- Golden task fixtures for replay

## Commands

```bash
npm install
npm run build
npm test
npm run test:golden
npm run premerge
npm run live:preflight
npm run live:test
```

Live-test starts are fail-closed and operator-visible. Check `/health`, `/kpi/summary`, and `/runtime/status` for round state, then use `POST /emergency-stop` or `POST /control/reset` if needed.

## Config

- `src/config/guardrails.yaml` – risk limits, allowlist/denylist
- `src/config/permissions.yaml` – tool–permission mapping
- `src/config/agents.yaml` – agent profiles

## Local User Setup

1. Copy [`.env.example`](../.env.example) to `.env` in the repo root.
2. Keep the local-safe defaults unless you are intentionally testing something else:
   - `LIVE_TRADING=false`
   - `DRY_RUN=true`
   - `RPC_MODE=stub`
   - `TRADING_ENABLED=false`
3. Install dependencies from `bot/`:

   ```bash
   cd bot
   npm install
   ```

4. Run the offline gate:

   ```bash
   npm run premerge
   ```

5. Start the bot API:

   ```bash
   npm run start:server
   ```

6. Optional: run the dashboard from `dashboard/` if you want a visual surface:

   ```bash
   cd dashboard
   npm install
   npm run dev
   ```

   Put `NEXT_PUBLIC_API_URL=http://localhost:3333` and `NEXT_PUBLIC_USE_MOCK=false` in `dashboard/.env.local` to read the local bot API.

7. If you need the control routes locally, set `CONTROL_TOKEN` and `OPERATOR_READ_TOKEN` in the repo root `.env`. If they stay empty, mutating routes remain fail-closed.

## Operations

- [`docs/bobbyexecution/production_readiness_checklist.md`](docs/bobbyexecution/production_readiness_checklist.md) – operator readiness checklist before any live test
- [`docs/bobbyexecution/live_test_runbook.md`](docs/bobbyexecution/live_test_runbook.md) – limited-capital live test procedure
- [`docs/operations/action-handbook.md`](docs/operations/action-handbook.md) – reusable operator action flow
