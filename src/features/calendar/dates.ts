export function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}
export function isDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && isoDay(date) === value;
}
export function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDay(date);
}
export function monthStart(value: string) {
  return `${value.slice(0, 7)}-01`;
}
export function shiftMonth(value: string, months: number) {
  const date = new Date(`${monthStart(value)}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return isoDay(date);
}
export function dateRangeError(start: string, end: string) {
  if (!isDay(start) || !isDay(end)) return 'Choose valid check-in and checkout dates.';
  if (end <= start) return 'The end date must be after the start date.';
  if ((Date.parse(end) - Date.parse(start)) / 86400000 > 366)
    return 'Choose a range of 366 nights or fewer.';
  return '';
}
export function nightsInRange(start: string, end: string) {
  if (dateRangeError(start, end)) return [];
  const nights: string[] = [];
  for (let day = start; day < end; day = addDays(day, 1)) nights.push(day);
  return nights;
}
