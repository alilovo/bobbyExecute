# BobbyExecution — Domain Navigation Index

> **Governance authority:** All rules in this directory are subordinate to [`governance/SoT.md`](../../governance/SoT.md).
> If any document here conflicts with the SoT, the SoT wins.

This index organises the BobbyExecution operational documentation bundle.
Use it to find the right document for any engineering, safety, audit, or incident task.

---

## Governance Dependencies

| Document | Location | Role |
|---|---|---|
| Source of Truth | [`governance/SoT.md`](../../governance/SoT.md) | Highest written authority |
| Agent / Cursor Rules | [`governance/cursor_rule.md`](../../governance/cursor_rule.md) | Agent working rules |
| Repo Path Rules | [`governance/file_path.md`](../../governance/file_path.md) | File and path conventions |
| Trading Chaos Reference | [`docs/trading/trading-edge_chaos-scenarios.md`](../trading/trading-edge_chaos-scenarios.md) | Deep chaos scenario reference |

---

## Current Operator Truth

Use these documents for the current operational state:

- [`production_readiness_checklist.md`](production_readiness_checklist.md)
- [`live_test_runbook.md`](live_test_runbook.md)
- [`incident_and_killswitch_runbook.md`](incident_and_killswitch_runbook.md)

Historical audit reports are kept in git history and no longer define the live operator path.

## Local Setup

If you are setting up the repo on your own machine for the first time:

1. Read [`../../governance/SoT.md`](../../governance/SoT.md) and this index.
2. Copy [`.env.example`](../../.env.example) to `.env` in the repo root.
3. Keep the safe defaults for local work: `LIVE_TRADING=false`, `DRY_RUN=true`, `RPC_MODE=stub`, `TRADING_ENABLED=false`.
4. Run `cd bot && npm install`.
5. Run `cd bot && npm run premerge`.
6. Start the bot API with `cd bot && npm run start:server`.
7. Optional: start the dashboard from `dashboard/` with a local `.env.local`.
8. Use `GET /health`, `GET /kpi/summary`, and `GET /runtime/status` to confirm the local runtime state.

---

## Start Here

| Use case | First document |
|---|---|
| Contributor onboarding | [`../../governance/SoT.md`](../../governance/SoT.md) → this index |
| Local setup | [`../../governance/SoT.md`](../../governance/SoT.md) → [`../../bot/CONFIG_GUIDE.md`](../../bot/CONFIG_GUIDE.md) |
| Auditor entry point | [`../../governance/SoT.md`](../../governance/SoT.md) → [`production_readiness_checklist.md`](production_readiness_checklist.md) → [`live_test_runbook.md`](live_test_runbook.md) |
| Incident / emergency | [`incident_and_killswitch_runbook.md`](incident_and_killswitch_runbook.md) |
| Pre-live-test checklist | [`production_readiness_checklist.md`](production_readiness_checklist.md) |

---

## Trading Safety & Runtime

- [`trading_execution_protocol.md`](trading_execution_protocol.md) — execution flow, gating rules, safety conditions
- [`market_data_reliability_protocol.md`](market_data_reliability_protocol.md) — adapter trust, freshness, consensus
- [`risk_and_chaos_governance.md`](risk_and_chaos_governance.md) — risk decisions, manipulation signals, chaos outcomes
- [`runtime_observability_protocol.md`](runtime_observability_protocol.md) — telemetry, KPIs, alerting

Deep chaos reference: [`docs/trading/trading-edge_chaos-scenarios.md`](../trading/trading-edge_chaos-scenarios.md)

---

## Architecture Reference

- [`docs/architecture/master-trading-bot-intelligence-spec.md`](../architecture/master-trading-bot-intelligence-spec.md) — canonical high-level system design for the current bot runtime
- [`bot/README.md`](../../bot/README.md) — runtime overview and local operator setup

---

## Readiness / Audit / Incident Response

- [`production_readiness_checklist.md`](production_readiness_checklist.md) — mandatory gates before any live test
- [`archive/README.md`](../../archive/README.md) — retired audit reports and cleaned-up docs
- [`incident_and_killswitch_runbook.md`](incident_and_killswitch_runbook.md) — emergency stop, level classification, post-incident review
