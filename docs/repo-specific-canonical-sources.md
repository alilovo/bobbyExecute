# Repo-Specific Canonical Sources

This repository owns its own local governance and runtime truth.

## Canonical Sources

- repo-local AGENTS instructions
- `.codex/repo-intake-inputs.json`
- `.codex/runtime-policy-inputs.json`
- operator and delivery docs
- runtime or deployment policy files
- local journals or evidence logs

## Shared-Core Boundary

Shared-core assets are consumed through `.codex/shared-core-consumer.json`.
The shared-core source of truth is the standalone codex-workflow-core repository.
The repo-intake skill uses `.codex/repo-intake-inputs.json` for consumer-local source selection.
The runtime-policy skill uses `.codex/runtime-policy-inputs.json` for consumer-local runtime policy selection.
