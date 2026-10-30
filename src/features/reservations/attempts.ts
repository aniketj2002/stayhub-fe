import { ApiError } from '../../lib/api';
export interface Attempt {
  key: string;
  path: string;
  body: Record<string, unknown>;
  review?: string;
}
const memory = new Map<string, Attempt>();
const keyFor = (scope: string) => `stayhub.attempt.${scope}`;
export function loadAttempt(scope: string): Attempt | null {
  try {
    const raw = sessionStorage.getItem(keyFor(scope));
    if (raw) {
      const value = JSON.parse(raw) as Attempt;
      if (
        typeof value.key === 'string' &&
        typeof value.path === 'string' &&
        value.body &&
        typeof value.body === 'object'
      )
        return value;
    }
  } catch {
    /* In-memory recovery remains available. */
  }
  return memory.get(scope) || null;
}
export function saveAttempt(
  scope: string,
  path: string,
  body: Record<string, unknown>,
  review?: string,
): Attempt {
  const existing = loadAttempt(scope);
  if (existing) {
    if (existing.path !== path || JSON.stringify(existing.body) !== JSON.stringify(body))
      throw new Error('Resolve the previous attempt before changing this request.');
    return existing;
  }
  const attempt = { key: crypto.randomUUID(), path, body, review };
  memory.set(scope, attempt);
  try {
    sessionStorage.setItem(keyFor(scope), JSON.stringify(attempt));
  } catch {
    /* Retry works until this page is reloaded. */
  }
  return attempt;
}
export function clearAttempt(scope: string) {
  memory.delete(scope);
  try {
    sessionStorage.removeItem(keyFor(scope));
  } catch {
    /* No persistent record. */
  }
}
export function uncertainOutcome(error: unknown) {
  return (
    !(error instanceof ApiError) ||
    error.status === 0 ||
    error.status >= 500 ||
    [401, 408, 429].includes(error.status) ||
    ['IDEMPOTENCY_IN_FLIGHT', 'SESSION_CHANGED', 'INVALID_RESPONSE'].includes(error.code)
  );
}
