# TrendReversal Worker Alignment

Canonical planning note for the deterministic TrendReversalMonitorWorker reservation.

## Summary

- The worker is reserved at Stage 5.5.
- It is an observational, non-LLM sidecar, not a second decision path.
- It is evidence-first, journal-first, shadow-first, deterministic, and non-authoritative.
- The first standalone artifact is `TrendReversalObservationV1`; do not merge it into `SignalPackV1` yet.

## Placement

- Prereqs: `DataQualityV1`, `CQDSnapshotV1`, and the later signal/forensics foundation.
- Sequence: W1-02 upstream chain plus real `DataQualityV1`, W1-03 `CQDSnapshotV1`, W2-01 signal/forensics foundation, W2-02 worker shadow introduction, W2-03 downstream qualification hooks, W3+ optional advisory consumption, W4+ optional typed bridge into signal construction.
- The worker belongs between the upper-half evidence/quality path and the later scoring, pattern, policy, and execution layers.

## Contract Decision

- Primary artifact: `TrendReversalObservationV1`.
- Planned supporting contracts: `TrendReversalMonitorInputV1`, `TrendReversalWorkerStateV1`, and optional `TrendReversalMaterialChangeV1`.
- The artifact is standalone for lifecycle separation, journaling, replayability, and specialized semantics.

## Boundary Rules

Allowed inputs:

- typed upstream artifacts
- typed forensics and signal inputs
- deterministic feature derivations
- validated quality, freshness, and consensus metadata

Forbidden inputs:

- raw mutable runtime state
- execution credentials
- policy or control mutation surfaces
- direct decision outputs as control inputs
- hidden advisory or provider state

Allowed outputs:

- `TrendReversalObservationV1`
- journal entries
- optional material-change events
- setup qualification metadata
- watchlist and candidate enrichment hints

Forbidden outputs:

- trade intent
- `PositionPlan`
- score mutation
- pattern result override
- policy decision
- execution authorization

## Governance

- Worker outputs are journal-first and observational only.
- Any downstream use must pass through approved typed deterministic bridges.
- No direct worker -> score, pattern, policy, or execute path is permitted.
- This note reserves the planning slot only and does not add runtime code or exports.
