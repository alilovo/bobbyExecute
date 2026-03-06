# BobbyExecution Architecture Review Protocol

Audit the system as unsafe until proven otherwise.

## Review dimensions

Score each from 0–10:

- architecture clarity
- data reliability
- execution safety
- risk / chaos coverage
- RPC verification quality
- observability
- dashboard integration
- persistence
- runtime safety
- testing completeness

## Required review outputs

1. summary verdict
2. component strengths
3. blocking risks
4. critical required fixes
5. secondary improvements
6. live-test readiness verdict

## Severity model

- **Critical** — blocks any live test
- **High** — should be fixed before extended controlled testing
- **Medium** — acceptable only with explicit mitigation
- **Low** — improvement item

## Automatic critical conditions

Mark as **Critical** if any of these are true:

- live execution is stubbed
- RPC verification can silently pass in stub mode
- no operator-visible kill switch exists for the bot runtime
- dashboard does not reflect bot truth state
- no persistent decision / action audit trail exists
- required chaos / manipulation checks are stubbed for live execution scope
