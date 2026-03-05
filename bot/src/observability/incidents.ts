/**
 * M10: Incident counters by adapter/error type.
 */
const counters: Record<string, number> = {};

export function incrementIncident(adapterId: string, errorType?: string): void {
  const key = errorType ? `${adapterId}:${errorType}` : adapterId;
  counters[key] = (counters[key] ?? 0) + 1;
}

export function getIncidentCount(adapterId?: string): number | Record<string, number> {
  if (!adapterId) return { ...counters };
  return Object.entries(counters)
    .filter(([k]) => k.startsWith(adapterId))
    .reduce((s, [, v]) => s + v, 0);
}
