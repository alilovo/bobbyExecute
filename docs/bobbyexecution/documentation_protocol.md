# BobbyExecution Documentation Governance Protocol

Documentation is mandatory for every architecture or safety-relevant change.

## Required documents by change type

### Execution path changes
- `architecture.md`
- `interfaces.md`
- `decision-log.md`
- `execution-policy.md`

### Data / adapter changes
- `architecture.md`
- `interfaces.md`
- `adapter-contracts.md`
- `decision-log.md`

### Risk / chaos changes
- `risk-rules.md`
- `chaos-scenarios.md`
- `decision-log.md`

### Dashboard / observability changes
- `workflow.md`
- `runtime-observability.md`
- `decision-log.md`

### Incident / kill-switch changes
- `runbook.md`
- `incident-log.md`
- `decision-log.md`

## Decision log format

- decision
- context
- chosen approach
- blockers addressed
- tradeoffs
- operator impact
- live-test impact
- follow-up actions

## Documentation quality rules

- explain why a trade can be allowed or blocked
- identify source of truth for runtime state
- document fail-closed behavior explicitly
- record any remaining unsafe assumptions

---

## Authority / Related Docs

- Canonical governance: [`governance/SoT.md`](../../governance/SoT.md)
- Agent rules: [`governance/cursor_rule.md`](../../governance/cursor_rule.md)
- Domain index: [`docs/bobbyexecution/README.md`](README.md)
