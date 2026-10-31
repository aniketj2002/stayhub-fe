// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { messagingSocket } from './socket';
import * as session from '../auth/session';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.();
    }, 10);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.();
  }
}

describe('MessagingSocketManager', () => {
  let queryClient: QueryClient;
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    global.WebSocket = MockWebSocket as any;
    queryClient = new QueryClient();
    messagingSocket.setQueryClient(queryClient);
    vi.spyOn(session, 'getUserAccessToken').mockReturnValue('mock-jwt-token-xyz');
    vi.spyOn(session, 'getCurrentUserId').mockReturnValue('usr-1');
  });

  afterEach(() => {
    messagingSocket.disconnect();
    global.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
  });

  it('connects to websocket with query token and sends join action', async () => {
    messagingSocket.connect();
    expect(MockWebSocket.instances.length).toBe(1);
    const ws = MockWebSocket.instances[0];
    expect(ws.url).toContain('/api/v1/conversations/ws?token=mock-jwt-token-xyz');

    await vi.waitFor(() => {
      expect(ws.readyState).toBe(WebSocket.OPEN);
    });

    messagingSocket.setCurrentConversation('conv-123');
    expect(ws.sentMessages).toContain(JSON.stringify({ action: 'join', conversation_id: 'conv-123' }));
  });

  it('handles new_message event and updates react-query cache', async () => {
    queryClient.setQueryData(['conversations', 'conv-123', 'messages', undefined], {
      messages: [],
      has_more: false,
    });
    queryClient.setQueryData(['conversations'], [
      { id: 'conv-123', unread_count: 0, last_message: null },
    ]);

    messagingSocket.connect();
    const ws = MockWebSocket.instances[0];
    await vi.waitFor(() => expect(ws.readyState).toBe(WebSocket.OPEN));

    const newMsg = {
      id: 'msg-99',
      conversation_id: 'conv-123',
      sender_id: 'usr-2',
      body: 'Hello from websocket!',
      created_at: '2026-10-31T12:00:00Z',
    };

    ws.onmessage?.({
      data: JSON.stringify({
        type: 'new_message',
        data: newMsg,
      }),
    });

    const cached = queryClient.getQueryData<any>(['conversations', 'conv-123', 'messages', undefined]);
    expect(cached.messages).toHaveLength(1);
    expect(cached.messages[0].body).toBe('Hello from websocket!');

    const convList = queryClient.getQueryData<any[]>(['conversations']);
    expect(convList?.[0].last_message.body).toBe('Hello from websocket!');
    expect(convList?.[0].unread_count).toBe(1);
  });

  it('dispatches typing events to typing subscribers', async () => {
    messagingSocket.connect();
    const ws = MockWebSocket.instances[0];
    await vi.waitFor(() => expect(ws.readyState).toBe(WebSocket.OPEN));

    const typingEvents: any[] = [];
    const unsub = messagingSocket.subscribeTyping((evt) => {
      typingEvents.push(evt);
    });

    ws.onmessage?.({
      data: JSON.stringify({
        type: 'typing',
        data: { conversation_id: 'conv-123', user_id: 'usr-2', is_typing: true },
      }),
    });

    expect(typingEvents).toHaveLength(1);
    expect(typingEvents[0]).toEqual({
      conversation_id: 'conv-123',
      user_id: 'usr-2',
      is_typing: true,
    });

    unsub();
  });
});
