import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '../../../lib/api';
import type {
  ListingDecisionInput,
  ReviewQueueItem,
  VersionDiff,
} from './types';

export function useReviewQueue(status: string = 'submitted') {
  return useQuery({
    queryKey: ['admin', 'listing-reviews', status],
    queryFn: () =>
      request<ReviewQueueItem[]>(`/api/v1/admin/listing-reviews?status=${encodeURIComponent(status)}`),
  });
}

export function useVersionDiff(versionId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'listing-reviews', 'diff', versionId],
    queryFn: () => request<VersionDiff>(`/api/v1/admin/listing-reviews/${versionId}/diff`),
    enabled: !!versionId,
  });
}

export function useApproveVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId, note }: { versionId: string; note: string }) =>
      request<void>(`/api/v1/admin/listing-reviews/${versionId}/approve`, {
        method: 'POST',
        body: { note } as ListingDecisionInput,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'listing-reviews'] });
    },
  });
}

export function useRequestChanges() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId, note }: { versionId: string; note: string }) =>
      request<void>(`/api/v1/admin/listing-reviews/${versionId}/request-changes`, {
        method: 'POST',
        body: { note } as ListingDecisionInput,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'listing-reviews'] });
    },
  });
}

export function useRejectVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId, note }: { versionId: string; note: string }) =>
      request<void>(`/api/v1/admin/listing-reviews/${versionId}/reject`, {
        method: 'POST',
        body: { note } as ListingDecisionInput,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'listing-reviews'] });
    },
  });
}

