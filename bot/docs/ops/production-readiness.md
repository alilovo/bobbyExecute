# Production Readiness Runbook

This runbook matches the code in `src/` and the canonical operator surfaces.

## Safe defaults

- Paper mode is the safest startup path.
- Live mode requires validated startup config and explicit operator control.
- Rollout posture must be explicit. `paper_only`, `micro_live`, `staged_live_candidate`, and `paused_or_rolled_back` are the supported values.
- Missing or invalid live prerequisites fail closed.

## Canonical truth surfaces

- `GET /health`
- `GET /runtime/status`
- `GET /runtime/cycles`
- `GET /runtime/cycles/:traceId/replay`
- `GET /incidents`
- `GET /kpi/summary`
- `GET /kpi/decisions`
- `GET /kpi/adapters`
- `GET /kpi/metrics`

## Canonical control routes

- `POST /control/pause`
- `POST /control/resume`
- `POST /control/halt`
- `POST /control/reset`
- `POST /control/live/arm`
- `POST /control/live/disarm`
- `POST /emergency-stop`

## Readiness interpretation

- `healthy_for_posture` means the current posture is consistent and live eligibility is not blocked.
- `degraded_but_safe_in_paper` means paper mode can continue, but live should stay disabled until the blockers clear.
- `blocked_for_live` means live arming is not allowed right now.
- `manual_review_required` means startup or runtime state needs operator review before live can be trusted again.

The `readiness` object now includes:

- rollout posture
- whether rollout config is valid
- whether micro-live arming is currently allowed
- whether staged-live-candidate conditions are met
- a bounded list of blockers

## Preflight deployment review

1. Check `GET /health`.
2. Check `GET /runtime/status`.
3. Check `GET /kpi/summary`.
4. Confirm rollout posture, readiness class, and blocker list.
5. Confirm incident history and recent control actions if anything looks degraded.

## Paper startup

1. Start the service with paper-safe config.
2. Verify `GET /health` reports paper-safe runtime truth.
3. Verify `GET /runtime/status` and `GET /kpi/summary` match the same posture.
4. Do not arm live unless the readiness object says micro-live arming is allowed.

## Micro-live arming checklist

1. Confirm rollout posture is `micro_live` or `staged_live_candidate`.
2. Confirm readiness says `canArmMicroLive: true`.
3. Confirm no active kill switch.
4. Confirm no manual-review blocker.
5. Confirm recent incidents do not show unresolved live refusal or dependency degradation.
6. Call `POST /control/live/arm`.
7. Re-check `GET /health` and `GET /runtime/status`.

## Disarm, kill, reset

- Use `POST /control/live/disarm` to return to disarmed micro-live posture.
- Use `POST /emergency-stop` for immediate kill and runtime pause.
- Use `POST /control/reset` to clear kill-switch state.
- After reset, the runtime stays disarmed until explicit re-arm.

## Blocked-state investigation

1. Read the latest incident list from `GET /incidents`.
2. Check `GET /runtime/status` for the current blocker summary.
3. Check `GET /kpi/summary` for recent control and readiness signals.
4. If the blocker is `manual_review_required`, do not re-arm until the underlying issue is addressed.

## Rollback and paused posture

- `paused_or_rolled_back` blocks new live attempts.
- A paused or rolled-back posture stays operator-visible in readiness and health.
- Recovery should be manual and auditable. Do not assume automatic re-promotion.

## Incident review workflow

1. Use `GET /incidents` for recent canonical incident evidence.
2. Use `GET /runtime/cycles/:traceId/replay` for end-to-end attempt evidence.
3. Use `GET /kpi/summary` and `GET /kpi/decisions` for recent control posture and refusal distribution.
4. Review `GET /kpi/metrics` and `GET /kpi/adapters` for dependency health.

## Handoff checklist

1. Confirm current rollout posture.
2. Confirm readiness class.
3. Confirm last control action and last posture transition.
4. Confirm recent incidents are understood.
5. Confirm whether the next operator should keep paper mode, arm micro-live, or maintain rollback/paused posture.

