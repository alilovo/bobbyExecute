# BobbyExecution Render Incident Quick Checklist

Use this when you need the shortest safe path through a Render production incident.

## Order

1. Identify the affected Render service.
2. Identify the service role: bot, runtime worker, control, dashboard, Postgres, or KV.
3. Check the latest deploy/event history.
4. Read the latest startup/runtime logs.
5. Compare the symptom to the correct health surface for that role.
6. Check env binding and config shape on the affected service only.
7. Check heartbeat, visibility snapshot freshness, and backend connectivity if the issue is stale or runtime-related.
8. Choose the smallest safe move: redeploy, restart worker, fix env, repair backend, or escalate.

## First Five Checks

- Is the failing service a web service, private service, worker, cron, database, or key value?
- Did the last deploy fail before boot, during boot, or after boot?
- Does the log show missing env, malformed JSON, backend connectivity, or crash loop?
- Is the public bot healthy while the runtime/control plane is broken?
- Is the issue a policy block rather than an infrastructure outage?

## Safe Next Move

- redeploy the affected service when the problem is deploy, boot, or config related
- restart only the worker when the build is healthy and the symptom is stale heartbeat or crash loop
- do not force live promotion past a fail-closed gate
- stop and escalate when the evidence does not isolate the fault domain

