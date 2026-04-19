## Cursor Cloud specific instructions

### Project overview

Governance-first Solana trading bot. Primary codebase is TypeScript in `bot/`. See `README.md` for architecture details.

### Key commands (all run from `bot/`)

| Task | Command |
|---|---|
| Install deps | `npm install` |
| Lint | `npm run lint` |
| Tests (all) | `npm test` |
| Golden tasks | `npm run test:golden` |
| Chaos gate | `npm run test:chaos` |
| **Pre-merge gate** | `npm run premerge` |
| Build | `npm run build` |

### Non-obvious notes

- **Node 22 required** — enforced by `engines` field and `.nvmrc`. The VM snapshot already has Node 22 installed.
- All tests run fully offline using deterministic stubs/fixtures — no external APIs, wallets, or Solana RPC needed.
- `snappyjs` and `@types/snappyjs` must be resolvable after install (memory compression). The setup script verifies this.
- `dor-bot/` is a Python legacy component — not required for the core test/lint/build pipeline.
- The `premerge` script (`npm run premerge`) is the canonical quality gate: lint → golden tasks → chaos gate. Always run it before committing.
## Model-Agnostic Workflow System Shared-Core Consumer
- If `.codex/shared-core-consumer.json` exists, read `docs/model-agnostic-workflow-system-consumer.md` and `docs/repo-specific-canonical-sources.md` first.
- If `.codex/repo-intake-inputs.json` exists, keep it aligned with the repo-intake skill before mapping the repo.
- If `.codex/runtime-policy-inputs.json` exists, keep it aligned with `runtime-policy-auditor` before auditing runtime policy.
- Use the standalone `model-agnostic-workflow-system` source only through the consumer manifest.
- Do not edit the standalone `model-agnostic-workflow-system` repository from this repository.
