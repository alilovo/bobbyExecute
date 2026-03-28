import type {
  WorkerRestartDeliveryQuery,
  WorkerRestartDeliveryTrendRow,
} from '@/types/api';

export type DeliveryDrilldownWindow = '24h' | '7d';

const MAX_FILTER_TEXT_LENGTH = 128;
const MAX_DELIVERY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const DRILLDOWN_MARKER = 'trend';
const DELIVERY_STATUSES = new Set(['sent', 'failed', 'suppressed', 'skipped']);
const DELIVERY_EVENT_TYPES = new Set([
  'alert_opened',
  'alert_escalated',
  'alert_acknowledged',
  'alert_resolved',
  'alert_repeated_failure_summary',
]);
const DELIVERY_SEVERITIES = new Set(['info', 'warning', 'critical']);

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

export interface DeliveryJournalUrlState {
  draft: DeliveryJournalDraft;
  query: WorkerRestartDeliveryQuery;
  drilldown: DeliveryTrendDrilldownState | null;
}

export interface TextCopyEnvironment {
  writeText?: (text: string) => Promise<void>;
  fallbackCopy?: (text: string) => boolean;
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

export function clearTrendDrilldownDraft(draft: DeliveryJournalDraft): DeliveryJournalDraft {
  return {
    ...draft,
    destinationName: '',
    from: '',
    to: '',
  };
}

function clampText(value: string): string {
  return value.trim().slice(0, MAX_FILTER_TEXT_LENGTH);
}

function parseDelimitedValues(value: string, allowed: ReadonlySet<string>): string {
  const normalized = value
    .split(',')
    .map((segment) => clampText(segment))
    .filter((segment) => segment.length > 0 && allowed.has(segment));
  return [...new Set(normalized)].join(',');
}

function parseTimestamp(value: string): string | undefined {
  if (value.trim().length === 0) {
    return undefined;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return new Date(parsed).toISOString();
}

function parseBoundedWindow(fromAt: string | undefined, toAt: string | undefined): { fromAt: string; toAt: string } | undefined {
  if (!fromAt || !toAt) {
    return undefined;
  }

  const fromMs = Date.parse(fromAt);
  const toMs = Date.parse(toAt);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) {
    return undefined;
  }

  if (toMs - fromMs > MAX_DELIVERY_WINDOW_MS) {
    return undefined;
  }

  return {
    fromAt: new Date(fromMs).toISOString(),
    toAt: new Date(toMs).toISOString(),
  };
}

function inferDrilldownWindow(fromAt: string, toAt: string): DeliveryDrilldownWindow | undefined {
  const span = Date.parse(toAt) - Date.parse(fromAt);
  if (span === 24 * 60 * 60 * 1000) {
    return '24h';
  }

  if (span === 7 * 24 * 60 * 60 * 1000) {
    return '7d';
  }

  return undefined;
}

function parseTrendFilter(value: string | null): string {
  return value == null ? '' : clampText(value);
}

function parseSafeDeliveryFilter(value: string | null, allowed: ReadonlySet<string>): string {
  if (value == null) {
    return '';
  }

  return parseDelimitedValues(clampText(value), allowed);
}

export function normalizeDeliveryJournalDraft(draft: DeliveryJournalDraft): DeliveryJournalDraft {
  const environment = clampText(draft.environment);
  const destinationName = clampText(draft.destinationName);
  const status = parseSafeDeliveryFilter(draft.status, DELIVERY_STATUSES);
  const eventType = parseSafeDeliveryFilter(draft.eventType, DELIVERY_EVENT_TYPES);
  const severity = parseSafeDeliveryFilter(draft.severity, DELIVERY_SEVERITIES);
  const from = parseTimestamp(clampText(draft.from));
  const to = parseTimestamp(clampText(draft.to));
  const bounded = parseBoundedWindow(from, to);

  return {
    environment,
    destinationName,
    status,
    eventType,
    severity,
    from: bounded?.fromAt ?? '',
    to: bounded?.toAt ?? '',
    alertId: clampText(draft.alertId),
    restartRequestId: clampText(draft.restartRequestId),
    formatterProfile: clampText(draft.formatterProfile),
  };
}

export function buildDeliveryQueryFromDraft(draft: DeliveryJournalDraft): WorkerRestartDeliveryQuery {
  const normalized = normalizeDeliveryJournalDraft(draft);
  const next: WorkerRestartDeliveryQuery = {};
  const environment = normalized.environment;
  const destinationName = normalized.destinationName;
  const status = normalized.status;
  const eventType = normalized.eventType;
  const severity = normalized.severity;
  const from = normalized.from;
  const to = normalized.to;
  const alertId = normalized.alertId;
  const restartRequestId = normalized.restartRequestId;
  const formatterProfile = normalized.formatterProfile;
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
    draft: { ...normalizeDeliveryJournalDraft(draft) },
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
  const normalizedDraft = normalizeDeliveryJournalDraft(currentDraft);
  const draft: DeliveryJournalDraft = {
    ...normalizedDraft,
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

export function parseDeliveryJournalUrlState(searchParams: URLSearchParams): DeliveryJournalUrlState {
  const draft = normalizeDeliveryJournalDraft({
    ...createEmptyDeliveryJournalDraft(),
    environment: parseTrendFilter(searchParams.get('environment')),
    destinationName: parseTrendFilter(searchParams.get('destinationName')),
    status: parseSafeDeliveryFilter(searchParams.get('status'), DELIVERY_STATUSES),
    eventType: parseSafeDeliveryFilter(searchParams.get('eventType'), DELIVERY_EVENT_TYPES),
    severity: parseSafeDeliveryFilter(searchParams.get('severity'), DELIVERY_SEVERITIES),
    from: parseTimestamp(parseTrendFilter(searchParams.get('from'))) ?? '',
    to: parseTimestamp(parseTrendFilter(searchParams.get('to'))) ?? '',
    alertId: parseTrendFilter(searchParams.get('alertId')),
    restartRequestId: parseTrendFilter(searchParams.get('restartRequestId')),
    formatterProfile: parseTrendFilter(searchParams.get('formatterProfile')),
  });
  const drilldownMarker = parseTrendFilter(searchParams.get('drilldown'));
  const inferredWindow = draft.from && draft.to ? inferDrilldownWindow(draft.from, draft.to) : undefined;
  const query = buildDeliveryQueryFromDraft(draft);

  if (drilldownMarker !== DRILLDOWN_MARKER || !inferredWindow || !draft.destinationName || !draft.from || !draft.to) {
    return {
      draft,
      query,
      drilldown: null,
    };
  }

  return {
    draft,
    query,
    drilldown: {
      destinationName: draft.destinationName,
      environment: draft.environment.trim() || undefined,
      window: inferredWindow,
      windowStartAt: draft.from,
      windowEndAt: draft.to,
    },
  };
}

export function buildDeliveryJournalUrlState(state: DeliveryJournalUrlState): URLSearchParams {
  const params = new URLSearchParams();
  const draft = normalizeDeliveryJournalDraft(state.draft);
  if (draft.environment) params.set('environment', draft.environment);
  if (draft.destinationName) params.set('destinationName', draft.destinationName);
  if (draft.status) params.set('status', draft.status);
  if (draft.eventType) params.set('eventType', draft.eventType);
  if (draft.severity) params.set('severity', draft.severity);
  if (draft.from) params.set('from', draft.from);
  if (draft.to) params.set('to', draft.to);
  if (draft.alertId) params.set('alertId', draft.alertId);
  if (draft.restartRequestId) params.set('restartRequestId', draft.restartRequestId);
  if (draft.formatterProfile) params.set('formatterProfile', draft.formatterProfile);

  if (state.drilldown) {
    params.set('drilldown', DRILLDOWN_MARKER);
    params.set('window', state.drilldown.window);
    params.set('from', state.drilldown.windowStartAt);
    params.set('to', state.drilldown.windowEndAt);
  }

  return params;
}

export function buildDeliveryJournalUrlPathname(pathname: string, state: DeliveryJournalUrlState): string {
  const params = buildDeliveryJournalUrlState(state).toString();
  return params.length > 0 ? `${pathname}?${params}` : pathname;
}

export function hasShareableDeliveryJournalState(state: DeliveryJournalUrlState): boolean {
  return buildDeliveryJournalUrlState(state).toString().length > 0;
}

export function buildDeliveryJournalShareUrl(origin: string, pathname: string, state: DeliveryJournalUrlState): string | null {
  const canonicalPath = buildDeliveryJournalUrlPathname(pathname, state);
  return canonicalPath.includes('?') ? `${origin}${canonicalPath}` : null;
}

export function getDeliveryJournalCopyButtonLabel(state: DeliveryJournalUrlState): string {
  return state.drilldown ? 'Copy drilldown URL' : 'Copy journal URL';
}

export function getDeliveryJournalCopyNotice(
  state: DeliveryJournalUrlState,
  copied: boolean,
  fallbackMessage?: string
): string {
  if (copied) {
    return state.drilldown ? 'Copied drilldown URL to clipboard.' : 'Copied journal URL to clipboard.';
  }

  return fallbackMessage ? `Clipboard unavailable. ${fallbackMessage}` : 'Clipboard unavailable. Copy the URL from the address bar.';
}

function defaultClipboardWriteText(): ((text: string) => Promise<void>) | undefined {
  const nav = globalThis.navigator;
  const clipboard = nav?.clipboard;
  if (!clipboard || typeof clipboard.writeText !== 'function') {
    return undefined;
  }

  return clipboard.writeText.bind(clipboard);
}

function defaultFallbackCopy(text: string): boolean {
  const doc = globalThis.document;
  if (!doc || !doc.body) {
    return false;
  }

  const textarea = doc.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  doc.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let copied = false;
  try {
    copied = doc.execCommand('copy');
  } catch {
    copied = false;
  }

  textarea.remove();
  return copied;
}

export async function copyTextToClipboard(text: string, environment: TextCopyEnvironment = {}): Promise<boolean> {
  const writeText = environment.writeText ?? defaultClipboardWriteText();
  if (writeText) {
    try {
      await writeText(text);
      return true;
    } catch {
      // Fall through to the fallback copy path.
    }
  }

  const fallbackCopy = environment.fallbackCopy ?? defaultFallbackCopy;
  try {
    return fallbackCopy(text);
  } catch {
    return false;
  }
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
