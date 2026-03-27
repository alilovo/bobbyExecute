import { describe, expect, it } from "vitest";
import {
  InMemoryWorkerRestartAlertRepository,
  type WorkerRestartAlertEventRecord,
  type WorkerRestartAlertRecord,
} from "../../src/persistence/worker-restart-alert-repository.js";

const WINDOW_START = "2026-03-27T00:00:00.000Z";
const WINDOW_END = "2026-03-28T00:00:00.000Z";

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
    firstSeenAt: overrides.firstSeenAt ?? WINDOW_START,
    lastSeenAt: overrides.lastSeenAt ?? WINDOW_START,
    lastEvaluatedAt: overrides.lastEvaluatedAt ?? WINDOW_START,
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
    createdAt: overrides.createdAt ?? WINDOW_START,
    updatedAt: overrides.updatedAt ?? WINDOW_START,
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
    createdAt: overrides.createdAt ?? WINDOW_START,
  };
}

async function seedRepository(): Promise<InMemoryWorkerRestartAlertRepository> {
  const repository = new InMemoryWorkerRestartAlertRepository();

  const productionPrimary = buildAlert({
    id: "alert-production-primary",
    environment: "production",
    restartRequestId: "restart-production",
    severity: "critical",
    status: "open",
    summary: "production primary alert",
    targetVersionId: "version-prod",
    requestedVersionId: "version-prod",
    lastRestartRequestStatus: "requested",
    createdAt: "2026-03-27T11:50:00.000Z",
    updatedAt: "2026-03-27T11:50:00.000Z",
  });
  const productionSecondary = buildAlert({
    id: "alert-production-secondary",
    environment: "production",
    restartRequestId: "restart-production-secondary",
    severity: "critical",
    status: "open",
    summary: "production secondary alert",
    targetVersionId: "version-prod",
    requestedVersionId: "version-prod",
    lastRestartRequestStatus: "requested",
    createdAt: "2026-03-27T11:40:00.000Z",
    updatedAt: "2026-03-27T11:40:00.000Z",
  });
  const stagingResolved = buildAlert({
    id: "alert-staging-resolved",
    environment: "staging",
    restartRequestId: "restart-staging",
    severity: "warning",
    status: "resolved",
    summary: "staging suppressed alert",
    targetVersionId: "version-staging",
    requestedVersionId: "version-staging",
    lastRestartRequestStatus: "converged",
    resolvedAt: "2026-03-27T11:30:00.000Z",
    createdAt: "2026-03-27T11:20:00.000Z",
    updatedAt: "2026-03-27T11:30:00.000Z",
  });
  const stagingOpen = buildAlert({
    id: "alert-staging-open",
    environment: "staging",
    restartRequestId: "restart-staging-open",
    severity: "warning",
    status: "open",
    summary: "staging skipped alert",
    targetVersionId: "version-staging",
    requestedVersionId: "version-staging",
    lastRestartRequestStatus: "requested",
    createdAt: "2026-03-27T11:10:00.000Z",
    updatedAt: "2026-03-27T11:10:00.000Z",
  });

  await repository.save(productionPrimary);
  await repository.save(productionSecondary);
  await repository.save(stagingResolved);
  await repository.save(stagingOpen);

  await repository.recordEvent(
    buildEvent({
      id: "event-production-primary",
      environment: "production",
      alertId: productionPrimary.id,
      action: "notification_sent",
      summary: "primary sent",
      notificationSinkName: "restart-alert-webhook",
      notificationSinkType: "generic_webhook",
      notificationDestinationName: "primary",
      notificationDestinationType: "primary",
      notificationFormatterProfile: "generic",
      notificationEventType: "alert_opened",
      notificationStatus: "sent",
      notificationDedupeKey: "dedupe-primary-sent",
      notificationPayloadFingerprint: "payload-primary",
      notificationAttemptCount: 1,
      notificationRouteReason: "critical production alert routed to primary",
      notificationScope: "external",
      createdAt: "2026-03-27T11:50:05.000Z",
    })
  );

  await repository.recordEvent(
    buildEvent({
      id: "event-production-secondary",
      environment: "production",
      alertId: productionSecondary.id,
      action: "notification_failed",
      summary: "secondary failed",
      notificationSinkName: "restart-alert-webhook",
      notificationSinkType: "generic_webhook",
      notificationDestinationName: "secondary",
      notificationDestinationType: "secondary",
      notificationFormatterProfile: "slack",
      notificationEventType: "alert_escalated",
      notificationStatus: "failed",
      notificationDedupeKey: "dedupe-secondary-failed",
      notificationPayloadFingerprint: "payload-secondary",
      notificationAttemptCount: 2,
      notificationFailureReason: "provider responded with 503",
      notificationRouteReason: "secondary escalation target selected",
      notificationResponseStatus: 503,
      notificationScope: "external",
      createdAt: "2026-03-27T11:40:05.000Z",
    })
  );

  await repository.recordEvent(
    buildEvent({
      id: "event-staging-suppressed",
      environment: "staging",
      alertId: stagingResolved.id,
      action: "notification_suppressed",
      summary: "staging suppressed",
      notificationSinkName: "restart-alert-webhook",
      notificationSinkType: "generic_webhook",
      notificationDestinationName: "staging",
      notificationDestinationType: "staging",
      notificationFormatterProfile: "generic",
      notificationEventType: "alert_resolved",
      notificationStatus: "suppressed",
      notificationDedupeKey: "dedupe-staging-suppressed",
      notificationAttemptCount: 1,
      notificationSuppressionReason: "cooldown active",
      notificationRouteReason: "cooldown active for staging",
      notificationScope: "external",
      createdAt: "2026-03-27T11:30:05.000Z",
    })
  );

  await repository.recordEvent(
    buildEvent({
      id: "event-staging-skipped",
      environment: "staging",
      alertId: stagingOpen.id,
      action: "notification_skipped",
      summary: "staging skipped",
      notificationSinkName: "restart-alert-webhook",
      notificationSinkType: "generic_webhook",
      notificationDestinationName: "staging",
      notificationDestinationType: "staging",
      notificationFormatterProfile: "generic",
      notificationEventType: "alert_opened",
      notificationStatus: "skipped",
      notificationDedupeKey: "dedupe-staging-skipped",
      notificationAttemptCount: 1,
      notificationRouteReason: "destination not selected by policy",
      notificationScope: "external",
      createdAt: "2026-03-27T11:10:05.000Z",
    })
  );

  return repository;
}

describe("worker restart delivery reporting", () => {
  it("filters the delivery journal and keeps suppression visible", async () => {
    const repository = await seedRepository();

    const filtered = await repository.listDeliveryJournal({
      environment: "production",
      destinationName: "secondary",
      deliveryStatuses: ["failed"],
      eventTypes: ["alert_escalated"],
      severities: ["critical"],
      windowStartAt: WINDOW_START,
      windowEndAt: WINDOW_END,
      limit: 50,
      offset: 0,
    });

    expect(filtered.totalCount).toBe(1);
    expect(filtered.hasMore).toBe(false);
    expect(filtered.deliveries).toHaveLength(1);
    expect(filtered.deliveries[0]).toMatchObject({
      eventId: "event-production-secondary",
      alertId: "alert-production-secondary",
      environment: "production",
      destinationName: "secondary",
      deliveryStatus: "failed",
      severity: "critical",
      routeReason: "secondary escalation target selected",
      failureReason: "provider responded with 503",
    });

    const suppressed = await repository.listDeliveryJournal({
      environment: "staging",
      deliveryStatuses: ["suppressed"],
      windowStartAt: WINDOW_START,
      windowEndAt: WINDOW_END,
      limit: 50,
      offset: 0,
    });

    expect(suppressed.totalCount).toBe(1);
    expect(suppressed.deliveries[0]).toMatchObject({
      eventId: "event-staging-suppressed",
      deliveryStatus: "suppressed",
      suppressionReason: "cooldown active",
    });
  });

  it("aggregates per-destination delivery summaries and health hints", async () => {
    const repository = await seedRepository();

    const summary = await repository.summarizeDeliveryJournal({
      windowStartAt: WINDOW_START,
      windowEndAt: WINDOW_END,
      limit: 50,
      offset: 0,
    });

    expect(summary.totalCount).toBe(4);
    expect(summary.destinations).toHaveLength(3);
    expect(summary.destinations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          destinationName: "primary",
          sentCount: 1,
          failedCount: 0,
          suppressedCount: 0,
          skippedCount: 0,
          healthHint: "healthy",
          lastSentAt: "2026-03-27T11:50:05.000Z",
        }),
        expect.objectContaining({
          destinationName: "secondary",
          sentCount: 0,
          failedCount: 1,
          suppressedCount: 0,
          skippedCount: 0,
          healthHint: "failing",
          lastFailedAt: "2026-03-27T11:40:05.000Z",
          lastFailureReason: "provider responded with 503",
        }),
        expect.objectContaining({
          destinationName: "staging",
          sentCount: 0,
          failedCount: 0,
          suppressedCount: 1,
          skippedCount: 1,
          healthHint: "idle",
        }),
      ])
    );
  });

  it("returns clean empty results and rejects reversed windows", async () => {
    const repository = await seedRepository();

    const empty = await repository.listDeliveryJournal({
      environment: "qa",
      windowStartAt: WINDOW_START,
      windowEndAt: WINDOW_END,
      limit: 50,
      offset: 0,
    });
    expect(empty.totalCount).toBe(0);
    expect(empty.deliveries).toHaveLength(0);

    await expect(
      repository.listDeliveryJournal({
        windowStartAt: WINDOW_END,
        windowEndAt: WINDOW_START,
        limit: 50,
        offset: 0,
      })
    ).rejects.toThrow("delivery journal window start must be before the end");
  });
});
