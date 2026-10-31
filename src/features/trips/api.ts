import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '../../lib/api';
import type {
  CreateReservationAlterationInput,
  DeclineReservationAlterationInput,
  HostPendingAlteration,
  ReservationAlteration,
  TripItinerary,
} from './types';

export function useTripItinerary(reservationId: string | undefined) {
  return useQuery({
    queryKey: ['trips', reservationId, 'itinerary'],
    queryFn: () => request<TripItinerary>(`/api/v1/guest/trips/${reservationId}/itinerary`),
    enabled: !!reservationId,
  });
}

export function useReservationAlterations(reservationId: string | undefined) {
  return useQuery({
    queryKey: ['reservations', reservationId, 'alterations'],
    queryFn: async () => {
      const res = await request<{ alterations: ReservationAlteration[] } | ReservationAlteration[]>(
        `/api/v1/reservations/${reservationId}/alterations`,
      );
      if (Array.isArray(res)) return res;
      return res?.alterations || [];
    },
    enabled: !!reservationId,
  });
}

export function useHostDateChangeRequests() {
  return useQuery({
    queryKey: ['host-date-change-requests'],
    queryFn: () =>
      request<{ alterations: HostPendingAlteration[] | null }>('/api/v1/host/date-change-requests'),
    staleTime: 0,
    refetchInterval: 30000,
  });
}

export function useRequestAlteration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      reservationId,
      input,
    }: {
      reservationId: string;
      input: CreateReservationAlterationInput;
    }) =>
      request<ReservationAlteration>(`/api/v1/reservations/${reservationId}/alterations`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (_, { reservationId }) => {
      qc.invalidateQueries({ queryKey: ['reservations', reservationId, 'alterations'] });
      qc.invalidateQueries({ queryKey: ['trips', reservationId, 'itinerary'] });
      qc.invalidateQueries({ queryKey: ['reservations', reservationId] });
    },
  });
}

export function useApproveAlteration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      reservationId,
      alterationId,
    }: {
      reservationId: string;
      alterationId: string;
    }) =>
      request<ReservationAlteration>(
        `/api/v1/reservations/${reservationId}/alterations/${alterationId}/approve`,
        {
          method: 'POST',
        },
      ),
    onSuccess: (_, { reservationId }) => {
      qc.invalidateQueries({ queryKey: ['reservations', reservationId, 'alterations'] });
      qc.invalidateQueries({ queryKey: ['trips', reservationId, 'itinerary'] });
      qc.invalidateQueries({ queryKey: ['reservations', reservationId] });
      qc.invalidateQueries({ queryKey: ['host-date-change-requests'] });
    },
  });
}

export function useDeclineAlteration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      reservationId,
      alterationId,
      input,
    }: {
      reservationId: string;
      alterationId: string;
      input: DeclineReservationAlterationInput;
    }) =>
      request<ReservationAlteration>(
        `/api/v1/reservations/${reservationId}/alterations/${alterationId}/decline`,
        {
          method: 'POST',
          body: input,
        },
      ),
    onSuccess: (_, { reservationId }) => {
      qc.invalidateQueries({ queryKey: ['reservations', reservationId, 'alterations'] });
      qc.invalidateQueries({ queryKey: ['trips', reservationId, 'itinerary'] });
      qc.invalidateQueries({ queryKey: ['host-date-change-requests'] });
    },
  });
}

