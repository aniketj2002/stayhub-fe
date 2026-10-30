import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api';
import { clearAttempt, loadAttempt, saveAttempt, uncertainOutcome } from './attempts';
import { refundSignature } from './presentation';
import { refundPreview } from '../../test/reservationFixtures';
afterEach(() => {
  for (const scope of ['test-user:booking', 'other-user:booking']) clearAttempt(scope);
  vi.unstubAllGlobals();
});
describe('durable transaction attempts', () => {
  it('reuses one key for the exact payload, persists its reviewed terms, and isolates users', () => {
    const stored = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => stored.get(key) || null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    });
    const first = saveAttempt(
      'test-user:booking',
      '/api/v1/reservations',
      { guests: 2 },
      'reviewed quote',
    );
    const replay = saveAttempt('test-user:booking', '/api/v1/reservations', { guests: 2 });
    expect(replay.key).toBe(first.key);
    expect(loadAttempt('test-user:booking')?.review).toBe('reviewed quote');
    expect(loadAttempt('other-user:booking')).toBeNull();
    expect(() => saveAttempt('test-user:booking', '/api/v1/reservations', { guests: 3 })).toThrow(
      'Resolve the previous attempt',
    );
    clearAttempt('test-user:booking');
    expect(saveAttempt('test-user:booking', '/api/v1/reservations', { guests: 3 }).key).not.toBe(
      first.key,
    );
  });
  it('keeps uncertain outcomes retryable while treating definitive conflicts as terminal', () => {
    for (const error of [
      new TypeError('offline'),
      new ApiError(0, 'NETWORK_ERROR', ''),
      new ApiError(500, 'INTERNAL_ERROR', ''),
      new ApiError(409, 'IDEMPOTENCY_IN_FLIGHT', ''),
      new ApiError(200, 'INVALID_RESPONSE', ''),
    ])
      expect(uncertainOutcome(error)).toBe(true);
    for (const error of [
      new ApiError(409, 'DATES_UNAVAILABLE', ''),
      new ApiError(409, 'INVALID_STATE_TRANSITION', ''),
      new ApiError(403, 'FORBIDDEN', ''),
      new ApiError(422, 'VALIDATION_ERROR', ''),
    ])
      expect(uncertainOutcome(error)).toBe(false);
  });
  it('detects changed refund terms without reconfirming just because evaluation time moved', () => {
    const initial = refundPreview();
    expect(refundSignature({ ...initial, evaluated_at: '2030-01-01T00:01:00Z' })).toBe(
      refundSignature(initial),
    );
    expect(refundSignature(refundPreview(10500))).not.toBe(refundSignature(initial));
    expect(refundSignature(refundPreview(0))).not.toBe(refundSignature(initial));
  });
});
