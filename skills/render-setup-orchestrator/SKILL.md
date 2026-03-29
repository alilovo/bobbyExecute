---
name: render-setup-orchestrator
description: Design, review, and implement safe Render deployment topologies for repositories or app specs. Use when Codex needs to analyze an app for Render, produce or refine render.yaml Blueprints, define env/secret models, split staging vs production, orchestrate migrations/recovery/cron/workers, write operator runbooks, validate readiness, or review deployment and failure modes.
---

# Render Setup Orchestrator

Use this skill for Render-specific deployment planning, setup, review, or hardening. Prefer this skill when Render is the target platform or when `render.yaml` is part of the task.

## Core Mission

Design a Render-native topology that is reproducible, fail-closed, operator-friendly, staging-first, and production-safe.

## Non-Negotiable Rules

- Treat `render.yaml` as the source of truth.
- Prefer adaptation over rewrite.
- Prefer one coherent topology over many ad hoc services.
- Prefer explicit migration and recovery procedures over implicit boot-time mutation.
- Prefer server-side control and private services over browser-direct privileged flows.
- Prefer Postgres as canonical durable truth when the app already uses it.
- Keep public surface area minimal.
- Fail closed on missing secrets, ambiguous source/target data assumptions, unsafe DB source/target assumptions, or incomplete launch prerequisites.
- Never expose deploy hooks, API keys, or privileged control to browser runtime.
- Never use cron jobs as canonical storage.
- Never use worker disk as shared cross-service truth.
- Never rely on silent schema mutation as the only upgrade model.

## Discovery Checklist

1. Inspect actual entrypoints and runtime split.
2. Identify data stores, background loops, scheduled jobs, control plane, dashboard/admin surface, migration requirements, recovery requirements, auth/secret requirements, and staging vs production needs.
3. Start from existing `render.yaml`, README, deployment docs, env examples, scripts, and operator notes if present.
4. Treat repo-local governance or deployment docs as canonical inputs when they exist.
5. Stop and ask a narrow question if service boundaries, DB source/target, or secret ownership remain ambiguous.

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

## Style

Write in crisp operator language.
Be concrete.
Be fail-closed.
Avoid fluff.
