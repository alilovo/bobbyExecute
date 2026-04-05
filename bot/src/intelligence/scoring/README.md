Pre-decision deterministic scoring bridge.

This directory owns the typed `ConstructedSignalSetV1` -> `ScoreCardV1` reduction layer.
It is replay-friendly, fail-closed, and explicitly non-authoritative.

Rules:
- keep scores descriptive and bounded
- keep missing / degraded / invalidated state explicit
- preserve input refs, evidence refs, and source coverage
- do not add policy, pattern classification, sizing, decision, or execution semantics here

Legacy authority scoring residue remains in `src/core/contracts/scorecard.ts`.
The intelligence scoring layer is additive and pre-decision only.
