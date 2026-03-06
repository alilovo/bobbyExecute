# BobbyExecution Architecture Decision Matrix

Use this matrix to compare remediation options.

## Criteria

Score each 1–5, then apply weights.

| Criterion | Weight |
|---|---:|
| execution safety | 5 |
| data reliability | 5 |
| operator visibility | 4 |
| auditability | 4 |
| implementation complexity | 2 |
| rollback safety | 4 |
| runtime maintainability | 3 |

## Rules

- any option that leaves live swap execution stubbed is automatically rejected
- any option that leaves bot → dashboard state disconnected is not live-test ready
- any option without bot-side kill-switch support is not approved for live test
- choose the option with the highest weighted score that satisfies all hard safety gates

## Required rationale

For the selected option, explain:

- why it is safest
- what blockers it removes
- what risk remains
- what must be verified before live testing
