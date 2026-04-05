# Staging Live-Preflight Evidence Record (Blocked)

Scope: operator evidence snapshot captured from the current shell on 2026-04-05.  
Authority: rehearsal evidence only; no live authorization.

## Run Metadata

- Date (UTC): `2026-04-05`
- Operator: `codex-agent`
- Environment: `local-shell`
- Commit SHA: `not-captured-in-this-run`

## Governance Source

- Active governance source: `meta_prompt_control_plane_bundle.zip`
- Control-plane order applied:
  1. `shared_prompt_contract_v2`
  2. `meta_prompt_control_plane_v2`
  3. `prompt_type_router_v2`
  4. `boundary_authority_validator_v1` (sensitive cases only)
  5. selected family: `prompt_migration_v2`
  6. `release_checklist.md`

## Environment Readiness

- Env readiness status: `blocked`
- Signer reachability: `not-tested` (missing `SIGNER_URL`)
- RPC reachability: `not-tested` (missing `RPC_URL`)
- Token distinctness (`CONTROL_TOKEN != OPERATOR_READ_TOKEN`): `not-tested` (both missing)
- `JOURNAL_PATH`: `data/journal.jsonl` (effective default)

## Boot-Critical Artifact Check

Derived `basePath`: `data/journal`

| Artifact | Required path | Present | Non-empty | Parse/status notes |
|---|---|---|---|---|
| kill switch state | `data/journal.kill-switch.json` | `yes` | `yes` | valid |
| live control state | `data/journal.live-control.json` | `yes` | `yes` | valid |
| daily loss state | `data/journal.daily-loss.json` | `yes` | `yes` | valid |
| idempotency cache | `data/journal.idempotency.json` | `yes` | `yes` | valid |

## `recovery:worker-state` Evidence

- Command: `npm --prefix bot run recovery:worker-state`
- Exit code: `0`
- Status: `ready`
- `safeBoot`: `true`
- `bootCriticalMissing`: `[]`
- `bootCriticalInvalid`: `[]`
- Captured output path: terminal output in this run

## `live:preflight` Evidence

- Command: `npm --prefix bot run live:preflight`
- Exit code: `not-run`
- Result: `blocked`
- Key output lines:
  - `not executed because required live env vars/secrets/services are unavailable in current shell`
  - `no environment-backed staging proof captured in this run`
- Captured output path: `n/a`

## Remaining Missing Inputs

- `LIVE_TRADING`
- `TRADING_ENABLED`
- `LIVE_TEST_MODE`
- `RPC_MODE`
- `RUNTIME_POLICY_AUTHORITY`
- `WALLET_ADDRESS`
- `SIGNER_MODE`
- `SIGNER_URL`
- `SIGNER_AUTH_TOKEN`
- `CONTROL_TOKEN`
- `OPERATOR_READ_TOKEN`
- `MORALIS_API_KEY`
- `JUPITER_API_KEY`
- `RPC_URL`

## Next Command Order

1. Export required live env and secrets in staging shell:
   - `RUNTIME_POLICY_AUTHORITY=ts-env`
   - `LIVE_TRADING=true`
   - `TRADING_ENABLED=true`
   - `LIVE_TEST_MODE=true`
   - `RPC_MODE=real`
   - `WALLET_ADDRESS=...`
   - `SIGNER_MODE=remote`
   - `SIGNER_URL=...`
   - `SIGNER_AUTH_TOKEN=...`
   - `CONTROL_TOKEN=...`
   - `OPERATOR_READ_TOKEN=...`
   - `MORALIS_API_KEY=...`
   - `JUPITER_API_KEY=...`
   - `RPC_URL=...`
   - `JOURNAL_PATH=data/journal.jsonl` (or staging mount path)
2. Run `npm --prefix bot run recovery:worker-state`.
3. If `safeBoot=true`, run `npm --prefix bot run live:preflight`.
4. Record stdout/stderr, exit codes, and gate decision in `docs/06_journal_replay/staging-live-preflight-evidence-template.md`.

## Gate Decision

- Pass/Fail decision: `hold`
- Decision reason: `live preflight prerequisites are missing in current shell`
- Follow-up action: `operator supplies required staging env/services and reruns command order above`
- Approval scope note: `This record is blocked-execution preparation evidence; it is not environment-backed live proof.`
