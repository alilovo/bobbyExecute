# Default Prompt Script — Render Setup, Validation, and Redeploy

Use this prompt as a starting point when asking Codex to validate environment configuration, complete Render service setup, and execute or prepare a safe redeploy.

---

## Purpose

This prompt is meant for operators and contributors working on the **BobbyExecution** deployment on Render.

It tells Codex to:
- inspect the repo and env files,
- distinguish real boot blockers from optional settings,
- validate per-service readiness,
- choose the correct redeploy order,
- execute redeploys when safe,
- or produce exact manual steps when automation is not possible.

---

## How to Use

1. Copy the prompt block below.
2. Paste it into Codex.
3. Adjust only the few placeholders if needed.
4. Keep secrets in local env files or Render only.
5. Do not paste raw secrets into chat unless rotation is intended.

---

## Default Prompt

```text
You are continuing an in-progress BobbyExecution Render deployment. Do not restart discovery from scratch. Work directly from the repo and the existing validated setup state.

Local repo:
C:\workspace\main_projects\dotBot\bobbyExecute

Primary goal:
Validate the current Render setup, use the keys and configuration already present in local env files where available, and complete a safe redeploy in the correct dependency order.

Critical rules:
- Do not print secrets in full in your final response.
- Do not rotate secrets unless compromise is proven.
- Use existing env values from local files where present.
- If a required value is missing locally, report it explicitly instead of inventing it.
- Separate true blockers from optional feature settings.
- Keep a fail-closed mindset.
- Do not make speculative repo changes.
- Only change repo files if a proven mismatch is found.

Known deployment context you should trust unless code disproves it:
- Production services:
  - bobbyexecute-dashboard-production
  - bobbyexecute-bot-production
  - bobbyexecute-runtime-production
  - bobbyexecute-control-production
  - bobbyexecute-rehearsal-refresh-production
  - bobbyexecute-postgres-production
  - bobbyexecute-kv-production
  - bobbyexecute-postgres-rehearsal-production
- CONTROL_TOKEN is already required and is the key hard boot requirement for the control/dashboard auth pair.
- CONTROL_TOKEN must match exactly between production control and production dashboard.
- The control service has a predeploy migration step and must remain healthy before dashboard/control/operator validation.
- Restart orchestration is optional-by-feature and depends on WORKER_DEPLOY_HOOK_URL if CONTROL_RESTARTS_ENABLED=true.
- External restart-alert webhooks are optional and may remain intentionally unset.

Tasks:
1. Inspect the repo and local env sources.
   At minimum inspect:
   - render.yaml
   - .env
   - .env.local
   - .env.production
   - dashboard env files
   - .env.example
   - bot/package.json
   - dashboard/package.json
   - bot/src/control/run.ts
   - dashboard/src/lib/control-client.ts
   - dashboard/src/lib/operator-auth.ts

2. Build an authoritative per-service env map for production.
   For each production service, determine the exact env values that should be present, using local env files as source of truth where available:
   - bobbyexecute-control-production
   - bobbyexecute-dashboard-production
   - bobbyexecute-bot-production
   - bobbyexecute-runtime-production

3. Classify each variable as one of:
   - required for boot
   - required for deploy success
   - required only by feature
   - intentionally optional

4. Validate minimum production readiness before redeploy.
   Check specifically:
   - control service env completeness
   - dashboard auth env completeness
   - bot public API env completeness
   - runtime worker env completeness
   - control/dashboard CONTROL_TOKEN equality
   - whether restart orchestration is fully wired or should be explicitly disabled

5. Decide the correct redeploy order.
   Default to this unless repo facts prove a better dependency order:
   1. control
   2. bot
   3. runtime
   4. dashboard

6. Trigger the redeploy using the safest available mechanism.
   Preferred order of mechanisms:
   A. Existing service-specific deploy hook URLs if they are already available and clearly mapped
   B. Render API only if RENDER_API_KEY is present and exact service targeting can be done safely
   C. If neither is safely available, stop before execution and produce exact manual deploy instructions

7. Before triggering any deploy:
   - confirm the local repo is on the intended commit/branch
   - confirm build/start commands in render.yaml
   - confirm control predeploy migration expectations
   - confirm that no required env is missing for the target service
   - if any required env is missing, stop and report exactly which one blocks redeploy

8. Execute the production redeploy in the final chosen order.
   For each service:
   - trigger deploy
   - capture whether deploy started successfully
   - if you can poll status safely, do so
   - if a deploy fails, stop the chain and report the exact failing stage
   - do not continue blindly past a failed dependency

9. Post-redeploy verification:
   - control health
   - bot health
   - dashboard availability
   - runtime deploy started / healthy if observable
   - control/dashboard auth consistency
   - restart orchestration readiness if enabled

10. If execution is not possible end-to-end from the local environment:
   produce the exact minimal manual actions in Render, in the correct order, with each service and the exact env/key dependency it needs.

Output format:
1. SUMMARY
- what env sources were found
- whether the redeploy could be automated or only partially automated
- final redeploy order
- whether any blockers were found

2. PRODUCTION ENV MATRIX
Compact table:
- Variable
- Service(s)
- Source file
- Required for boot / deploy / feature
- Status
- Notes

3. REDEPLOY EXECUTION PLAN
Step-by-step:
- service order
- trigger mechanism per service
- why this order was chosen

4. EXECUTION RESULT
For each service:
- attempted? yes/no
- trigger method
- started successfully? yes/no
- final known state
- blocker if any

5. MANUAL FOLLOW-UPS
Only the remaining human actions, if any.

6. FILES CHANGED
- list every file changed and why
- or explicitly:
  None. No repo edits were needed.

7. ACCEPTANCE CHECK
State yes/no with one-line reason for:
- production control ready
- production bot ready
- production runtime ready
- production dashboard ready
- overall production redeploy completed

Safety constraints:
- Redact all secrets, tokens, passwords, hook URLs, API keys, and full JSON operator directories in output.
- It is acceptable to display the last 4 characters of a secret for matching checks only.
- If secrets are missing from local env, do not invent replacements.
- If RENDER_API_KEY or deploy hooks are absent, switch to manual Render instructions instead of forcing automation.

Success criteria:
- The production redeploy order is correct and justified.
- The services are redeployed only when their required env is confirmed.
- Secrets from .env are used safely and never leaked in full.
- The final result is directly usable by an operator without guessing.
```

---

## Recommended Variants

### Variant A — Validation Only
Use this when you want Codex to inspect and prepare, but not trigger deploys.

Add this instruction near the top:

```text
Do not execute deploys. Validate setup only and produce a deployment-ready action plan.
```

### Variant B — Manual Render UI Workflow Only
Use this when deploy hooks or API access are unavailable.

Add this instruction near the top:

```text
Do not use deploy hooks or API-based deploys. Produce manual Render dashboard steps only.
```

### Variant C — Control-Service Failure Investigation
Use this when a specific control deploy failed and you need root cause first.

Add this instruction near the top:

```text
Focus first on bobbyexecute-control-production and reduce any failed deploy to a concrete failing phase before proposing a full redeploy sequence.
```

---

## Operator Notes

- `CONTROL_TOKEN` must match between the dashboard and control service within the same environment.
- `DASHBOARD_SESSION_SECRET` and `DASHBOARD_OPERATOR_DIRECTORY_JSON` are for dashboard auth, not for control-service boot.
- `WORKER_DEPLOY_HOOK_URL` is only needed if restart orchestration is enabled.
- External restart-alert webhook values can remain unset when the feature is intentionally disabled.
- Never reuse secrets that were exposed in chat or logs.

---

## Suggested Repo Placement

Recommended path:

```text
/docs/ops/RENDER_REDEPLOY_DEFAULT_PROMPT.md
```

Alternative:

```text
/RENDER_REDEPLOY_DEFAULT_PROMPT.md
```

---

## Maintenance Guidance

Update this prompt when one of the following changes:
- service names in `render.yaml`
- deploy order dependencies
- auth model between dashboard and control
- migration strategy
- restart orchestration wiring
- Render API / deploy hook usage policy

---

## Short Version

Use the full version above for real work. If someone only needs the intent in one paragraph, use this:

```text
Validate BobbyExecution production Render setup from the repo and local env files, classify required versus optional variables per service, confirm control/dashboard token consistency, choose the correct redeploy order, execute deploys only when all hard requirements are present, redact secrets in output, and otherwise produce exact manual Render actions without guessing.
```

