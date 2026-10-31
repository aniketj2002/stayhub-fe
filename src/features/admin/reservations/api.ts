import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '../../../lib/api';
import type {
  AdminCancelReservationInput,
  AdminRefundReservationInput,
  AdminReservationDetail,
  AdminReservationFilters,
  AdminReservationListResponse,
  PayoutRecord,
} from './types';

function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      searchParams.set(key, String(val));
    }
  });
  return searchParams.toString();
}

export function useAdminReservations(filters: AdminReservationFilters) {
  const qs = buildQueryString(filters as Record<string, unknown>);
  return useQuery({
    queryKey: ['admin', 'reservations', filters],
    queryFn: () =>
      request<AdminReservationListResponse>(`/api/v1/admin/reservations${qs ? `?${qs}` : ''}`),
  });
}

export function useAdminReservation(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'reservations', id],
    queryFn: () => request<AdminReservationDetail>(`/api/v1/admin/reservations/${id}`),
    enabled: !!id,
  });
}

export function useAdminCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminCancelReservationInput }) =>
      request<AdminReservationDetail>(`/api/v1/admin/reservations/${id}/cancel`, {
        method: 'POST',
        body: input,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['admin', 'reservations'] });
      qc.setQueryData(['admin', 'reservations', updated.reservation.id], updated);
    },
  });
}

export function useAdminRefund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminRefundReservationInput }) =>
      request<AdminReservationDetail>(`/api/v1/admin/reservations/${id}/refund`, {
        method: 'POST',
        body: input,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['admin', 'reservations'] });
      qc.setQueryData(['admin', 'reservations', updated.reservation.id], updated);
    },
  });
}

export function useAdminHoldPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ payoutId, reason }: { payoutId: string; reason: string }) =>
      request<PayoutRecord>(`/api/v1/admin/payouts/${payoutId}/hold`, {
        method: 'POST',
        body: { reason },
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reservations'] });
    },
  });
}

export function useAdminReleasePayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ payoutId, reason }: { payoutId: string; reason: string }) =>
      request<PayoutRecord>(`/api/v1/admin/payouts/${payoutId}/release`, {
        method: 'POST',
        body: { reason },
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reservations'] });
    },
  });
}

