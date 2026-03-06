# Source of Truth (SoT) — BobbyExecution System Governance

Version: 1.0
Scope: dotBot / BobbyExecution Trading System
Authority Level: Canonical System Governance Document

**Related governance files:**
- [cursor_rule.md](cursor_rule.md) — agent/cursor working rules
- [file_path.md](file_path.md) — repo path and file rules

**Related operational files:**
- [docs/bobbyexecution/production_readiness_checklist.md](../docs/bobbyexecution/production_readiness_checklist.md)
- [docs/bobbyexecution/incident_and_killswitch_runbook.md](../docs/bobbyexecution/incident_and_killswitch_runbook.md)
- [docs/trading/trading-edge_chaos-scenarios.md](../docs/trading/trading-edge_chaos-scenarios.md)

---

# 1. Purpose

This document defines the **canonical operational truth of the BobbyExecution system**.

The SoT establishes:

- system governance rules
- execution authority boundaries
- data truth requirements
- runtime safety rules
- observability guarantees
- incident governance

If any implementation conflicts with this document, **this document prevails**.

---

# 2. Authority Hierarchy

Authority order for system decisions:

1. **governance/SoT.md** (this document)
2. **governance/cursor_rule.md** — agent / cursor rules
3. **governance/file_path.md** — repo path rules
4. **docs/bobbyexecution/** — domain-specific operational guidance
5. System architecture documentation
6. Implementation code
7. Dashboard interpretation
8. Chat discussions

Chat output is **never authoritative**.

---

# 3. Repo Truth Principle

The repository is the **only persistent truth**.

Principles:

- repo content overrides runtime interpretation
- configuration must exist in the repository
- system rules must be documented before implementation

No runtime behavior may contradict repository rules.

---

# 4. Append-Only Governance

Critical system logs must follow **append-only semantics**.

Mandatory append-only artifacts:

- action logs
- decision logs
- execution reports
- chaos reports
- incident reports

Modification or deletion of these logs is prohibited.

---

# 5. Change Governance

All changes affecting execution safety must be reviewed.

Mandatory review required for:

- trading logic
- risk logic
- chaos scenarios
- execution adapters
- RPC verification
- circuit breaker logic
- market data sources

Unsafe changes must be rejected.

---

# 6. Market Data Truth

The trading engine must operate only on **valid market truth**.

Market data rules:

- data freshness must be ≤ 15 seconds
- at least one trusted source must succeed
- adapter errors must be recorded
- corrupted data must abort the run

Fail conditions:

```
if data freshness > 15 seconds
→ abort trading
```

```
if adapter responses invalid
→ abort trading
```

Market data integrity is mandatory for any execution decision.

---

# 7. Adapter Reliability Rules

Market adapters must enforce reliability constraints.

Mandatory adapter behavior:

- timeout protection
- retry logic
- circuit breaker integration
- health reporting

Required behaviors:

Retry policy:
- retry up to 3 times for 5xx errors
- exponential backoff

Timeout policy:
- adapter request timeout ≤ 10 seconds

Circuit breaker policy:

```
5 consecutive failures → circuit breaker open
```

When circuit breaker is open:

```
adapter disabled
```

---

# 8. Execution Authority

The system may only perform trades if **all execution conditions are satisfied**.

Mandatory conditions:

- chaosPassed ≥ 98%
- DataQuality ≥ 70%
- CircuitBreaker healthy
- RPC verification enabled
- liquidity threshold satisfied
- slippage threshold satisfied

Execution rule:

```
if any condition fails
→ execution forbidden
```

Execution must be fail-closed.

---

# 9. Slippage Protection

Every trade must enforce slippage limits.

Required rule:

```
slippage ≤ maxSlippagePercent
```

If slippage threshold is exceeded:

```
abort trade
```

---

# 10. Liquidity Requirements

Trades require sufficient liquidity.

Mandatory rule:

```
liquidity ≥ minimumLiquidityThreshold
```

Low liquidity must abort trading.

---

# 11. RPC Verification Truth

All trades must be verified on-chain.

RPC rules:

- RPC must run in **real mode**
- stub RPC mode forbidden for live trading
- transaction confirmation must be verified

Execution rule:

```
if RPC verification fails
→ trade invalid
```

---

# 12. Chaos Safety Governance

The Chaos Suite protects the system from market manipulation and abnormal events.

Chaos evaluation rules:

- minimum pass rate: 98%
- catastrophic failures abort execution

Example catastrophic scenarios:

- flash crash
- liquidity drain
- oracle divergence
- cross-DEX manipulation

Execution rule:

```
if Cat-5 scenario triggered
→ abort execution
```

Deep reference: [docs/trading/trading-edge_chaos-scenarios.md](../docs/trading/trading-edge_chaos-scenarios.md)

---

# 13. Risk Layer Authority

The risk engine enforces guardrails.

Mandatory risk checks:

- max position size
- daily loss limit
- allowlist / denylist
- slippage enforcement

Risk rule:

```
if risk policy violated
→ block trade
```

---

# 14. Runtime Safety Truth

The system must always prioritize capital protection.

Mandatory runtime protections:

- circuit breaker
- kill switch
- fail closed execution
- adapter health checks

Critical failure rule:

```
if system integrity compromised
→ halt trading engine
```

---

# 15. Circuit Breaker Policy

Circuit breakers protect against cascading failures.

Trigger condition:

```
5 consecutive adapter failures
```

Circuit breaker behavior:

- adapter disabled
- execution paused
- health recovery required

---

# 16. Kill Switch Authority

The system must support immediate shutdown.

Kill switch conditions:

- chaos failure
- RPC failure
- daily loss exceeded
- repeated execution failures
- manual operator command

Kill switch effect:

```
stop engine immediately
```

Runbook: [docs/bobbyexecution/incident_and_killswitch_runbook.md](../docs/bobbyexecution/incident_and_killswitch_runbook.md)

---

# 17. Observability Truth

All trading actions must be observable.

Required logs:

- action logs
- decision logs
- execution reports
- adapter health
- chaos reports

Logging rules:

- structured logs required
- append-only format
- persistent storage

---

# 18. Decision Traceability

Every trading decision must be traceable.

Mandatory trace fields:

- run_id
- decision_id
- market snapshot
- signal output
- risk evaluation
- execution result

A trade must always be reproducible.

---

# 19. Dashboard Truth

The dashboard must reflect **actual system state**.

Rules:

- dashboard must consume real engine data
- mock data forbidden for production monitoring
- adapter health must be visible
- chaos results must be visible
- execution decisions must be visible

The dashboard is a **monitoring interface**, not a decision authority.

---

# 20. Persistence Requirements

Critical system state must persist across restarts.

Required persistence:

- trade history
- action logs
- decision logs
- metrics
- adapter health

In-memory only storage is not acceptable for production.

---

# 21. Incident Governance

Incidents must be handled through defined procedures.

Incident response steps:

1. halt trading engine
2. preserve logs
3. identify root cause
4. document incident
5. implement fix
6. verify system stability

Incident reports must be stored in the repository.

Runbook: [docs/bobbyexecution/incident_and_killswitch_runbook.md](../docs/bobbyexecution/incident_and_killswitch_runbook.md)

---

# 22. Testing Authority

System safety must be validated through testing.

Required test categories:

- adapter tests
- risk tests
- chaos tests
- determinism tests
- integration tests
- end-to-end tests

Tests must run successfully before system changes are deployed.

---

# 23. Deployment Safety

Production deployment must follow safety gates.

Required conditions:

- passing test suite
- passing chaos suite
- verified RPC connectivity
- valid configuration
- monitoring available

Deployment rule:

```
if any safety gate fails
→ deployment forbidden
```

Pre-deployment checklist: [docs/bobbyexecution/production_readiness_checklist.md](../docs/bobbyexecution/production_readiness_checklist.md)

---

# 24. Live Test Procedure Authority

Controlled live tests must follow strict limits.

Required constraints:

- small capital allocation
- limited runtime
- monitored execution
- rollback plan

Live test rule:

```
unexpected behavior → stop system
```

---

# 25. Incident Documentation

Every critical failure must produce a report.

Mandatory incident fields:

- timestamp
- affected components
- root cause
- corrective action
- prevention strategy

---

# 26. Anti-Drift Principle

System documentation and implementation must remain aligned.

Rules:

- undocumented behavior forbidden
- architecture drift must be corrected
- governance violations must be rejected

---

# 27. Deterministic Execution

Given identical inputs, the system must produce identical outputs.

Deterministic components:

- scoring logic
- signal logic
- risk evaluation

Non-determinism is unacceptable.

---

# 28. Security Principles

Secrets must never be exposed.

Security rules:

- secrets stored in vault
- environment variables protected
- logs must not expose private keys

---

# 29. Operator Authority

Human operators retain final authority.

Operators may:

- stop the engine
- override trading
- trigger emergency procedures

Operators cannot override **SoT safety rules**.

---

# 30. Final Principle

BobbyExecution is a **capital-protecting system**.

Safety takes precedence over:

- performance
- trade frequency
- profit opportunity

Primary rule:

```
when uncertain
→ do not trade
```

Fail-safe behavior is mandatory.

---
