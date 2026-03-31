# BobbyExecution Render Incident Triage Playbook

This playbook is the production debugging companion to the Render deployment skill.

Use it when an operator sees any of the following:

- deploy or build failure
- boot failure
- runtime crash loop
- `FAIL`, `STOPPED`, `Stale`, or `Runtime: error` in governance UI
- `observe` mode when paper or live-limited readiness was expected
- live promotion blocked or rejected
- `runtime_error`, `live_not_allowed`, or `live_health_not_healthy`
- worker heartbeat missing or stale
- public bot healthy while governance or runtime is not

## Fault Domains

Treat these as separate until evidence proves otherwise:

- public bot/web service
- runtime worker / execution service
- private control service
- dashboard / governance surface
- Postgres
- Key Value

Do not flatten them into "the app".

## Phase 0 - Classify the Failure

Start by writing down:

| Item | What to capture |
|---|---|
| Affected service | exact Render service name |
| Service type | web, private service, worker, cron, database, key value |
| Symptom | build/deploy failure, boot failure, crash loop, stale snapshot, policy block, connectivity failure, env/config error |
| User-visible surface | dashboard, control UI, public bot, runtime worker, Render deploy page |
| Time anchor | deploy time, restart time, first visible failure time |

If you cannot classify the service, stop and look at Render service metadata first.

## Phase 1 - Check Render Surfaces First

Inspect in this order:

1. Latest deploy/event history for the affected service.
2. Startup and runtime logs.
3. Restart or redeploy timing correlation.
4. Whether the service is actually running or repeatedly failing after boot.

What to look for:

- build failure before the process starts
- predeploy migration failure
- missing env or malformed env
- port bind failure
- repeated crashes after a successful boot
- worker start that never publishes heartbeat
- private control startup that fails closed on config or auth

## Phase 2 - Separate Web Health from Runtime Health

Important rule:

- A `200` on `bobbyexecute-bot-.../health` proves only the public web surface is alive.
- It does not prove the runtime worker is healthy.
- It does not prove control-plane state is converged.
- It does not prove governance promotion is allowed.

Use the right surface for the right role:

| Role | Primary check |
|---|---|
| Public bot | `/health`, `/kpi/summary`, `/kpi/decisions`, `/kpi/adapters`, `/kpi/metrics` |
| Runtime worker | control runtime status, heartbeat, visibility snapshot, worker logs |
| Private control | `/control/status`, `/control/runtime-config`, `/control/history`, `/control/runtime-status`, `/control/restart-alerts` |
| Dashboard | login/session status and control proxy behavior |
| Postgres / KV | connection or readiness checks from the affected service |

If the bot is healthy but the governance UI shows `FAIL`, `STOPPED`, `Stale`, or `Runtime: error`, treat the runtime/control plane as broken until proven otherwise.

## Phase 3 - Verify Config and Fail-Closed Gates

Check the affected service only:

- required env vars are present
- env vars have the expected names
- env values are non-empty when the code trims them
- JSON envs parse to the expected shape
- Render service wiring matches `render.yaml`
- posture / mode vars match the intended launch state

Common BobbyExecution posture warnings:

- `observe` usually means the system is not in the posture the operator expected
- `live_not_allowed` usually means a policy gate, not an infra outage
- `live_health_not_healthy` usually means the runtime evidence is stale or missing
- `runtime_error` usually means the runtime state or worker health is broken

Fail closed if a required env is missing or malformed.

## Phase 4 - Verify State Backends and Visibility Path

Check:

- Postgres connectivity if runtime status, history, or rehearsal evidence depends on the DB
- Key Value connectivity if a fast overlay or mirror depends on it
- worker heartbeat freshness
- last applied state / requested state convergence
- visibility snapshot write path
- journal or evidence persistence path

Interpretation:

- stale reporting can mean the worker is alive but the visibility path is broken
- stale heartbeat usually means the worker is dead, hung, or isolated
- a healthy control UI can still be reading stale or partial state if the backend path is broken

## Phase 5 - Map Governance Errors to Root Cause

| Governance symptom | Likely cause class | What to inspect next |
|---|---|---|
| `runtime_error` | worker crash, broken applied state, bad config, stale snapshot | worker logs, control runtime status, heartbeat, latest deploy |
| `live_not_allowed` | posture / policy mismatch | current mode, promotion gate, live prerequisites |
| `live_health_not_healthy` | runtime health evidence missing or stale | heartbeat, visibility snapshot, backend connectivity |
| `observe` visible when paper or live was expected | configuration mismatch or promotion not applied | mode configuration, live gate, control history |
| request accepted but not applied | control accepted the request but runtime did not converge | restart/convergence state, worker heartbeat, backend write path |
| request rejected | fail-closed policy or missing prerequisite | gate reasons, config shape, live prerequisites |

Never force promotion past a governance block. Treat the block as a signal until evidence proves it is stale or misreported.

## Phase 6 - Safe Recovery

Choose the smallest action that matches the fault domain:

- redeploy the affected service when the issue is build, boot, or config related
- restart only the worker when the build is healthy and the symptom is a crash loop or stale heartbeat
- correct env or Render wiring when the service is healthy in code but the bound runtime config is wrong
- repair Postgres/KV connectivity before retrying promotions if state backends are down
- stop and escalate when evidence is insufficient or the system is intentionally failing closed

Do not:

- force live promotion through `runtime_error`
- use bot `/health` as proof of runtime readiness
- assume dashboard health implies control or worker health
- restart unrelated services before localizing the fault domain

## Fast Operator Checklist

Use this exact order under time pressure:

1. Identify the failing Render service and its type.
2. Open the latest deploy/event history.
3. Read the latest startup/runtime logs.
4. Compare the symptom against the right surface for that role.
5. Check env/config binding on the affected service only.
6. Check Postgres/KV/heartbeat/state convergence if the symptom is stale or runtime-related.
7. Choose the smallest safe move: redeploy, restart worker, correct env, repair backend, or escalate.

## Decision Matrix

| Symptom | Likely layer | What to inspect | Likely causes | Next action | Escalation threshold |
|---|---|---|---|---|---|
| Public bot `/health` is `200`, but governance shows `FAIL` / `STOPPED` / `Stale` / `Runtime: error` | runtime worker or control plane | control status, runtime-status, heartbeat, worker logs, latest deploy | worker crash, stale snapshot, broken backend write path, failed restart convergence | inspect worker/control first; do not declare the system healthy | escalate if worker logs or backend evidence are absent |
| Render deploy failed before the service starts | deploy/build or predeploy | deploy event history, build logs, predeploy migration logs | build error, migration error, missing env, wrong command, wrong resource wiring | fix the deploy-stage error and redeploy only the affected service | escalate if the deploy log is ambiguous or missing the failing command |
| Service boots then immediately restarts | boot/runtime crash loop | startup log tail, env validation, attached resources | missing config, malformed JSON env, DB/KV connection failure, port bind error | correct config or dependency and redeploy the same service | escalate if restart loop persists after config is corrected |
| Governance UI says `observe` while paper/live readiness was expected | policy/config mismatch | mode config, promotion gate, control history, runtime config | posture not promoted, live disabled, request rejected by fail-closed gate | compare expected posture to actual env/runtime config | escalate if the runtime is healthy but the policy is intentionally blocking |
| Live promotion blocked with `live_not_allowed` | policy block | gate reasons, current mode, live prerequisites | paper/observe posture, missing approval, missing prerequisite | do not override; satisfy the gate or stay non-live | escalate only if the gate should not exist according to repo code |
| Live promotion blocked with `live_health_not_healthy` | stale or broken runtime evidence | heartbeat, runtime status, visibility snapshot, DB/KV | dead worker, stale reporting path, missing evidence write | repair runtime evidence path, then retry promotion | escalate if evidence source cannot be verified |
| Restart alert remains open | convergence or heartbeat issue | `/control/restart-alerts`, `/control/status`, worker logs | worker did not restart, applied version not converged, backend write path broken | restart only the worker or repair the convergence path | escalate if alert remains open after the expected convergence window |
| Dashboard shows auth `configured:false` | dashboard env binding | `DASHBOARD_SESSION_SECRET`, `DASHBOARD_OPERATOR_DIRECTORY_JSON` on dashboard service | env missing, blank, wrong service | fix the dashboard env and redeploy dashboard only | escalate if the live service still reports `configured:false` after redeploy |

## Evidence Collection Template

Use this when writing an incident note or handing off to another operator:

```md
# BobbyExecution Render Incident Evidence Pack

- timestamp:
- environment:
- affected service:
- service type:
- symptom class:
- operator:

## Latest Deploy Evidence

- deploy id:
- deploy time:
- deploy status:
- failing phase:
- last deploy event:

## Runtime / Boot Evidence

- startup log signature:
- crash loop?:
- running after boot?:
- port bind result:
- first error line:

## Env / Config Evidence

- expected env keys:
- missing keys:
- blank keys:
- wrong service binding:
- malformed JSON / shape mismatch:

## Backend / State Evidence

- Postgres status:
- Key Value status:
- worker heartbeat:
- visibility snapshot freshness:
- journal or evidence freshness:

## Governance / UI Evidence

- bot health:
- runtime status:
- control status:
- dashboard auth status:
- gate reasons:
- mode / posture:

## Root Cause Hypothesis

- suspected fault domain:
- why this is the most likely cause:
- what evidence still needs confirmation:

## Safe Next Action

- redeploy:
- restart worker:
- correct env:
- repair backend:
- stop and escalate:

## Decision

- rollback / retry / hold:
- why:
```

## Scenario Reference: Bot Healthy, Runtime Stopped or Stale, Governance Blocked

If the public bot is healthy but the control or dashboard surfaces show `FAIL`, `STOPPED`, `Stale`, `observe`, or `Runtime: error`:

1. Assume the public web surface is not the problem until proven otherwise.
2. Inspect the worker logs and control status first.
3. Check whether the worker heartbeat is missing or only the visibility snapshot is stale.
4. Check whether the runtime is actually dead, or whether only the reporting path is broken.
5. Compare the actual mode and gate reasons against the expected paper/live posture.
6. If the gate reason is `runtime_error` or `live_health_not_healthy`, do not force promotion.
7. If the runtime is alive but reporting is stale, repair the visibility path and re-check the state before any promotion action.

## Safe Recovery Rules

- redeploy the affected service when the failure is build, boot, or config related
- restart only the worker when the build is healthy and the issue is a crash loop or stale heartbeat
- do not promote live while the runtime is unhealthy or stale
- stop and escalate if the logs do not show a clear fault domain
- do not treat a healthy dashboard as proof of worker readiness

