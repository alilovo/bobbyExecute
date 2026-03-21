# Live Test Runbook (Stage 3 — Limited Capital)

Use this runbook for controlled live testing after Waves 1–8 completion.

## Prerequisites

- [ ] All waves 1–7 complete
- [ ] `npm run premerge` passes
- [ ] `npm run live:preflight` passes
- [ ] Dry run successful (1 week)
- [ ] Shadow mode successful (1 week)

## Environment Variables (Live Test Mode)

| Variable | Default | Description |
|----------|---------|-------------|
| `LIVE_TEST_MODE` | false | Enable live-test constraints |
| `LIVE_TEST_MAX_CAPITAL_USD` | 100 | Max capital in USD |
| `LIVE_TEST_MAX_TRADES_PER_DAY` | 1 | Max trades per calendar day (UTC) |
| `LIVE_TEST_MAX_DAILY_LOSS_USD` | 50 | Halt when daily loss >= this |
| `LIVE_TRADING` | false | Must be true for real swaps |
| `RPC_MODE` | stub | Must be `real` when LIVE_TRADING=true |

## Pre-flight Checklist

Run one of the following before enabling live test:

```bash
cd bot
npm run live:preflight
```

or, from the repo root:

```bash
bot/scripts/live-test-checklist.sh
```

## Execution Flow

1. **Run preflight**: `cd bot && npm run live:preflight`
2. **Start live-test server**: `cd bot && npm run live:test`
3. **Verify health**: `curl http://localhost:3333/health`
4. **Monitor KPIs**: Dashboard at `/kpi/summary`, `/kpi/adapters`, `/kpi/decisions`
5. **Emergency stop**: `POST /emergency-stop` if needed
6. **Reset**: `POST /control/reset` (manual operator only)

## Live Test Round

The current workflow is a controlled round with one live-test server session:

1. Preflight must pass.
2. Server starts in `LIVE_TRADING=true`, `RPC_MODE=real`, `LIVE_TEST_MODE=true`.
3. Operator validates `/health` and `/kpi/summary`.
4. One bounded live round is executed through the guarded runtime/control flow.
5. Operator stops the session or uses `POST /emergency-stop` / `POST /control/reset` if needed.

## Rollback Triggers

- 2 consecutive losses
- Daily loss > 50% of max
- Any CRITICAL alert
- Chaos Category 5 failure
- MEV sandwich detected

## Post-Incident

- Record timeline, components, financial impact
- Update this runbook with learnings
- Document go/no-go for next stage

## Related

- [Incident and Kill-Switch Runbook](incident_and_killswitch_runbook.md)
- [Production Readiness Checklist](production_readiness_checklist.md)
