import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '../../lib/api';
import type {
  DateOverride,
  DateOverrideDeleteRangeInput,
  DateOverrideRangeInput,
  PricingRuleInput,
  PricingRules,
} from './types';

export function usePricingRules(listingId: string | undefined) {
  return useQuery({
    queryKey: ['host', 'listings', listingId, 'pricing-rules'],
    queryFn: () => request<PricingRules>(`/api/v1/host/listings/${listingId}/pricing-rules`),
    enabled: !!listingId,
  });
}

export function useUpdatePricingRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listingId, input }: { listingId: string; input: PricingRuleInput }) =>
      request<PricingRules>(`/api/v1/host/listings/${listingId}/pricing-rules`, {
        method: 'PUT',
        body: input,
      }),
    onSuccess: (saved, { listingId }) => {
      qc.setQueryData(['host', 'listings', listingId, 'pricing-rules'], saved);
      qc.invalidateQueries({ queryKey: ['host', 'listings', listingId] });
    },
  });
}

export function useDateOverrides(listingId: string | undefined, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();

  return useQuery({
    queryKey: ['host', 'listings', listingId, 'date-overrides', from, to],
    queryFn: () =>
      request<DateOverride[]>(`/api/v1/host/listings/${listingId}/date-overrides${qs ? `?${qs}` : ''}`),
    enabled: !!listingId,
  });
}

export function useSetDateOverrides() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listingId, input }: { listingId: string; input: DateOverrideRangeInput }) =>
      request<DateOverride[]>(`/api/v1/host/listings/${listingId}/date-overrides`, {
        method: 'PUT',
        body: input,
      }),
    onSuccess: (_, { listingId }) => {
      qc.invalidateQueries({ queryKey: ['host', 'listings', listingId, 'date-overrides'] });
      qc.invalidateQueries({ queryKey: ['calendar', listingId] });
    },
  });
}

export function useDeleteDateOverrides() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      listingId,
      input,
    }: {
      listingId: string;
      input: DateOverrideDeleteRangeInput;
    }) =>
      request<{ deleted: number }>(`/api/v1/host/listings/${listingId}/date-overrides`, {
        method: 'DELETE',
        body: input,
      }),
    onSuccess: (_, { listingId }) => {
      qc.invalidateQueries({ queryKey: ['host', 'listings', listingId, 'date-overrides'] });
      qc.invalidateQueries({ queryKey: ['calendar', listingId] });
    },
  });
}

