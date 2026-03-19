/**
 * M10: Health check - adapter breaker status.
 */
import type { CircuitBreaker } from "../governance/circuit-breaker.js";
import type { RuntimeSnapshot } from "../runtime/dry-run-runtime.js";

export type HealthStatus = "OK" | "DEGRADED" | "FAIL";

export interface HealthReport {
  status: HealthStatus;
  adapters: { id: string; healthy: boolean }[];
  lastChecked: string;
}

export function checkHealth(circuitBreaker?: CircuitBreaker, runtime?: RuntimeSnapshot): HealthReport {
  const now = new Date().toISOString();
  const runtimeAdapterDegraded =
    runtime?.adapterHealth?.degraded === true || (runtime?.adapterHealth?.unhealthy ?? 0) > 0;
  const runtimeLiveBlocked =
    runtime?.liveControl?.posture === "live_blocked" ||
    runtime?.liveControl?.rolloutPosture === "paper_only" ||
    runtime?.liveControl?.rolloutPosture === "paused_or_rolled_back";
  const runtimeManualReviewRequired =
    runtime?.status === "error" || runtime?.liveControl?.rolloutConfigValid === false;
  if (!circuitBreaker) {
    return {
      status: runtimeManualReviewRequired
        ? "FAIL"
        : runtime?.degradedState?.active || runtimeAdapterDegraded || runtimeLiveBlocked
          ? "DEGRADED"
          : "OK",
      adapters: [],
      lastChecked: now,
    };
  }

  const health = circuitBreaker.getHealth();
  const adapters = health.map((h) => ({ id: h.adapterId, healthy: h.healthy }));
  const unhealthyCount = adapters.filter((adapter) => !adapter.healthy).length;
  const allUnhealthy = adapters.length > 0 && unhealthyCount === adapters.length;
  const runtimeFailed = runtime?.status === "error";
  const runtimeDegraded = runtime?.degradedState?.active === true;

  const status: HealthStatus = runtimeFailed || allUnhealthy || runtimeManualReviewRequired
    ? "FAIL"
    : unhealthyCount > 0 || runtimeDegraded || runtimeAdapterDegraded || runtimeLiveBlocked
      ? "DEGRADED"
      : "OK";

  return { status, adapters, lastChecked: now };
}
