# Repo-Specific Canonical Sources

Scope: repository-local source-of-truth hierarchy.
Authority: authoritative for documentation-tier classification in BobbyExecute.

## Tiered Truth Model

### Tier 0: Governance Entry

- `governance/SoT.md`

### Tier 1: Canonical Architecture And Boundaries

- `README.md`
- `docs/01_architecture/README.md`
- `docs/02_pipeline/README.md`
- `docs/05_governance/README.md`
- `docs/architecture/target-architecture-4-plane.md`

The Tier 1 architecture and boundary docs above now also carry the Dashboard V1 target route model (`/overview`, `/control`, `/journal`, `/recovery`, `/advanced`) and the responsive/mobile addendum.

### Tier 2: Canonical Support Documents

- `docs/glossary/architecture-terms.md`
- `docs/architecture/forensics-evidence-plane.md`
- `docs/architecture/signing-architecture.md`
- `docs/architecture/workflow-consumers.md`
- `docs/architecture/journal-memory-casebook-architecture.md`
- `docs/architecture/journal-memory-validation-gates.md`
- `docs/architecture/dashboard-v1-control-spec.md`
- `docs/03_skill_plane/README.md`
- `docs/04_sidecars/README.md`
- `docs/06_journal_replay/README.md`

### Tier 3: Operational Runbooks, Pointers, And Env Examples (Non-Canonical Architecture)

- `docs/local-run.md`
- `docs/local-run-macos.md`
- `docs/local-run-windows.md`
- `.env.papertrade.example`
- `.env.live-local.example`
- `dashboard/.env.example`
- `signer/.env.example`
- `docs/06_journal_replay/staging-live-preflight-runbook.md`
- `docs/06_journal_replay/staging-live-preflight-runbook-macos.md`
- `docs/06_journal_replay/staging-live-preflight-runbook-windows.md`
- `docs/06_journal_replay/boot-critical-artifact-preparation.md` (pointer only)
- `docs/06_journal_replay/staging-live-preflight-evidence-template.md`
- `bot/README.md`

### Tier 4: Historical Evidence And Legacy Records

- `docs/06_journal_replay/evidence-records-index.md`
- dated evidence snapshots under `docs/06_journal_replay/`
- `archive/README.md`

## Shared-Core Boundary

Shared-core assets are consumed only through `.codex/shared-core-consumer.json`.
The current consumer overlay is `docs/model-agnostic-workflow-system-consumer.md`.
The standalone `model-agnostic-workflow-system` repository is a workflow dependency, not BobbyExecute runtime authority.

## Classification Rules

- Architecture truth must come from Tier 0-2 documents.
- Runbooks must link upward to Tier 1 and must not define alternate architecture truth.
- Historical evidence records must be explicitly dated and labeled non-canonical.
- Canonical decision-history truth is runtime cycle summary `decisionEnvelope`.
