# BobbyExecution Architecture Pattern Library

## 1. Data Intelligence Pipeline

Use when market data from multiple sources must be normalized into a scoring and risk decision flow.

Flow:
Data Sources
→ Normalization
→ Validation
→ Freshness Check
→ Feature Extraction
→ Scoring
→ Risk / Chaos Gate
→ Trade Intent

Strengths:
- explicit decision chain
- traceable score inputs
- easy to block on invalid data

Risks:
- stale data leakage
- inconsistent field semantics across sources
- score confidence inflation without consensus logic

## 2. Governance Control Pattern

Use when a trade request must pass policy, risk, and approval checks before execution.

Flow:
Trade Intent
→ Policy Check
→ Risk Check
→ Chaos Check
→ Execution Eligibility
→ Execution
→ Verification
→ Audit Log

Strengths:
- fail-closed friendly
- clear reasons for blocked trades
- strong audit trail potential

Risks:
- false sense of safety if checks are stubbed
- policy declarations without enforcement

## 3. Execution Guardrail Pattern

Use for live swaps.

Flow:
Quote
→ Route Validation
→ Simulation
→ Slippage Check
→ Live Submit
→ Confirmation
→ Reconciliation
→ Journal

Strengths:
- protects against bad routes and unsafe fills
- supports rollback decisions
- makes live-test behavior observable

Risks:
- incomplete quote trust
- simulation / live divergence
- missing reconciliation on partial success

## 4. Circuit Breaker + Health Pattern

Use for adapters and RPC clients.

Flow:
Request
→ Timeout / Retry
→ Health Reporting
→ Breaker State
→ Block / Allow
→ Alert

Strengths:
- reduces repeated failures
- makes degraded mode visible
- supports dashboard health KPIs

Risks:
- useless if health is never reported
- hidden failures if breaker state is not surfaced

## 5. Decision Trace Pattern

Use when every important decision must be explainable.

Flow:
Inputs
→ Decision Context
→ Gate Results
→ Final Verdict
→ Persistent Log
→ Dashboard Projection

Strengths:
- auditability
- easier debugging
- supports incident review

Risks:
- in-memory only logs
- inconsistent run_id correlation
