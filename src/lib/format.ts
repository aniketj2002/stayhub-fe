export function formatMoney(minor: number, currency = 'EUR', locale = 'en-GB') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);
}

// Date-only stay nights never pass through the browser's local timezone.
export function formatStayDate(date: string, locale = 'en-GB') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Expected YYYY-MM-DD');
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
    throw new Error('Invalid stay date');
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

export function formatTimestamp(timestamp: string, timeZone: string, locale = 'en-GB') {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(timestamp));
}
