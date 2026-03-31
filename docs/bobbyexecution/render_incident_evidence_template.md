# BobbyExecution Render Incident Evidence Template

Use this template to capture the minimum evidence needed for incident triage or handoff.

```md
# Incident Evidence Pack

- timestamp:
- environment:
- affected service:
- service role:
- symptom class:
- responder:

## Render Evidence

- latest deploy id:
- latest deploy status:
- latest deploy time:
- latest deploy event:
- failing phase:
- restart timing correlation:

## Logs

- startup log signature:
- runtime log signature:
- first failure line:
- repeated crash line:

## Env / Config

- expected env keys:
- missing env keys:
- blank env keys:
- wrong service binding:
- malformed JSON:
- config posture / mode mismatch:

## State Backends

- Postgres status:
- KV status:
- worker heartbeat:
- visibility snapshot freshness:
- journal freshness:
- evidence freshness:

## Governance / UI

- bot health:
- runtime status:
- control status:
- dashboard auth status:
- gate reasons:
- mode / posture:
- request accepted / rejected / not applied:

## Root Cause

- suspected fault domain:
- strongest evidence:
- remaining unknowns:

## Recovery Decision

- safe next action:
- redeploy / restart / repair / escalate:
- why:
```

