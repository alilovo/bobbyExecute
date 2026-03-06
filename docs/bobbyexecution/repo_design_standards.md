# BobbyExecution Repository Design Standards

## Preferred logical layout

```text
repo/
  bot/
    src/
      adapters/
        market/
        onchain/
        execution/
      domain/
        scoring/
        signals/
        risk/
        chaos/
        policies/
      application/
        workflows/
        use-cases/
      governance/
      observability/
      persistence/
      server/
    tests/
      unit/
      integration/
      e2e/
  dor-bot/
  docs/
    architecture/
    operations/
    audits/
```

## Design rules

- no business logic inside transport adapters
- scoring, risk, chaos, and execution remain separate domains
- execution code must not bypass policy / chaos gates
- dashboard projection must consume explicit contracts, not implicit memory dumps
- every server endpoint must map to a source-of-truth producer
- persistent logs should be append-only where possible

## Ownership boundaries

- adapters own external I/O only
- domain owns decisions
- application owns sequencing
- observability owns metrics, traces, and projections
- persistence owns durable state
- dashboard owns presentation, not hidden business logic

---

## Authority / Related Docs

- Canonical governance: [`governance/SoT.md`](../../governance/SoT.md)
- Repo path rules: [`governance/file_path.md`](../../governance/file_path.md)
- Domain index: [`docs/bobbyexecution/README.md`](README.md)
