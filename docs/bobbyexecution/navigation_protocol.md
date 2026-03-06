# BobbyExecution Navigation Protocol

Purpose: choose the correct engineering workflow for every BobbyExecution request.

## Primary routing logic

### 1. Production readiness / live-test request
Use:
- `production_readiness_audit_report.md`
- `production_readiness_checklist.md`
- `architecture_review_protocol.md`
- `runtime_observability_protocol.md`

Output:
- readiness verdict
- blockers
- remediation sequence
- controlled test procedure

### 2. Execution-path request
Use:
- `trading_execution_protocol.md`
- `risk_and_chaos_governance.md`
- `market_data_reliability_protocol.md`

Output:
- exact execution flow
- gating rules
- missing safety controls
- implementation plan

### 3. Data / adapter reliability request
Use:
- `market_data_reliability_protocol.md`
- `architecture_pattern_library.md`
- `systems_thinking_framework.md`

Output:
- source trust assessment
- timeout / retry / fallback rules
- freshness and consensus guidance

### 4. Chaos / manipulation / risk request
Use:
- `risk_and_chaos_governance.md`
- `architecture_review_protocol.md`

Output:
- scenario classification
- block / degrade / review / allow decision
- missing scenario coverage
- remediation plan

### 5. Dashboard / observability request
Use:
- `runtime_observability_protocol.md`
- `incident_and_killswitch_runbook.md`
- `documentation_protocol.md`

Output:
- telemetry requirements
- KPI contract
- alerting / kill-switch mapping
- persistence requirements

### 6. Spec creation request
Use:
- `spec_generation_protocol.md`
- the most relevant trading extension documents above

Output:
- one implementation-ready technical spec

### 7. Repo design / refactor request
Use:
- `repo_design_standards.md`
- `multi_agent_orchestration.md`

Output:
- repo structure
- ownership boundaries
- change sequencing

## Mixed-request conflict rules

### Audit + implement
1. audit current state first
2. isolate blockers
3. implement only the minimal safe path
4. re-check readiness

### Dashboard + live trading
1. execution safety first
2. bot-side observability second
3. dashboard integration third
4. live test only after all gates pass

### Risk + execution
Risk governance always has priority over execution enablement.

### Bot + dor-bot integration
Treat the bridge as a production dependency, not a UI nice-to-have.

## Default fallback

If a request touches live execution, default to:
- `trading_execution_protocol.md`
- `market_data_reliability_protocol.md`
- `risk_and_chaos_governance.md`
- `runtime_observability_protocol.md`

---

## Authority / Related Docs

- Canonical governance: [`governance/SoT.md`](../../governance/SoT.md)
- Agent rules: [`governance/cursor_rule.md`](../../governance/cursor_rule.md)
- Domain index: [`docs/bobbyexecution/README.md`](README.md)
