---
name: render-setup-orchestrator
description: Design, review, debug, and implement safe Render deployment topologies for repositories or app specs. Use when Codex needs to analyze an app for Render, produce or refine render.yaml Blueprints, define env/secret models, split staging vs production, orchestrate migrations/recovery/cron/workers, write operator runbooks, validate readiness, triage production incidents, or review deployment and failure modes.
---

# Render Setup Orchestrator

Use this skill for Render-specific deployment planning, setup, review, hardening, or incident triage. Prefer this skill when Render is the target platform or when `render.yaml` is part of the task.

## Core Mission

Design a Render-native topology that is reproducible, fail-closed, operator-friendly, staging-first, and production-safe. When incidents happen, localize the fault domain first instead of treating the repository as one flat application.

## Non-Negotiable Rules

- Treat `render.yaml` as the source of truth.
- Prefer adaptation over rewrite.
- Prefer one coherent topology over many ad hoc services.
- Prefer explicit migration and recovery procedures over implicit boot-time mutation.
- Prefer server-side control and private services over browser-direct privileged flows.
- Prefer Postgres as canonical durable truth when the app already uses it.
- Keep public surface area minimal.
- Fail closed on missing secrets, ambiguous source/target data assumptions, unsafe DB source/target assumptions, or incomplete launch prerequisites.
- Treat Render incident diagnosis as a service-role problem first: web service, private control service, worker, dashboard, Postgres, and Key Value are separate fault domains.
- Never expose deploy hooks, API keys, or privileged control to browser runtime.
- Never use cron jobs as canonical storage.
- Never use worker disk as shared cross-service truth.
- Never rely on silent schema mutation as the only upgrade model.

## BobbyExecution Incident Triage

Use this triage mode when the issue is a production incident, failed deploy, boot failure, crash loop, stale heartbeat, stale snapshot, governance block, dependency outage, or env/config mismatch.

Follow this order:

1. Classify the failure.
   - Identify the affected Render service.
   - Identify the service role: public web, private control, background worker, dashboard, Postgres, or Key Value.
   - Classify the symptom: build/deploy failure, boot failure, runtime crash loop, stale visibility, policy block, dependency failure, or config validation failure.
2. Check Render surfaces first.
   - Inspect the latest deploy/event history for the affected service.
   - Read startup and runtime logs.
   - Correlate restart timing with deploy timing.
   - Confirm whether the service is actually running or repeatedly failing after boot.
3. Separate web health from runtime health.
   - A `200` on the public bot `/health` only proves the web surface is alive.
   - It does not prove the runtime worker, control plane, or governance state is healthy.
   - Governance may block promotion even when the public bot is alive if runtime state is `error`, `stopped`, or `stale`.
4. Verify config and fail-closed gates.
   - Inspect required env presence and shape on the affected service only.
   - Compare paper, observe, live, and live-limited semantics against repo code.
   - Treat `runtime_error`, `live_not_allowed`, and `live_health_not_healthy` as likely fail-closed states until evidence proves otherwise.
5. Verify state backends and the visibility path.
   - Check Postgres if runtime status, history, or rehearsal evidence depends on durable state.
   - Check Key Value if fast overlay or mirror state is expected.
   - Check worker heartbeat and visibility snapshot freshness before blaming the dashboard.
   - Distinguish a dead worker from stale reporting.
6. Map governance errors to root cause.
   - `runtime_error` usually means the runtime or its applied state is broken, not just the bot web service.
   - `live_not_allowed` usually means a policy gate or posture mismatch, not an infrastructure outage.
   - `live_health_not_healthy` usually means missing or stale runtime evidence, not a browser problem.
7. Choose the safest recovery path.
   - Redeploy only the affected service when the issue is build, boot, or config related.
   - Restart only the worker when the build is healthy and the issue is a crash loop or stale heartbeat.
   - Stop and escalate when evidence is insufficient or a backend dependency is down.
   - Never force promotion past a fail-closed governance gate.

Reference playbooks:

- [`docs/bobbyexecution/render_incident_triage_playbook.md`](../../docs/bobbyexecution/render_incident_triage_playbook.md)
- [`docs/bobbyexecution/render_incident_quick_checklist.md`](../../docs/bobbyexecution/render_incident_quick_checklist.md)
- [`docs/bobbyexecution/render_incident_evidence_template.md`](../../docs/bobbyexecution/render_incident_evidence_template.md)

## Discovery Checklist

1. Inspect actual entrypoints and runtime split.
2. Identify data stores, background loops, scheduled jobs, control plane, dashboard/admin surface, migration requirements, recovery requirements, auth/secret requirements, and staging vs production needs.
3. Start from existing `render.yaml`, README, deployment docs, env examples, scripts, and operator notes if present.
4. Treat repo-local governance or deployment docs as canonical inputs when they exist.
5. Stop and ask a narrow question if service boundaries, DB source/target, or secret ownership remain ambiguous.
6. For incidents, prefer runtime and Render logs over dashboard impressions, and always confirm the service role before diagnosing the symptom.

## Working Sequence

1. Gather facts from the repo or app spec.
2. Infer the service split and public/private boundaries.
3. Draft the Render Blueprint topology.
4. Model secrets, env groups, and browser-visible values.
5. Specify deployment, migration, and recovery flows.
6. Validate the result against the checklist and surface blockers.

## Render Decision Rules

- Map public HTTP app/API to a web service.
- Map internal port-bound services that receive private traffic to a private service.
- Map continuous loops with no inbound traffic to a background worker.
- Map scheduled checks, rehearsal jobs, cleanup jobs, or refresh jobs to a cron job.
- Map canonical relational state to Postgres.
- Map fast transient overlay or signal state to Key Value.
- Attach persistent disk only to the service that truly owns those files.
- Treat cron jobs as diskless.
- Treat background workers as unreachable over the private network.
- Require private services to bind a port.

## Required Output

When asked to design or review a Render setup, return these sections in order:

1. `EXECUTIVE SUMMARY`
- State the recommended Render topology and why it fits the workload.

2. `SERVICE TOPOLOGY`
- List each service.
- Include name, Render service type, purpose, public/private/internal role, persistent disk need, and dependent resources.

3. `RENDER BLUEPRINT PLAN`
- Define the intended `render.yaml` structure.
- Cover services, databases, key value, cron jobs, env groups, key fields, and deploy/restart assumptions.

4. `SECRET / ENV MODEL`
- Split required secrets, shared env group values, service-specific env vars, values that must never be browser-visible, and values safe for public frontend exposure.

5. `DEPLOYMENT FLOW`
- Define staging deploy order, validation steps, production promotion order, rollback flow, restart strategy, and any deploy hook or API usage that is actually justified.

6. `DATA / MIGRATION / RECOVERY`
- Define migration runner expectations, schema readiness rules, backup/restore expectations, worker-disk classification, cron/job DB safety rules, and rehearsal/restore validation flow.

7. `OPERATOR SURFACES`
- Define what the public app exposes, what the dashboard/admin UI exposes, what must be server-side proxied, what the control plane owns, and what roles/operators can do.

8. `VALIDATION CHECKLIST`
- Include build, lint, tests, staging auth check, private control check, DB readiness check, restore/rehearsal check, cron/job check, and promotion gate check.

9. `FAILURE MODES`
- List missing secrets, wrong service type, stale cron evidence, failed migrations, bad recovery state, private/public boundary mistakes, dashboard auth gaps, and deploy drift risks.

10. `FINAL RECOMMENDATION`
- End with the minimum safe path to staging, the minimum safe path to controlled production, and the top remaining blockers if any.

## Implementation Mode

When the user asks you to implement the setup, produce concrete artifacts:
- `render.yaml`
- env var matrix
- operator runbook
- staging checklist
- production checklist
- migration/recovery checklist
- deploy-hook or API orchestration spec only if it is needed

Implement by reconciling the repo’s actual entrypoints and docs with the Render rules above. Do not invent missing infrastructure. If a prerequisite is missing, report the blocker instead of silently filling the gap.

## Review Mode

When the user asks for a review or audit, prioritize correctness and launch realism.
- Call out deployment realism issues first.
- List blockers before minor recommendations.
- State the launch verdict clearly.
- Finish with the exact next wave of work.
- Separate production blockers from staging-only gaps.

## Incident Review Mode

When the user asks about an incident or production failure:

- identify the fault domain before proposing a fix
- state whether the failure is deploy, boot, crash loop, stale reporting, policy block, backend outage, or a combination
- show the evidence chain that proves the diagnosis
- distinguish healthy web surfaces from unhealthy runtime/control surfaces
- recommend the safest next action only after evidence is sufficient

## Style

Write in crisp operator language.
Be concrete.
Be fail-closed.
Avoid fluff.
