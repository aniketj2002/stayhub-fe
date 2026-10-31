import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '../../../lib/api';
import type {
  FeeConfig,
  FeeConfigListResponse,
  ProposeFeeConfigInput,
  RejectFeeConfigInput,
} from './types';

export function useFeeConfigs() {
  return useQuery({
    queryKey: ['admin', 'fee-configs'],
    queryFn: () => request<FeeConfigListResponse>('/api/v1/admin/fee-configs'),
  });
}

export function useProposeFeeConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProposeFeeConfigInput) =>
      request<FeeConfig>('/api/v1/admin/fee-configs', {
        method: 'POST',
        body: input,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'fee-configs'] });
    },
  });
}

export function useApproveFeeConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request<FeeConfig>(`/api/v1/admin/fee-configs/${id}/approve`, {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'fee-configs'] });
    },
  });
}

export function useRejectFeeConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      request<FeeConfig>(`/api/v1/admin/fee-configs/${id}/reject`, {
        method: 'POST',
        body: { reason } as RejectFeeConfigInput,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'fee-configs'] });
    },
  });
}

