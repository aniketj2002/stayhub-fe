import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '../../lib/api';
import type {
  AcceptCohostInviteResponse,
  CohostInvitation,
  CohostInvitationDetails,
  CohostInviteResponseData,
  CohostMember,
  CreateCohostInviteInput,
  UpdateCohostInput,
} from './types';

export function useCohosts(listingId: string | undefined) {
  return useQuery({
    queryKey: ['host', 'listings', listingId, 'cohosts'],
    queryFn: async () => {
      const res = await request<{ cohosts: CohostMember[] }>(
        `/api/v1/host/listings/${listingId}/cohosts`,
      );
      return res?.cohosts || [];
    },
    enabled: !!listingId,
  });
}

export function useCohostInvitations(listingId: string | undefined) {
  return useQuery({
    queryKey: ['host', 'listings', listingId, 'cohost-invitations'],
    queryFn: async () => {
      const res = await request<{ invitations: CohostInvitation[] }>(
        `/api/v1/host/listings/${listingId}/cohosts/invitations`,
      );
      return res?.invitations || [];
    },
    enabled: !!listingId,
  });
}

export function useInviteCohost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listingId, input }: { listingId: string; input: CreateCohostInviteInput }) =>
      request<CohostInviteResponseData>(`/api/v1/host/listings/${listingId}/cohosts/invitations`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (_, { listingId }) => {
      qc.invalidateQueries({ queryKey: ['host', 'listings', listingId, 'cohost-invitations'] });
      qc.invalidateQueries({ queryKey: ['host', 'listings', listingId, 'cohosts'] });
    },
  });
}

export function useCancelInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listingId, inviteId }: { listingId: string; inviteId: string }) =>
      request<void>(`/api/v1/host/listings/${listingId}/cohosts/invitations/${inviteId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_, { listingId }) => {
      qc.invalidateQueries({ queryKey: ['host', 'listings', listingId, 'cohost-invitations'] });
    },
  });
}

export function useUpdateCohost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      listingId,
      userId,
      input,
    }: {
      listingId: string;
      userId: string;
      input: UpdateCohostInput;
    }) =>
      request<CohostMember>(`/api/v1/host/listings/${listingId}/cohosts/${userId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: (_, { listingId }) => {
      qc.invalidateQueries({ queryKey: ['host', 'listings', listingId, 'cohosts'] });
    },
  });
}

export function useRemoveCohost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listingId, userId }: { listingId: string; userId: string }) =>
      request<void>(`/api/v1/host/listings/${listingId}/cohosts/${userId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_, { listingId }) => {
      qc.invalidateQueries({ queryKey: ['host', 'listings', listingId, 'cohosts'] });
    },
  });
}

export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      request<AcceptCohostInviteResponse>(`/api/v1/cohost-invitations/${token}/accept`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['host', 'listings', data.listing_id] });
      qc.invalidateQueries({ queryKey: ['host', 'listings'] });
    },
  });
}

export function useCohostInvitationDetails(token: string | undefined) {
  return useQuery({
    queryKey: ['cohost-invitations', token],
    queryFn: () => request<CohostInvitationDetails>(`/api/v1/cohost-invitations/${token}`),
    enabled: !!token,
  });
}

