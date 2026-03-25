# Risk and Chaos Governance Protocol

This protocol governs risk, manipulation, and chaos outcomes for BobbyExecution.

## Operational Outcomes

- `allow` - all required checks passed
- `degrade` - useful for paper or analysis, but not enough for confident live action
- `block` - trade must not proceed
- `abort` - catastrophic runtime condition, treat as an emergency-stop candidate

## Current Risk Signals

The current risk engine aggregates:

- liquidity risk
- social manipulation risk
- momentum exhaust risk
- structural weakness risk
- pattern flags from the deterministic pattern engine

The pattern engine currently recognizes:

1. `velocity_liquidity_divergence`
2. `bundle_sybil_cluster`
3. `narrative_shift`
4. `smart_money_fakeout`
5. `early_pump_risk`
6. `sentiment_structural_mismatch`
7. `cross_source_anomaly`
8. `fragile_expansion`

## Current Chaos Reference

The trading-edge chaos reference is a deep-support document for the 19-scenario suite. The current category 5 set covers:

- rug pull and liquidity drain
- pump and dump
- sandwich / MEV exposure
- wash trading
- liquidity pool price inflation
- oracle manipulation
- liquidation cascade
- sniper / front-running pressure

## Live-Test Rules

- Catastrophic scenario failures should be treated as abort candidates.
- Any live-path manipulation signal should bias toward block rather than allow.
- Pass rate alone is not enough if a critical scenario is missing or stubbed.
- Fail closed when data quality, adapter health, or verification confidence is weak.

## Required Logging

- scenario or pattern id
- severity
- result
- block reason
- trade impact
- operator action required
