# Staging Live-Preflight Remaining Blockers (2026-04-05)

## Remaining Missing Inputs

- `LIVE_TRADING=true`
- `TRADING_ENABLED=true`
- `LIVE_TEST_MODE=true`
- `RPC_MODE=real`
- `RUNTIME_POLICY_AUTHORITY=ts-env`
- `WALLET_ADDRESS`
- `SIGNER_MODE=remote`
- `SIGNER_URL`
- `SIGNER_AUTH_TOKEN`
- `CONTROL_TOKEN`
- `OPERATOR_READ_TOKEN`
- `MORALIS_API_KEY`
- `JUPITER_API_KEY`
- `RPC_URL`

## Current Boot-State Status

- Command: `npm --prefix bot run recovery:worker-state`
- Result: `status=ready`, `safeBoot=true`
- `bootCriticalMissing=[]`
- `bootCriticalInvalid=[]`

## Exact Next Operator Command Order

1. Export required staging env vars and secrets (`LIVE_TRADING`, `TRADING_ENABLED`, `LIVE_TEST_MODE`, `RPC_MODE`, `RUNTIME_POLICY_AUTHORITY`, `WALLET_ADDRESS`, `SIGNER_MODE`, `SIGNER_URL`, `SIGNER_AUTH_TOKEN`, `CONTROL_TOKEN`, `OPERATOR_READ_TOKEN`, `MORALIS_API_KEY`, `JUPITER_API_KEY`, `RPC_URL`).
2. Run `npm --prefix bot run recovery:worker-state`.
3. If `safeBoot=true`, run `npm --prefix bot run live:preflight`.
4. Record stdout/stderr/exit code and gate decision in `docs/06_journal_replay/staging-live-preflight-evidence-template.md`.
