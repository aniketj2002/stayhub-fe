import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getCurrentUserId, getUserAccessToken } from '../auth/session';
import type { Conversation, Message, MessageListResponse } from './types';

export type SocketStatus = 'connecting' | 'connected' | 'disconnected';

interface WebSocketEvent {
  type: string;
  data?: any;
  error?: string;
}

type TypingListener = (data: { conversation_id: string; user_id: string; is_typing: boolean }) => void;

class MessagingSocketManager {
  private socket: WebSocket | null = null;
  private status: SocketStatus = 'disconnected';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private currentConversationId: string | null = null;
  private statusListeners = new Set<(status: SocketStatus) => void>();
  private typingListeners = new Set<TypingListener>();
  private queryClient: any = null;

  setQueryClient(qc: any) {
    this.queryClient = qc;
  }

  getStatus(): SocketStatus {
    return this.status;
  }

  subscribeStatus(listener: (status: SocketStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  subscribeTyping(listener: TypingListener): () => void {
    this.typingListeners.add(listener);
    return () => {
      this.typingListeners.delete(listener);
    };
  }

  private setStatus(next: SocketStatus) {
    if (this.status === next) return;
    this.status = next;
    this.statusListeners.forEach((l) => l(next));
  }

  connect() {
    if (typeof window === 'undefined') return;
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
      return;
    }

    const token = getUserAccessToken();
    if (!token) {
      this.setStatus('disconnected');
      return;
    }

    this.setStatus('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/api/v1/conversations/ws?token=${encodeURIComponent(token)}`;

    try {
      this.socket = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus('connected');
      this.startPing();
      if (this.currentConversationId) {
        this.sendAction({ action: 'join', conversation_id: this.currentConversationId });
      }
    };

    this.socket.onmessage = (event) => {
      try {
        const payload: WebSocketEvent = JSON.parse(event.data);
        this.handleEvent(payload);
      } catch {
        // Ignore unparseable frames
      }
    };

    this.socket.onclose = () => {
      this.stopPing();
      this.socket = null;
      this.setStatus('disconnected');
      this.scheduleReconnect();
    };

    this.socket.onerror = () => {
      if (this.socket) {
        this.socket.close();
      }
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPing();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.currentConversationId = null;
    this.setStatus('disconnected');
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const token = getUserAccessToken();
    if (!token) return;

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.sendAction({ action: 'ping' });
    }, 25000);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  sendAction(action: Record<string, any>) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(action));
    }
  }

  setCurrentConversation(convId: string | null) {
    this.currentConversationId = convId;
    if (convId) {
      this.sendAction({ action: 'join', conversation_id: convId });
    } else {
      this.sendAction({ action: 'leave' });
    }
  }

  sendTyping(conversationId: string, isTyping: boolean) {
    this.sendAction({
      action: 'typing',
      conversation_id: conversationId,
      is_typing: isTyping,
    });
  }

  private handleEvent(evt: WebSocketEvent) {
    if (!evt || !evt.type) return;

    if (evt.type === 'typing' && evt.data) {
      this.typingListeners.forEach((l) => l(evt.data));
      return;
    }

    if (!this.queryClient) return;

    if (evt.type === 'new_message' && evt.data) {
      const msg: Message = evt.data;
      const convId = msg.conversation_id;

      // 1. Update message list in thread cache
      this.queryClient.setQueryData(
        ['conversations', convId, 'messages', undefined],
        (old: MessageListResponse | Message[] | undefined) => {
          if (!old) {
            return { messages: [msg], has_more: false };
          }
          if (Array.isArray(old)) {
            if (old.some((m) => m.id === msg.id)) return old;
            return [...old, msg];
          }
          if (old.messages.some((m) => m.id === msg.id)) return old;
          return {
            ...old,
            messages: [...old.messages, msg],
          };
        },
      );

      // 2. Update conversation list preview & unread count
      const myId = getCurrentUserId();
      const isViewing = this.currentConversationId === convId;
      const isFromOther = msg.sender_id !== myId;

      this.queryClient.setQueryData(['conversations'], (old: Conversation[] | undefined) => {
        if (!Array.isArray(old)) return old;
        const updated = old.map((c) => {
          if (c.id === convId) {
            return {
              ...c,
              last_message: msg,
              unread_count: isFromOther && !isViewing ? c.unread_count + 1 : c.unread_count,
              updated_at: msg.created_at,
            };
          }
          return c;
        });

        return [...updated].sort((a, b) => {
          const tA = a.last_message?.created_at || a.updated_at || a.created_at;
          const tB = b.last_message?.created_at || b.updated_at || b.created_at;
          return new Date(tB).getTime() - new Date(tA).getTime();
        });
      });

      // 3. Keep single conversation query fresh
      this.queryClient.invalidateQueries({ queryKey: ['conversations', convId] });
    } else if (evt.type === 'conversation_read' && evt.data) {
      const { conversation_id } = evt.data;
      this.queryClient.setQueryData(['conversations', conversation_id], (old: Conversation | undefined) =>
        old ? { ...old, unread_count: 0 } : old,
      );
      this.queryClient.setQueryData(['conversations'], (old: Conversation[] | undefined) =>
        Array.isArray(old) ? old.map((c) => (c.id === conversation_id ? { ...c, unread_count: 0 } : c)) : old,
      );
    }
  }
}

export const messagingSocket = new MessagingSocketManager();

export function useMessagingSocket(conversationId?: string) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SocketStatus>(messagingSocket.getStatus());
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagingSocket.setQueryClient(queryClient);
    messagingSocket.connect();

    const unsubStatus = messagingSocket.subscribeStatus(setStatus);
    return () => {
      unsubStatus();
    };
  }, [queryClient]);

  useEffect(() => {
    messagingSocket.setCurrentConversation(conversationId || null);

    const unsubTyping = messagingSocket.subscribeTyping((data) => {
      if (conversationId && data.conversation_id === conversationId) {
        const myId = getCurrentUserId();
        if (data.user_id !== myId) {
          setIsPartnerTyping(data.is_typing);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          if (data.is_typing) {
            typingTimeoutRef.current = setTimeout(() => {
              setIsPartnerTyping(false);
            }, 4000);
          }
        }
      }
    });

    return () => {
      unsubTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [conversationId]);

  const sendTyping = (isTyping: boolean) => {
    if (conversationId) {
      messagingSocket.sendTyping(conversationId, isTyping);
    }
  };

  return {
    status,
    isConnected: status === 'connected',
    isPartnerTyping,
    sendTyping,
  };
}
