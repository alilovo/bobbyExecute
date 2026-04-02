Pre-authority v2 forensics reservation.

This directory is reserved for the future TrendReversalMonitorWorker contracts and typed forensics inputs.
This slice adds no TS barrel and no runtime entrypoint here.
The worker remains observational, journal-first, non-LLM, and non-authoritative.

Stage 5.5 placement:
- after `DataQualityV1`
- after `CQDSnapshotV1`
- after the later signal/forensics foundation from W2-01
- before any downstream scoring, pattern, policy, or execution use

Planned contracts:
- `TrendReversalObservationV1`
- `TrendReversalMonitorInputV1`
- `TrendReversalWorkerStateV1`
- optional `TrendReversalMaterialChangeV1`

Contract decision:
- keep `TrendReversalObservationV1` standalone first
- do not merge it into `SignalPackV1` yet
- do not expose it as a control input

Allowed downstream use:
- watchlist prioritization
- candidate enrichment
- setup qualification context
- alerting
- journaling
- optional advisory request enqueue

Forbidden downstream use:
- `DecisionResult` mutation
- `DecisionTokenV1` mutation
- `PositionPlan` mutation
- `TradeIntent` mutation
- policy or risk override
- execution authorization

Future consumers must use approved typed deterministic bridges only.
