import { dateRangeError } from '../calendar/dates';
export function searchError(params: URLSearchParams) {
  const start = params.get('check_in') || '';
  const end = params.get('check_out') || '';
  if (start || end) {
    const error = dateRangeError(start, end);
    if (error) return error;
  }
  const guests = params.get('guests');
  if (
    guests &&
    (!/^\d+$/.test(guests) || !Number.isSafeInteger(Number(guests)) || Number(guests) < 1)
  )
    return 'Guest count must be a positive whole number.';
  const country = params.get('country');
  if (country && !/^[a-zA-Z]{2}$/.test(country))
    return 'Use a two-letter country code, such as PT, IN, or JP.';
  return '';
}
export function searchParams(params: URLSearchParams) {
  const result = new URLSearchParams();
  for (const key of ['city', 'country', 'check_in', 'check_out', 'guests']) {
    const value = params.get(key)?.trim();
    if (value) result.set(key, key === 'country' ? value.toUpperCase() : value);
  }
  const offset = params.get('offset');
  if (offset && /^\d+$/.test(offset) && Number.isSafeInteger(Number(offset)))
    result.set('offset', offset);
  result.set('limit', '12');
  return result;
}
