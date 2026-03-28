import { describe, expect, it } from "vitest";
import {
  buildDeliveryQueryFromDraft,
  buildTrendDrilldown,
  captureDeliveryJournalSnapshot,
  createEmptyDeliveryJournalDraft,
  restoreDeliveryJournalSnapshot,
  type DeliveryJournalDraft,
} from "../../../dashboard/src/lib/delivery-drilldown.ts";
import type { WorkerRestartDeliveryTrendRow } from "../../../dashboard/src/types/api.ts";

function buildTrendRow(overrides: Partial<WorkerRestartDeliveryTrendRow> = {}): WorkerRestartDeliveryTrendRow {
  return {
    destinationName: overrides.destinationName ?? "primary",
    destinationType: overrides.destinationType ?? "webhook",
    sinkType: overrides.sinkType ?? "generic_webhook",
    formatterProfile: overrides.formatterProfile ?? "generic",
    currentWindow: overrides.currentWindow ?? {
      windowStartAt: "2026-03-27T00:00:00.000Z",
      windowEndAt: "2026-03-28T00:00:00.000Z",
      totalCount: 3,
      sentCount: 1,
      failedCount: 2,
      suppressedCount: 0,
      skippedCount: 0,
      failureRate: 0.6666666667,
      suppressionRate: 0,
      healthHint: "failing",
      recentEnvironments: ["production"],
      recentEventTypes: ["alert_escalated"],
      lastActivityAt: "2026-03-27T12:00:00.000Z",
      lastSentAt: "2026-03-27T11:00:00.000Z",
      lastFailedAt: "2026-03-27T12:00:00.000Z",
      lastSuppressedAt: undefined,
      lastSkippedAt: undefined,
    },
    comparisonWindow: overrides.comparisonWindow ?? {
      windowStartAt: "2026-03-21T00:00:00.000Z",
      windowEndAt: "2026-03-28T00:00:00.000Z",
      totalCount: 12,
      sentCount: 8,
      failedCount: 4,
      suppressedCount: 0,
      skippedCount: 0,
      failureRate: 0.3333333333,
      suppressionRate: 0,
      healthHint: "degraded",
      recentEnvironments: ["production"],
      recentEventTypes: ["alert_opened", "alert_escalated"],
      lastActivityAt: "2026-03-27T12:00:00.000Z",
      lastSentAt: "2026-03-27T11:00:00.000Z",
      lastFailedAt: "2026-03-27T12:00:00.000Z",
      lastSuppressedAt: undefined,
      lastSkippedAt: undefined,
    },
    currentHealthHint: overrides.currentHealthHint ?? "failing",
    comparisonHealthHint: overrides.comparisonHealthHint ?? "degraded",
    trendHint: overrides.trendHint ?? "worsening",
    recentFailureDelta: overrides.recentFailureDelta ?? 1,
    recentSuppressionDelta: overrides.recentSuppressionDelta ?? 0,
    recentVolumeDelta: overrides.recentVolumeDelta ?? 0,
    lastSentAt: overrides.lastSentAt ?? "2026-03-27T11:00:00.000Z",
    lastFailedAt: overrides.lastFailedAt ?? "2026-03-27T12:00:00.000Z",
    summaryText: overrides.summaryText ?? "Delivery behavior is worsening.",
  };
}

function buildDraft(overrides: Partial<DeliveryJournalDraft> = {}): DeliveryJournalDraft {
  return {
    environment: overrides.environment ?? "production",
    destinationName: overrides.destinationName ?? "",
    status: overrides.status ?? "failed",
    eventType: overrides.eventType ?? "alert_escalated",
    severity: overrides.severity ?? "critical",
    from: overrides.from ?? "2026-03-26T00:00:00.000Z",
    to: overrides.to ?? "2026-03-28T00:00:00.000Z",
    alertId: overrides.alertId ?? "alert-123",
    restartRequestId: overrides.restartRequestId ?? "restart-123",
    formatterProfile: overrides.formatterProfile ?? "generic",
  };
}

describe("delivery drilldown helper", () => {
  it("maps a trend row into a bounded 24h and 7d journal query", () => {
    const row = buildTrendRow();
    const draft = buildDraft();

    const current = buildTrendDrilldown(draft, row);
    const widened = buildTrendDrilldown(draft, row, "7d");

    expect(current.draft.destinationName).toBe("primary");
    expect(current.draft.from).toBe("2026-03-27T00:00:00.000Z");
    expect(current.draft.to).toBe("2026-03-28T00:00:00.000Z");
    expect(current.drilldown.window).toBe("24h");
    expect(current.drilldown.windowStartAt).toBe("2026-03-27T00:00:00.000Z");
    expect(current.drilldown.environment).toBe("production");
    expect(current.query).toMatchObject({
      environment: "production",
      destinationName: "primary",
      status: "failed",
      eventType: "alert_escalated",
      severity: "critical",
      from: "2026-03-27T00:00:00.000Z",
      to: "2026-03-28T00:00:00.000Z",
      alertId: "alert-123",
      restartRequestId: "restart-123",
      formatterProfile: "generic",
    });

    expect(widened.draft.from).toBe("2026-03-21T00:00:00.000Z");
    expect(widened.draft.to).toBe("2026-03-28T00:00:00.000Z");
    expect(widened.drilldown.window).toBe("7d");
    expect(widened.query).toMatchObject({
      environment: "production",
      destinationName: "primary",
      from: "2026-03-21T00:00:00.000Z",
      to: "2026-03-28T00:00:00.000Z",
    });
  });

  it("preserves and restores the pre-drilldown journal filter state", () => {
    const draft = buildDraft({
      environment: "staging",
      destinationName: "secondary",
      status: "suppressed",
      eventType: "alert_opened",
      severity: "warning",
      from: "2026-03-25T00:00:00.000Z",
      to: "2026-03-28T00:00:00.000Z",
      alertId: "alert-9",
      restartRequestId: "restart-9",
      formatterProfile: "slack",
    });
    const snapshot = captureDeliveryJournalSnapshot(draft);
    const restored = restoreDeliveryJournalSnapshot(snapshot);
    const empty = createEmptyDeliveryJournalDraft();

    expect(snapshot.query).toMatchObject({
      environment: "staging",
      destinationName: "secondary",
      status: "suppressed",
      eventType: "alert_opened",
      severity: "warning",
      from: "2026-03-25T00:00:00.000Z",
      to: "2026-03-28T00:00:00.000Z",
      alertId: "alert-9",
      restartRequestId: "restart-9",
      formatterProfile: "slack",
    });
    expect(restored).toEqual(snapshot);
    expect(buildDeliveryQueryFromDraft(empty)).toEqual({});
  });
});
