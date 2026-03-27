/**
 * Runtime control routes.
 */
import type { FastifyPluginAsync } from "fastify";
import { triggerKillSwitch, resetKillSwitch, getKillSwitchState } from "../../governance/kill-switch.js";
import type { RuntimeController } from "../../runtime/controller.js";
import type { RuntimeConfigManager, RuntimeConfigMutationResult, RuntimeConfigHistorySnapshot } from "../../runtime/runtime-config-manager.js";
import type { RuntimeControlResult } from "../../runtime/dry-run-runtime.js";
import { getMicroLiveControlSnapshot } from "../../runtime/live-control.js";
import { buildRuntimeReadiness } from "../runtime-truth.js";
import type { RuntimeReadiness } from "../contracts/kpi.js";
import type {
  RuntimeConfigControlView,
  RuntimeConfigDocument,
  RuntimeConfigStatus,
  RuntimeMode,
} from "../../config/runtime-config-schema.js";

export interface ControlRouteDeps {
  runtime?: RuntimeController;
  runtimeConfigManager?: RuntimeConfigManager;
  requiredToken?: string;
}

export interface ControlResponse {
  success: boolean;
  message: string;
  code?: "control_auth_unconfigured" | "control_auth_invalid" | "runtime_control_unavailable";
  runtimeStatus?: string;
  killSwitch: { halted: boolean; reason?: string; triggeredAt?: string };
  liveControl: import("../../runtime/live-control.js").MicroLiveControlSnapshot;
  readiness?: RuntimeReadiness;
}

export interface RuntimeConfigReadResponse {
  success: true;
  runtimeConfig: RuntimeConfigStatus;
  controlView: RuntimeConfigControlView;
  document: RuntimeConfigDocument;
}

export interface RuntimeConfigStatusResponse {
  success: true;
  runtime?: import("../../runtime/dry-run-runtime.js").RuntimeSnapshot;
  runtimeConfig?: RuntimeConfigStatus;
  controlView?: RuntimeConfigControlView;
  readiness?: RuntimeReadiness;
  killSwitch: { halted: boolean; reason?: string; triggeredAt?: string };
  liveControl: import("../../runtime/live-control.js").MicroLiveControlSnapshot;
}

export interface RuntimeConfigHistoryResponse {
  success: true;
  history: RuntimeConfigHistorySnapshot;
}

export interface RuntimeConfigMutationResponse extends RuntimeConfigMutationResult {
  success: boolean;
  runtimeConfig?: RuntimeConfigStatus;
  controlView?: RuntimeConfigControlView;
  killSwitch: { halted: boolean; reason?: string; triggeredAt?: string };
  liveControl: import("../../runtime/live-control.js").MicroLiveControlSnapshot;
  readiness?: RuntimeReadiness;
}

function toReply(
  result: RuntimeControlResult | null,
  killSwitch = getKillSwitchState(),
  readiness?: RuntimeReadiness
): ControlResponse {
  return {
    success: result?.success ?? true,
    message: result?.message ?? "Control action executed.",
    runtimeStatus: result?.status,
    killSwitch: {
      halted: killSwitch.halted,
      reason: killSwitch.reason,
      triggeredAt: killSwitch.triggeredAt,
    },
    liveControl: getMicroLiveControlSnapshot(),
    readiness,
  };
}

function buildRuntimeConfigReadResponse(manager: RuntimeConfigManager): RuntimeConfigReadResponse {
  return {
    success: true,
    runtimeConfig: manager.getRuntimeConfigStatus(),
    controlView: manager.getRuntimeControlView(),
    document: manager.getRuntimeConfigDocument(),
  };
}

function buildRuntimeConfigStatusResponse(
  runtimeConfigManager: RuntimeConfigManager | undefined,
  runtime?: RuntimeController,
  readiness?: RuntimeReadiness
): RuntimeConfigStatusResponse {
  const runtimeSnapshot = runtime?.getSnapshot();
  const runtimeConfig = runtimeConfigManager?.getRuntimeConfigStatus();
  const controlView = runtimeConfigManager?.getRuntimeControlView();
  return {
    success: true,
    runtime: runtimeSnapshot,
    runtimeConfig,
    controlView,
    readiness,
    killSwitch: getKillSwitchState(),
    liveControl: getMicroLiveControlSnapshot(),
  };
}

function buildMutationResponse(
  result: RuntimeConfigMutationResult,
  runtimeConfigManager: RuntimeConfigManager | undefined,
  readiness?: RuntimeReadiness
): RuntimeConfigMutationResponse {
  return {
    ...result,
    success: result.accepted,
    runtimeConfig: runtimeConfigManager?.getRuntimeConfigStatus(),
    controlView: runtimeConfigManager?.getRuntimeControlView(),
    killSwitch: getKillSwitchState(),
    liveControl: getMicroLiveControlSnapshot(),
    readiness,
  };
}

function buildRuntimeControlMutationResponse(
  action: RuntimeConfigMutationResult["action"],
  runtimeResult: RuntimeControlResult,
  runtimeConfigManager: RuntimeConfigManager,
  readiness?: RuntimeReadiness
): RuntimeConfigMutationResponse {
  const status = runtimeConfigManager.getRuntimeConfigStatus();
  return {
    accepted: runtimeResult.success,
    action,
    message: runtimeResult.message,
    requestedVersionId: status.requestedVersionId,
    appliedVersionId: status.appliedVersionId,
    activeVersionId: status.activeVersionId,
    lastValidVersionId: status.lastValidVersionId,
    pendingApply: status.pendingApply,
    requiresRestart: status.requiresRestart,
    reloadNonce: status.reloadNonce,
    rejectionReason: runtimeResult.success ? undefined : runtimeResult.message,
    status,
    runtimeConfig: status,
    controlView: runtimeConfigManager.getRuntimeControlView(),
    killSwitch: getKillSwitchState(),
    liveControl: getMicroLiveControlSnapshot(),
    readiness,
    success: runtimeResult.success,
  };
}

async function recordAuthFailure(
  runtimeConfigManager: RuntimeConfigManager | undefined,
  action: string,
  reason: string
): Promise<void> {
  if (!runtimeConfigManager) {
    return;
  }

  await runtimeConfigManager.recordAuthFailure({
    actor: "control_api",
    action,
    reason,
  });
}

function readPresentedToken(headers: Record<string, unknown>): string | undefined {
  const controlToken = headers["x-control-token"];
  if (typeof controlToken === "string" && controlToken.length > 0) {
    return controlToken;
  }

  const authorization = headers.authorization;
  if (typeof authorization === "string") {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (match) {
      return match[1];
    }
  }

  return undefined;
}

export function controlRoutes(deps: ControlRouteDeps = {}): FastifyPluginAsync {
  const { runtime, runtimeConfigManager, requiredToken } = deps;

  return async (fastify) => {
    fastify.addHook("preHandler", async (request, reply) => {
      const actionLabel = `${request.method} ${request.url}`;
      if (!requiredToken) {
        void recordAuthFailure(runtimeConfigManager, actionLabel, "control token not configured");
        return reply.status(403).send({
          success: false,
          code: "control_auth_unconfigured",
          message: "Control routes denied: CONTROL_TOKEN is not configured.",
          killSwitch: getKillSwitchState(),
          liveControl: getMicroLiveControlSnapshot(),
        } satisfies ControlResponse);
      }

      const presentedToken = readPresentedToken(request.headers as Record<string, unknown>);
      if (presentedToken !== requiredToken) {
        void recordAuthFailure(runtimeConfigManager, actionLabel, "missing or invalid control authorization");
        return reply.status(403).send({
          success: false,
          code: "control_auth_invalid",
          message: "Control routes denied: missing or invalid control authorization.",
          killSwitch: getKillSwitchState(),
          liveControl: getMicroLiveControlSnapshot(),
        } satisfies ControlResponse);
      }
    });

    fastify.post<{ Reply: ControlResponse }>("/emergency-stop", async (_request, reply) => {
      const readiness = buildRuntimeReadiness(runtime?.getSnapshot());
      if (runtimeConfigManager) {
        const result = await runtimeConfigManager.setKillSwitch({
          action: "trigger",
          actor: "control_api",
          reason: "API emergency-stop",
        });
        if (runtime) {
          const runtimeResult = await runtime.emergencyStop("API emergency-stop");
          if (!runtimeResult.success) {
            return reply.status(409).send({
              success: false,
              message: runtimeResult.message,
              code: "runtime_control_unavailable",
              killSwitch: getKillSwitchState(),
              liveControl: getMicroLiveControlSnapshot(),
              readiness,
            });
          }
        }
        return reply.status(result.accepted ? 200 : 409).send(buildMutationResponse(result, runtimeConfigManager, readiness));
      }

      if (!runtime) {
        triggerKillSwitch("API emergency-stop");
        return reply.status(503).send({
          success: false,
          code: "runtime_control_unavailable",
          message: "Emergency stop triggered kill switch, but runtime control is unavailable so runtime state is unverifiable.",
          killSwitch: getKillSwitchState(),
          liveControl: getMicroLiveControlSnapshot(),
          readiness,
        });
      }
      const runtimeResult = await runtime.emergencyStop("kill_switch_emergency_stop");
      const status = runtimeResult.success ? 200 : 409;
      return reply.status(status).send(toReply(runtimeResult, getKillSwitchState(), readiness));
    });

    fastify.post<{
      Body: { scope?: "soft" | "hard"; reason?: string };
      Reply: ControlResponse | RuntimeConfigMutationResponse;
    }>("/control/pause", async (request, reply) => {
      const readiness = buildRuntimeReadiness(runtime?.getSnapshot());
      const body = (request.body ?? {}) as { scope?: "soft" | "hard"; reason?: string };
      const scope = body.scope ?? "soft";
      const reason = body.reason ?? `${scope} pause`;

      if (runtimeConfigManager) {
        if (runtime) {
          const runtimeStatus = runtime.getStatus();
          if (runtimeStatus === "stopped" || runtimeStatus === "error") {
            return reply.status(409).send({
              success: false,
              message: `Pause unsupported while runtime status=${runtimeStatus}`,
              code: "runtime_control_unavailable",
              killSwitch: getKillSwitchState(),
              liveControl: getMicroLiveControlSnapshot(),
              readiness,
            });
          }
        }

        const result = await runtimeConfigManager.setPause({
          scope,
          actor: "control_api",
          reason,
        });
        if (runtime) {
          const runtimeResult = await runtime.pause(reason);
          if (!runtimeResult.success) {
            return reply.status(409).send({
              success: false,
              message: runtimeResult.message,
              code: "runtime_control_unavailable",
              killSwitch: getKillSwitchState(),
              liveControl: getMicroLiveControlSnapshot(),
              readiness,
            });
          }
        }
        return reply.status(result.accepted ? 200 : 409).send(buildMutationResponse(result, runtimeConfigManager, readiness));
      }

      if (!runtime) {
        return reply.status(501).send({
          success: false,
          code: "runtime_control_unavailable",
          message: "Pause unsupported: runtime control unavailable.",
          killSwitch: getKillSwitchState(),
          liveControl: getMicroLiveControlSnapshot(),
          readiness,
        });
      }
      const result = await runtime.pause(reason);
      const status = result.success ? 200 : 409;
      return reply.status(status).send(toReply(result, getKillSwitchState(), readiness));
    });

    fastify.post<{
      Body: { reason?: string };
      Reply: ControlResponse | RuntimeConfigMutationResponse;
    }>("/control/resume", async (request, reply) => {
      const readiness = buildRuntimeReadiness(runtime?.getSnapshot());
      const body = (request.body ?? {}) as { reason?: string };
      const reason = body.reason ?? "api_resume";

      if (runtimeConfigManager) {
        if (runtime) {
          const runtimeStatus = runtime.getStatus();
          if (runtimeStatus !== "paused") {
            return reply.status(409).send({
              success: false,
              message: `Resume unsupported while runtime status=${runtimeStatus}`,
              code: "runtime_control_unavailable",
              killSwitch: getKillSwitchState(),
              liveControl: getMicroLiveControlSnapshot(),
              readiness,
            });
          }
        }

        const result = await runtimeConfigManager.resume({
          actor: "control_api",
          reason,
        });
        if (runtime) {
          const runtimeResult = await runtime.resume(reason);
          if (!runtimeResult.success) {
            return reply.status(409).send({
              success: false,
              message: runtimeResult.message,
              code: "runtime_control_unavailable",
              killSwitch: getKillSwitchState(),
              liveControl: getMicroLiveControlSnapshot(),
              readiness,
            });
          }
        }
        return reply.status(result.accepted ? 200 : 409).send(buildMutationResponse(result, runtimeConfigManager, readiness));
      }

      if (!runtime) {
        return reply.status(501).send({
          success: false,
          code: "runtime_control_unavailable",
          message: "Resume unsupported: runtime control unavailable.",
          killSwitch: getKillSwitchState(),
          liveControl: getMicroLiveControlSnapshot(),
          readiness,
        });
      }
      const result = await runtime.resume(reason);
      const status = result.success ? 200 : 409;
      return reply.status(status).send(toReply(result, getKillSwitchState(), readiness));
    });

    fastify.post<{ Reply: ControlResponse }>("/control/halt", async (_request, reply) => {
      const readiness = buildRuntimeReadiness(runtime?.getSnapshot());
      if (!runtime) {
        return reply.status(501).send({
          success: false,
          code: "runtime_control_unavailable",
          message: "Halt unsupported: runtime control unavailable.",
          killSwitch: getKillSwitchState(),
          liveControl: getMicroLiveControlSnapshot(),
          readiness,
        });
      }
      const result = await runtime.halt("api_halt");
      return reply.status(200).send(toReply(result, getKillSwitchState(), readiness));
    });

    fastify.post<{ Reply: ControlResponse }>("/control/reset", async (_request, reply) => {
      const readinessBeforeReset = buildRuntimeReadiness(runtime?.getSnapshot());
      if (runtimeConfigManager) {
        const result = await runtimeConfigManager.setKillSwitch({
          action: "reset",
          actor: "control_api",
          reason: "API reset",
        });
        if (runtime) {
          const runtimeResult = await runtime.resetLiveKill("api_reset");
          if (!runtimeResult.success) {
            return reply.status(409).send({
              success: false,
              message: runtimeResult.message,
              runtimeStatus: runtime.getStatus(),
              killSwitch: getKillSwitchState(),
              liveControl: getMicroLiveControlSnapshot(),
              readiness: readinessBeforeReset,
            });
          }
        }
        return reply.status(result.accepted ? 200 : 409).send({
          success: result.accepted,
          message: "Kill switch reset. Live-test round returned to a safe preflighted state until explicit resume.",
          runtimeStatus: runtime?.getStatus(),
          killSwitch: getKillSwitchState(),
          liveControl: getMicroLiveControlSnapshot(),
          readiness: buildRuntimeReadiness(runtime?.getSnapshot()),
        });
      }

      if (runtime) {
        const runtimeResult = await runtime.resetLiveKill("api_reset");
        if (!runtimeResult.success) {
          return reply.status(409).send({
            success: false,
            message: runtimeResult.message,
            runtimeStatus: runtime.getStatus(),
            killSwitch: getKillSwitchState(),
            liveControl: getMicroLiveControlSnapshot(),
            readiness: readinessBeforeReset,
          });
        }
      } else {
        resetKillSwitch();
      }
      return reply.status(200).send({
        success: true,
        message: "Kill switch reset. Live-test round returned to a safe preflighted state until explicit resume.",
        runtimeStatus: runtime?.getStatus(),
        killSwitch: getKillSwitchState(),
        liveControl: getMicroLiveControlSnapshot(),
        readiness: buildRuntimeReadiness(runtime?.getSnapshot()),
      });
    });

    fastify.post<{ Reply: ControlResponse }>("/control/live/arm", async (_request, reply) => {
      const readiness = buildRuntimeReadiness(runtime?.getSnapshot());
      if (!runtime) {
        return reply.status(501).send({
          success: false,
          code: "runtime_control_unavailable",
          message: "Live arm unsupported: runtime control unavailable.",
          killSwitch: getKillSwitchState(),
          liveControl: getMicroLiveControlSnapshot(),
          readiness,
        });
      }
      const result = await runtime.armLive("api_live_arm");
      const status = result.success ? 200 : 409;
      return reply.status(status).send(toReply(result, getKillSwitchState(), readiness));
    });

    fastify.post<{ Reply: ControlResponse }>("/control/live/disarm", async (_request, reply) => {
      const readiness = buildRuntimeReadiness(runtime?.getSnapshot());
      if (!runtime) {
        return reply.status(501).send({
          success: false,
          code: "runtime_control_unavailable",
          message: "Live disarm unsupported: runtime control unavailable.",
          killSwitch: getKillSwitchState(),
          liveControl: getMicroLiveControlSnapshot(),
          readiness,
        });
      }
      const result = await runtime.disarmLive("api_live_disarm");
      return reply.status(200).send(toReply(result, getKillSwitchState(), readiness));
    });

    fastify.get<{ Reply: RuntimeConfigReadResponse | ControlResponse }>("/control/runtime-config", async (_request, reply) => {
      if (!runtimeConfigManager) {
        return reply.status(503).send({
          success: false,
          message: "Runtime config unavailable: manager is not wired.",
          killSwitch: getKillSwitchState(),
          liveControl: getMicroLiveControlSnapshot(),
        });
      }

      return reply.status(200).send(buildRuntimeConfigReadResponse(runtimeConfigManager));
    });

    const buildStatus = () => buildRuntimeConfigStatusResponse(runtimeConfigManager, runtime, buildRuntimeReadiness(runtime?.getSnapshot()));

    fastify.get<{ Reply: RuntimeConfigStatusResponse | ControlResponse }>("/control/status", async (_request, reply) => {
      if (!runtimeConfigManager) {
        return reply.status(503).send({
          success: false,
          message: "Runtime status unavailable: config manager is not wired.",
          killSwitch: getKillSwitchState(),
          liveControl: getMicroLiveControlSnapshot(),
        });
      }

      return reply.status(200).send(buildStatus());
    });

    fastify.get<{ Reply: RuntimeConfigStatusResponse | ControlResponse }>("/control/runtime-status", async (_request, reply) => {
      const readiness = buildRuntimeReadiness(runtime?.getSnapshot());
      if (!runtimeConfigManager) {
        return reply.status(503).send({
          success: false,
          message: "Runtime status unavailable: config manager is not wired.",
          killSwitch: getKillSwitchState(),
          liveControl: getMicroLiveControlSnapshot(),
          readiness,
        });
      }

      return reply.status(200).send(buildRuntimeConfigStatusResponse(runtimeConfigManager, runtime, readiness));
    });

    fastify.get<{ Querystring: { limit?: string }; Reply: RuntimeConfigHistoryResponse | ControlResponse }>(
      "/control/history",
      async (request, reply) => {
        if (!runtimeConfigManager) {
          return reply.status(503).send({
            success: false,
            message: "Runtime config history unavailable: manager is not wired.",
            killSwitch: getKillSwitchState(),
            liveControl: getMicroLiveControlSnapshot(),
          });
        }

        const limit = request.query.limit && /^\d+$/.test(request.query.limit) ? Number.parseInt(request.query.limit, 10) : 50;
        const history = await runtimeConfigManager.getHistory(Math.min(Math.max(limit, 1), 200));
        return reply.status(200).send({ success: true, history });
      }
    );

    fastify.post<{
      Body: { mode: RuntimeMode; reason?: string };
      Reply: RuntimeConfigMutationResponse | ControlResponse;
    }>("/control/mode", async (request, reply) => {
      if (!runtimeConfigManager) {
        return reply.status(503).send({
          success: false,
          message: "Runtime mode control unavailable: manager is not wired.",
          killSwitch: getKillSwitchState(),
          liveControl: getMicroLiveControlSnapshot(),
        });
      }

      const result = await runtimeConfigManager.setMode(request.body.mode, {
        actor: "control_api",
        reason: request.body.reason ?? `mode set to ${request.body.mode}`,
      });
      return reply.status(result.accepted ? 200 : 409).send(buildMutationResponse(result, runtimeConfigManager));
    });

    fastify.post<{
      Body: { action: "trigger" | "reset"; reason?: string; incidentId?: string };
      Reply: RuntimeConfigMutationResponse | ControlResponse;
    }>("/control/kill-switch", async (request, reply) => {
      if (!runtimeConfigManager) {
        return reply.status(503).send({
          success: false,
          message: "Kill switch unavailable: manager is not wired.",
          killSwitch: getKillSwitchState(),
          liveControl: getMicroLiveControlSnapshot(),
        });
      }

      const action = request.body.action;
      const reason =
        request.body.reason ?? (action === "trigger" ? "control_api_kill_switch" : "control_api_reset_kill");
      const readiness = buildRuntimeReadiness(runtime?.getSnapshot());

      if (action === "trigger") {
        if (runtime) {
          const runtimeResult = await runtime.emergencyStop(reason);
          if (!runtimeResult.success) {
            return reply.status(409).send({
              success: false,
              message: runtimeResult.message,
              code: "runtime_control_unavailable",
              killSwitch: getKillSwitchState(),
              liveControl: getMicroLiveControlSnapshot(),
              readiness,
            });
          }
          return reply.status(200).send(
            buildRuntimeControlMutationResponse("kill_switch", runtimeResult, runtimeConfigManager, readiness)
          );
        }

        const mutation = await runtimeConfigManager.setKillSwitch({
          action: "trigger",
          actor: "control_api",
          reason,
        });
        return reply.status(mutation.accepted ? 200 : 409).send(buildMutationResponse(mutation, runtimeConfigManager, readiness));
      }

      if (runtime) {
        const runtimeResult = await runtime.resetLiveKill(reason);
        if (!runtimeResult.success) {
          return reply.status(409).send({
            success: false,
            message: runtimeResult.message,
            code: "runtime_control_unavailable",
            killSwitch: getKillSwitchState(),
            liveControl: getMicroLiveControlSnapshot(),
            readiness,
          });
        }
        return reply.status(200).send(
          buildRuntimeControlMutationResponse("kill_switch", runtimeResult, runtimeConfigManager, readiness)
        );
      }

      const mutation = await runtimeConfigManager.setKillSwitch({
        action: "reset",
        actor: "control_api",
        reason,
      });
      return reply.status(mutation.accepted ? 200 : 409).send(buildMutationResponse(mutation, runtimeConfigManager, readiness));
    });

    fastify.post<{
      Body: { patch: Record<string, unknown>; reason?: string };
      Reply: RuntimeConfigMutationResponse | ControlResponse;
    }>("/control/runtime-config", async (request, reply) => {
      if (!runtimeConfigManager) {
        return reply.status(503).send({
          success: false,
          message: "Runtime config mutation unavailable: manager is not wired.",
          killSwitch: getKillSwitchState(),
          liveControl: getMicroLiveControlSnapshot(),
        });
      }

      const result = await runtimeConfigManager.applyBehaviorPatch({
        patch: request.body.patch as never,
        actor: "control_api",
        reason: request.body.reason ?? "runtime config patch",
      });
      return reply.status(result.accepted ? 200 : 409).send(buildMutationResponse(result, runtimeConfigManager));
    });

    fastify.post<{
      Body: { reason?: string };
      Reply: RuntimeConfigMutationResponse | ControlResponse;
    }>("/control/reload", async (request, reply) => {
      if (!runtimeConfigManager) {
        return reply.status(503).send({
          success: false,
          message: "Reload unavailable: manager is not wired.",
          killSwitch: getKillSwitchState(),
          liveControl: getMicroLiveControlSnapshot(),
        });
      }

      const result = await runtimeConfigManager.reload({
        actor: "control_api",
        reason: request.body.reason ?? "control_api_reload",
      });
      return reply.status(result.accepted ? 200 : 409).send(buildMutationResponse(result, runtimeConfigManager));
    });
  };
}
