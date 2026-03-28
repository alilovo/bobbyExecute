import { describe, expect, it } from "vitest";
import {
  buildDeliveryJournalUrlState,
  buildDeliveryJournalShareUrl,
  buildDeliveryQueryFromDraft,
  buildTrendDrilldown,
  clearTrendDrilldownDraft,
  copyTextToClipboard,
  createEmptyDeliveryJournalDraft,
  getDeliveryJournalCopyButtonLabel,
  getDeliveryJournalCopyNotice,
  hasShareableDeliveryJournalState,
  normalizeDeliveryJournalDraft,
  parseDeliveryJournalUrlState,
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
  it("writes and restores a bounded 24h trend drilldown URL state", () => {
    const row = buildTrendRow();
    const draft = buildDraft();

    const current = buildTrendDrilldown(draft, row);
    const currentUrl = buildDeliveryJournalUrlState(current).toString();
    const parsedCurrent = parseDeliveryJournalUrlState(new URLSearchParams(currentUrl));

    expect(currentUrl).toBe(
      "environment=production&destinationName=primary&status=failed&eventType=alert_escalated&severity=critical&from=2026-03-27T00%3A00%3A00.000Z&to=2026-03-28T00%3A00%3A00.000Z&alertId=alert-123&restartRequestId=restart-123&formatterProfile=generic&drilldown=trend&window=24h"
    );
    expect(parsedCurrent.draft).toMatchObject({
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
    expect(parsedCurrent.drilldown).toEqual({
      destinationName: "primary",
      environment: "production",
      window: "24h",
      windowStartAt: "2026-03-27T00:00:00.000Z",
      windowEndAt: "2026-03-28T00:00:00.000Z",
    });
    expect(parsedCurrent.query).toMatchObject({
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

    const widened = buildTrendDrilldown(draft, row, "7d");
    const widenedUrl = buildDeliveryJournalUrlState(widened).toString();
    const parsedWidened = parseDeliveryJournalUrlState(new URLSearchParams(widenedUrl));

    expect(widenedUrl).toBe(
      "environment=production&destinationName=primary&status=failed&eventType=alert_escalated&severity=critical&from=2026-03-21T00%3A00%3A00.000Z&to=2026-03-28T00%3A00%3A00.000Z&alertId=alert-123&restartRequestId=restart-123&formatterProfile=generic&drilldown=trend&window=7d"
    );
    expect(parsedWidened.drilldown).toEqual({
      destinationName: "primary",
      environment: "production",
      window: "7d",
      windowStartAt: "2026-03-21T00:00:00.000Z",
      windowEndAt: "2026-03-28T00:00:00.000Z",
    });
  });

  it("normalizes malformed url params safely and preserves the journal filter context", () => {
    const parsed = parseDeliveryJournalUrlState(
      new URLSearchParams({
        environment: " production ",
        destinationName: " secondary ",
        status: "failed,bad-value",
        eventType: "alert_opened,not-real",
        severity: "warning,broken",
        from: "2026-03-28T00:00:00.000Z",
        to: "2026-03-27T00:00:00.000Z",
        alertId: " alert-9 ",
        restartRequestId: " restart-9 ",
        formatterProfile: " generic ",
        drilldown: "trend",
        window: "bad-window",
      })
    );

    expect(parsed.draft).toMatchObject({
      environment: "production",
      destinationName: "secondary",
      status: "failed",
      eventType: "alert_opened",
      severity: "warning",
      from: "",
      to: "",
      alertId: "alert-9",
      restartRequestId: "restart-9",
      formatterProfile: "generic",
    });
    expect(parsed.drilldown).toBeNull();
    expect(buildDeliveryJournalUrlState(parsed).toString()).toBe(
      "environment=production&destinationName=secondary&status=failed&eventType=alert_opened&severity=warning&alertId=alert-9&restartRequestId=restart-9&formatterProfile=generic"
    );
  });

  it("clears drilldown-specific params while preserving the broader journal filters", () => {
    const row = buildTrendRow();
    const current = buildTrendDrilldown(
      buildDraft({
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
      }),
      row
    );

    const clearedDraft = clearTrendDrilldownDraft(current.draft);
    const clearedUrl = buildDeliveryJournalUrlState({ draft: clearedDraft, drilldown: null }).toString();

    expect(clearedDraft).toMatchObject({
      environment: "staging",
      destinationName: "",
      status: "suppressed",
      eventType: "alert_opened",
      severity: "warning",
      from: "",
      to: "",
      alertId: "alert-9",
      restartRequestId: "restart-9",
      formatterProfile: "slack",
    });
    expect(clearedUrl).toBe(
      "environment=staging&status=suppressed&eventType=alert_opened&severity=warning&alertId=alert-9&restartRequestId=restart-9&formatterProfile=slack"
    );
  });

  it("normalizes an already empty draft to an empty query", () => {
    const empty = createEmptyDeliveryJournalDraft();

    expect(normalizeDeliveryJournalDraft(empty)).toEqual(empty);
    expect(buildDeliveryQueryFromDraft(empty)).toEqual({});
  });

  it("keeps the copy affordance hidden for the default unfiltered state", () => {
    const parsed = parseDeliveryJournalUrlState(new URLSearchParams());

    expect(hasShareableDeliveryJournalState(parsed)).toBe(false);
    expect(buildDeliveryJournalShareUrl("https://dashboard.example", "/control", parsed)).toBeNull();
  });

  it("copies a bounded journal filter URL even without an active drilldown", () => {
    const parsed = parseDeliveryJournalUrlState(
      new URLSearchParams({
        environment: "production",
        destinationName: "primary",
        status: "failed",
      })
    );

    expect(hasShareableDeliveryJournalState(parsed)).toBe(true);
    expect(getDeliveryJournalCopyButtonLabel(parsed)).toBe("Copy journal URL");
    expect(buildDeliveryJournalShareUrl("https://dashboard.example", "/control", parsed)).toBe(
      "https://dashboard.example/control?environment=production&destinationName=primary&status=failed"
    );
  });

  it("derives a shareable bounded URL and copy feedback from normalized drilldown state", async () => {
    const row = buildTrendRow();
    const draft = buildDraft();
    const drilldown = buildTrendDrilldown(draft, row, "24h");
    const parsed = parseDeliveryJournalUrlState(new URLSearchParams(buildDeliveryJournalUrlState(drilldown).toString()));
    const shareUrl = buildDeliveryJournalShareUrl("https://dashboard.example", "/control", parsed);

    expect(hasShareableDeliveryJournalState(parsed)).toBe(true);
    expect(getDeliveryJournalCopyButtonLabel(parsed)).toBe("Copy drilldown URL");
    expect(getDeliveryJournalCopyNotice(parsed, true)).toBe("Copied drilldown URL to clipboard.");
    expect(shareUrl).toBe(
      "https://dashboard.example/control?environment=production&destinationName=primary&status=failed&eventType=alert_escalated&severity=critical&from=2026-03-27T00%3A00%3A00.000Z&to=2026-03-28T00%3A00%3A00.000Z&alertId=alert-123&restartRequestId=restart-123&formatterProfile=generic&drilldown=trend&window=24h"
    );
    expect(shareUrl).not.toContain("dashboard-control-secret");
    expect(shareUrl).not.toContain("control.internal");

    const copied = await copyTextToClipboard(shareUrl ?? "", {
      writeText: async () => undefined,
    });
    expect(copied).toBe(true);
  });

  it("rejects malformed inputs and reports safe failure feedback for clipboard errors", async () => {
    const parsed = parseDeliveryJournalUrlState(
      new URLSearchParams({
        destinationName: "primary",
        from: "2026-03-28T00:00:00.000Z",
        to: "2026-03-27T00:00:00.000Z",
        drilldown: "trend",
        window: "7d",
      })
    );

    expect(hasShareableDeliveryJournalState(parsed)).toBe(true);
    expect(buildDeliveryJournalShareUrl("https://dashboard.example", "/control", parsed)).toBe(
      "https://dashboard.example/control?destinationName=primary"
    );
    expect(getDeliveryJournalCopyNotice(parsed, false, "The browser blocked clipboard access.")).toBe(
      "Clipboard unavailable. The browser blocked clipboard access."
    );

    const copied = await copyTextToClipboard("https://dashboard.example/control?destinationName=primary", {
      writeText: async () => {
        throw new Error("blocked");
      },
      fallbackCopy: () => false,
    });
    expect(copied).toBe(false);
  });
});
