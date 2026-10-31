import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '../../lib/api';
import type { Conversation, Message, MessageListResponse, SendMessageInput } from './types';

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await request<{ conversations: Conversation[] } | Conversation[]>(
        '/api/v1/conversations',
      );
      if (Array.isArray(res)) return res;
      return res?.conversations || [];
    },
  });
}

export function useConversation(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['conversations', conversationId],
    queryFn: () => request<Conversation>(`/api/v1/conversations/${conversationId}`),
    enabled: !!conversationId,
  });
}

export function useGetOrCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reservationId: string) =>
      request<Conversation>('/api/v1/conversations', {
        method: 'POST',
        body: { reservation_id: reservationId },
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversations', data.id] });
    },
  });
}

export function useMessages(conversationId: string | undefined, before?: string) {
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  params.set('limit', '50');
  const qs = params.toString();

  return useQuery({
    queryKey: ['conversations', conversationId, 'messages', before],
    queryFn: async () => {
      const res = await request<MessageListResponse | Message[]>(
        `/api/v1/conversations/${conversationId}/messages${qs ? `?${qs}` : ''}`,
      );
      if (Array.isArray(res)) {
        return { messages: res, has_more: false };
      }
      return res || { messages: [], has_more: false };
    },
    enabled: !!conversationId,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      input,
    }: {
      conversationId: string;
      input: SendMessageInput;
    }) =>
      request<Message>(`/api/v1/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (_, { conversationId }) => {
      qc.invalidateQueries({ queryKey: ['conversations', conversationId, 'messages'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      request<{ status: string }>(`/api/v1/conversations/${conversationId}/read`, {
        method: 'POST',
      }),
    onSuccess: (_, conversationId) => {
      qc.setQueryData<Conversation | undefined>(['conversations', conversationId], (old) =>
        old ? { ...old, unread_count: 0 } : old,
      );
      qc.setQueryData<Conversation[] | undefined>(['conversations'], (old) =>
        Array.isArray(old)
          ? old.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
          : old,
      );
    },
  });
}

