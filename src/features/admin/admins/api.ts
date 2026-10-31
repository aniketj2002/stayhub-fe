import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '../../../lib/api';
import type {
  AdminListResponse,
  AdminUserDetail,
  CreateAdminInput,
  UpdateAdminInput,
} from './types';

export function useAdminList() {
  return useQuery({
    queryKey: ['admin', 'admins'],
    queryFn: () => request<AdminListResponse>('/api/v1/admin/admins'),
  });
}

export function useCreateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAdminInput) =>
      request<AdminUserDetail>('/api/v1/admin/admins', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'admins'] });
    },
  });
}

export function useUpdateAdminRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAdminInput }) =>
      request<AdminUserDetail>(`/api/v1/admin/admins/${id}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'admins'] });
    },
  });
}

