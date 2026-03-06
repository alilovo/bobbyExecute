# Production Readiness Checklist

Use this checklist before any controlled live test.

## Phase 1 — Mandatory before any live test

- [ ] real swap execution implemented
- [ ] real quote service implemented
- [ ] `RPC_MODE=real` documented and enforced
- [ ] bot-side health / KPI server exists
- [ ] persistent action log exists
- [ ] persistent journal exists
- [ ] bot → dashboard bridge exists
- [ ] adapter health is exported
- [ ] live failure state is visible in dashboard
- [ ] no silent stub path remains in execution

## Phase 2 — Strongly required before extended testing

- [ ] MEV / sandwich scenario implemented
- [ ] 5xx retry implemented
- [ ] fallback cache implemented
- [ ] freshness checks implemented
- [ ] secondary RPC or failover implemented
- [ ] at least core stub chaos scenarios replaced
- [ ] bot-side kill switch implemented

## Phase 3 — Recommended operational hardening

- [ ] persistent metrics export
- [ ] `/kpi/adapters` endpoint available
- [ ] incident runbook verified
- [ ] dashboard switched to bot truth state where available
- [ ] E2E tests cover bot + dashboard + execution-disabled path

## No-go conditions

Do not live test if any of these remain true:

- execution path is stubbed
- dashboard still only reflects `dor-bot` memory proxies
- bot cannot be emergency-stopped
- action / decision trail is not durable
- required critical chaos scenarios are stubbed

---

## Authority / Related Docs

- Canonical governance: [`governance/SoT.md`](../../governance/SoT.md)
- Audit report: [`production_readiness_audit_report.md`](production_readiness_audit_report.md)
- Incident runbook: [`incident_and_killswitch_runbook.md`](incident_and_killswitch_runbook.md)
- Domain index: [`docs/bobbyexecution/README.md`](README.md)
