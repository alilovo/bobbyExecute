# Production Readiness Plan

**Repository:** dotBot / BobbyExecute  
**Created:** 2026-03-05  
**Target:** Raise from 38/100 to production-ready

---

## Current Status

| Metric | Value |
|--------|-------|
| **Score** | 38/100 |
| **Recommendation** | NOT READY |

### Critical Blockers (from audit)

1. Chaos suite is stubbed: all 19 scenarios return `async () => true`
2. RPC adapter is stub only: `StubRpcClient` returns fake data
3. Swap execution throws when not dryRun
4. No adapter retries/timeouts/rate limiting
5. CircuitBreaker exists but not integrated
6. Non-deterministic trace IDs (`Math.random` in Orchestrator/Engine/Tracer/MemoryDB)
7. Token universe builder missing
8. Risk models missing (LiquidityRiskModel etc.)
9. Governance policies not implemented as modules
10. Idempotency not implemented

---

## Target Definition: "Production Ready"

### Go/No-Go Checks

| Check | Description |
|-------|-------------|
| GO-1 | `LIVE_TRADING=false` default; no real swaps unless explicitly enabled |
| GO-2 | Trace IDs deterministic when `REPLAY_MODE=true` |
| GO-3 | All adapters use timeout, retry, circuit breaker |
| GO-4 | Chaos suite scenarios 12–19 implement real checks |
| GO-5 | Real RPC client or documented stub-only mode |
| GO-6 | Idempotency key dedupe before focused_tx |
| GO-7 | Risk engine modules implemented |
| GO-8 | Governance policy modules enforced on write paths |
| GO-9 | Dockerfile + .env.example present |
| GO-10 | Metrics (latency, p95) and persistent action log option |

---

## Milestones (Ordered)

### M0 — Safety Switch + Paper Mode Default

| Attribute | Detail |
|-----------|--------|
| **Objective** | Global config flag `LIVE_TRADING=false`; executeSwap never performs live swap unless explicitly enabled |
| **Files to change** | `bot/src/config/safety.ts` (new), `bot/src/adapters/dex-execution/swap.ts` |
| **New modules** | `safety.ts` — `isLiveTradingEnabled()` |
| **Tests** | `bot/tests/adapters/dex-execution/swap-safety.test.ts` |
| **Acceptance Criteria** | With LIVE_TRADING unset/false, executeSwap(dryRun:false) returns paper result; test passes |
| **Rollback** | Remove safety.ts; restore swap.ts to check only intent.dryRun |

---

### M1 — Determinism & Trace IDs

| Attribute | Detail |
|-----------|--------|
| **Objective** | Replace `Math.random`-based traceIds with deterministic IDs from stable inputs; shared traceId source |
| **Files to change** | `bot/src/observability/trace-id.ts` (new), `bot/src/core/orchestrator.ts`, `bot/src/core/engine.ts`, `bot/src/observability/tracer.ts`, `bot/src/memory/memory-db.ts` |
| **New modules** | `trace-id.ts` — `createTraceId({ timestamp, seed })` |
| **Tests** | `bot/tests/observability/trace-id.test.ts` — same input → same traceId when seed provided |
| **Acceptance Criteria** | REPLAY_MODE + same seed → same traceId; MemoryDB/Orchestrator/Engine use shared source |
| **Rollback** | Revert to Math.random; restore original traceId format |

---

### M2 — HTTP Resilience Layer for Adapters

| Attribute | Detail |
|-----------|--------|
| **Objective** | Shared fetch wrapper: timeout, retries, backoff, rate-limit handling, circuit breaker hooks |
| **Files to change** | `bot/src/adapters/http-resilience.ts` (new), `bot/src/adapters/dexpaprika/client.ts`, `bot/src/adapters/moralis/client.ts`, `bot/src/adapters/dexscreener/client.ts` |
| **Tests** | `bot/tests/adapters/http-resilience.test.ts` |
| **Acceptance Criteria** | Mocked fetch: timeout triggers retry; 429 triggers backoff; tests pass |

---

### M3 — Circuit Breaker Integration

| Attribute | Detail |
|-----------|--------|
| **Objective** | Wire CircuitBreaker into adapter calls; fail-closed when open |
| **Files to change** | `bot/src/agents/ingest.agent.ts`, adapter wrappers |
| **Tests** | `bot/tests/governance/circuit-breaker-integration.test.ts` |
| **Acceptance Criteria** | Consecutive failures open breaker; requireHealthy blocks when open |

---

### M4 — Replace StubRpcClient with Real Solana RPC Client

| Attribute | Detail |
|-----------|--------|
| **Objective** | Implement `RealRpcClient` via `@solana/web3.js`; keep StubRpcClient for tests |
| **Files to change** | `bot/src/adapters/rpc-verify/client.ts`, new `RealRpcClient` |
| **Dependencies** | `@solana/web3.js` (pin version) |
| **Tests** | Integration-style tests with mocked Connection |
| **Acceptance Criteria** | verifyBeforeTrade/verifyAfterTrade work with RealRpcClient |

---

### M5 — Token Universe Builder + Normalizer + Cross-Source Validator

| Attribute | Detail |
|-----------|--------|
| **Objective** | token_universe_builder (MAX=30, MIN=20), normalizer, cross_source_validator |
| **Files to change** | `bot/src/token-universe/` (new), integrate with Orchestrator research phase |
| **Tests** | Enforce MAX/MIN; discrepancy flags; confidence on missing metrics |
| **Acceptance Criteria** | ReducedMode profile enforces limits; fail-closed on recovery failure |

---

### M6 — Chaos Suite: Replace Stubs With Real Scenario Checks

| Attribute | Detail |
|-----------|--------|
| **Objective** | Scenarios 12–19 implement real checks (liquidity delta, bundle risk, cross-dex discrepancy, fake volume) |
| **Files to change** | `bot/src/chaos/chaos-suite.ts` |
| **Tests** | Per-scenario tests with synthetic inputs |
| **Acceptance Criteria** | Each scenario returns false when manipulation detected |

---

### M7 — Idempotency Store + Dedupe Gate

| Attribute | Detail |
|-----------|--------|
| **Objective** | In-memory idempotency KV; reject duplicate idempotencyKey before focused_tx |
| **Files to change** | `bot/src/governance/idempotency-store.ts` (new), `bot/src/core/orchestrator.ts` |
| **Tests** | Same key executed twice → second denied |
| **Acceptance Criteria** | Dedupe gate blocks repeat execution |

---

### M8 — Risk Engine (Minimal)

| Attribute | Detail |
|-----------|--------|
| **Objective** | LiquidityRiskModel, SocialManipModel, MomentumExhaustModel, StructuralWeaknessModel, GlobalRiskAggregator, RiskBreakdown contract |
| **Files to change** | `bot/src/risk/` (new), `bot/src/core/contracts/risk-breakdown.ts` |
| **Tests** | Risk caps and aggregation weights match spec |
| **Acceptance Criteria** | Risk models produce RiskBreakdown; fail-closed on threshold breach |

---

### M9 — Governance Policies as Modules

| Attribute | Detail |
|-----------|--------|
| **Objective** | FailClosedPolicy, FallbackPolicy, ConfidencePolicy, CapsPolicy, ApprovalPolicy |
| **Files to change** | `bot/src/governance/policies/` (new), wire into Engine/Orchestrator |
| **Tests** | Side effect without approval → denied |
| **Acceptance Criteria** | All write paths require policy evaluation |

---

### M10 — Observability & Deployment Readiness

| Attribute | Detail |
|-----------|--------|
| **Objective** | metrics.ts (latency, p95), incident counters, persistent action log option, Dockerfile, .env.example, health check |
| **Files to change** | `bot/src/observability/metrics.ts`, `Dockerfile`, `.env.example` |
| **Tests** | CI includes lint/test |
| **Acceptance Criteria** | Metrics exportable; Docker build succeeds; .env.example documents required vars |

---

## Risk Register

| Risk | Severity | Mitigation | Owner |
|------|----------|------------|-------|
| Live trading enabled by misconfiguration | Critical | M0: LIVE_TRADING default false; double-gate in swap | M0 |
| Replay non-deterministic | High | M1: Deterministic traceIds when seed provided | M1 |
| Adapter hangs/failures cascade | High | M2–M3: Timeout, retry, circuit breaker | M2, M3 |
| Stub RPC in production | Critical | M4: RealRpcClient or explicit stub-only mode | M4 |
| Token universe unbounded | Medium | M5: MAX/MIN limits | M5 |
| Chaos always passes | Critical | M6: Real scenario logic | M6 |
| Duplicate execution | High | M7: Idempotency store | M7 |
| Policy bypass | High | M9: Enforce on all write paths | M9 |

---

## Release Strategy

| Phase | Description |
|-------|-------------|
| **Staging** | All milestones done; LIVE_TRADING=false; chaos real; RPC real or documented stub |
| **Soft-launch** | Paper mode with real adapters; optional LIVE_TRADING per env |
| **Prod** | Feature flag LIVE_TRADING; audit log; idempotency; policy gates |

**Feature flags:**
- `LIVE_TRADING` — must be `true` for real swaps (default: false)
- `REPLAY_MODE` — use deterministic traceIds when true
- `DRY_RUN` — Orchestrator/Engine default true
