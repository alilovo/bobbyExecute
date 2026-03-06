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

## Current Readiness Snapshot

Based on the latest audit ([`production_readiness_audit_report.md`](production_readiness_audit_report.md)):

- **Overall readiness:** `4.2 / 10`
- **Execution safety:** `2 / 10`
- **Observability:** `4 / 10`
- **Dashboard readiness:** `5 / 10`
- **Runtime safety:** `5 / 10`

**Status: Not ready for controlled live test.**

---

## Start Here

| Use case | First document |
|---|---|
| Contributor onboarding | [`../../governance/SoT.md`](../../governance/SoT.md) → this index |
| Auditor entry point | [`../../governance/SoT.md`](../../governance/SoT.md) → [`production_readiness_audit_report.md`](production_readiness_audit_report.md) |
| Implementer entry point | [`navigation_protocol.md`](navigation_protocol.md) → [`spec_generation_protocol.md`](spec_generation_protocol.md) |
| Incident / emergency | [`incident_and_killswitch_runbook.md`](incident_and_killswitch_runbook.md) |
| Pre-live-test checklist | [`production_readiness_checklist.md`](production_readiness_checklist.md) |

---

## Architecture & Thinking

- [`system_prompt.md`](system_prompt.md) — system operating identity and constraints
- [`navigation_protocol.md`](navigation_protocol.md) — how to route engineering requests
- [`systems_thinking_framework.md`](systems_thinking_framework.md) — reasoning framework
- [`architecture_pattern_library.md`](architecture_pattern_library.md) — reusable architecture patterns
- [`multi_agent_orchestration.md`](multi_agent_orchestration.md) — multi-agent design and ownership
- [`decision_matrix.md`](decision_matrix.md) — decision classification and routing

---

## Spec / Design / Review

- [`spec_generation_protocol.md`](spec_generation_protocol.md) — how to produce implementation-ready specs
- [`documentation_protocol.md`](documentation_protocol.md) — documentation standards and process
- [`repo_design_standards.md`](repo_design_standards.md) — repo structure and naming conventions
- [`architecture_review_protocol.md`](architecture_review_protocol.md) — architecture review process

---

## Trading Safety & Runtime

- [`trading_execution_protocol.md`](trading_execution_protocol.md) — execution flow, gating rules, safety conditions
- [`market_data_reliability_protocol.md`](market_data_reliability_protocol.md) — adapter trust, freshness, consensus
- [`risk_and_chaos_governance.md`](risk_and_chaos_governance.md) — risk decisions, manipulation signals, chaos outcomes
- [`runtime_observability_protocol.md`](runtime_observability_protocol.md) — telemetry, KPIs, alerting

Deep chaos reference: [`docs/trading/trading-edge_chaos-scenarios.md`](../trading/trading-edge_chaos-scenarios.md)

---

## Readiness / Audit / Incident Response

- [`production_readiness_checklist.md`](production_readiness_checklist.md) — mandatory gates before any live test
- [`production_readiness_audit_report.md`](production_readiness_audit_report.md) — current audit findings and remediation plan
- [`implementation_audit_prompt.md`](implementation_audit_prompt.md) — structured audit prompt for implementation review
- [`incident_and_killswitch_runbook.md`](incident_and_killswitch_runbook.md) — emergency stop, level classification, post-incident review
