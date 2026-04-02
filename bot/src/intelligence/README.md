Pre-authority and deterministic v2 intelligence area.

Upper-half artifacts become typed validated inputs here before deterministic scoring, pattern, sizing, and policy consume them.
PR-01 introduces structure and contracts only.
PR-02 and PR-02b introduce the first real upper-half builders on top of those contracts.
These builders remain pre-authority and are not wired into runtime authority yet.
`quality/` is the Wave-1 admission gate only; it stops at data-quality truth and does not imply CQD or execution authority.

Stage 5.5 reservation:
- `TrendReversalMonitorWorker` is reserved here as a deterministic, non-LLM observational sidecar.
- It comes after `DataQualityV1`, `CQDSnapshotV1`, and the later signal/forensics foundation.
- The first artifact is planned as `TrendReversalObservationV1` and stays standalone first instead of merging into `SignalPackV1`.
- Later use must stay shadow-first, journal-first, and non-authoritative until an approved typed bridge exists.
- See [`./forensics/README.md`](./forensics/README.md) and [`../../docs/architecture/trend-reversal-worker-alignment.md`](../../docs/architecture/trend-reversal-worker-alignment.md).

Wave bundle mapping note:
- `UniverseBuildResultV1` -> `UniverseBuildResult`
- `DataQualityReportV1` -> `DataQualityV1`
- `CQDArtifactV1` -> `CQDSnapshotV1`
