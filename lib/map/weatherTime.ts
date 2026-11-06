/** Older API timestamps omit UTC; published timestamps already carry an offset. */
export function weatherTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(value)) return null;
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`;
  return Number.isFinite(Date.parse(normalized)) ? normalized : null;
}

export function formatRainfallTime(value: unknown): string {
  const timestamp = weatherTimestamp(value);
  if (!timestamp) return '—';
  return `as of ${new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit',
  }).format(new Date(timestamp))} PHT`;
}
