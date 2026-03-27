import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryWorkerRestartAlertRepository,
  type WorkerRestartAlertRecord,
} from "../../src/persistence/worker-restart-alert-repository.js";
import type { WorkerRestartNotificationDestinationConfig } from "../../src/control/worker-restart-notification-routing.js";
import {
  WorkerRestartNotificationService,
  createGenericWebhookNotificationSink,
  createStructuredWorkerRestartNotificationSink,
} from "../../src/control/worker-restart-notification-service.js";

function nowIso(): string {
  return new Date().toISOString();
}

function buildAlert(overrides: Partial<WorkerRestartAlertRecord> = {}): WorkerRestartAlertRecord {
  const now = nowIso();
  return {
    id: "alert-1",
    environment: "test",
    dedupeKey: "request:restart-1",
    restartRequestId: "restart-1",
    workerService: "mock-runtime-worker",
    targetWorker: "mock-runtime-worker",
    targetVersionId: "version-1",
    sourceCategory: "convergence_timeout",
    reasonCode: "convergence_timeout",
    severity: "critical",
    status: "open",
    summary: "worker restart has not converged",
    recommendedAction: "inspect the worker restart path",
    metadata: {
      requestedAt: now,
    },
    conditionSignature: "signature-1",
    occurrenceCount: 1,
    firstSeenAt: now,
    lastSeenAt: now,
    lastEvaluatedAt: now,
    lastRestartRequestStatus: "requested",
    lastRestartRequestUpdatedAt: now,
    lastWorkerHeartbeatAt: now,
    lastAppliedVersionId: "version-1",
    requestedVersionId: "version-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function createHarness(options: {
  environment?: string;
  sinks?: ConstructorParameters<typeof WorkerRestartNotificationService>[0]["sinks"];
  destinations?: WorkerRestartNotificationDestinationConfig[];
  cooldownMs?: number;
} = {}) {
  const environment = options.environment ?? "test";
  const alertRepository = new InMemoryWorkerRestartAlertRepository();
  const service = new WorkerRestartNotificationService({
    environment,
    workerServiceName: "mock-runtime-worker",
    alertRepository,
    sinks:
      options.sinks ??
      [createStructuredWorkerRestartNotificationSink(console)],
    destinations: options.destinations,
    notificationCooldownMs: options.cooldownMs ?? 60_000,
    notificationTimeoutMs: 1_000,
    logger: console,
  });
  const alert = await alertRepository.save(buildAlert({ environment }));
  return { alertRepository, service, alert };
}

function buildDestination(
  overrides: Partial<WorkerRestartNotificationDestinationConfig> & Pick<WorkerRestartNotificationDestinationConfig, "name">,
): WorkerRestartNotificationDestinationConfig {
  return {
    slot: (overrides.slot ?? "primary") as WorkerRestartNotificationDestinationConfig["slot"],
    name: overrides.name,
    enabled: overrides.enabled ?? true,
    priority: overrides.priority ?? 10,
    formatterProfile: overrides.formatterProfile ?? "generic",
    url: overrides.url,
    token: overrides.token,
    headerName: overrides.headerName,
    cooldownMs: overrides.cooldownMs ?? 60_000,
    required: overrides.required ?? true,
    recoveryEnabled: overrides.recoveryEnabled ?? true,
    repeatedFailureSummaryEnabled: overrides.repeatedFailureSummaryEnabled ?? false,
    allowWarning: overrides.allowWarning ?? false,
    environmentScope: overrides.environmentScope ?? "production",
    tags: overrides.tags ?? [overrides.name],
    formatterError: overrides.formatterError,
  };
}

describe("worker restart notification service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends external notifications for critical alert openings", async () => {
    const notify = vi.fn().mockResolvedValue({
      status: "sent",
      reason: "delivered",
      responseStatus: 202,
    });
    const { service, alertRepository, alert } = await createHarness({
      sinks: [
        {
          kind: "generic_webhook",
          name: "alert-webhook",
          scope: "external",
          configured: true,
          notify,
        },
      ],
    });

    const summary = await service.dispatch({
      actor: "system",
      alert,
      eventType: "alert_opened",
    });

    expect(notify).toHaveBeenCalledTimes(1);
    expect(summary.externallyNotified).toBe(true);
    expect(summary.latestDeliveryStatus).toBe("sent");

    const events = await alertRepository.listEvents("test", alert.id);
    expect(events.map((event) => event.action)).toContain("notification_sent");
    expect(events[0]?.notificationStatus).toBe("sent");
  });

  it("routes critical production alerts to primary and secondary destinations", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("primary")) {
        return new Response("primary ok", { status: 202 });
      }
      if (url.includes("secondary")) {
        return new Response("secondary ok", { status: 202 });
      }
      return new Response("unexpected", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { service, alertRepository, alert } = await createHarness({
      environment: "production",
      destinations: [
        buildDestination({
          slot: "primary",
          name: "primary",
          url: "https://primary.example.test/webhook",
          priority: 10,
        }),
        buildDestination({
          slot: "secondary",
          name: "secondary",
          url: "https://secondary.example.test/webhook",
          priority: 20,
          repeatedFailureSummaryEnabled: true,
        }),
      ],
    });

    const summary = await service.dispatch({
      actor: "system",
      alert,
      eventType: "alert_opened",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(summary.externallyNotified).toBe(true);
    expect(summary.selectedDestinationNames).toEqual(["primary", "secondary"]);
    expect(summary.destinations.map((destination) => destination.latestDeliveryStatus)).toEqual(["sent", "sent"]);

    const events = await alertRepository.listEvents("production", alert.id);
    expect(events.filter((event) => event.notificationScope === "external").map((event) => event.notificationDestinationName)).toEqual([
      "secondary",
      "primary",
    ]);
  });

  it("skips warning alert openings when policy is local-only", async () => {
    const notify = vi.fn();
    const { service, alertRepository, alert } = await createHarness({
      sinks: [
        {
          kind: "generic_webhook",
          name: "alert-webhook",
          scope: "external",
          configured: true,
          notify,
        },
      ],
    });
    const warningAlert = await alertRepository.save(buildAlert({ severity: "warning" }));

    const summary = await service.dispatch({
      actor: "system",
      alert: warningAlert,
      eventType: "alert_opened",
    });

    expect(notify).not.toHaveBeenCalled();
    expect(summary.externallyNotified).toBe(false);
    expect(summary.latestDeliveryStatus).toBe("skipped");

    const events = await alertRepository.listEvents("test", warningAlert.id);
    expect(events.some((event) => event.notificationStatus === "skipped")).toBe(true);
  });

  it("routes staging critical alerts only to the staging destination", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 202 }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { service, alert } = await createHarness({
      environment: "staging",
      destinations: [
        buildDestination({
          slot: "primary",
          name: "primary",
          url: "https://primary.example.test/webhook",
          environmentScope: "production",
          priority: 10,
        }),
        buildDestination({
          slot: "staging",
          name: "staging",
          url: "https://staging.example.test/webhook",
          environmentScope: "staging",
          priority: 30,
        }),
      ],
    });

    const summary = await service.dispatch({
      actor: "system",
      alert: { ...alert, environment: "staging", severity: "critical" },
      eventType: "alert_opened",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(summary.selectedDestinationNames).toEqual(["primary", "staging"]);
    expect(summary.latestDestinationName).toBe("staging");
    expect(summary.destinations.find((destination) => destination.name === "staging")?.latestDeliveryStatus).toBe("sent");
  });

  it("sends escalation notifications when an alert becomes critical", async () => {
    const notify = vi.fn().mockResolvedValue({
      status: "sent",
      reason: "delivered",
      responseStatus: 202,
    });
    const { service, alert } = await createHarness({
      sinks: [
        {
          kind: "generic_webhook",
          name: "alert-webhook",
          scope: "external",
          configured: true,
          notify,
        },
      ],
    });

    const escalated = await service.dispatch({
      actor: "system",
      alert: { ...alert, severity: "critical" },
      eventType: "alert_escalated",
    });

    expect(notify).toHaveBeenCalledTimes(1);
    expect(escalated.latestDeliveryStatus).toBe("sent");
  });

  it("formats slack-compatible payloads while using generic webhook transport", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain("slack");
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      expect(body.type).toBe("worker_restart_alert");
      expect(typeof body.text).toBe("string");
      expect(Array.isArray(body.blocks)).toBe(true);
      expect(Array.isArray(body.attachments)).toBe(true);
      return new Response("ok", { status: 202 });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { service, alert } = await createHarness({
      environment: "production",
      destinations: [
        buildDestination({
          slot: "primary",
          name: "primary",
          url: "https://slack.example.test/webhook",
          formatterProfile: "slack",
        }),
      ],
    });

    const summary = await service.dispatch({
      actor: "system",
      alert,
      eventType: "alert_opened",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(summary.destinations[0]?.formatterProfile).toBe("slack");
  });

  it("continues fanout when one destination fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("primary")) {
        return new Response("bad gateway", { status: 502 });
      }
      if (url.includes("secondary")) {
        return new Response("ok", { status: 202 });
      }
      return new Response("unexpected", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { service, alert } = await createHarness({
      environment: "production",
      destinations: [
        buildDestination({
          slot: "primary",
          name: "primary",
          url: "https://primary.example.test/webhook",
          priority: 10,
        }),
        buildDestination({
          slot: "secondary",
          name: "secondary",
          url: "https://secondary.example.test/webhook",
          priority: 20,
        }),
      ],
    });

    const summary = await service.dispatch({
      actor: "system",
      alert,
      eventType: "alert_opened",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const primary = summary.destinations.find((destination) => destination.name === "primary");
    const secondary = summary.destinations.find((destination) => destination.name === "secondary");
    expect(primary?.latestDeliveryStatus).toBe("failed");
    expect(secondary?.latestDeliveryStatus).toBe("sent");
    expect(summary.externallyNotified).toBe(true);
  });

  it("suppresses repeated sends inside the cooldown window", async () => {
    const notify = vi.fn().mockResolvedValue({
      status: "sent",
      reason: "delivered",
      responseStatus: 202,
    });
    const { service, alertRepository, alert } = await createHarness({
      cooldownMs: 60 * 60 * 1000,
      sinks: [
        {
          kind: "generic_webhook",
          name: "alert-webhook",
          scope: "external",
          configured: true,
          notify,
        },
      ],
    });

    await service.dispatch({
      actor: "system",
      alert,
      eventType: "alert_opened",
    });
    await service.dispatch({
      actor: "system",
      alert,
      eventType: "alert_opened",
    });

    expect(notify).toHaveBeenCalledTimes(1);
    const events = await alertRepository.listEvents("test", alert.id);
    expect(events.some((event) => event.notificationStatus === "suppressed")).toBe(true);
  });

  it("suppresses repeated sends per destination within the cooldown window", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 202 }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { service, alert } = await createHarness({
      environment: "production",
      cooldownMs: 60 * 60 * 1000,
      destinations: [
        buildDestination({
          slot: "primary",
          name: "primary",
          url: "https://primary.example.test/webhook",
          cooldownMs: 60 * 60 * 1000,
        }),
      ],
    });

    await service.dispatch({
      actor: "system",
      alert,
      eventType: "alert_opened",
    });
    const summary = await service.dispatch({
      actor: "system",
      alert,
      eventType: "alert_opened",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(summary.destinations[0]?.latestDeliveryStatus).toBe("suppressed");
    expect(summary.destinations[0]?.suppressionReason).toMatch(/cooldown/i);
  });

  it("sends a recovery notification when a previously notified critical alert resolves", async () => {
    const notify = vi.fn().mockResolvedValue({
      status: "sent",
      reason: "delivered",
      responseStatus: 202,
    });
    const { service, alert } = await createHarness({
      sinks: [
        {
          kind: "generic_webhook",
          name: "alert-webhook",
          scope: "external",
          configured: true,
          notify,
        },
      ],
    });

    await service.dispatch({
      actor: "system",
      alert,
      eventType: "alert_opened",
    });
    const resolved = await service.dispatch({
      actor: "system",
      alert: { ...alert, status: "resolved", resolvedAt: nowIso() },
      eventType: "alert_resolved",
    });

    expect(notify).toHaveBeenCalledTimes(2);
    expect(resolved.externallyNotified).toBe(true);
    expect(resolved.latestDeliveryStatus).toBe("sent");
    expect(resolved.resolutionNotificationSent).toBe(true);
    expect(resolved.resolutionNotificationAt).toBeDefined();
  });

  it("records per-destination failure when a destination is misconfigured", async () => {
    const { service, alert } = await createHarness({
      environment: "production",
      destinations: [
        buildDestination({
          slot: "primary",
          name: "primary",
          enabled: true,
          url: undefined,
          required: true,
        }),
      ],
    });

    const summary = await service.dispatch({
      actor: "system",
      alert,
      eventType: "alert_opened",
    });

    expect(summary.latestDeliveryStatus).toBe("failed");
    expect(summary.lastFailureReason).toMatch(/missing/i);
    expect(summary.destinations[0]?.latestDeliveryStatus).toBe("failed");
  });

  it("fails closed when webhook config is missing", async () => {
    const { service, alertRepository, alert } = await createHarness({
      sinks: [
        createGenericWebhookNotificationSink({
          name: "alert-webhook",
          required: true,
          timeoutMs: 1000,
        }),
      ],
    });

    const summary = await service.dispatch({
      actor: "system",
      alert,
      eventType: "alert_opened",
    });

    expect(summary.latestDeliveryStatus).toBe("failed");
    expect(summary.lastFailureReason).toMatch(/configured/i);
    const events = await alertRepository.listEvents("test", alert.id);
    expect(events.some((event) => event.notificationStatus === "failed")).toBe(true);
  });

  it("records failed deliveries for non-2xx webhook responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 503,
        text: async () => "service unavailable",
      })) as typeof fetch
    );

    const { service, alertRepository, alert } = await createHarness({
      sinks: [
        createGenericWebhookNotificationSink({
          name: "alert-webhook",
          url: "https://alerts.example.test/webhook",
          token: "secret-token",
          timeoutMs: 1000,
        }),
      ],
    });

    const summary = await service.dispatch({
      actor: "system",
      alert,
      eventType: "alert_opened",
    });

    expect(summary.latestDeliveryStatus).toBe("failed");
    const events = await alertRepository.listEvents("test", alert.id);
    expect(events[0]?.notificationResponseStatus).toBe(503);
    expect(events[0]?.notificationFailureReason).toContain("503");
  });

  it("keeps canonical alert state intact when a sink throws", async () => {
    const { service, alertRepository, alert } = await createHarness({
      sinks: [
        {
          kind: "generic_webhook",
          name: "alert-webhook",
          scope: "external",
          configured: true,
          async notify() {
            throw new Error("boom");
          },
        },
      ],
    });

    const before = await alertRepository.load("test", alert.id);
    const summary = await service.dispatch({
      actor: "system",
      alert,
      eventType: "alert_opened",
    });
    const after = await alertRepository.load("test", alert.id);

    expect(after).toMatchObject(before ?? {});
    expect(summary.latestDeliveryStatus).toBe("failed");
    expect(after).toBeTruthy();
  });
});
