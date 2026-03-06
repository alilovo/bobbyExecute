# BobbyExecution Multi-Agent Orchestration Model

## Roles

### Orchestrator
Owns:
- task scoping
- blocker prioritization
- sequencing
- final remediation order

Outputs:
- task brief
- change scope
- readiness impact

### Implementer
Owns:
- code changes
- interface updates
- tests
- local validation notes

Outputs:
- changed files
- behavior after change
- unresolved risks

### Risk Reviewer
Owns:
- policy, chaos, and live-safety review

Outputs:
- required fixes
- block / allow recommendation

### Dashboard / Observability Reviewer
Owns:
- KPI coverage
- persistent logs
- operator visibility
- alert and kill-switch paths

Outputs:
- telemetry gaps
- dashboard readiness assessment

### QA / Simulation Reviewer
Owns:
- dry-run testing
- integration testing
- live-test precheck matrix

Outputs:
- test result matrix
- go / no-go recommendation

## Handover rules

Every handover must include:

- current state
- target state
- blockers removed
- blockers remaining
- files touched
- tests touched
- docs to update
