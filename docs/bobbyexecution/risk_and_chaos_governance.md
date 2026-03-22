# Risk and Chaos Governance Protocol

This protocol governs risk, manipulation, and chaos outcomes for BobbyExecution.

## Decision classes

Every risk / chaos outcome must resolve to one of:

- **allow**
- **degrade**
- **manual_review**
- **block**
- **abort**

## Required rule groups

### Policy rules
- denylist / allowlist
- max position size
- max slippage
- max daily loss
- live-trading enablement gate

### Chaos rules
- adapter integrity
- data integrity
- load / timeout failure
- divergence anomalies
- liquidity drain
- flash crash
- oracle inconsistency
- MEV / sandwich exposure
- pump / dump behavior

### Manipulation signals
- cross-DEX divergence
- pump velocity without holders
- abnormal liquidity drain
- abnormal price collapse
- suspicious quote / fill mismatch

## Critical live-test requirements

The following are critical before controlled live testing:

- scenario 15 MEV / Sandwich must be implemented
- high-severity live-path scenarios must not remain stubbed
- Cat-5 abort behavior must be tested and visible
- pass rate alone is not enough if critical scenarios are placeholders

## Outcome matrix

### Allow
All critical checks passed.

### Degrade
Use for non-critical data-quality issues that do not justify execution.

### Manual review
Use when operator review is required before any risky progression.

### Block
Used when trade must not proceed.

### Abort
Used for catastrophic runtime conditions; should trigger emergency stop consideration.

## Required logging fields

- scenario id
- severity
- result
- block reason
- trade impact
- operator action required

---

## Authority / Related Docs

- Canonical governance (chaos section): [`governance/SoT.md §12`](../../governance/SoT.md)
- Deep chaos scenario reference: [`docs/trading/trading-edge_chaos-scenarios.md`](../trading/trading-edge_chaos-scenarios.md)
- Production readiness checklist: [`production_readiness_checklist.md`](production_readiness_checklist.md)
- Archive: [`archive/README.md`](../../archive/README.md)
- Domain index: [`docs/bobbyexecution/README.md`](README.md)
