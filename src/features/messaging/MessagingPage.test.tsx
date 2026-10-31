// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MessagingPage } from './MessagingPage';
import * as messagingApi from './api';
import * as session from '../auth/session';

const mockConversations = [
  {
    id: 'conv-1',
    reservation_id: 'res-1',
    reservation_code: 'SH-88412',
    reservation_status: 'confirmed',
    check_in_date: '2026-11-10',
    check_out_date: '2026-11-15',
    guests: 2,
    listing_id: 'lst-1',
    listing_title: 'Azulejo Loft in Alfama',
    listing_city: 'Lisbon',
    host_id: 'usr-host-1',
    host_name: 'Marisol Aguilar',
    guest_id: 'usr-guest-1',
    guest_name: 'Elena Rostova',
    last_message: {
      id: 'msg-1',
      conversation_id: 'conv-1',
      sender_id: 'usr-guest-1',
      body: 'Hello! What time is check-in?',
      media_ids: [],
      flags: [],
      created_at: '2026-10-31T10:00:00Z',
    },
    unread_count: 2,
    created_at: '2026-10-31T09:00:00Z',
    updated_at: '2026-10-31T10:00:00Z',
  },
];

const mockMessages = [
  {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_id: 'usr-guest-1',
    body: 'Hello! What time is check-in?',
    media_ids: [],
    flags: [],
    created_at: '2026-10-31T10:00:00Z',
  },
  {
    id: 'msg-2',
    conversation_id: 'conv-1',
    sender_id: 'usr-guest-1',
    body: 'Can I pay you directly via wire transfer to +351 912 345 678?',
    media_ids: [],
    flags: ['off_platform_contact', 'off_platform_payment'],
    warning: 'Off-platform contact or payment detected.',
    created_at: '2026-10-31T10:05:00Z',
  },
];

describe('MessagingPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.spyOn(session, 'getCurrentUserId').mockReturnValue('usr-host-1');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders conversation list and selected message thread', () => {
    vi.spyOn(messagingApi, 'useConversations').mockReturnValue({
      data: mockConversations,
      isLoading: false,
    } as any);

    vi.spyOn(messagingApi, 'useConversation').mockReturnValue({
      data: mockConversations[0],
      isLoading: false,
    } as any);

    vi.spyOn(messagingApi, 'useMessages').mockReturnValue({
      data: { messages: mockMessages, has_more: false },
      isLoading: false,
    } as any);

    vi.spyOn(messagingApi, 'useSendMessage').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.spyOn(messagingApi, 'useMarkRead').mockReturnValue({
      mutateAsync: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/messages/conv-1']}>
          <Routes>
            <Route path="/messages/:conversationId" element={<MessagingPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Sidebar & Thread
    expect(screen.getAllByText('Elena Rostova').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Azulejo Loft in Alfama').length).toBeGreaterThan(0);

    // Messages Thread
    expect(screen.getAllByText('Hello! What time is check-in?').length).toBeGreaterThan(0);
    expect(screen.getByText(/Can I pay you directly/i)).toBeTruthy();

    // Security warning banner
    expect(screen.getByText(/Security Notice:/i)).toBeTruthy();
  });

  it('sends a message when input is filled and submitted', async () => {
    const sendMutate = vi.fn().mockResolvedValue({ id: 'msg-new' });

    vi.spyOn(messagingApi, 'useConversations').mockReturnValue({
      data: mockConversations,
      isLoading: false,
    } as any);

    vi.spyOn(messagingApi, 'useConversation').mockReturnValue({
      data: mockConversations[0],
      isLoading: false,
    } as any);

    vi.spyOn(messagingApi, 'useMessages').mockReturnValue({
      data: { messages: mockMessages, has_more: false },
      isLoading: false,
    } as any);

    vi.spyOn(messagingApi, 'useSendMessage').mockReturnValue({
      mutateAsync: sendMutate,
      isPending: false,
    } as any);

    vi.spyOn(messagingApi, 'useMarkRead').mockReturnValue({
      mutateAsync: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/messages/conv-1']}>
          <Routes>
            <Route path="/messages/:conversationId" element={<MessagingPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const textarea = screen.getByPlaceholderText(/write a message/i);
    const sendBtn = screen.getByRole('button', { name: /send/i });

    fireEvent.change(textarea, { target: { value: 'Check-in is from 3:00 PM.' } });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(sendMutate).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        input: { body: 'Check-in is from 3:00 PM.' },
      });
    });
  });

  it('renders placeholder when no conversations exist', () => {
    vi.spyOn(messagingApi, 'useConversations').mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/messages']}>
          <Routes>
            <Route path="/messages" element={<MessagingPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('No conversations yet')).toBeTruthy();
    expect(screen.getByText(/Choose a conversation from the left to read messages and reply/i)).toBeTruthy();
  });

  it('shows host name to guest user and renders messages in chronological order', () => {
    vi.spyOn(session, 'getCurrentUserId').mockReturnValue('usr-guest-1');

    // Backend returns DESC (newest first); UI should sort chronologically (oldest first)
    const descMessages = [mockMessages[1], mockMessages[0]];

    vi.spyOn(messagingApi, 'useConversations').mockReturnValue({
      data: mockConversations,
      isLoading: false,
    } as any);

    vi.spyOn(messagingApi, 'useConversation').mockReturnValue({
      data: mockConversations[0],
      isLoading: false,
    } as any);

    vi.spyOn(messagingApi, 'useMessages').mockReturnValue({
      data: { messages: descMessages, has_more: false },
      isLoading: false,
    } as any);

    vi.spyOn(messagingApi, 'useSendMessage').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.spyOn(messagingApi, 'useMarkRead').mockReturnValue({
      mutateAsync: vi.fn(),
    } as any);

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/messages/conv-1']}>
          <Routes>
            <Route path="/messages/:conversationId" element={<MessagingPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Guest should see Host's name "Marisol Aguilar"
    expect(screen.getAllByText('Marisol Aguilar').length).toBeGreaterThan(0);

    // Messages should be rendered oldest first
    const bodies = Array.from(container.querySelectorAll('.message-body')).map(
      (el) => el.textContent,
    );
    expect(bodies[0]).toBe('Hello! What time is check-in?');
    expect(bodies[1]).toContain('Can I pay you directly');
  });
});
