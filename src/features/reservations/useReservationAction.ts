import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, request } from '../../lib/api';
import { getCurrentUserId } from '../auth/session';
import { clearAttempt, loadAttempt, saveAttempt, uncertainOutcome } from './attempts';
import { reservationKeys } from './api';
import type { ReservationDetail } from './types';

export function useReservationAction(scope: string) {
  const [attempt, setAttempt] = useState(() => loadAttempt(scope));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lock = useRef(false);
  const cache = useQueryClient();
  async function run(
    path: string,
    body: Record<string, unknown>,
    review?: string,
  ): Promise<ReservationDetail | null> {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    setError(null);
    const actor = getCurrentUserId();
    try {
      const transaction = saveAttempt(scope, path, body, review);
      setAttempt(transaction);
      const result = await request<ReservationDetail>(path, {
        method: 'POST',
        body: transaction.body,
        idempotencyKey: transaction.key,
      });
      if (!result?.reservation?.id || !result.reservation.status)
        throw new ApiError(
          200,
          'INVALID_RESPONSE',
          'The reservation result could not be read. Retry to recover it.',
        );
      clearAttempt(scope);
      setAttempt(null);
      if (getCurrentUserId() !== actor) return null;
      cache.setQueryData(reservationKeys.detail(result.reservation.id), result);
      for (const key of [
        reservationKeys.trips,
        reservationKeys.today,
        reservationKeys.earnings,
        ['calendar'],
        ['search'],
        ['public-listing'],
        ['quote'],
      ])
        void cache.invalidateQueries({ queryKey: key });
      return result;
    } catch (e) {
      setError(e);
      if (e instanceof ApiError && [403, 404, 409].includes(e.status)) {
        for (const key of [
          ['reservation'],
          reservationKeys.today,
          reservationKeys.trips,
          reservationKeys.earnings,
          ['calendar'],
          ['host-listing'],
          ['host-listings'],
        ])
          void cache.invalidateQueries({ queryKey: key });
      }
      if (!uncertainOutcome(e)) {
        clearAttempt(scope);
        setAttempt(null);
      }
      return null;
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return { attempt, busy, error, run };
}
