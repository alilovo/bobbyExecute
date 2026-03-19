# Staging Rehearsal Report Template

Use this after a staging rehearsal or operator dry run.

## Metadata

- Date:
- Environment:
- Operator:
- Build:
- Commit:
- Rollout posture:
- Execution mode:

## Readiness Review

- `/health` status:
- `/health` readiness posture:
- `/runtime/status` readiness posture:
- `/runtime/status` blockers:
- `/kpi/summary` readiness posture:
- `/kpi/summary` blockers:
- Live arm allowed:
- Active caps / limits:

## Procedure Performed

- Paper startup:
- Readiness review:
- Micro-live posture switch:
- Arm:
- Disarm:
- Kill / emergency stop:
- Reset after kill:
- Blocked-state inspection:
- Rollback / paused handling:

## Evidence Reviewed

- Recent incidents:
- Recent runtime cycles:
- Control responses:
- KPI summary:
- KPI decisions:
- KPI adapters:
- KPI metrics:

## Results

- Readiness blockers seen:
- Operator actions performed:
- Kill/disarm/reset behaved as documented:
- Runbook matched actual behavior:

## Go / No-Go

- Outcome:
- Capital-enable readiness:
- Follow-up blockers:
- Required follow-up owner:

