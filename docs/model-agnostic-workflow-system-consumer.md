# Model-Agnostic Workflow System Consumer Overlay

Scope: shared-core consumer linkage for this repository.  
Authority: authoritative for shared-core linkage only, not for runtime architecture.

This repository consumes the standalone `model-agnostic-workflow-system` shared-core package through the consumer manifest.

## Linked Version

- shared-core version: `0.2.1`
- package fingerprint: `42c40e701633cce0606efce1a7057c4831fe095a66676906bfa8270049d97c96`
- linkage mode: standalone local repository reference

## Adopted Shared-Core Skills

- `repo-intake-sot-mapper`
- `runtime-policy-auditor`
- `planning-slice-builder`
- `implementation-contract-extractor`
- `test-matrix-builder`
- `post-implementation-review-writer`
- `patch-strategy-designer`
- `failure-mode-enumerator`
- `release-narrative-builder`

## Local Consumer Truth

Consumer-local overlays remain:

- `AGENTS.md`
- `.codex/repo-intake-inputs.json`
- `.codex/runtime-policy-inputs.json`
- `docs/repo-specific-canonical-sources.md`
- the canonical docs under `docs/01_architecture/` through `docs/06_journal_replay/`

Architecture truth tiering is owned by:

- `docs/repo-specific-canonical-sources.md`

## Operator Rule

- read `.codex/shared-core-consumer.json` before using shared-core assets
- do not edit the standalone `model-agnostic-workflow-system` repository from this repository
- keep the local overlay inputs aligned whenever canonical docs move
