import type {
  WorkerRestartDeliveryQuery,
  WorkerRestartDeliveryTrendRow,
} from '@/types/api';

export type DeliveryDrilldownWindow = '24h' | '7d';

export interface DeliveryJournalDraft {
  environment: string;
  destinationName: string;
  status: string;
  eventType: string;
  severity: string;
  from: string;
  to: string;
  alertId: string;
  restartRequestId: string;
  formatterProfile: string;
}

export interface DeliveryJournalSnapshot {
  draft: DeliveryJournalDraft;
  query: WorkerRestartDeliveryQuery;
}

export interface DeliveryTrendDrilldownState {
  destinationName: string;
  environment?: string;
  window: DeliveryDrilldownWindow;
  windowStartAt: string;
  windowEndAt: string;
}

export interface DeliveryTrendDrilldownResult {
  draft: DeliveryJournalDraft;
  query: WorkerRestartDeliveryQuery;
  drilldown: DeliveryTrendDrilldownState;
}

export function createEmptyDeliveryJournalDraft(): DeliveryJournalDraft {
  return {
    environment: '',
    destinationName: '',
    status: '',
    eventType: '',
    severity: '',
    from: '',
    to: '',
    alertId: '',
    restartRequestId: '',
    formatterProfile: '',
  };
}

export function buildDeliveryQueryFromDraft(draft: DeliveryJournalDraft): WorkerRestartDeliveryQuery {
  const next: WorkerRestartDeliveryQuery = {};
  const environment = draft.environment.trim();
  const destinationName = draft.destinationName.trim();
  const status = draft.status.trim();
  const eventType = draft.eventType.trim();
  const severity = draft.severity.trim();
  const from = draft.from.trim();
  const to = draft.to.trim();
  const alertId = draft.alertId.trim();
  const restartRequestId = draft.restartRequestId.trim();
  const formatterProfile = draft.formatterProfile.trim();
  if (environment) next.environment = environment;
  if (destinationName) next.destinationName = destinationName;
  if (status) next.status = status;
  if (eventType) next.eventType = eventType;
  if (severity) next.severity = severity;
  if (from) next.from = from;
  if (to) next.to = to;
  if (alertId) next.alertId = alertId;
  if (restartRequestId) next.restartRequestId = restartRequestId;
  if (formatterProfile) next.formatterProfile = formatterProfile;
  return next;
}

export function captureDeliveryJournalSnapshot(draft: DeliveryJournalDraft): DeliveryJournalSnapshot {
  return {
    draft: { ...draft },
    query: buildDeliveryQueryFromDraft(draft),
  };
}

export function restoreDeliveryJournalSnapshot(snapshot: DeliveryJournalSnapshot): DeliveryJournalSnapshot {
  return {
    draft: { ...snapshot.draft },
    query: { ...snapshot.query },
  };
}

export function buildTrendDrilldown(
  currentDraft: DeliveryJournalDraft,
  row: WorkerRestartDeliveryTrendRow,
  window: DeliveryDrilldownWindow = '24h'
): DeliveryTrendDrilldownResult {
  const draft: DeliveryJournalDraft = {
    ...currentDraft,
    destinationName: row.destinationName,
    from: window === '7d' ? row.comparisonWindow.windowStartAt : row.currentWindow.windowStartAt,
    to: row.currentWindow.windowEndAt,
  };
  const query = buildDeliveryQueryFromDraft(draft);

  return {
    draft,
    query,
    drilldown: {
      destinationName: row.destinationName,
      environment: draft.environment.trim() || undefined,
      window,
      windowStartAt: draft.from,
      windowEndAt: draft.to,
    },
  };
}

export function drilldownLabel(drilldown: DeliveryTrendDrilldownState): string {
  const environment = drilldown.environment ? ` in ${drilldown.environment}` : '';
  return `${drilldown.destinationName}${environment} · ${drilldown.window} window`;
}

export function drilldownWindowRangeLabel(drilldown: DeliveryTrendDrilldownState): string {
  return `${drilldown.windowStartAt} → ${drilldown.windowEndAt}`;
}

export function drilldownSourceLabel(row: WorkerRestartDeliveryTrendRow): string {
  return `${row.destinationName} (${row.currentWindow.windowStartAt} → ${row.currentWindow.windowEndAt})`;
}
