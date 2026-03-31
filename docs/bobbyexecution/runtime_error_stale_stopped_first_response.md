# Runtime Error / Stale / Stopped: First Response

Use this first when `bobbyexecute-runtime-production` is `runtime_error`, `Stale`, or `STOPPED` while the bot and dashboard still look healthy.

1. Confirm the failing service is `bobbyexecute-runtime-production`.
2. Do **not** infer runtime health from `bobbyexecute-bot-production /health`.
3. Open the latest deploy/events for the runtime service.
4. Read the latest runtime startup/crash logs.
5. Classify the failure as one of: boot/config failure, crash loop, stale reporting path, dependency/backend failure, or policy/fail-closed block after boot.
6. Check only runtime env/config that is relevant to this incident.
7. Decide whether the runtime is dead or only invisible/stale.
8. Choose the smallest safe next move.

**Do not**
- Do not force live promotion around governance blocks.
- Do not restart unrelated services first.
- Do not treat dashboard or bot health as proof the runtime is healthy.

**Evidence to capture before action**
- Affected service
- Latest deploy time
- Latest failing log line
- Current runtime role/status
- Whether heartbeat/visibility is missing or the process actually crashed

**Safe next move**
- Redeploy the runtime service for boot/config failures.
- Restart only the runtime service for a clear crash loop.
- Otherwise stop and escalate.
