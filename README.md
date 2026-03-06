# dotBot / BobbyExecute

Governance-first Solana trading bot with deterministic execution, memory hash-chains, and chaos gates.

---

## Engineering Navigation

| Purpose | Document |
|---|---|
| **Governance / Source of Truth** | [`governance/SoT.md`](governance/SoT.md) |
| **Agent / Cursor Rules** | [`governance/cursor_rule.md`](governance/cursor_rule.md) |
| **Repo Path Rules** | [`governance/file_path.md`](governance/file_path.md) |
| **BobbyExecution Navigation Index** | [`docs/bobbyexecution/README.md`](docs/bobbyexecution/README.md) |
| **Trading Chaos Reference** | [`docs/trading/trading-edge_chaos-scenarios.md`](docs/trading/trading-edge_chaos-scenarios.md) |

### Which document to read first

| Role | Start here |
|---|---|
| **Contributor** | `README.md` → [`governance/SoT.md`](governance/SoT.md) → [`docs/bobbyexecution/README.md`](docs/bobbyexecution/README.md) |
| **Auditor** | [`governance/SoT.md`](governance/SoT.md) → [`docs/bobbyexecution/production_readiness_audit_report.md`](docs/bobbyexecution/production_readiness_audit_report.md) |
| **Implementer** | [`governance/SoT.md`](governance/SoT.md) → [`docs/bobbyexecution/navigation_protocol.md`](docs/bobbyexecution/navigation_protocol.md) → [`docs/bobbyexecution/spec_generation_protocol.md`](docs/bobbyexecution/spec_generation_protocol.md) |
| **Incident responder** | [`docs/bobbyexecution/incident_and_killswitch_runbook.md`](docs/bobbyexecution/incident_and_killswitch_runbook.md) |

---

## How to use this docs layer

1. **Governance first.** [`governance/SoT.md`](governance/SoT.md) is the highest written authority. If any document contradicts it, the SoT wins.
2. **Operational guidance is in `docs/bobbyexecution/`.** These documents cover execution safety, market data reliability, chaos governance, observability, and incident response. They are subordinate to the SoT.
3. **Chaos scenario deep reference is in `docs/trading/`.** Use it for detailed manipulation pattern analysis. It does not override the SoT.
4. **The dashboard is a monitoring interface, not a decision authority.** Live trading requires real RPC verification and explicit safety gates — see [`governance/SoT.md §11`](governance/SoT.md).
5. **Chat context is ephemeral.** Repository artifacts are the truth.

---

## Repository Context

This repo bundles two runtimes:

- **`bot/`** — active TypeScript implementation (Core Runtime, Governance, Tests)
- **`dor-bot/`** — legacy Python reference components

---

## Architecture Overview

### Classic Runtime Pipeline (`Engine`)

```text
Ingest → Signal → Risk → Execute → Verify → Journal → Monitor
```

Goal: deterministic trade processing with fail-closed on risk / verify failures.

### Extended Intelligence / Execution Pipeline (`Orchestrator`)

```text
Research → Analyse (MCI/BCI/Hybrid) → Reasoning + Pattern
→ Compress DB (Snappy + SHA-256) → Chaos Gate (19 scenarios)
→ Memory Log (Hash-Chain) → Focused TX Execute
→ Loop via Action Handbook Lookup
```

Key guardrails:

- `DecisionResult.decision = allow|deny`
- TX only on `allow` + valid vault lease (TTL ≤ 1h)
- Fail-closed on DataQuality < 70%, chaos fail, or vault problems

---

## Core Components

- **Governance:** Review Gates, Policy Engine, Guardrails, Circuit Breaker
- **Determinism:** Canonicalize + SHA-256 for Decision / Result / Journal
- **Memory:** iterative renewal, Snappy compression, crash recovery
- **Chaos:** 19 scenarios in 5 categories (Category 5 = trading-edge critical)
- **Tests:** Golden Tasks GT-001 to GT-018 + Chaos Pre-Merge Gate

---

## Repository Structure

```text
/
├─ governance/              ← canonical governance layer
│  ├─ SoT.md                  highest written authority
│  ├─ cursor_rule.md           agent / cursor working rules
│  └─ file_path.md             repo path and file rules
│
├─ docs/
│  ├─ bobbyexecution/       ← BobbyExecution operational docs
│  │  ├─ README.md             domain navigation index
│  │  ├─ navigation_protocol.md
│  │  ├─ trading_execution_protocol.md
│  │  ├─ risk_and_chaos_governance.md
│  │  ├─ production_readiness_checklist.md
│  │  ├─ production_readiness_audit_report.md
│  │  ├─ incident_and_killswitch_runbook.md
│  │  └─ ...                   (full index in docs/bobbyexecution/README.md)
│  │
│  ├─ trading/              ← chaos scenario deep reference
│  │  └─ trading-edge_chaos-scenarios.md
│  │
│  ├─ architecture/         ← architecture blueprints
│  └─ operations/           ← operations guides
│
├─ bot/                     ← TypeScript production codebase
├─ ops/agent-team/          ← governance and team artifacts
├─ packages/skills/         ← skill manifests and instructions
└─ dor-bot/                 ← Python legacy
```

---

## Current Production Readiness

**Overall readiness: `4.2 / 10` — Not ready for live test.**

See [`docs/bobbyexecution/production_readiness_audit_report.md`](docs/bobbyexecution/production_readiness_audit_report.md) for the full audit and remediation plan.

---

## Development Commands (run from `bot/`)

```bash
npm install
npm run lint
npm test
npm run premerge
```

The `premerge` script is the canonical quality gate: lint → golden tasks → chaos gate.

---

## Cloud Agent Environment (Cursor)

The cloud environment is configured via:

- `.cursor/environment.json`
- `.cursor/setup.sh`
- `.nvmrc` (root + `bot/.nvmrc`)

Node **22** is required. After setup, run:

```bash
cd bot
npm run premerge
```

---

## License

See [`LICENSE`](LICENSE).
