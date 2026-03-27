/**
 * Fastify HTTP server for Runtime Visibility & Dashboard Bridge (Wave 3 P0).
 * Endpoints: GET /health, GET /kpi/summary, GET /kpi/decisions, GET /kpi/adapters, GET /kpi/metrics
 */
import Fastify from "fastify";
import { healthRoutes } from "./routes/health.js";
import { kpiRoutes } from "./routes/kpi.js";
import { controlRoutes } from "./routes/control.js";
import { operatorRoutes } from "./routes/operator.js";
import type { CircuitBreaker } from "../governance/circuit-breaker.js";
import type { ActionLogger } from "../observability/action-log.js";
import type { KpiRouteDeps } from "./routes/kpi.js";
import type { HealthRouteDeps } from "./routes/health.js";
import type { RuntimeController } from "../runtime/controller.js";
import type { RuntimeSnapshot } from "../runtime/dry-run-runtime.js";
import type { RuntimeConfigManager } from "../runtime/runtime-config-manager.js";

export interface ServerConfig {
  port?: number;
  host?: string;
  dashboardOrigin?: string;
  circuitBreaker?: CircuitBreaker;
  actionLogger?: ActionLogger & { list?: () => import("../observability/action-log.js").ActionLogEntry[] };
  getP95?: (name: string) => number | undefined;
  botStatus?: "running" | "paused" | "stopped";
  getBotStatus?: () => "running" | "paused" | "stopped";
  chaosPassRate?: number;
  riskScore?: number;
  getRuntimeSnapshot?: () => RuntimeSnapshot;
  runtime?: RuntimeController;
  runtimeConfigManager?: RuntimeConfigManager;
  controlAuthToken?: string;
  operatorReadAuthToken?: string;
}

const DEFAULT_PORT = 3333;
const DEFAULT_HOST = "0.0.0.0";
const LOCAL_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
]);

function isAllowedOrigin(origin: string, dashboardOrigin?: string, allowLocalhost = false): boolean {
  if (dashboardOrigin && origin === dashboardOrigin) {
    return true;
  }

  if (!allowLocalhost) {
    return false;
  }

  return LOCAL_ORIGINS.has(origin);
}

/**
 * Create and start the Fastify server.
 * Returns the server instance; call server.close() to stop.
 */
export async function createServer(config: ServerConfig = {}) {
  return createVisibilityServer(config, {
    includeControlRoutes: false,
    includeOperatorRoutes: true,
  });
}

export async function createControlServer(config: ServerConfig = {}) {
  return createVisibilityServer(config, {
    includeControlRoutes: true,
    includeOperatorRoutes: false,
  });
}

async function createVisibilityServer(
  config: ServerConfig,
  options: {
    includeControlRoutes: boolean;
    includeOperatorRoutes: boolean;
  }
) {
  const port = config.port ?? DEFAULT_PORT;
  const host = config.host ?? DEFAULT_HOST;
  const startedAt = Date.now();
  const allowLocalhostOrigins = process.env.NODE_ENV !== "production";

  const fastify = Fastify({ logger: true });
  const allowedHeaders = options.includeControlRoutes
    ? "Content-Type, Authorization, x-control-token, x-operator-token, x-idempotency-key, x-request-id"
    : "Content-Type, Authorization, x-operator-token, x-idempotency-key, x-request-id";
  fastify.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && isAllowedOrigin(origin, config.dashboardOrigin, allowLocalhostOrigins)) {
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Vary", "Origin");
      reply.header("Access-Control-Allow-Credentials", "false");
      reply.header("Access-Control-Allow-Headers", allowedHeaders);
      reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      reply.header("Access-Control-Max-Age", "86400");
    }

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  await fastify.register(healthRoutes({
    circuitBreaker: config.circuitBreaker,
    startedAt,
    getBotStatus: config.getBotStatus,
    getRuntimeSnapshot: config.getRuntimeSnapshot,
  }));

  const kpiDeps: KpiRouteDeps = {
    circuitBreaker: config.circuitBreaker,
    actionLogger: config.actionLogger,
    getP95: config.getP95,
    botStatus: config.botStatus,
    getBotStatus: config.getBotStatus,
    chaosPassRate: config.chaosPassRate,
    riskScore: config.riskScore,
    getRuntimeSnapshot: config.getRuntimeSnapshot,
  };
  await fastify.register(kpiRoutes(kpiDeps));
  if (options.includeControlRoutes) {
    await fastify.register(
      controlRoutes({
        runtime: config.runtime,
        runtimeConfigManager: config.runtimeConfigManager,
        requiredToken: config.controlAuthToken,
      })
    );
  }
  if (options.includeOperatorRoutes) {
    await fastify.register(
      operatorRoutes({
        runtime: config.runtime,
        getRuntimeSnapshot: config.getRuntimeSnapshot,
        requiredToken: config.operatorReadAuthToken,
      })
    );
  }

  await fastify.listen({ port, host });
  return fastify;
}
