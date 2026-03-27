/**
 * App bootstrap - config load, runtime selection, server start.
 * Fail-closed: exits on config validation failure.
 */
import { loadConfig } from "./config/load-config.js";
import { createServer } from "./server/index.js";
import { createRuntime, type RuntimeDeps } from "./runtime/create-runtime.js";
import { getKillSwitchState } from "./governance/kill-switch.js";
import type { RuntimeController } from "./runtime/controller.js";
import type { Config } from "./config/config-schema.js";
import { createDecisionCoordinator } from "./core/decision/index.js";
import { RuntimeConfigManager } from "./runtime/runtime-config-manager.js";

/**
 * Bootstrap the application: validate config, start runtime, start server.
 */
export async function bootstrap(options?: {
  port?: number;
  host?: string;
  runtimeDeps?: RuntimeDeps;
}): Promise<{
  server: Awaited<ReturnType<typeof createServer>>;
  runtime: RuntimeController;
}> {
  const config = loadConfig();
  const port = options?.port ?? parseInt(process.env.PORT ?? "3333", 10);
  const host = options?.host ?? process.env.HOST ?? "0.0.0.0";
  const runtimeDeps: RuntimeDeps = options?.runtimeDeps ?? {};
  const runtimeConfigManager =
    runtimeDeps.runtimeConfigManager ??
    (await RuntimeConfigManager.create(config, {
      environment: process.env.RUNTIME_CONFIG_ENV?.trim() ?? process.env.RENDER_SERVICE_NAME?.trim() ?? config.nodeEnv,
      databaseUrl: process.env.DATABASE_URL,
      redisUrl: process.env.REDIS_URL,
      env: process.env,
      bootstrapActor: "bootstrap",
    }));
  await runtimeConfigManager.initialize();
  const runtime = await createRuntime(config, {
    ...runtimeDeps,
    runtimeConfigManager,
    decisionCoordinator: runtimeDeps.decisionCoordinator ?? createDecisionCoordinator(),
  });

  console.info(
    "[bootstrap] Starting BobbyExecution runtime",
    JSON.stringify({
      executionMode: config.executionMode,
      rpcMode: config.rpcMode,
      tradingEnabled: config.tradingEnabled,
      safetyPosture: "fail-closed",
      runtimePolicyAuthority: config.runtimePolicyAuthority,
    })
  );

  await runtime.start();

  const getRuntimeSnapshot = () => runtime.getSnapshot();
  const getBotStatus = (): "running" | "paused" | "stopped" => {
    if (getKillSwitchState().halted) return "paused";
    const runtimeStatus = runtime.getStatus();
    if (runtimeStatus === "running") return "running";
    if (runtimeStatus === "paused") return "paused";
    return "stopped";
  };

  let server: Awaited<ReturnType<typeof createServer>>;
  try {
    server = await createServer({
      port,
      host,
      getBotStatus,
      getRuntimeSnapshot,
      runtimeConfigManager,
      runtime,
      controlAuthToken: config.controlToken,
      operatorReadAuthToken: config.operatorReadToken,
      dashboardOrigin: config.dashboardOrigin,
    });
  } catch (error) {
    await runtime.stop();
    throw error;
  }

  return { server, runtime };
}
