Pre-authority v2 discovery area.

This module family is reserved for typed observation, evidence, and candidate-discovery artifacts.
PR-01 introduced structure and contracts only.
PR-02 and PR-02b introduced the first real upper-half builders for observation, evidence, and candidate shaping.
These builders remain pre-authority and are not wired into runtime authority.

Discovery remains upstream for the Stage 5.5 trend-reversal reservation.
It may feed the worker only through typed observation/evidence artifacts such as `SourceObservation`, `DiscoveryEvidence`, and `CandidateToken`.
It must not consume worker output, worker state, or material-change signals as control input.

Wave bundle mapping note:
- `SourceObservationV1` -> `SourceObservation`
- `EvidenceBundleV1` -> `DiscoveryEvidence`
- `CandidateTokenV1` -> `CandidateToken`
