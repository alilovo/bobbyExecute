import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { WorkerRestartRecordStatus } from "./worker-restart-repository.js";

export type WorkerRestartAlertSeverity = "info" | "warning" | "critical";
export type WorkerRestartAlertStatus = "open" | "acknowledged" | "resolved";
export type WorkerRestartAlertSourceCategory =
  | "orchestration_failure"
  | "restart_timeout"
  | "missing_worker_heartbeat"
  | "applied_version_stalled"
  | "repeated_restart_failures"
  | "convergence_timeout";
export type WorkerRestartAlertNotificationEventType =
  | "alert_opened"
  | "alert_escalated"
  | "alert_acknowledged"
  | "alert_resolved"
  | "alert_repeated_failure_summary";
export type WorkerRestartAlertNotificationStatus = "pending" | "sent" | "skipped" | "suppressed" | "failed";

export interface WorkerRestartAlertNotificationDestinationSummary {
  name: string;
  sinkType?: string;
  formatterProfile?: string;
  priority?: number;
  selected: boolean;
  latestDeliveryStatus?: WorkerRestartAlertNotificationStatus;
  attemptCount: number;
  lastAttemptedAt?: string;
  lastFailureReason?: string;
  suppressionReason?: string;
  routeReason?: string;
  dedupeKey?: string;
  payloadFingerprint?: string;
  recoveryNotificationSent?: boolean;
  recoveryNotificationAt?: string;
}

export interface WorkerRestartAlertNotificationSummary {
  externallyNotified: boolean;
  sinkName?: string;
  sinkType?: string;
  latestDestinationName?: string;
  latestDestinationType?: string;
  latestFormatterProfile?: string;
  eventType?: WorkerRestartAlertNotificationEventType;
  latestDeliveryStatus?: WorkerRestartAlertNotificationStatus;
  attemptCount: number;
  lastAttemptedAt?: string;
  lastFailureReason?: string;
  suppressionReason?: string;
  dedupeKey?: string;
  payloadFingerprint?: string;
  resolutionNotificationSent?: boolean;
  resolutionNotificationAt?: string;
  selectedDestinationCount: number;
  selectedDestinationNames: string[];
  destinations: WorkerRestartAlertNotificationDestinationSummary[];
}

export type WorkerRestartAlertEventAction =
  | "opened"
  | "updated"
  | "escalated"
  | "reopened"
  | "acknowledged"
  | "acknowledge_rejected"
  | "resolved"
  | "resolve_rejected"
  | "notification_sent"
  | "notification_skipped"
  | "notification_suppressed"
  | "notification_failed";

export interface WorkerRestartAlertRecord {
  id: string;
  environment: string;
  dedupeKey: string;
  restartRequestId?: string;
  workerService: string;
  targetWorker?: string;
  targetVersionId?: string;
  sourceCategory: WorkerRestartAlertSourceCategory;
  reasonCode: string;
  severity: WorkerRestartAlertSeverity;
  status: WorkerRestartAlertStatus;
  summary: string;
  recommendedAction: string;
  metadata?: Record<string, unknown>;
  conditionSignature: string;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  lastEvaluatedAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  acknowledgmentNote?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  lastRestartRequestStatus?: WorkerRestartRecordStatus;
  lastRestartRequestUpdatedAt?: string;
  lastWorkerHeartbeatAt?: string;
  lastAppliedVersionId?: string;
  requestedVersionId?: string;
  notification?: WorkerRestartAlertNotificationSummary;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerRestartAlertEventRecord {
  id: string;
  environment: string;
  alertId: string;
  action: WorkerRestartAlertEventAction;
  actor: string;
  accepted: boolean;
  beforeStatus?: WorkerRestartAlertStatus;
  afterStatus?: WorkerRestartAlertStatus;
  reasonCode?: string;
  summary?: string;
  note?: string;
  metadata?: Record<string, unknown>;
  notificationSinkName?: string;
  notificationSinkType?: string;
  notificationDestinationName?: string;
  notificationDestinationType?: string;
  notificationFormatterProfile?: string;
  notificationDestinationPriority?: number;
  notificationDestinationTags?: string[];
  notificationEventType?: WorkerRestartAlertNotificationEventType;
  notificationStatus?: WorkerRestartAlertNotificationStatus;
  notificationDedupeKey?: string;
  notificationPayloadFingerprint?: string;
  notificationAttemptCount?: number;
  notificationFailureReason?: string;
  notificationSuppressionReason?: string;
  notificationRouteReason?: string;
  notificationResponseStatus?: number;
  notificationResponseBody?: string;
  notificationScope?: "internal" | "external";
  createdAt: string;
}

export interface WorkerRestartDeliveryJournalFilters {
  environment?: string;
  destinationName?: string;
  deliveryStatuses?: WorkerRestartAlertNotificationStatus[];
  eventTypes?: WorkerRestartAlertNotificationEventType[];
  severities?: WorkerRestartAlertSeverity[];
  alertId?: string;
  restartRequestId?: string;
  formatterProfile?: string;
  windowStartAt: string;
  windowEndAt: string;
  limit: number;
  offset: number;
}

export interface WorkerRestartDeliveryJournalRow {
  eventId: string;
  alertId: string;
  restartRequestId?: string;
  environment: string;
  destinationName?: string;
  destinationType?: string;
  sinkType?: string;
  formatterProfile?: string;
  eventType?: WorkerRestartAlertNotificationEventType;
  deliveryStatus?: WorkerRestartAlertNotificationStatus;
  severity?: WorkerRestartAlertSeverity;
  alertStatus?: WorkerRestartAlertStatus;
  sourceCategory?: WorkerRestartAlertSourceCategory;
  routeReason?: string;
  dedupeKey?: string;
  payloadFingerprint?: string;
  attemptedAt: string;
  attemptCount?: number;
  failureReason?: string;
  suppressionReason?: string;
  summary?: string;
}

export interface WorkerRestartDeliveryJournalResult {
  windowStartAt: string;
  windowEndAt: string;
  limit: number;
  offset: number;
  totalCount: number;
  hasMore: boolean;
  deliveries: WorkerRestartDeliveryJournalRow[];
}

export type WorkerRestartDeliveryHealthHint = "healthy" | "degraded" | "failing" | "idle" | "unknown";

export interface WorkerRestartDeliverySummaryRow {
  destinationName: string;
  destinationType?: string;
  sinkType?: string;
  formatterProfile?: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  suppressedCount: number;
  skippedCount: number;
  openAlertCount: number;
  recentEnvironments: string[];
  recentEventTypes: WorkerRestartAlertNotificationEventType[];
  lastActivityAt?: string;
  lastSentAt?: string;
  lastFailedAt?: string;
  lastSuppressedAt?: string;
  lastSkippedAt?: string;
  lastFailureReason?: string;
  latestRouteReason?: string;
  healthHint: WorkerRestartDeliveryHealthHint;
}

export interface WorkerRestartDeliverySummaryResult {
  windowStartAt: string;
  windowEndAt: string;
  totalCount: number;
  destinations: WorkerRestartDeliverySummaryRow[];
}

export type WorkerRestartDeliveryTrendHint = "improving" | "stable" | "worsening" | "inactive" | "insufficient_data";

export interface WorkerRestartDeliveryTrendWindowSummary {
  windowStartAt: string;
  windowEndAt: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  suppressedCount: number;
  skippedCount: number;
  failureRate: number;
  suppressionRate: number;
  healthHint: WorkerRestartDeliveryHealthHint;
  recentEnvironments: string[];
  recentEventTypes: WorkerRestartAlertNotificationEventType[];
  lastActivityAt?: string;
  lastSentAt?: string;
  lastFailedAt?: string;
  lastSuppressedAt?: string;
  lastSkippedAt?: string;
}

export interface WorkerRestartDeliveryTrendRow {
  destinationName: string;
  destinationType?: string;
  sinkType?: string;
  formatterProfile?: string;
  currentWindow: WorkerRestartDeliveryTrendWindowSummary;
  comparisonWindow: WorkerRestartDeliveryTrendWindowSummary;
  currentHealthHint: WorkerRestartDeliveryHealthHint;
  comparisonHealthHint: WorkerRestartDeliveryHealthHint;
  trendHint: WorkerRestartDeliveryTrendHint;
  recentFailureDelta: number;
  recentSuppressionDelta: number;
  recentVolumeDelta: number;
  lastSentAt?: string;
  lastFailedAt?: string;
  summaryText: string;
}

export interface WorkerRestartDeliveryTrendResult {
  referenceEndAt: string;
  currentWindowStartAt: string;
  comparisonWindowStartAt: string;
  limit: number;
  totalCount: number;
  hasMore: boolean;
  destinations: WorkerRestartDeliveryTrendRow[];
}

export interface WorkerRestartDeliveryTrendFilters {
  environment?: string;
  destinationName?: string;
  eventTypes?: WorkerRestartAlertNotificationEventType[];
  severities?: WorkerRestartAlertSeverity[];
  formatterProfile?: string;
  referenceEndAt?: string;
  limit?: number;
}

export interface WorkerRestartAlertRepository {
  kind: "postgres" | "memory";
  ensureSchema(): Promise<void>;
  load(environment: string, id: string): Promise<WorkerRestartAlertRecord | null>;
  loadByDedupeKey(environment: string, dedupeKey: string): Promise<WorkerRestartAlertRecord | null>;
  list(environment: string, limit?: number): Promise<WorkerRestartAlertRecord[]>;
  listOpen(environment: string, limit?: number): Promise<WorkerRestartAlertRecord[]>;
  save(record: WorkerRestartAlertRecord): Promise<WorkerRestartAlertRecord>;
  recordEvent(record: WorkerRestartAlertEventRecord): Promise<WorkerRestartAlertEventRecord>;
  listEvents(environment: string, alertId: string, limit?: number): Promise<WorkerRestartAlertEventRecord[]>;
  listDeliveryJournal(filters: WorkerRestartDeliveryJournalFilters): Promise<WorkerRestartDeliveryJournalResult>;
  summarizeDeliveryJournal(filters: WorkerRestartDeliveryJournalFilters): Promise<WorkerRestartDeliverySummaryResult>;
  summarizeDeliveryTrends(filters: WorkerRestartDeliveryTrendFilters): Promise<WorkerRestartDeliveryTrendResult>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mapRecord(row: Record<string, unknown>): WorkerRestartAlertRecord {
  return {
    id: String(row.id),
    environment: String(row.environment),
    dedupeKey: String(row.dedupe_key),
    restartRequestId: row.restart_request_id == null ? undefined : String(row.restart_request_id),
    workerService: String(row.worker_service),
    targetWorker: row.target_worker == null ? undefined : String(row.target_worker),
    targetVersionId: row.target_version_id == null ? undefined : String(row.target_version_id),
    sourceCategory: String(row.source_category) as WorkerRestartAlertSourceCategory,
    reasonCode: String(row.reason_code),
    severity: String(row.severity) as WorkerRestartAlertSeverity,
    status: String(row.status) as WorkerRestartAlertStatus,
    summary: String(row.summary),
    recommendedAction: String(row.recommended_action),
    metadata: row.metadata_json == null ? undefined : clone(row.metadata_json as Record<string, unknown>),
    conditionSignature: String(row.condition_signature),
    occurrenceCount: Number(row.occurrence_count),
    firstSeenAt: String(row.first_seen_at),
    lastSeenAt: String(row.last_seen_at),
    lastEvaluatedAt: String(row.last_evaluated_at),
    acknowledgedAt: row.acknowledged_at == null ? undefined : String(row.acknowledged_at),
    acknowledgedBy: row.acknowledged_by == null ? undefined : String(row.acknowledged_by),
    acknowledgmentNote: row.acknowledgment_note == null ? undefined : String(row.acknowledgment_note),
    resolvedAt: row.resolved_at == null ? undefined : String(row.resolved_at),
    resolvedBy: row.resolved_by == null ? undefined : String(row.resolved_by),
    resolutionNote: row.resolution_note == null ? undefined : String(row.resolution_note),
    lastRestartRequestStatus:
      row.last_restart_request_status == null
        ? undefined
        : (String(row.last_restart_request_status) as WorkerRestartRecordStatus),
    lastRestartRequestUpdatedAt:
      row.last_restart_request_updated_at == null ? undefined : String(row.last_restart_request_updated_at),
    lastWorkerHeartbeatAt: row.last_worker_heartbeat_at == null ? undefined : String(row.last_worker_heartbeat_at),
    lastAppliedVersionId: row.last_applied_version_id == null ? undefined : String(row.last_applied_version_id),
    requestedVersionId: row.requested_version_id == null ? undefined : String(row.requested_version_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapEvent(row: Record<string, unknown>): WorkerRestartAlertEventRecord {
  return {
    id: String(row.id),
    environment: String(row.environment),
    alertId: String(row.alert_id),
    action: String(row.action) as WorkerRestartAlertEventRecord["action"],
    actor: String(row.actor),
    accepted: Boolean(row.accepted),
    beforeStatus: row.before_status == null ? undefined : (String(row.before_status) as WorkerRestartAlertStatus),
    afterStatus: row.after_status == null ? undefined : (String(row.after_status) as WorkerRestartAlertStatus),
    reasonCode: row.reason_code == null ? undefined : String(row.reason_code),
    summary: row.summary == null ? undefined : String(row.summary),
    note: row.note == null ? undefined : String(row.note),
    metadata: row.metadata_json == null ? undefined : clone(row.metadata_json as Record<string, unknown>),
    notificationSinkName: row.notification_sink_name == null ? undefined : String(row.notification_sink_name),
    notificationSinkType: row.notification_sink_type == null ? undefined : String(row.notification_sink_type),
    notificationDestinationName:
      row.notification_destination_name == null ? undefined : String(row.notification_destination_name),
    notificationDestinationType:
      row.notification_destination_type == null ? undefined : String(row.notification_destination_type),
    notificationFormatterProfile:
      row.notification_formatter_profile == null ? undefined : String(row.notification_formatter_profile),
    notificationDestinationPriority:
      row.notification_destination_priority == null ? undefined : Number(row.notification_destination_priority),
    notificationDestinationTags:
      row.notification_destination_tags_json == null
        ? undefined
        : (clone(row.notification_destination_tags_json as string[]) as string[]),
    notificationEventType: row.notification_event_type == null ? undefined : (String(row.notification_event_type) as WorkerRestartAlertNotificationEventType),
    notificationStatus: row.notification_status == null ? undefined : (String(row.notification_status) as WorkerRestartAlertNotificationStatus),
    notificationDedupeKey: row.notification_dedupe_key == null ? undefined : String(row.notification_dedupe_key),
    notificationPayloadFingerprint:
      row.notification_payload_fingerprint == null ? undefined : String(row.notification_payload_fingerprint),
    notificationAttemptCount:
      row.notification_attempt_count == null ? undefined : Number(row.notification_attempt_count),
    notificationFailureReason:
      row.notification_failure_reason == null ? undefined : String(row.notification_failure_reason),
    notificationSuppressionReason:
      row.notification_suppression_reason == null ? undefined : String(row.notification_suppression_reason),
    notificationRouteReason: row.notification_route_reason == null ? undefined : String(row.notification_route_reason),
    notificationResponseStatus:
      row.notification_response_status == null ? undefined : Number(row.notification_response_status),
    notificationResponseBody:
      row.notification_response_body == null ? undefined : String(row.notification_response_body),
    notificationScope: row.notification_scope == null ? undefined : (String(row.notification_scope) as "internal" | "external"),
    createdAt: String(row.created_at),
  };
}

function buildRecord(record: WorkerRestartAlertRecord): WorkerRestartAlertRecord {
  return clone(record);
}

function buildEvent(record: WorkerRestartAlertEventRecord): WorkerRestartAlertEventRecord {
  return clone(record);
}

function parseDateOrUndefined(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeDeliveryFilters(filters: WorkerRestartDeliveryJournalFilters): WorkerRestartDeliveryJournalFilters {
  const limit = Math.min(Math.max(Math.trunc(filters.limit), 1), 200);
  const offset = Math.max(Math.trunc(filters.offset), 0);
  const windowStartAt = filters.windowStartAt;
  const windowEndAt = filters.windowEndAt;

  if (parseDateOrUndefined(windowStartAt) == null || parseDateOrUndefined(windowEndAt) == null) {
    throw new Error("delivery journal window must be valid ISO timestamps");
  }
  if (Date.parse(windowStartAt) > Date.parse(windowEndAt)) {
    throw new Error("delivery journal window start must be before the end");
  }

  return {
    ...filters,
    limit,
    offset,
  };
}

function isExternalDeliveryEvent(event: WorkerRestartAlertEventRecord): boolean {
  return event.notificationScope === "external" && Boolean(event.notificationEventType) && Boolean(event.notificationDestinationName);
}

function matchesDeliveryFilterValue<T extends string>(
  values: T[] | undefined,
  candidate: T | undefined
): boolean {
  if (!values || values.length === 0) {
    return true;
  }
  if (!candidate) {
    return false;
  }
  return values.includes(candidate);
}

function buildDeliveryJournalRow(
  event: WorkerRestartAlertEventRecord,
  alert: WorkerRestartAlertRecord
): WorkerRestartDeliveryJournalRow {
  return {
    eventId: event.id,
    alertId: event.alertId,
    restartRequestId: alert.restartRequestId,
    environment: event.environment,
    destinationName: event.notificationDestinationName,
    destinationType: event.notificationDestinationType,
    sinkType: event.notificationSinkType,
    formatterProfile: event.notificationFormatterProfile,
    eventType: event.notificationEventType,
    deliveryStatus: event.notificationStatus,
    severity: alert.severity,
    alertStatus: alert.status,
    sourceCategory: alert.sourceCategory,
    routeReason: event.notificationRouteReason,
    dedupeKey: event.notificationDedupeKey,
    payloadFingerprint: event.notificationPayloadFingerprint,
    attemptedAt: event.createdAt,
    attemptCount: event.notificationAttemptCount ?? 1,
    failureReason: event.notificationFailureReason,
    suppressionReason: event.notificationSuppressionReason,
    summary: event.summary ?? alert.summary,
  };
}

function deriveDeliveryHealthHint(row: Pick<WorkerRestartDeliverySummaryRow, "totalCount" | "sentCount" | "failedCount" | "suppressedCount" | "skippedCount">): WorkerRestartDeliveryHealthHint {
  if (row.totalCount === 0) {
    return "idle";
  }
  if (row.failedCount > 0 && row.sentCount === 0) {
    return "failing";
  }
  if (row.failedCount > 0 && row.sentCount > 0) {
    return "degraded";
  }
  if (row.sentCount > 0 && row.failedCount === 0) {
    return "healthy";
  }
  if (row.suppressedCount > 0 || row.skippedCount > 0) {
    return "idle";
  }
  return "unknown";
}

interface DeliveryTrendWindowAggregate {
  windowStartAt: string;
  windowEndAt: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  suppressedCount: number;
  skippedCount: number;
  recentEnvironments: string[];
  recentEventTypes: WorkerRestartAlertNotificationEventType[];
  lastActivityAt?: string;
  lastSentAt?: string;
  lastFailedAt?: string;
  lastSuppressedAt?: string;
  lastSkippedAt?: string;
}

interface DeliveryTrendAggregateRow {
  destinationName: string;
  destinationType?: string;
  sinkType?: string;
  formatterProfile?: string;
  currentWindow: DeliveryTrendWindowAggregate;
  comparisonWindow: DeliveryTrendWindowAggregate;
}

interface NormalizedDeliveryTrendFilters {
  referenceEndAt: string;
  currentWindowStartAt: string;
  comparisonWindowStartAt: string;
  limit: number;
  deliveryFilters: WorkerRestartDeliveryJournalFilters;
}

function cloneStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)).filter((entry) => entry.length > 0) : [];
}

function cloneEventTypeArray(value: unknown): WorkerRestartAlertNotificationEventType[] {
  return cloneStringArray(value).filter((entry): entry is WorkerRestartAlertNotificationEventType =>
    entry === "alert_opened" ||
    entry === "alert_escalated" ||
    entry === "alert_acknowledged" ||
    entry === "alert_resolved" ||
    entry === "alert_repeated_failure_summary"
  );
}

function rateFromCount(count: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return count / total;
}

function sortUniqueStrings(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function summarizeTrendWindow(
  windowStartAt: string,
  windowEndAt: string,
  rows: WorkerRestartDeliveryJournalRow[]
): DeliveryTrendWindowAggregate {
  const recentEnvironments: string[] = [];
  const recentEventTypes: WorkerRestartAlertNotificationEventType[] = [];
  let totalCount = 0;
  let sentCount = 0;
  let failedCount = 0;
  let suppressedCount = 0;
  let skippedCount = 0;
  let lastActivityAt: string | undefined;
  let lastSentAt: string | undefined;
  let lastFailedAt: string | undefined;
  let lastSuppressedAt: string | undefined;
  let lastSkippedAt: string | undefined;

  for (const row of rows) {
    totalCount += 1;
    if (row.deliveryStatus === "sent") {
      sentCount += 1;
    } else if (row.deliveryStatus === "failed") {
      failedCount += 1;
    } else if (row.deliveryStatus === "suppressed") {
      suppressedCount += 1;
    } else if (row.deliveryStatus === "skipped") {
      skippedCount += 1;
    }

    if (!lastActivityAt || Date.parse(row.attemptedAt) > Date.parse(lastActivityAt)) {
      lastActivityAt = row.attemptedAt;
    }
    if (row.deliveryStatus === "sent" && (!lastSentAt || Date.parse(row.attemptedAt) > Date.parse(lastSentAt))) {
      lastSentAt = row.attemptedAt;
    }
    if (row.deliveryStatus === "failed" && (!lastFailedAt || Date.parse(row.attemptedAt) > Date.parse(lastFailedAt))) {
      lastFailedAt = row.attemptedAt;
    }
    if (row.deliveryStatus === "suppressed" && (!lastSuppressedAt || Date.parse(row.attemptedAt) > Date.parse(lastSuppressedAt))) {
      lastSuppressedAt = row.attemptedAt;
    }
    if (row.deliveryStatus === "skipped" && (!lastSkippedAt || Date.parse(row.attemptedAt) > Date.parse(lastSkippedAt))) {
      lastSkippedAt = row.attemptedAt;
    }

    if (row.environment) {
      recentEnvironments.push(row.environment);
    }
    if (row.eventType) {
      recentEventTypes.push(row.eventType);
    }
  }

  return {
    windowStartAt,
    windowEndAt,
    totalCount,
    sentCount,
    failedCount,
    suppressedCount,
    skippedCount,
    recentEnvironments: sortUniqueStrings(recentEnvironments),
    recentEventTypes: sortUniqueStrings(recentEventTypes) as WorkerRestartAlertNotificationEventType[],
    lastActivityAt,
    lastSentAt,
    lastFailedAt,
    lastSuppressedAt,
    lastSkippedAt,
  };
}

function buildTrendWindowSummary(aggregate: DeliveryTrendWindowAggregate): WorkerRestartDeliveryTrendWindowSummary {
  const failureRate = rateFromCount(aggregate.failedCount, aggregate.totalCount);
  const suppressionRate = rateFromCount(aggregate.suppressedCount, aggregate.totalCount);
  const summary: WorkerRestartDeliveryTrendWindowSummary = {
    ...aggregate,
    failureRate,
    suppressionRate,
    healthHint: deriveDeliveryHealthHint(aggregate),
  };

  return summary;
}

function toDailyEquivalent(count: number): number {
  return Math.round(count / 7);
}

function describeTrendHint(
  currentWindow: WorkerRestartDeliveryTrendWindowSummary,
  comparisonWindow: WorkerRestartDeliveryTrendWindowSummary
): WorkerRestartDeliveryTrendHint {
  if (comparisonWindow.totalCount < 5) {
    return "insufficient_data";
  }

  if (currentWindow.totalCount === 0) {
    return comparisonWindow.totalCount > 0 ? "inactive" : "insufficient_data";
  }

  const failureDelta = currentWindow.failedCount - toDailyEquivalent(comparisonWindow.failedCount);
  const suppressionDelta = currentWindow.suppressedCount - toDailyEquivalent(comparisonWindow.suppressedCount);
  const failureRateDelta = currentWindow.failureRate - comparisonWindow.failureRate;
  const suppressionRateDelta = currentWindow.suppressionRate - comparisonWindow.suppressionRate;

  if (
    currentWindow.failedCount >= 2 &&
    (failureDelta >= 2 || failureRateDelta >= 0.15 || currentWindow.healthHint === "failing")
  ) {
    return "worsening";
  }

  if (
    currentWindow.sentCount > 0 &&
    currentWindow.failedCount === 0 &&
    (failureDelta <= -1 || failureRateDelta <= -0.05 || suppressionDelta < 0 || suppressionRateDelta < 0)
  ) {
    return "improving";
  }

  if (
    currentWindow.sentCount > 0 &&
    failureDelta <= -1 &&
    failureRateDelta <= -0.05 &&
    comparisonWindow.healthHint !== "healthy"
  ) {
    return "improving";
  }

  if (failureDelta >= 1 || suppressionDelta >= 1 || failureRateDelta >= 0.1 || suppressionRateDelta >= 0.1) {
    return "worsening";
  }

  return "stable";
}

function buildTrendSummaryText(
  currentWindow: WorkerRestartDeliveryTrendWindowSummary,
  comparisonWindow: WorkerRestartDeliveryTrendWindowSummary,
  trendHint: WorkerRestartDeliveryTrendHint,
  recentFailureDelta: number,
  recentSuppressionDelta: number
): string {
  const failureDeltaText = recentFailureDelta === 0 ? "flat failures" : `${recentFailureDelta > 0 ? "+" : ""}${recentFailureDelta} failure delta`;
  const suppressionDeltaText =
    recentSuppressionDelta === 0 ? "flat suppression" : `${recentSuppressionDelta > 0 ? "+" : ""}${recentSuppressionDelta} suppression delta`;

  switch (trendHint) {
    case "insufficient_data":
      return `Not enough 7-day volume to compare safely (${comparisonWindow.totalCount} events).`;
    case "inactive":
      return `No delivery activity in the last 24h after ${comparisonWindow.totalCount} events across 7d.`;
    case "worsening":
      return `Delivery behavior is worsening: ${failureDeltaText}, ${suppressionDeltaText}, health ${comparisonWindow.healthHint} -> ${currentWindow.healthHint}.`;
    case "improving":
      return `Delivery behavior is improving: ${failureDeltaText}, ${suppressionDeltaText}, with successful sends still present.`;
    case "stable":
    default:
      return `Delivery behavior is stable: 24h activity stays close to the 7d baseline.`;
  }
}

function buildDeliveryTrendRow(
  destinationName: string,
  destinationType: string | undefined,
  sinkType: string | undefined,
  formatterProfile: string | undefined,
  currentWindow: DeliveryTrendWindowAggregate,
  comparisonWindow: DeliveryTrendWindowAggregate
): WorkerRestartDeliveryTrendRow {
  const current = buildTrendWindowSummary(currentWindow);
  const comparison = buildTrendWindowSummary(comparisonWindow);
  const recentFailureDelta = current.failedCount - toDailyEquivalent(comparison.failedCount);
  const recentSuppressionDelta = current.suppressedCount - toDailyEquivalent(comparison.suppressedCount);
  const recentVolumeDelta = current.totalCount - toDailyEquivalent(comparison.totalCount);
  const trendHint = describeTrendHint(current, comparison);

  return {
    destinationName,
    destinationType,
    sinkType,
    formatterProfile,
    currentWindow: current,
    comparisonWindow: comparison,
    currentHealthHint: current.healthHint,
    comparisonHealthHint: comparison.healthHint,
    trendHint,
    recentFailureDelta,
    recentSuppressionDelta,
    recentVolumeDelta,
    lastSentAt: current.lastSentAt,
    lastFailedAt: current.lastFailedAt,
    summaryText: buildTrendSummaryText(current, comparison, trendHint, recentFailureDelta, recentSuppressionDelta),
  };
}

function buildTrendRowsFromDeliveryRows(
  rows: WorkerRestartDeliveryJournalRow[],
  referenceEndAt: string,
  currentWindowStartAt: string,
  comparisonWindowStartAt: string
): WorkerRestartDeliveryTrendRow[] {
  const byDestination = new Map<
    string,
    {
      destinationType?: string;
      sinkType?: string;
      formatterProfile?: string;
      currentRows: WorkerRestartDeliveryJournalRow[];
      comparisonRows: WorkerRestartDeliveryJournalRow[];
    }
  >();

  for (const row of rows) {
    const destinationName = row.destinationName ?? "unknown";
    const bucket = byDestination.get(destinationName) ?? {
      destinationType: row.destinationType,
      sinkType: row.sinkType,
      formatterProfile: row.formatterProfile,
      currentRows: [],
      comparisonRows: [],
    };
    bucket.destinationType = bucket.destinationType ?? row.destinationType;
    bucket.sinkType = bucket.sinkType ?? row.sinkType;
    bucket.formatterProfile = bucket.formatterProfile ?? row.formatterProfile;
    if (Date.parse(row.attemptedAt) >= Date.parse(currentWindowStartAt)) {
      bucket.currentRows.push(row);
    }
    bucket.comparisonRows.push(row);
    byDestination.set(destinationName, bucket);
  }

  return [...byDestination.entries()]
    .map(([destinationName, bucket]) =>
      buildDeliveryTrendRow(
        destinationName,
        bucket.destinationType,
        bucket.sinkType,
        bucket.formatterProfile,
        summarizeTrendWindow(currentWindowStartAt, referenceEndAt, bucket.currentRows),
        summarizeTrendWindow(comparisonWindowStartAt, referenceEndAt, bucket.comparisonRows)
      )
    )
    .sort((left, right) => {
      const leftTime = Date.parse(left.currentWindow.lastActivityAt ?? left.lastFailedAt ?? left.lastSentAt ?? "1970-01-01T00:00:00.000Z");
      const rightTime = Date.parse(right.currentWindow.lastActivityAt ?? right.lastFailedAt ?? right.lastSentAt ?? "1970-01-01T00:00:00.000Z");
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return left.destinationName.localeCompare(right.destinationName);
    });
}

function normalizeTrendFilters(filters: WorkerRestartDeliveryTrendFilters): NormalizedDeliveryTrendFilters {
  const referenceEndAt = filters.referenceEndAt?.trim() ? filters.referenceEndAt.trim() : new Date().toISOString();
  const parsedReference = Date.parse(referenceEndAt);
  if (!Number.isFinite(parsedReference)) {
    throw new Error("trend reference end must be a valid ISO timestamp");
  }

  const limit = Math.min(Math.max(Math.trunc(filters.limit ?? 50), 1), 100);
  const currentWindowStartAt = new Date(parsedReference - 24 * 60 * 60 * 1000).toISOString();
  const comparisonWindowStartAt = new Date(parsedReference - 7 * 24 * 60 * 60 * 1000).toISOString();
  const deliveryFilters: WorkerRestartDeliveryJournalFilters = {
    environment: filters.environment,
    destinationName: filters.destinationName,
    eventTypes: filters.eventTypes,
    severities: filters.severities,
    formatterProfile: filters.formatterProfile,
    windowStartAt: comparisonWindowStartAt,
    windowEndAt: referenceEndAt,
    limit,
    offset: 0,
  };

  return {
    referenceEndAt,
    currentWindowStartAt,
    comparisonWindowStartAt,
    limit,
    deliveryFilters,
  };
}

export class InMemoryWorkerRestartAlertRepository implements WorkerRestartAlertRepository {
  kind = "memory" as const;

  private readonly alerts = new Map<string, Map<string, WorkerRestartAlertRecord>>();
  private readonly events = new Map<string, WorkerRestartAlertEventRecord[]>();

  async ensureSchema(): Promise<void> {
    return;
  }

  private getEnvironmentAlerts(environment: string): Map<string, WorkerRestartAlertRecord> {
    const existing = this.alerts.get(environment);
    if (existing) {
      return existing;
    }

    const created = new Map<string, WorkerRestartAlertRecord>();
    this.alerts.set(environment, created);
    return created;
  }

  private getEnvironmentEvents(environment: string): WorkerRestartAlertEventRecord[] {
    const existing = this.events.get(environment);
    if (existing) {
      return existing;
    }

    const created: WorkerRestartAlertEventRecord[] = [];
    this.events.set(environment, created);
    return created;
  }

  async load(environment: string, id: string): Promise<WorkerRestartAlertRecord | null> {
    const alerts = this.getEnvironmentAlerts(environment);
    for (const record of alerts.values()) {
      if (record.id === id) {
        return buildRecord(record);
      }
    }
    return null;
  }

  async loadByDedupeKey(environment: string, dedupeKey: string): Promise<WorkerRestartAlertRecord | null> {
    const alerts = this.getEnvironmentAlerts(environment);
    const record = alerts.get(dedupeKey);
    return record ? buildRecord(record) : null;
  }

  async list(environment: string, limit = 100): Promise<WorkerRestartAlertRecord[]> {
    const alerts = this.getEnvironmentAlerts(environment);
    return [...alerts.values()]
      .sort((left, right) => {
        const leftTime = Date.parse(left.lastSeenAt ?? left.updatedAt ?? left.firstSeenAt);
        const rightTime = Date.parse(right.lastSeenAt ?? right.updatedAt ?? right.firstSeenAt);
        return rightTime - leftTime;
      })
      .slice(0, limit)
      .map((record) => buildRecord(record));
  }

  async listOpen(environment: string, limit = 100): Promise<WorkerRestartAlertRecord[]> {
    return (await this.list(environment, limit)).filter((record) => record.status !== "resolved");
  }

  async save(record: WorkerRestartAlertRecord): Promise<WorkerRestartAlertRecord> {
    const alerts = this.getEnvironmentAlerts(record.environment);
    alerts.set(record.dedupeKey, buildRecord(record));
    return buildRecord(record);
  }

  async recordEvent(record: WorkerRestartAlertEventRecord): Promise<WorkerRestartAlertEventRecord> {
    const events = this.getEnvironmentEvents(record.environment);
    events.push(buildEvent(record));
    return buildEvent(record);
  }

  async listEvents(environment: string, alertId: string, limit = 100): Promise<WorkerRestartAlertEventRecord[]> {
    const events = this.getEnvironmentEvents(environment);
    return events
      .filter((event) => event.alertId === alertId)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, limit)
      .map((event) => buildEvent(event));
  }

  private collectDeliveryRows(filters: WorkerRestartDeliveryJournalFilters): WorkerRestartDeliveryJournalRow[] {
    const normalized = normalizeDeliveryFilters(filters);
    const environments = normalized.environment ? [normalized.environment] : [...this.events.keys()];
    const rows: WorkerRestartDeliveryJournalRow[] = [];

    for (const environment of environments) {
      const events = this.getEnvironmentEvents(environment);
      const alerts = new Map([...this.getEnvironmentAlerts(environment).values()].map((alert) => [alert.id, alert] as const));
      for (const event of events) {
        if (!isExternalDeliveryEvent(event)) {
          continue;
        }
        if (normalized.environment && event.environment !== normalized.environment) {
          continue;
        }
        if (normalized.destinationName && event.notificationDestinationName !== normalized.destinationName) {
          continue;
        }
        if (!matchesDeliveryFilterValue(normalized.deliveryStatuses, event.notificationStatus)) {
          continue;
        }
        if (!matchesDeliveryFilterValue(normalized.eventTypes, event.notificationEventType)) {
          continue;
        }
        if (!normalized.formatterProfile || event.notificationFormatterProfile === normalized.formatterProfile) {
          // fall through
        } else {
          continue;
        }
        const createdAt = Date.parse(event.createdAt);
        const windowStart = Date.parse(normalized.windowStartAt);
        const windowEnd = Date.parse(normalized.windowEndAt);
        if (createdAt < windowStart || createdAt > windowEnd) {
          continue;
        }
        const alert = alerts.get(event.alertId);
        if (!alert) {
          continue;
        }
        const row = buildDeliveryJournalRow(event, alert);
        if (!matchesDeliveryFilterValue(normalized.severities, row.severity)) {
          continue;
        }
        if (normalized.alertId && row.alertId !== normalized.alertId) {
          continue;
        }
        if (normalized.restartRequestId && row.restartRequestId !== normalized.restartRequestId) {
          continue;
        }
        rows.push(row);
      }
    }

    return rows.sort((left, right) => {
      const diff = Date.parse(right.attemptedAt) - Date.parse(left.attemptedAt);
      return diff !== 0 ? diff : right.eventId.localeCompare(left.eventId);
    });
  }

  async listDeliveryJournal(filters: WorkerRestartDeliveryJournalFilters): Promise<WorkerRestartDeliveryJournalResult> {
    const normalized = normalizeDeliveryFilters(filters);
    const filtered = this.collectDeliveryRows(normalized);
    const totalCount = filtered.length;
    const deliveries = filtered.slice(normalized.offset, normalized.offset + normalized.limit);
    return {
      windowStartAt: normalized.windowStartAt,
      windowEndAt: normalized.windowEndAt,
      limit: normalized.limit,
      offset: normalized.offset,
      totalCount,
      hasMore: normalized.offset + normalized.limit < totalCount,
      deliveries,
    };
  }

  async summarizeDeliveryJournal(filters: WorkerRestartDeliveryJournalFilters): Promise<WorkerRestartDeliverySummaryResult> {
    const normalized = normalizeDeliveryFilters(filters);
    const rows = this.collectDeliveryRows(normalized);
    const byDestination = new Map<string, WorkerRestartDeliverySummaryRow>();
    const alertsByEnvironment = new Map<string, Map<string, WorkerRestartAlertRecord>>();
    for (const row of rows) {
      const name = row.destinationName ?? "unknown";
      const current = byDestination.get(name) ?? {
        destinationName: name,
        destinationType: row.destinationType,
        sinkType: row.sinkType,
        formatterProfile: row.formatterProfile,
        totalCount: 0,
        sentCount: 0,
        failedCount: 0,
        suppressedCount: 0,
        skippedCount: 0,
        openAlertCount: 0,
        recentEnvironments: [],
        recentEventTypes: [],
        healthHint: "idle" as WorkerRestartDeliveryHealthHint,
      };
      current.totalCount += 1;
      if (row.deliveryStatus === "sent") current.sentCount += 1;
      else if (row.deliveryStatus === "failed") current.failedCount += 1;
      else if (row.deliveryStatus === "suppressed") current.suppressedCount += 1;
      else if (row.deliveryStatus === "skipped") current.skippedCount += 1;
      current.lastActivityAt = current.lastActivityAt && Date.parse(current.lastActivityAt) > Date.parse(row.attemptedAt) ? current.lastActivityAt : row.attemptedAt;
      if (row.deliveryStatus === "sent" && (!current.lastSentAt || Date.parse(row.attemptedAt) > Date.parse(current.lastSentAt))) {
        current.lastSentAt = row.attemptedAt;
      }
      if (row.deliveryStatus === "failed" && (!current.lastFailedAt || Date.parse(row.attemptedAt) > Date.parse(current.lastFailedAt))) {
        current.lastFailedAt = row.attemptedAt;
        current.lastFailureReason = row.failureReason;
      }
      if (row.deliveryStatus === "suppressed" && (!current.lastSuppressedAt || Date.parse(row.attemptedAt) > Date.parse(current.lastSuppressedAt))) {
        current.lastSuppressedAt = row.attemptedAt;
      }
      if (row.deliveryStatus === "skipped" && (!current.lastSkippedAt || Date.parse(row.attemptedAt) > Date.parse(current.lastSkippedAt))) {
        current.lastSkippedAt = row.attemptedAt;
      }
      current.latestRouteReason = row.routeReason ?? current.latestRouteReason;
      if (!current.recentEnvironments.includes(row.environment)) {
        current.recentEnvironments.push(row.environment);
      }
      if (row.eventType && !current.recentEventTypes.includes(row.eventType)) {
        current.recentEventTypes.push(row.eventType);
      }
      byDestination.set(name, current);

      if (!alertsByEnvironment.has(row.environment)) {
        alertsByEnvironment.set(row.environment, new Map([...this.getEnvironmentAlerts(row.environment).values()].map((alert) => [alert.id, alert] as const)));
      }
    }

    const destinationNames = [...byDestination.keys()];
    const openAlertCountByDestination = new Map<string, number>();
    if (destinationNames.length > 0) {
      for (const destinationName of destinationNames) {
        const openIds = new Set(rows.filter((row) => (row.destinationName ?? "unknown") === destinationName).map((row) => row.alertId));
        const openCount = [...alertsByEnvironment.values()]
          .flatMap((alertMap) => [...alertMap.values()])
          .filter((alert) => alert.status !== "resolved" && openIds.has(alert.id)).length;
        openAlertCountByDestination.set(destinationName, openCount);
      }
    }

    const destinations = [...byDestination.values()]
      .map((row) => ({
        ...row,
        openAlertCount: openAlertCountByDestination.get(row.destinationName) ?? 0,
        healthHint: deriveDeliveryHealthHint(row),
      }))
      .sort((left, right) => {
        const leftTime = Date.parse(left.lastActivityAt ?? left.lastFailedAt ?? left.lastSentAt ?? left.lastSuppressedAt ?? left.lastSkippedAt ?? "1970-01-01T00:00:00.000Z");
        const rightTime = Date.parse(right.lastActivityAt ?? right.lastFailedAt ?? right.lastSentAt ?? right.lastSuppressedAt ?? right.lastSkippedAt ?? "1970-01-01T00:00:00.000Z");
        if (rightTime !== leftTime) {
          return rightTime - leftTime;
        }
        return left.destinationName.localeCompare(right.destinationName);
      });

    return {
      windowStartAt: normalized.windowStartAt,
      windowEndAt: normalized.windowEndAt,
      totalCount: rows.length,
      destinations,
    };
  }

  async summarizeDeliveryTrends(filters: WorkerRestartDeliveryTrendFilters): Promise<WorkerRestartDeliveryTrendResult> {
    const normalized = normalizeTrendFilters(filters);
    const rows = this.collectDeliveryRows(normalized.deliveryFilters);
    const destinations = buildTrendRowsFromDeliveryRows(
      rows,
      normalized.referenceEndAt,
      normalized.currentWindowStartAt,
      normalized.comparisonWindowStartAt
    );
    const limited = destinations.slice(0, normalized.limit);
    return {
      referenceEndAt: normalized.referenceEndAt,
      currentWindowStartAt: normalized.currentWindowStartAt,
      comparisonWindowStartAt: normalized.comparisonWindowStartAt,
      limit: normalized.limit,
      totalCount: destinations.length,
      hasMore: destinations.length > normalized.limit,
      destinations: limited,
    };
  }
}

export class PostgresWorkerRestartAlertRepository implements WorkerRestartAlertRepository {
  kind = "postgres" as const;

  constructor(private readonly pool: Pool) {}

  private async withClient<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      return await work(client);
    } finally {
      client.release();
    }
  }

  private buildDeliveryWhereClause(filters: WorkerRestartDeliveryJournalFilters, params: unknown[]): string {
    const clauses: string[] = ["e.notification_scope = 'external'"];
    if (filters.environment) {
      params.push(filters.environment);
      clauses.push(`e.environment = $${params.length}`);
    }
    if (filters.destinationName) {
      params.push(filters.destinationName);
      clauses.push(`e.notification_destination_name = $${params.length}`);
    }
    if (filters.deliveryStatuses && filters.deliveryStatuses.length > 0) {
      params.push(filters.deliveryStatuses);
      clauses.push(`e.notification_status = ANY($${params.length}::text[])`);
    }
    if (filters.eventTypes && filters.eventTypes.length > 0) {
      params.push(filters.eventTypes);
      clauses.push(`e.notification_event_type = ANY($${params.length}::text[])`);
    }
    if (filters.severities && filters.severities.length > 0) {
      params.push(filters.severities);
      clauses.push(`a.severity = ANY($${params.length}::text[])`);
    }
    if (filters.alertId) {
      params.push(filters.alertId);
      clauses.push(`e.alert_id = $${params.length}`);
    }
    if (filters.restartRequestId) {
      params.push(filters.restartRequestId);
      clauses.push(`a.restart_request_id = $${params.length}`);
    }
    if (filters.formatterProfile) {
      params.push(filters.formatterProfile);
      clauses.push(`e.notification_formatter_profile = $${params.length}`);
    }
    params.push(filters.windowStartAt);
    clauses.push(`e.created_at >= $${params.length}::timestamptz`);
    params.push(filters.windowEndAt);
    clauses.push(`e.created_at <= $${params.length}::timestamptz`);
    return clauses.join(" AND ");
  }

  private mapDeliveryJournalRow(row: Record<string, unknown>): WorkerRestartDeliveryJournalRow {
    return {
      eventId: String(row.event_id),
      alertId: String(row.alert_id),
      restartRequestId: row.restart_request_id == null ? undefined : String(row.restart_request_id),
      environment: String(row.environment),
      destinationName: row.destination_name == null ? undefined : String(row.destination_name),
      destinationType: row.destination_type == null ? undefined : String(row.destination_type),
      sinkType: row.sink_type == null ? undefined : String(row.sink_type),
      formatterProfile: row.formatter_profile == null ? undefined : String(row.formatter_profile),
      eventType: row.event_type == null ? undefined : (String(row.event_type) as WorkerRestartAlertNotificationEventType),
      deliveryStatus: row.delivery_status == null ? undefined : (String(row.delivery_status) as WorkerRestartAlertNotificationStatus),
      severity: row.severity == null ? undefined : (String(row.severity) as WorkerRestartAlertSeverity),
      alertStatus: row.alert_status == null ? undefined : (String(row.alert_status) as WorkerRestartAlertStatus),
      sourceCategory: row.source_category == null ? undefined : (String(row.source_category) as WorkerRestartAlertSourceCategory),
      routeReason: row.route_reason == null ? undefined : String(row.route_reason),
      dedupeKey: row.dedupe_key == null ? undefined : String(row.dedupe_key),
      payloadFingerprint: row.payload_fingerprint == null ? undefined : String(row.payload_fingerprint),
      attemptedAt: String(row.attempted_at),
      attemptCount: row.attempt_count == null ? undefined : Number(row.attempt_count),
      failureReason: row.failure_reason == null ? undefined : String(row.failure_reason),
      suppressionReason: row.suppression_reason == null ? undefined : String(row.suppression_reason),
      summary: row.summary == null ? undefined : String(row.summary),
    };
  }

  private mapDeliverySummaryRow(row: Record<string, unknown>): WorkerRestartDeliverySummaryRow {
    const recentEnvironments = Array.isArray(row.recent_environments) ? (row.recent_environments as string[]) : [];
    const recentEventTypes = Array.isArray(row.recent_event_types)
      ? (row.recent_event_types as string[]).filter((value): value is WorkerRestartAlertNotificationEventType =>
          value === "alert_opened" ||
          value === "alert_escalated" ||
          value === "alert_acknowledged" ||
          value === "alert_resolved" ||
          value === "alert_repeated_failure_summary"
        )
      : [];

    const summary: WorkerRestartDeliverySummaryRow = {
      destinationName: String(row.destination_name),
      destinationType: row.destination_type == null ? undefined : String(row.destination_type),
      sinkType: row.sink_type == null ? undefined : String(row.sink_type),
      formatterProfile: row.formatter_profile == null ? undefined : String(row.formatter_profile),
      totalCount: Number(row.total_count ?? 0),
      sentCount: Number(row.sent_count ?? 0),
      failedCount: Number(row.failed_count ?? 0),
      suppressedCount: Number(row.suppressed_count ?? 0),
      skippedCount: Number(row.skipped_count ?? 0),
      openAlertCount: Number(row.open_alert_count ?? 0),
      recentEnvironments,
      recentEventTypes,
      lastActivityAt: row.last_activity_at == null ? undefined : String(row.last_activity_at),
      lastSentAt: row.last_sent_at == null ? undefined : String(row.last_sent_at),
      lastFailedAt: row.last_failed_at == null ? undefined : String(row.last_failed_at),
      lastSuppressedAt: row.last_suppressed_at == null ? undefined : String(row.last_suppressed_at),
      lastSkippedAt: row.last_skipped_at == null ? undefined : String(row.last_skipped_at),
      lastFailureReason: row.last_failure_reason == null ? undefined : String(row.last_failure_reason),
      latestRouteReason: row.latest_route_reason == null ? undefined : String(row.latest_route_reason),
      healthHint: "unknown",
    };
    summary.healthHint = deriveDeliveryHealthHint(summary);
    return summary;
  }

  private mapTrendWindowAggregate(
    row: Record<string, unknown>,
    prefix: "current" | "comparison",
    windowStartAt: string,
    windowEndAt: string
  ): DeliveryTrendWindowAggregate {
    const recentEnvironmentsKey = `${prefix}_recent_environments`;
    const recentEventTypesKey = `${prefix}_recent_event_types`;
    return {
      windowStartAt,
      windowEndAt,
      totalCount: Number(row[`${prefix}_total_count`] ?? 0),
      sentCount: Number(row[`${prefix}_sent_count`] ?? 0),
      failedCount: Number(row[`${prefix}_failed_count`] ?? 0),
      suppressedCount: Number(row[`${prefix}_suppressed_count`] ?? 0),
      skippedCount: Number(row[`${prefix}_skipped_count`] ?? 0),
      recentEnvironments: sortUniqueStrings(cloneStringArray(row[recentEnvironmentsKey])),
      recentEventTypes: sortUniqueStrings(cloneEventTypeArray(row[recentEventTypesKey])) as WorkerRestartAlertNotificationEventType[],
      lastActivityAt: row[`${prefix}_last_activity_at`] == null ? undefined : String(row[`${prefix}_last_activity_at`]),
      lastSentAt: row[`${prefix}_last_sent_at`] == null ? undefined : String(row[`${prefix}_last_sent_at`]),
      lastFailedAt: row[`${prefix}_last_failed_at`] == null ? undefined : String(row[`${prefix}_last_failed_at`]),
      lastSuppressedAt: row[`${prefix}_last_suppressed_at`] == null ? undefined : String(row[`${prefix}_last_suppressed_at`]),
      lastSkippedAt: row[`${prefix}_last_skipped_at`] == null ? undefined : String(row[`${prefix}_last_skipped_at`]),
    };
  }

  private mapDeliveryTrendRow(
    row: Record<string, unknown>,
    normalized: NormalizedDeliveryTrendFilters
  ): WorkerRestartDeliveryTrendRow {
    const currentWindow = this.mapTrendWindowAggregate(row, "current", normalized.currentWindowStartAt, normalized.referenceEndAt);
    const comparisonWindow = this.mapTrendWindowAggregate(
      row,
      "comparison",
      normalized.comparisonWindowStartAt,
      normalized.referenceEndAt
    );
    const current = buildTrendWindowSummary(currentWindow);
    const comparison = buildTrendWindowSummary(comparisonWindow);
    const trendHint = describeTrendHint(current, comparison);
    const destinationName = String(row.destination_name ?? "unknown");
    const recentFailureDelta = currentWindow.failedCount - toDailyEquivalent(comparisonWindow.failedCount);
    const recentSuppressionDelta = currentWindow.suppressedCount - toDailyEquivalent(comparisonWindow.suppressedCount);
    const recentVolumeDelta = currentWindow.totalCount - toDailyEquivalent(comparisonWindow.totalCount);

    return {
      destinationName,
      destinationType: row.destination_type == null ? undefined : String(row.destination_type),
      sinkType: row.sink_type == null ? undefined : String(row.sink_type),
      formatterProfile: row.formatter_profile == null ? undefined : String(row.formatter_profile),
      currentWindow: current,
      comparisonWindow: comparison,
      currentHealthHint: current.healthHint,
      comparisonHealthHint: comparison.healthHint,
      trendHint,
      recentFailureDelta,
      recentSuppressionDelta,
      recentVolumeDelta,
      lastSentAt: current.lastSentAt,
      lastFailedAt: current.lastFailedAt,
      summaryText: buildTrendSummaryText(current, comparison, trendHint, recentFailureDelta, recentSuppressionDelta),
    };
  }

  async ensureSchema(): Promise<void> {
    await this.withClient(async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS worker_restart_alerts (
          id text PRIMARY KEY,
          environment text NOT NULL,
          dedupe_key text NOT NULL,
          restart_request_id text,
          worker_service text NOT NULL,
          target_worker text,
          target_version_id text,
          source_category text NOT NULL,
          reason_code text NOT NULL,
          severity text NOT NULL,
          status text NOT NULL,
          summary text NOT NULL,
          recommended_action text NOT NULL,
          metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          condition_signature text NOT NULL,
          occurrence_count integer NOT NULL DEFAULT 1,
          first_seen_at timestamptz NOT NULL,
          last_seen_at timestamptz NOT NULL,
          last_evaluated_at timestamptz NOT NULL,
          acknowledged_at timestamptz,
          acknowledged_by text,
          acknowledgment_note text,
          resolved_at timestamptz,
          resolved_by text,
          resolution_note text,
          last_restart_request_status text,
          last_restart_request_updated_at timestamptz,
          last_worker_heartbeat_at timestamptz,
          last_applied_version_id text,
          requested_version_id text,
          created_at timestamptz NOT NULL,
          updated_at timestamptz NOT NULL
        )
      `);
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS worker_restart_alerts_environment_dedupe_key_idx
        ON worker_restart_alerts (environment, dedupe_key)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS worker_restart_alerts_environment_status_updated_idx
        ON worker_restart_alerts (environment, status, updated_at DESC)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS worker_restart_alerts_environment_request_idx
        ON worker_restart_alerts (environment, restart_request_id)
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS worker_restart_alert_events (
          id text PRIMARY KEY,
          environment text NOT NULL,
          alert_id text NOT NULL REFERENCES worker_restart_alerts (id) ON DELETE CASCADE,
          action text NOT NULL,
          actor text NOT NULL,
          accepted boolean NOT NULL DEFAULT true,
          before_status text,
          after_status text,
          reason_code text,
          summary text,
          note text,
          metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          notification_sink_name text,
          notification_sink_type text,
          notification_destination_name text,
          notification_destination_type text,
          notification_formatter_profile text,
          notification_destination_priority integer,
          notification_destination_tags_json jsonb,
          notification_event_type text,
          notification_status text,
          notification_dedupe_key text,
          notification_payload_fingerprint text,
          notification_attempt_count integer,
          notification_failure_reason text,
          notification_suppression_reason text,
          notification_route_reason text,
          notification_response_status integer,
          notification_response_body text,
          notification_scope text,
          created_at timestamptz NOT NULL
        )
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS worker_restart_alert_events_environment_alert_idx
        ON worker_restart_alert_events (environment, alert_id, created_at DESC)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS worker_restart_alert_events_environment_created_idx
        ON worker_restart_alert_events (environment, created_at DESC)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS worker_restart_alert_events_environment_destination_created_idx
        ON worker_restart_alert_events (environment, notification_destination_name, created_at DESC)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS worker_restart_alert_events_environment_status_created_idx
        ON worker_restart_alert_events (environment, notification_status, created_at DESC)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS worker_restart_alert_events_environment_event_type_created_idx
        ON worker_restart_alert_events (environment, notification_event_type, created_at DESC)
      `);
      for (const column of [
        "notification_sink_name text",
        "notification_sink_type text",
        "notification_destination_name text",
        "notification_destination_type text",
        "notification_formatter_profile text",
        "notification_destination_priority integer",
        "notification_destination_tags_json jsonb",
        "notification_event_type text",
        "notification_status text",
        "notification_dedupe_key text",
        "notification_payload_fingerprint text",
        "notification_attempt_count integer",
        "notification_failure_reason text",
        "notification_suppression_reason text",
        "notification_route_reason text",
        "notification_response_status integer",
        "notification_response_body text",
        "notification_scope text",
      ]) {
        await client.query(`ALTER TABLE worker_restart_alert_events ADD COLUMN IF NOT EXISTS ${column}`);
      }
    });
  }

  async load(environment: string, id: string): Promise<WorkerRestartAlertRecord | null> {
    const result = await this.withClient((client) =>
      client.query(
        `
          SELECT *
          FROM worker_restart_alerts
          WHERE environment = $1 AND id = $2
          LIMIT 1
        `,
        [environment, id]
      )
    );
    const row = result.rows[0];
    return row ? mapRecord(row as Record<string, unknown>) : null;
  }

  async loadByDedupeKey(environment: string, dedupeKey: string): Promise<WorkerRestartAlertRecord | null> {
    const result = await this.withClient((client) =>
      client.query(
        `
          SELECT *
          FROM worker_restart_alerts
          WHERE environment = $1 AND dedupe_key = $2
          LIMIT 1
        `,
        [environment, dedupeKey]
      )
    );
    const row = result.rows[0];
    return row ? mapRecord(row as Record<string, unknown>) : null;
  }

  async list(environment: string, limit = 100): Promise<WorkerRestartAlertRecord[]> {
    const result = await this.withClient((client) =>
      client.query(
        `
          SELECT *
          FROM worker_restart_alerts
          WHERE environment = $1
          ORDER BY last_seen_at DESC, updated_at DESC
          LIMIT $2
        `,
        [environment, limit]
      )
    );
    return result.rows.map((row) => mapRecord(row as Record<string, unknown>));
  }

  async listOpen(environment: string, limit = 100): Promise<WorkerRestartAlertRecord[]> {
    const result = await this.withClient((client) =>
      client.query(
        `
          SELECT *
          FROM worker_restart_alerts
          WHERE environment = $1 AND status <> 'resolved'
          ORDER BY last_seen_at DESC, updated_at DESC
          LIMIT $2
        `,
        [environment, limit]
      )
    );
    return result.rows.map((row) => mapRecord(row as Record<string, unknown>));
  }

  async save(record: WorkerRestartAlertRecord): Promise<WorkerRestartAlertRecord> {
    await this.withClient(async (client) => {
      await client.query(
        `
          INSERT INTO worker_restart_alerts (
            id, environment, dedupe_key, restart_request_id, worker_service, target_worker, target_version_id,
            source_category, reason_code, severity, status, summary, recommended_action, metadata_json,
            condition_signature, occurrence_count, first_seen_at, last_seen_at, last_evaluated_at,
            acknowledged_at, acknowledged_by, acknowledgment_note, resolved_at, resolved_by, resolution_note,
            last_restart_request_status, last_restart_request_updated_at, last_worker_heartbeat_at,
            last_applied_version_id, requested_version_id, created_at, updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
          )
          ON CONFLICT (environment, dedupe_key) DO UPDATE SET
            id = EXCLUDED.id,
            restart_request_id = EXCLUDED.restart_request_id,
            worker_service = EXCLUDED.worker_service,
            target_worker = EXCLUDED.target_worker,
            target_version_id = EXCLUDED.target_version_id,
            source_category = EXCLUDED.source_category,
            reason_code = EXCLUDED.reason_code,
            severity = EXCLUDED.severity,
            status = EXCLUDED.status,
            summary = EXCLUDED.summary,
            recommended_action = EXCLUDED.recommended_action,
            metadata_json = EXCLUDED.metadata_json,
            condition_signature = EXCLUDED.condition_signature,
            occurrence_count = EXCLUDED.occurrence_count,
            first_seen_at = EXCLUDED.first_seen_at,
            last_seen_at = EXCLUDED.last_seen_at,
            last_evaluated_at = EXCLUDED.last_evaluated_at,
            acknowledged_at = EXCLUDED.acknowledged_at,
            acknowledged_by = EXCLUDED.acknowledged_by,
            acknowledgment_note = EXCLUDED.acknowledgment_note,
            resolved_at = EXCLUDED.resolved_at,
            resolved_by = EXCLUDED.resolved_by,
            resolution_note = EXCLUDED.resolution_note,
            last_restart_request_status = EXCLUDED.last_restart_request_status,
            last_restart_request_updated_at = EXCLUDED.last_restart_request_updated_at,
            last_worker_heartbeat_at = EXCLUDED.last_worker_heartbeat_at,
            last_applied_version_id = EXCLUDED.last_applied_version_id,
            requested_version_id = EXCLUDED.requested_version_id,
            updated_at = EXCLUDED.updated_at
        `,
        [
          record.id,
          record.environment,
          record.dedupeKey,
          record.restartRequestId ?? null,
          record.workerService,
          record.targetWorker ?? null,
          record.targetVersionId ?? null,
          record.sourceCategory,
          record.reasonCode,
          record.severity,
          record.status,
          record.summary,
          record.recommendedAction,
          JSON.stringify(record.metadata ?? {}),
          record.conditionSignature,
          record.occurrenceCount,
          record.firstSeenAt,
          record.lastSeenAt,
          record.lastEvaluatedAt,
          record.acknowledgedAt ?? null,
          record.acknowledgedBy ?? null,
          record.acknowledgmentNote ?? null,
          record.resolvedAt ?? null,
          record.resolvedBy ?? null,
          record.resolutionNote ?? null,
          record.lastRestartRequestStatus ?? null,
          record.lastRestartRequestUpdatedAt ?? null,
          record.lastWorkerHeartbeatAt ?? null,
          record.lastAppliedVersionId ?? null,
          record.requestedVersionId ?? null,
          record.createdAt,
          record.updatedAt,
        ]
      );
    });

    return buildRecord(record);
  }

  async recordEvent(record: WorkerRestartAlertEventRecord): Promise<WorkerRestartAlertEventRecord> {
    await this.withClient(async (client) => {
      await client.query(
        `
          INSERT INTO worker_restart_alert_events (
            id, environment, alert_id, action, actor, accepted, before_status, after_status,
            reason_code, summary, note, metadata_json, notification_sink_name, notification_sink_type,
            notification_destination_name, notification_destination_type, notification_formatter_profile,
            notification_destination_priority, notification_destination_tags_json, notification_event_type,
            notification_status, notification_dedupe_key, notification_payload_fingerprint,
            notification_attempt_count, notification_failure_reason, notification_suppression_reason,
            notification_route_reason, notification_response_status, notification_response_body,
            notification_scope, created_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
            $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31
          )
        `,
        [
          record.id,
          record.environment,
          record.alertId,
          record.action,
          record.actor,
          record.accepted,
          record.beforeStatus ?? null,
          record.afterStatus ?? null,
          record.reasonCode ?? null,
          record.summary ?? null,
          record.note ?? null,
          JSON.stringify(record.metadata ?? {}),
          record.notificationSinkName ?? null,
          record.notificationSinkType ?? null,
          record.notificationDestinationName ?? null,
          record.notificationDestinationType ?? null,
          record.notificationFormatterProfile ?? null,
          record.notificationDestinationPriority ?? null,
          record.notificationDestinationTags != null ? JSON.stringify(record.notificationDestinationTags) : null,
          record.notificationEventType ?? null,
          record.notificationStatus ?? null,
          record.notificationDedupeKey ?? null,
          record.notificationPayloadFingerprint ?? null,
          record.notificationAttemptCount ?? null,
          record.notificationFailureReason ?? null,
          record.notificationSuppressionReason ?? null,
          record.notificationRouteReason ?? null,
          record.notificationResponseStatus ?? null,
          record.notificationResponseBody ?? null,
          record.notificationScope ?? null,
          record.createdAt,
        ]
      );
    });

    return buildEvent(record);
  }

  async listEvents(environment: string, alertId: string, limit = 100): Promise<WorkerRestartAlertEventRecord[]> {
    const result = await this.withClient((client) =>
      client.query(
        `
          SELECT *
          FROM worker_restart_alert_events
          WHERE environment = $1 AND alert_id = $2
          ORDER BY created_at DESC
          LIMIT $3
        `,
        [environment, alertId, limit]
      )
    );
    return result.rows.map((row) => mapEvent(row as Record<string, unknown>));
  }

  async listDeliveryJournal(filters: WorkerRestartDeliveryJournalFilters): Promise<WorkerRestartDeliveryJournalResult> {
    const normalized = normalizeDeliveryFilters(filters);
    const params: unknown[] = [];
    const whereClause = this.buildDeliveryWhereClause(normalized, params);
    const result = await this.withClient((client) =>
      client.query(
        `
          WITH filtered AS (
            SELECT
              e.id AS event_id,
              e.environment,
              e.alert_id,
              a.restart_request_id,
              e.notification_destination_name AS destination_name,
              e.notification_destination_type AS destination_type,
              e.notification_sink_type AS sink_type,
              e.notification_formatter_profile AS formatter_profile,
              e.notification_event_type AS event_type,
              e.notification_status AS delivery_status,
              a.severity,
              a.status AS alert_status,
              a.source_category,
              e.notification_route_reason AS route_reason,
              e.notification_dedupe_key AS dedupe_key,
              e.notification_payload_fingerprint AS payload_fingerprint,
              e.notification_attempt_count AS attempt_count,
              e.notification_failure_reason AS failure_reason,
              e.notification_suppression_reason AS suppression_reason,
              e.summary,
              e.created_at AS attempted_at,
              COUNT(*) OVER() AS total_count
            FROM worker_restart_alert_events e
            JOIN worker_restart_alerts a ON a.id = e.alert_id AND a.environment = e.environment
            WHERE ${whereClause}
          )
          SELECT *
          FROM filtered
          ORDER BY attempted_at DESC, event_id DESC
          LIMIT $${params.length + 1}
          OFFSET $${params.length + 2}
        `,
        [...params, normalized.limit, normalized.offset]
      )
    );
    const rows = result.rows.map((row) => this.mapDeliveryJournalRow(row as Record<string, unknown>));
    const totalCount = rows.length > 0 ? Number((result.rows[0] as Record<string, unknown>).total_count ?? 0) : 0;
    return {
      windowStartAt: normalized.windowStartAt,
      windowEndAt: normalized.windowEndAt,
      limit: normalized.limit,
      offset: normalized.offset,
      totalCount,
      hasMore: normalized.offset + normalized.limit < totalCount,
      deliveries: rows,
    };
  }

  async summarizeDeliveryJournal(filters: WorkerRestartDeliveryJournalFilters): Promise<WorkerRestartDeliverySummaryResult> {
    const normalized = normalizeDeliveryFilters(filters);
    const params: unknown[] = [];
    const whereClause = this.buildDeliveryWhereClause(normalized, params);
    const result = await this.withClient((client) =>
      client.query(
        `
          WITH filtered AS (
            SELECT
              e.environment,
              e.alert_id,
              a.status AS alert_status,
              e.notification_destination_name AS destination_name,
              e.notification_destination_type AS destination_type,
              e.notification_sink_type AS sink_type,
              e.notification_formatter_profile AS formatter_profile,
              e.notification_event_type AS event_type,
              e.notification_status AS delivery_status,
              e.notification_route_reason AS route_reason,
              e.notification_failure_reason AS failure_reason,
              e.created_at AS attempted_at
            FROM worker_restart_alert_events e
            JOIN worker_restart_alerts a ON a.id = e.alert_id AND a.environment = e.environment
            WHERE ${whereClause}
          )
          SELECT
            destination_name,
            MAX(destination_type) AS destination_type,
            MAX(sink_type) AS sink_type,
            MAX(formatter_profile) AS formatter_profile,
            COUNT(*) AS total_count,
            COUNT(*) FILTER (WHERE delivery_status = 'sent') AS sent_count,
            COUNT(*) FILTER (WHERE delivery_status = 'failed') AS failed_count,
            COUNT(*) FILTER (WHERE delivery_status = 'suppressed') AS suppressed_count,
            COUNT(*) FILTER (WHERE delivery_status = 'skipped') AS skipped_count,
            COUNT(DISTINCT alert_id) FILTER (WHERE alert_status <> 'resolved') AS open_alert_count,
            ARRAY_AGG(DISTINCT environment) AS recent_environments,
            ARRAY_AGG(DISTINCT event_type) AS recent_event_types,
            MAX(attempted_at) AS last_activity_at,
            MAX(attempted_at) FILTER (WHERE delivery_status = 'sent') AS last_sent_at,
            MAX(attempted_at) FILTER (WHERE delivery_status = 'failed') AS last_failed_at,
            MAX(attempted_at) FILTER (WHERE delivery_status = 'suppressed') AS last_suppressed_at,
            MAX(attempted_at) FILTER (WHERE delivery_status = 'skipped') AS last_skipped_at,
            (ARRAY_AGG(failure_reason ORDER BY attempted_at DESC) FILTER (WHERE delivery_status = 'failed'))[1] AS last_failure_reason,
            (ARRAY_AGG(route_reason ORDER BY attempted_at DESC))[1] AS latest_route_reason
          FROM filtered
          GROUP BY destination_name
          ORDER BY MAX(attempted_at) DESC, destination_name ASC
        `,
        params
      )
    );

    const destinations = result.rows.map((row) => this.mapDeliverySummaryRow(row as Record<string, unknown>));
    return {
      windowStartAt: normalized.windowStartAt,
      windowEndAt: normalized.windowEndAt,
      totalCount: destinations.reduce((total, destination) => total + destination.totalCount, 0),
      destinations,
    };
  }

  async summarizeDeliveryTrends(filters: WorkerRestartDeliveryTrendFilters): Promise<WorkerRestartDeliveryTrendResult> {
    const normalized = normalizeTrendFilters(filters);
    const params: unknown[] = [];
    const whereClause = this.buildDeliveryWhereClause(normalized.deliveryFilters, params);
    params.push(normalized.currentWindowStartAt);
    const currentStartParam = `$${params.length}`;
    const result = await this.withClient((client) =>
      client.query(
        `
          WITH filtered AS (
            SELECT
              COALESCE(e.notification_destination_name, 'unknown') AS destination_name,
              e.notification_destination_type AS destination_type,
              e.notification_sink_type AS sink_type,
              e.notification_formatter_profile AS formatter_profile,
              e.notification_event_type AS event_type,
              e.notification_status AS delivery_status,
              e.environment,
              e.created_at AS attempted_at
            FROM worker_restart_alert_events e
            JOIN worker_restart_alerts a ON a.id = e.alert_id AND a.environment = e.environment
            WHERE ${whereClause}
          ),
          aggregated AS (
            SELECT
              destination_name,
              MAX(destination_type) AS destination_type,
              MAX(sink_type) AS sink_type,
              MAX(formatter_profile) AS formatter_profile,
              COUNT(*) FILTER (WHERE attempted_at >= ${currentStartParam}::timestamptz) AS current_total_count,
              COUNT(*) FILTER (WHERE attempted_at >= ${currentStartParam}::timestamptz AND delivery_status = 'sent') AS current_sent_count,
              COUNT(*) FILTER (WHERE attempted_at >= ${currentStartParam}::timestamptz AND delivery_status = 'failed') AS current_failed_count,
              COUNT(*) FILTER (WHERE attempted_at >= ${currentStartParam}::timestamptz AND delivery_status = 'suppressed') AS current_suppressed_count,
              COUNT(*) FILTER (WHERE attempted_at >= ${currentStartParam}::timestamptz AND delivery_status = 'skipped') AS current_skipped_count,
              COALESCE(ARRAY_AGG(DISTINCT environment ORDER BY environment) FILTER (WHERE attempted_at >= ${currentStartParam}::timestamptz), '{}'::text[]) AS current_recent_environments,
              COALESCE(ARRAY_AGG(DISTINCT event_type ORDER BY event_type) FILTER (WHERE attempted_at >= ${currentStartParam}::timestamptz), '{}'::text[]) AS current_recent_event_types,
              MAX(attempted_at) FILTER (WHERE attempted_at >= ${currentStartParam}::timestamptz) AS current_last_activity_at,
              MAX(attempted_at) FILTER (WHERE attempted_at >= ${currentStartParam}::timestamptz AND delivery_status = 'sent') AS current_last_sent_at,
              MAX(attempted_at) FILTER (WHERE attempted_at >= ${currentStartParam}::timestamptz AND delivery_status = 'failed') AS current_last_failed_at,
              MAX(attempted_at) FILTER (WHERE attempted_at >= ${currentStartParam}::timestamptz AND delivery_status = 'suppressed') AS current_last_suppressed_at,
              MAX(attempted_at) FILTER (WHERE attempted_at >= ${currentStartParam}::timestamptz AND delivery_status = 'skipped') AS current_last_skipped_at,
              COUNT(*) AS comparison_total_count,
              COUNT(*) FILTER (WHERE delivery_status = 'sent') AS comparison_sent_count,
              COUNT(*) FILTER (WHERE delivery_status = 'failed') AS comparison_failed_count,
              COUNT(*) FILTER (WHERE delivery_status = 'suppressed') AS comparison_suppressed_count,
              COUNT(*) FILTER (WHERE delivery_status = 'skipped') AS comparison_skipped_count,
              COALESCE(ARRAY_AGG(DISTINCT environment ORDER BY environment), '{}'::text[]) AS comparison_recent_environments,
              COALESCE(ARRAY_AGG(DISTINCT event_type ORDER BY event_type), '{}'::text[]) AS comparison_recent_event_types,
              MAX(attempted_at) AS comparison_last_activity_at,
              MAX(attempted_at) FILTER (WHERE delivery_status = 'sent') AS comparison_last_sent_at,
              MAX(attempted_at) FILTER (WHERE delivery_status = 'failed') AS comparison_last_failed_at,
              MAX(attempted_at) FILTER (WHERE delivery_status = 'suppressed') AS comparison_last_suppressed_at,
              MAX(attempted_at) FILTER (WHERE delivery_status = 'skipped') AS comparison_last_skipped_at
            FROM filtered
            GROUP BY destination_name
          ),
          ranked AS (
            SELECT
              *,
              COUNT(*) OVER() AS total_count
            FROM aggregated
            ORDER BY COALESCE(current_last_activity_at, comparison_last_activity_at) DESC, destination_name ASC
          )
          SELECT *
          FROM ranked
          LIMIT $${params.length + 1}
        `,
        [...params, normalized.limit]
      )
    );

    const destinations = result.rows.map((row) => this.mapDeliveryTrendRow(row as Record<string, unknown>, normalized));
    const totalCount = destinations.length > 0 ? Number((result.rows[0] as Record<string, unknown>).total_count ?? 0) : 0;
    return {
      referenceEndAt: normalized.referenceEndAt,
      currentWindowStartAt: normalized.currentWindowStartAt,
      comparisonWindowStartAt: normalized.comparisonWindowStartAt,
      limit: normalized.limit,
      totalCount,
      hasMore: destinations.length < totalCount,
      destinations,
    };
  }
}

export async function createWorkerRestartAlertRepository(
  databaseUrl?: string
): Promise<WorkerRestartAlertRepository> {
  if (!databaseUrl || databaseUrl.trim() === "") {
    return new InMemoryWorkerRestartAlertRepository();
  }

  return new PostgresWorkerRestartAlertRepository(new Pool({ connectionString: databaseUrl }));
}
