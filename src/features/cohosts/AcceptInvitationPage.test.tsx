// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AcceptInvitationPage } from './AcceptInvitationPage';
import * as cohostApi from './api';
import * as session from '../auth/session';

describe('AcceptInvitationPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('prompts unauthenticated user to sign in', () => {
    vi.spyOn(session, 'useUserSession').mockReturnValue({
      status: 'ready',
      identity: null,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/cohost-invitations/test-tok']}>
          <Routes>
            <Route path="/cohost-invitations/:token" element={<AcceptInvitationPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText(/sign in to accept/i)).toBeTruthy();
  });

  it('renders invitation metadata when available', () => {
    vi.spyOn(session, 'useUserSession').mockReturnValue({
      status: 'ready',
      identity: null,
    } as any);

    vi.spyOn(cohostApi, 'useCohostInvitationDetails').mockReturnValue({
      data: {
        listing_id: 'lst-1',
        listing_title: 'Sunny Seaside Villa',
        host_name: 'Alice Host',
        invited_email: 'pending@stayhub.dev',
        permissions: {
          can_manage_listing: true,
          can_manage_calendar: true,
          can_manage_reservations: false,
          can_message_guests: true,
          can_view_insights: false,
        },
        payout_share_bps: 1500,
        status: 'pending',
        expires_at: '2026-12-31T00:00:00Z',
      },
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/cohost-invitations/test-tok']}>
          <Routes>
            <Route path="/cohost-invitations/:token" element={<AcceptInvitationPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Sunny Seaside Villa')).toBeTruthy();
    expect(screen.getByText('Alice Host')).toBeTruthy();
    expect(screen.getByText('pending@stayhub.dev')).toBeTruthy();
    expect(screen.getByText('15.0%')).toBeTruthy();
    expect(screen.getByText('Manage Listing')).toBeTruthy();
    expect(screen.getByText('Message Guests')).toBeTruthy();
  });

  it('allows authenticated user to accept invitation and displays success', async () => {
    vi.spyOn(session, 'useUserSession').mockReturnValue({
      status: 'ready',
      identity: {
        subject_type: 'user',
        user: {
          id: 'usr-1',
          email: 'cohost@stayhub.dev',
          full_name: 'Co Host User',
          is_guest: true,
          is_host: true,
        },
      },
    } as any);

    const acceptMutate = vi.fn().mockResolvedValue({
      listing_id: 'lst-12345',
      status: 'accepted',
    });

    vi.spyOn(cohostApi, 'useAcceptInvitation').mockReturnValue({
      mutateAsync: acceptMutate,
      isPending: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/cohost-invitations/valid-invite-token']}>
          <Routes>
            <Route path="/cohost-invitations/:token" element={<AcceptInvitationPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText(/signed in as/i)).toBeTruthy();
    expect(screen.getByText('cohost@stayhub.dev')).toBeTruthy();

    const acceptBtn = screen.getByRole('button', { name: /accept invitation/i });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(acceptMutate).toHaveBeenCalledWith('valid-invite-token');
      expect(screen.getByText(/invitation accepted!/i)).toBeTruthy();
    });
  });

  it('displays error message if accepting invitation fails', async () => {
    vi.spyOn(session, 'useUserSession').mockReturnValue({
      status: 'ready',
      identity: {
        subject_type: 'user',
        user: {
          id: 'usr-1',
          email: 'mismatch@stayhub.dev',
          full_name: 'Other User',
          is_guest: true,
          is_host: false,
        },
      },
    } as any);

    const acceptMutate = vi.fn().mockRejectedValue(new Error('Invitation email does not match user account'));

    vi.spyOn(cohostApi, 'useAcceptInvitation').mockReturnValue({
      mutateAsync: acceptMutate,
      isPending: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/cohost-invitations/invalid-tok']}>
          <Routes>
            <Route path="/cohost-invitations/:token" element={<AcceptInvitationPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const acceptBtn = screen.getByRole('button', { name: /accept invitation/i });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(screen.getByText(/invitation email does not match user account/i)).toBeTruthy();
    });
  });
});
