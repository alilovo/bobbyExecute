/**
 * Private control-plane entry point.
 * Runs the authenticated runtime mutation surface without starting the bot loop.
 */
import { loadConfig } from "../config/load-config.js";
import { createControlServer } from "../server/index.js";
import { RuntimeConfigManager } from "../runtime/runtime-config-manager.js";

const entryConfig = loadConfig();
if (!entryConfig.controlToken) {
  throw new Error("CONTROL_TOKEN is required for the private control service.");
}

const port = parseInt(process.env.PORT ?? "3334", 10);
const host = process.env.HOST ?? "0.0.0.0";
const runtimeConfigEnvironment =
  process.env.RUNTIME_CONFIG_ENV?.trim() ?? process.env.RENDER_SERVICE_NAME?.trim() ?? entryConfig.nodeEnv;

console.log(
  "[control] Starting BobbyExecute control plane",
  JSON.stringify({
    nodeEnv: entryConfig.nodeEnv,
    controlPlaneEnvironment: runtimeConfigEnvironment,
    safetyPosture: "fail-closed",
  })
);

RuntimeConfigManager.create(entryConfig, {
  environment: runtimeConfigEnvironment,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  env: process.env,
  bootstrapActor: "control-bootstrap",
})
  .then(async (runtimeConfigManager) => {
    await runtimeConfigManager.initialize();
    const server = await createControlServer({
      port,
      host,
      dashboardOrigin: process.env.DASHBOARD_ORIGIN,
      runtimeConfigManager,
      controlAuthToken: entryConfig.controlToken,
      operatorReadAuthToken: entryConfig.operatorReadToken,
    });

    const address = server.server.address();
    const bound =
      typeof address === "object" && address !== null && "address" in address
        ? `${String(address.address)}:${String(address.port)}`
        : `${host}:${port}`;
    console.log(`[control] Control plane listening on ${bound}`);
    console.log("Endpoints: GET /health, GET /kpi/summary, GET /control/status, GET /control/runtime-config, GET /control/history");

    const shutdown = async () => {
      await server.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  })
  .catch((error) => {
    console.error("[control] Control plane failed:", error);
    process.exit(1);
  });
