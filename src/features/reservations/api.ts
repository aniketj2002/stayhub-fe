import { request } from '../../lib/api';
import type { Earnings, RefundPreview, ReservationDetail, Today } from './types';
export const reservationKeys = {
  detail: (id: string) => ['reservation', id] as const,
  trips: ['trips'] as const,
  today: ['host-today'] as const,
  earnings: ['host-earnings'] as const,
};
export const getTrips = (tab: string, signal?: AbortSignal) =>
  request<{ trips: ReservationDetail[] | null; count: number }>(
    `/api/v1/guest/trips?${new URLSearchParams({ tab })}`,
    { signal },
  );
export const getReservation = (id: string, signal?: AbortSignal) =>
  request<ReservationDetail>(`/api/v1/reservations/${encodeURIComponent(id)}`, { signal });
export const getCancelPreview = (id: string, signal?: AbortSignal) =>
  request<{ cancel_preview: RefundPreview }>(
    `/api/v1/reservations/${encodeURIComponent(id)}/cancel-preview`,
    { signal },
  );
export const getToday = (signal?: AbortSignal) => request<Today>('/api/v1/host/today', { signal });
export const getEarnings = (signal?: AbortSignal) =>
  request<Earnings>('/api/v1/host/earnings', { signal });
