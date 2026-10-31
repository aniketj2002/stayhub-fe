import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '../../lib/api';
import type { CreateICalFeedInput, ICalExportResponse, ICalFeed } from './types';

export function useIcalFeeds(listingId: string | undefined) {
  return useQuery({
    queryKey: ['host', 'listings', listingId, 'ical-feeds'],
    queryFn: () => request<ICalFeed[]>(`/api/v1/host/listings/${listingId}/ical-feeds`),
    enabled: !!listingId,
  });
}

export function useAddIcalFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listingId, input }: { listingId: string; input: CreateICalFeedInput }) =>
      request<ICalFeed>(`/api/v1/host/listings/${listingId}/ical-feeds`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (_, { listingId }) => {
      qc.invalidateQueries({ queryKey: ['host', 'listings', listingId, 'ical-feeds'] });
      qc.invalidateQueries({ queryKey: ['calendar', listingId] });
    },
  });
}

export function useDeleteIcalFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listingId, feedId }: { listingId: string; feedId: string }) =>
      request<void>(`/api/v1/host/listings/${listingId}/ical-feeds/${feedId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_, { listingId }) => {
      qc.invalidateQueries({ queryKey: ['host', 'listings', listingId, 'ical-feeds'] });
      qc.invalidateQueries({ queryKey: ['calendar', listingId] });
    },
  });
}

export function useRegenerateExportToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listingId: string) =>
      request<ICalExportResponse>(`/api/v1/host/listings/${listingId}/ical-export-token/regenerate`, {
        method: 'POST',
      }),
    onSuccess: (_, listingId) => {
      qc.invalidateQueries({ queryKey: ['host', 'listings', listingId] });
    },
  });
}

