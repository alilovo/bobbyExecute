Deterministic v2 decision area.

This module family is reserved for canonical downstream decision artifacts and tokenized execution authority.
PR-01 introduces structure only and does not change the current runtime authority path.

The TrendReversalMonitorWorker is not a second decision path.
Any future worker-derived use here must arrive through approved typed deterministic bridges only.
It must not directly set `DecisionResult`, `DecisionTokenV1`, `PositionPlan`, `TradeIntent`, policy, risk, or execution authority.
