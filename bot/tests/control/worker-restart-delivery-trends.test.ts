import { describe, expect, it } from "vitest";
import {
  InMemoryWorkerRestartAlertRepository,
  type WorkerRestartAlertEventRecord,
  type WorkerRestartAlertRecord,
} from "../../src/persistence/worker-restart-alert-repository.js";

const REFERENCE_END = "2026-03-28T00:00:00.000Z";
const CURRENT_START = "2026-03-27T00:00:00.000Z";

function buildAlert(overrides: Partial<WorkerRestartAlertRecord>): WorkerRestartAlertRecord {
  return {
    id: overrides.id ?? "alert-default",
    environment: overrides.environment ?? "production",
    dedupeKey: overrides.dedupeKey ?? `request:${overrides.id ?? "default"}`,
    restartRequestId: overrides.restartRequestId,
    workerService: overrides.workerService ?? "runtime-worker",
    targetWorker: overrides.targetWorker,
    targetVersionId: overrides.targetVersionId,
    sourceCategory: overrides.sourceCategory ?? "restart_timeout",
    reasonCode: overrides.reasonCode ?? "restart_timeout",
    severity: overrides.severity ?? "warning",
    status: overrides.status ?? "open",
    summary: overrides.summary ?? "restart alert",
    recommendedAction: overrides.recommendedAction ?? "inspect the worker",
    metadata: overrides.metadata,
    conditionSignature: overrides.conditionSignature ?? `signature-${overrides.id ?? "default"}`,
    occurrenceCount: overrides.occurrenceCount ?? 1,
    firstSeenAt: overrides.firstSeenAt ?? REFERENCE_END,
    lastSeenAt: overrides.lastSeenAt ?? REFERENCE_END,
    lastEvaluatedAt: overrides.lastEvaluatedAt ?? REFERENCE_END,
    acknowledgedAt: overrides.acknowledgedAt,
    acknowledgedBy: overrides.acknowledgedBy,
    acknowledgmentNote: overrides.acknowledgmentNote,
    resolvedAt: overrides.resolvedAt,
    resolvedBy: overrides.resolvedBy,
    resolutionNote: overrides.resolutionNote,
    lastRestartRequestStatus: overrides.lastRestartRequestStatus,
    lastRestartRequestUpdatedAt: overrides.lastRestartRequestUpdatedAt,
    lastWorkerHeartbeatAt: overrides.lastWorkerHeartbeatAt,
    lastAppliedVersionId: overrides.lastAppliedVersionId,
    requestedVersionId: overrides.requestedVersionId,
    notification: overrides.notification,
    createdAt: overrides.createdAt ?? REFERENCE_END,
    updatedAt: overrides.updatedAt ?? REFERENCE_END,
  };
}

function buildEvent(overrides: Partial<WorkerRestartAlertEventRecord>): WorkerRestartAlertEventRecord {
  return {
    id: overrides.id ?? "event-default",
    environment: overrides.environment ?? "production",
    alertId: overrides.alertId ?? "alert-default",
    action: overrides.action ?? "notification_sent",
    actor: overrides.actor ?? "control-plane",
    accepted: overrides.accepted ?? true,
    beforeStatus: overrides.beforeStatus,
    afterStatus: overrides.afterStatus,
    reasonCode: overrides.reasonCode,
    summary: overrides.summary,
    note: overrides.note,
    metadata: overrides.metadata,
    notificationSinkName: overrides.notificationSinkName,
    notificationSinkType: overrides.notificationSinkType,
    notificationDestinationName: overrides.notificationDestinationName,
    notificationDestinationType: overrides.notificationDestinationType,
    notificationFormatterProfile: overrides.notificationFormatterProfile,
    notificationDestinationPriority: overrides.notificationDestinationPriority,
    notificationDestinationTags: overrides.notificationDestinationTags,
    notificationEventType: overrides.notificationEventType,
    notificationStatus: overrides.notificationStatus,
    notificationDedupeKey: overrides.notificationDedupeKey,
    notificationPayloadFingerprint: overrides.notificationPayloadFingerprint,
    notificationAttemptCount: overrides.notificationAttemptCount,
    notificationFailureReason: overrides.notificationFailureReason,
    notificationSuppressionReason: overrides.notificationSuppressionReason,
    notificationRouteReason: overrides.notificationRouteReason,
    notificationResponseStatus: overrides.notificationResponseStatus,
    notificationResponseBody: overrides.notificationResponseBody,
    notificationScope: overrides.notificationScope ?? "external",
    createdAt: overrides.createdAt ?? REFERENCE_END,
  };
}

async function seedRepository(): Promise<InMemoryWorkerRestartAlertRepository> {
  const repository = new InMemoryWorkerRestartAlertRepository();

  const alerts = [
    buildAlert({
      id: "alert-worsening",
      environment: "production",
      severity: "critical",
      status: "open",
      createdAt: "2026-03-24T10:00:00.000Z",
      updatedAt: "2026-03-24T10:00:00.000Z",
    }),
    buildAlert({
      id: "alert-improving",
      environment: "production",
      severity: "critical",
      status: "open",
      createdAt: "2026-03-24T11:00:00.000Z",
      updatedAt: "2026-03-24T11:00:00.000Z",
    }),
    buildAlert({
      id: "alert-stable",
      environment: "production",
      severity: "warning",
      status: "resolved",
      resolvedAt: "2026-03-24T12:00:00.000Z",
      createdAt: "2026-03-24T12:00:00.000Z",
      updatedAt: "2026-03-24T12:00:00.000Z",
    }),
    buildAlert({
      id: "alert-inactive",
      environment: "staging",
      severity: "warning",
      status: "resolved",
      resolvedAt: "2026-03-24T13:00:00.000Z",
      createdAt: "2026-03-24T13:00:00.000Z",
      updatedAt: "2026-03-24T13:00:00.000Z",
    }),
    buildAlert({
      id: "alert-light",
      environment: "production",
      severity: "warning",
      status: "open",
      createdAt: "2026-03-24T14:00:00.000Z",
      updatedAt: "2026-03-24T14:00:00.000Z",
    }),
  ];

  for (const alert of alerts) {
    await repository.save(alert);
  }

  const worseningCurrentTimes = [
    "2026-03-27T10:00:00.000Z",
    "2026-03-27T11:00:00.000Z",
    "2026-03-27T12:00:00.000Z",
  ];
  for (const [index, attemptedAt] of worseningCurrentTimes.entries()) {
    await repository.recordEvent(
      buildEvent({
        id: `event-worsening-current-${index}`,
        environment: "production",
        alertId: "alert-worsening",
        action: "notification_failed",
        notificationSinkName: "restart-alert-webhook",
        notificationSinkType: "generic_webhook",
        notificationDestinationName: "production-worsening",
        notificationDestinationType: "webhook",
        notificationFormatterProfile: "generic",
        notificationEventType: "alert_escalated",
        notificationStatus: "failed",
        notificationAttemptCount: 2,
        notificationFailureReason: "provider responded with 503",
        createdAt: attemptedAt,
      })
    );
  }
  for (let index = 0; index < 9; index += 1) {
    await repository.recordEvent(
      buildEvent({
        id: `event-worsening-history-${index}`,
        environment: "production",
        alertId: "alert-worsening",
        action: index === 8 ? "notification_failed" : "notification_sent",
        notificationSinkName: "restart-alert-webhook",
        notificationSinkType: "generic_webhook",
        notificationDestinationName: "production-worsening",
        notificationDestinationType: "webhook",
        notificationFormatterProfile: "generic",
        notificationEventType: index === 8 ? "alert_escalated" : "alert_opened",
        notificationStatus: index === 8 ? "failed" : "sent",
        notificationAttemptCount: 1,
        notificationFailureReason: index === 8 ? "provider responded with 500" : undefined,
        createdAt: `2026-03-24T0${index}:00:00.000Z`,
      })
    );
  }

  for (let index = 0; index < 4; index += 1) {
    await repository.recordEvent(
      buildEvent({
        id: `event-improving-current-${index}`,
        environment: "production",
        alertId: "alert-improving",
        action: "notification_sent",
        notificationSinkName: "restart-alert-webhook",
        notificationSinkType: "generic_webhook",
        notificationDestinationName: "production-improving",
        notificationDestinationType: "webhook",
        notificationFormatterProfile: "slack",
        notificationEventType: "alert_opened",
        notificationStatus: "sent",
        notificationAttemptCount: 1,
        createdAt: `2026-03-27T13:0${index}:00.000Z`,
      })
    );
  }
  for (let index = 0; index < 8; index += 1) {
    await repository.recordEvent(
      buildEvent({
        id: `event-improving-history-${index}`,
        environment: "production",
        alertId: "alert-improving",
        action: index < 6 ? "notification_failed" : "notification_sent",
        notificationSinkName: "restart-alert-webhook",
        notificationSinkType: "generic_webhook",
        notificationDestinationName: "production-improving",
        notificationDestinationType: "webhook",
        notificationFormatterProfile: "slack",
        notificationEventType: index < 6 ? "alert_escalated" : "alert_opened",
        notificationStatus: index < 6 ? "failed" : "sent",
        notificationAttemptCount: 1,
        notificationFailureReason: index < 6 ? "provider responded with 500" : undefined,
        createdAt: `2026-03-23T1${index}:00:00.000Z`,
      })
    );
  }

  for (let index = 0; index < 4; index += 1) {
    await repository.recordEvent(
      buildEvent({
        id: `event-stable-current-${index}`,
        environment: "production",
        alertId: "alert-stable",
        action: "notification_sent",
        notificationSinkName: "restart-alert-webhook",
        notificationSinkType: "generic_webhook",
        notificationDestinationName: "production-stable",
        notificationDestinationType: "webhook",
        notificationFormatterProfile: "generic",
        notificationEventType: "alert_opened",
        notificationStatus: "sent",
        notificationAttemptCount: 1,
        createdAt: `2026-03-27T15:0${index}:00.000Z`,
      })
    );
  }
  for (let index = 0; index < 28; index += 1) {
    await repository.recordEvent(
      buildEvent({
        id: `event-stable-history-${index}`,
        environment: "production",
        alertId: "alert-stable",
        action: "notification_sent",
        notificationSinkName: "restart-alert-webhook",
        notificationSinkType: "generic_webhook",
        notificationDestinationName: "production-stable",
        notificationDestinationType: "webhook",
        notificationFormatterProfile: "generic",
        notificationEventType: "alert_opened",
        notificationStatus: "sent",
        notificationAttemptCount: 1,
        createdAt: `2026-03-22T12:${String(index).padStart(2, "0")}:00.000Z`,
      })
    );
  }

  for (let index = 0; index < 6; index += 1) {
    await repository.recordEvent(
      buildEvent({
        id: `event-inactive-history-${index}`,
        environment: "staging",
        alertId: "alert-inactive",
        action: "notification_sent",
        notificationSinkName: "restart-alert-webhook",
        notificationSinkType: "generic_webhook",
        notificationDestinationName: "staging-inactive",
        notificationDestinationType: "webhook",
        notificationFormatterProfile: "generic",
        notificationEventType: "alert_opened",
        notificationStatus: "sent",
        notificationAttemptCount: 1,
        createdAt: `2026-03-24T16:0${index}:00.000Z`,
      })
    );
  }

  for (let index = 0; index < 1; index += 1) {
    await repository.recordEvent(
      buildEvent({
        id: `event-light-current-${index}`,
        environment: "production",
        alertId: "alert-light",
        action: "notification_sent",
        notificationSinkName: "restart-alert-webhook",
        notificationSinkType: "generic_webhook",
        notificationDestinationName: "production-light",
        notificationDestinationType: "webhook",
        notificationFormatterProfile: "generic",
        notificationEventType: "alert_opened",
        notificationStatus: "sent",
        notificationAttemptCount: 1,
        createdAt: `2026-03-27T18:0${index}:00.000Z`,
      })
    );
  }
  for (let index = 0; index < 3; index += 1) {
    await repository.recordEvent(
      buildEvent({
        id: `event-light-history-${index}`,
        environment: "production",
        alertId: "alert-light",
        action: "notification_sent",
        notificationSinkName: "restart-alert-webhook",
        notificationSinkType: "generic_webhook",
        notificationDestinationName: "production-light",
        notificationDestinationType: "webhook",
        notificationFormatterProfile: "generic",
        notificationEventType: "alert_opened",
        notificationStatus: "sent",
        notificationAttemptCount: 1,
        createdAt: `2026-03-25T18:0${index}:00.000Z`,
      })
    );
  }

  return repository;
}

describe("worker restart delivery trends", () => {
  it("aggregates 24h and 7d counts and exposes explicit trend hints", async () => {
    const repository = await seedRepository();

    const result = await repository.summarizeDeliveryTrends({
      referenceEndAt: REFERENCE_END,
      limit: 50,
    });

    expect(result.referenceEndAt).toBe(REFERENCE_END);
    expect(result.currentWindowStartAt).toBe(CURRENT_START);
    expect(result.totalCount).toBe(5);
    expect(result.hasMore).toBe(false);

    expect(result.destinations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          destinationName: "production-worsening",
          currentWindow: expect.objectContaining({
            totalCount: 3,
            failedCount: 3,
          }),
          comparisonWindow: expect.objectContaining({
            totalCount: 12,
          }),
          currentHealthHint: "failing",
          trendHint: "worsening",
          recentFailureDelta: 2,
          lastFailedAt: "2026-03-27T12:00:00.000Z",
        }),
        expect.objectContaining({
          destinationName: "production-improving",
          currentWindow: expect.objectContaining({
            totalCount: 4,
            sentCount: 4,
            failedCount: 0,
          }),
          trendHint: "improving",
          currentHealthHint: "healthy",
        }),
        expect.objectContaining({
          destinationName: "production-stable",
          currentWindow: expect.objectContaining({
            totalCount: 4,
            sentCount: 4,
            failedCount: 0,
          }),
          trendHint: "stable",
          currentHealthHint: "healthy",
        }),
        expect.objectContaining({
          destinationName: "staging-inactive",
          currentWindow: expect.objectContaining({
            totalCount: 0,
          }),
          trendHint: "inactive",
          currentHealthHint: "idle",
        }),
        expect.objectContaining({
          destinationName: "production-light",
          trendHint: "insufficient_data",
        }),
      ])
    );
  });

  it("supports bounded environment and destination filters", async () => {
    const repository = await seedRepository();

    const production = await repository.summarizeDeliveryTrends({
      environment: "production",
      referenceEndAt: REFERENCE_END,
      limit: 50,
    });
    expect(production.destinations).toHaveLength(4);
    expect(production.destinations.every((row) => row.destinationName.startsWith("production-"))).toBe(true);

    const destination = await repository.summarizeDeliveryTrends({
      destinationName: "production-improving",
      referenceEndAt: REFERENCE_END,
      limit: 50,
    });
    expect(destination.totalCount).toBe(1);
    expect(destination.destinations).toHaveLength(1);
    expect(destination.destinations[0]).toMatchObject({
      destinationName: "production-improving",
      trendHint: "improving",
    });
  });

  it("returns a clean empty result when no destination matches", async () => {
    const repository = await seedRepository();

    const empty = await repository.summarizeDeliveryTrends({
      environment: "qa",
      referenceEndAt: REFERENCE_END,
      limit: 50,
    });

    expect(empty.totalCount).toBe(0);
    expect(empty.hasMore).toBe(false);
    expect(empty.destinations).toEqual([]);
  });
});
