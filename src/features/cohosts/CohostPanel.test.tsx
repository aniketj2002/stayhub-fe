// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CohostPanel } from './CohostPanel';
import * as cohostApi from './api';
import type { CohostInvitation, CohostMember } from './types';

const mockListingId = 'lst-test-cohost';

const mockMembers: CohostMember[] = [
  {
    user_id: 'usr-owner',
    full_name: 'Primary Host',
    email: 'host@stayhub.dev',
    role: 'owner',
    permissions: {
      can_manage_listing: true,
      can_manage_calendar: true,
      can_manage_reservations: true,
      can_message_guests: true,
      can_view_insights: true,
    },
    payout_share_bps: 0,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    user_id: 'usr-cohost',
    full_name: 'Partner Host',
    email: 'partner@stayhub.dev',
    role: 'cohost',
    permissions: {
      can_manage_listing: true,
      can_manage_calendar: true,
      can_manage_reservations: false,
      can_message_guests: true,
      can_view_insights: false,
    },
    payout_share_bps: 1500,
    created_at: '2026-01-02T00:00:00Z',
  },
];

const mockInvites: CohostInvitation[] = [
  {
    id: 'inv-1',
    listing_id: mockListingId,
    email: 'pending@stayhub.dev',
    permissions: {
      can_manage_listing: true,
      can_manage_calendar: true,
      can_manage_reservations: true,
      can_message_guests: true,
      can_view_insights: false,
    },
    payout_share_bps: 2000,
    status: 'pending',
    expires_at: '2026-03-01T00:00:00Z',
    created_at: '2026-02-01T00:00:00Z',
  },
];

describe('CohostPanel', () => {
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

  it('renders active team members and pending invitations', () => {
    vi.spyOn(cohostApi, 'useCohosts').mockReturnValue({
      data: mockMembers,
      isLoading: false,
    } as any);
    vi.spyOn(cohostApi, 'useCohostInvitations').mockReturnValue({
      data: mockInvites,
      isLoading: false,
    } as any);
    vi.spyOn(cohostApi, 'useInviteCohost').mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.spyOn(cohostApi, 'useCancelInvitation').mockReturnValue({ mutate: vi.fn() } as any);
    vi.spyOn(cohostApi, 'useUpdateCohost').mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.spyOn(cohostApi, 'useRemoveCohost').mockReturnValue({ mutateAsync: vi.fn() } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <CohostPanel listingId={mockListingId} />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Primary Host')).toBeTruthy();
    expect(screen.getByText('Partner Host')).toBeTruthy();
    expect(screen.getByText(/15.0% payout share/i)).toBeTruthy();
    expect(screen.getByText('pending@stayhub.dev')).toBeTruthy();
  });

  it('submits a new co-host invitation with basis points', async () => {
    const inviteMutate = vi.fn().mockResolvedValue({ token: 'raw-token-123' });
    vi.spyOn(cohostApi, 'useCohosts').mockReturnValue({
      data: mockMembers,
      isLoading: false,
    } as any);
    vi.spyOn(cohostApi, 'useCohostInvitations').mockReturnValue({
      data: [],
      isLoading: false,
    } as any);
    vi.spyOn(cohostApi, 'useInviteCohost').mockReturnValue({
      mutateAsync: inviteMutate,
      isPending: false,
    } as any);
    vi.spyOn(cohostApi, 'useCancelInvitation').mockReturnValue({ mutate: vi.fn() } as any);
    vi.spyOn(cohostApi, 'useUpdateCohost').mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.spyOn(cohostApi, 'useRemoveCohost').mockReturnValue({ mutateAsync: vi.fn() } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <CohostPanel listingId={mockListingId} />
      </QueryClientProvider>,
    );

    const emailInput = screen.getByLabelText(/co-host email address/i);
    const payoutInput = screen.getByLabelText(/payout share percentage/i);
    const sendBtn = screen.getByRole('button', { name: /send invitation/i });

    fireEvent.change(emailInput, { target: { value: 'newpartner@stayhub.dev' } });
    fireEvent.change(payoutInput, { target: { value: '12.5' } });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(inviteMutate).toHaveBeenCalledWith({
        listingId: mockListingId,
        input: {
          email: 'newpartner@stayhub.dev',
          payout_share_bps: 1250,
          permissions: {
            can_manage_listing: true,
            can_manage_calendar: true,
            can_manage_reservations: true,
            can_message_guests: true,
            can_view_insights: false,
          },
        },
      });
    });
  });

  it('cancels pending invitation when Cancel button is clicked', async () => {
    const cancelMutate = vi.fn();
    vi.spyOn(cohostApi, 'useCohosts').mockReturnValue({
      data: mockMembers,
      isLoading: false,
    } as any);
    vi.spyOn(cohostApi, 'useCohostInvitations').mockReturnValue({
      data: mockInvites,
      isLoading: false,
    } as any);
    vi.spyOn(cohostApi, 'useInviteCohost').mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.spyOn(cohostApi, 'useCancelInvitation').mockReturnValue({
      mutate: cancelMutate,
      isPending: false,
    } as any);
    vi.spyOn(cohostApi, 'useUpdateCohost').mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.spyOn(cohostApi, 'useRemoveCohost').mockReturnValue({ mutateAsync: vi.fn() } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <CohostPanel listingId={mockListingId} />
      </QueryClientProvider>,
    );

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(cancelMutate).toHaveBeenCalledWith({
      listingId: mockListingId,
      inviteId: 'inv-1',
    });
  });
});

