/**
 * M10: Health check - adapter breaker status.
 */
import type { CircuitBreaker } from "../governance/circuit-breaker.js";

export type HealthStatus = "OK" | "DEGRADED" | "FAIL";

export interface HealthReport {
  status: HealthStatus;
  adapters: { id: string; healthy: boolean }[];
  lastChecked: string;
}

export function checkHealth(circuitBreaker?: CircuitBreaker): HealthReport {
  const now = new Date().toISOString();
  if (!circuitBreaker) {
    return { status: "OK", adapters: [], lastChecked: now };
  }
  const health = circuitBreaker.getHealth();
  const adapters = health.map((h) => ({ id: h.adapterId, healthy: h.healthy }));
  const anyUnhealthy = adapters.some((a) => !a.healthy);
  const status: HealthStatus = anyUnhealthy ? "FAIL" : "OK";
  return { status, adapters, lastChecked: now };
}
