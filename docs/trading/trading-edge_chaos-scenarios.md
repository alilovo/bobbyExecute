# Trading-Edge Chaos Scenarios - Solana Meme Coins

> Supporting deep-reference layer. This document is not the canonical governance file.
>
> Canonical governance: [`governance/SoT.md`](../../governance/SoT.md)
> Risk governance protocol: [`docs/bobbyexecution/risk_and_chaos_governance.md`](../bobbyexecution/risk_and_chaos_governance.md)
> Readiness checklist: [`docs/bobbyexecution/production_readiness_checklist.md`](../bobbyexecution/production_readiness_checklist.md)
> Archive: [`archive/README.md`](../../archive/README.md)

---

## Current Category 5 Reference Set

These scenarios map to the current deterministic pattern engine and chaos suite. Treat any missing implementation or test coverage as a gap, not as a safe default.

### 1. Rug Pull / Liquidity Drain

- Current signals: fragile expansion, sudden liquidity collapse, cross-source discrepancy.
- Current tie-in: `fragile_expansion`, liquidity risk, cross-source anomaly.
- Response: block or abort live execution when liquidity falls away unexpectedly.

### 2. Pump and Dump

- Current signals: rapid velocity without holder growth, sharp narrative shift, low-depth entries.
- Current tie-in: `early_pump_risk`, `narrative_shift`.
- Response: block low-confidence live entries and bias toward no trade.

### 3. Sandwich / MEV Exposure

- Current signals: route timing risk, quote / fill mismatch, surrounding tx pressure.
- Current tie-in: execution verification and chaos abort logic.
- Response: fail closed if timing or confirmation evidence is ambiguous.

### 4. Wash Trading

- Current signals: synthetic volume, clustered activity, weak source agreement.
- Current tie-in: `bundle_sybil_cluster`, `cross_source_anomaly`.
- Response: degrade confidence or block live decisions when the pattern is synthetic.

### 5. Liquidity Pool Price Inflation

- Current signals: price movement outpacing depth, weak support liquidity, momentum without structure.
- Current tie-in: `velocity_liquidity_divergence`, `fragile_expansion`.
- Response: block when price action is not backed by liquidity.

### 6. Oracle Manipulation

- Current signals: source disagreement, stale inputs, conflicting truth layers.
- Current tie-in: `cross_source_anomaly`, data-quality gates.
- Response: fail closed when truth layers diverge beyond acceptable confidence.

### 7. Liquidation Cascade

- Current signals: momentum exhaustion, structural weakness, abrupt repricing.
- Current tie-in: `momentum_exhaust` risk, `structural_weakness` risk.
- Response: abort or block when the move looks cascade-driven rather than organic.

### 8. Sniper / Front-Running Pressure

- Current signals: early block pressure, suspicious first-print activity, weak narrative confirmation.
- Current tie-in: `early_pump_risk`, `narrative_shift`.
- Response: block low-liquidity entries that are too easy to front-run.

---

## Fail-Closed Rule

- Catastrophic category 5 failures should be treated as abort candidates.
- Pass rate alone is not enough if a critical scenario is stubbed or missing.
- If data quality, adapter health, or verification confidence is weak, favor no trade.
