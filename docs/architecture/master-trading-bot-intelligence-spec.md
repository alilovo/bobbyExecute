<!--
  Version: 2.0.0
  Owner: BobbyExecution maintainers
  Layer: architecture
  Last Updated: 2026-03-25
-->

# BobbyExecution Intelligence and Execution Setup

Canonical architecture summary for the current repository state.

## Current State

- `bot/` is the active TypeScript runtime.
- Deterministic execution and governance are the core strengths.
- Signal intelligence is still mostly source and quality weighted, not a full learning system.
- The LLM client exists in `bot/src/clients`, but it is not part of the default core execution path.
- The repository does not claim uncontrolled live trading readiness.

## Runtime Flow

```text
Ingest -> Signal -> Risk -> Execute -> Verify -> Journal -> Monitor
```

- **Ingest** produces the current market and wallet view.
- **Signal** turns a `SignalPack` into a deterministic `ScoreCard`.
- **Reasoning** derives `PatternResult` and risk context.
- **Risk** decides allow or block.
- **Execute** builds and submits the trade intent when live prerequisites pass.
- **Verify** confirms live results through real RPC.
- **Journal** appends the immutable audit trail.
- **Monitor** exposes runtime truth to the operator surfaces.

## Intelligence Layer

- `SignalPack` currently emphasizes price, volume, liquidity, freshness, source reliability, and cross-source confidence.
- `ScoreCard` remains a deterministic MCI / BCI / Hybrid formula layer.
- `PatternResult` is a fixed, deterministic pattern engine with eight current patterns.
- `DecisionResult` remains fail-closed and does not depend on an autonomous LLM judgment loop.
- Agent roles are still thin: executor and monitor are active profiles, while research, risk, and auditor remain scaffolding rather than a separate authoritative council.

## Reserved V2 Planning Slot

- `Stage 5.5` is reserved for `TrendReversalMonitorWorker`, a deterministic, non-LLM observational sidecar.
- Prereqs: `DataQualityV1`, `CQDSnapshotV1`, and the later signal/forensics foundation from W2-01.
- The first artifact is `TrendReversalObservationV1`, kept standalone instead of merging into `SignalPackV1` yet.
- Allowed downstream uses are watchlist prioritization, candidate enrichment, setup qualification context, alerting, journaling, and optional advisory request enqueue.
- Forbidden downstream uses are `DecisionResult`, `DecisionTokenV1`, `PositionPlan`, `TradeIntent`, score mutation, pattern override, policy/risk override, and execution authorization.
- The placement sequence is W1-02, W1-03, W2-01, W2-02 shadow introduction, W2-03 downstream qualification hooks, W3+ optional advisory consumption, and W4+ optional typed bridge into signal construction.
- See [`trend-reversal-worker-alignment.md`](trend-reversal-worker-alignment.md).

## Persistence and Replay

- Memory snapshots are compressed and hash-chained.
- Journal entries are append-only and replayable.
- Runtime cycle summaries and incidents provide operator truth.
- `/runtime/cycles/:traceId/replay` is the current end-to-end replay surface.

## Live Control and Safety

- Live-test requires real RPC, control tokens, explicit enablement, and persistent state.
- `POST /emergency-stop` and `POST /control/reset` are the operator kill / reset pair.
- Fail-closed is the default on invalid config, poor data quality, missing verification, or blocked control posture.

## Known Gaps

- Launch, wallet, and narrative feature enrichment is still an extension target.
- Offline learning proposals are not yet wired into an automated improvement loop.
- The journal is a strong audit base, but not yet a closed-loop learning system.

## Reference Map

- `SignalPack` - market and wallet signal aggregation
- `ScoreCard` - MCI / BCI / Hybrid scoring
- `PatternResult` - deterministic pattern recognition
- `TradeIntent` - execution intent and slippage semantics
- `ExecutionReport` - execution outcome and failure codes
- `JournalEntry` - append-only runtime record
