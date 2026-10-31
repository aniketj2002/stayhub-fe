// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DateChangeModal } from './DateChangeModal';
import * as tripsApi from './api';

describe('DateChangeModal', () => {
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

  it('submits a new date change request', async () => {
    const requestMutate = vi.fn().mockResolvedValue({ id: 'alt-1' });

    vi.spyOn(tripsApi, 'useReservationAlterations').mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    vi.spyOn(tripsApi, 'useRequestAlteration').mockReturnValue({
      mutateAsync: requestMutate,
      isPending: false,
    } as any);

    vi.spyOn(tripsApi, 'useApproveAlteration').mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.spyOn(tripsApi, 'useDeclineAlteration').mockReturnValue({ mutateAsync: vi.fn() } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <DateChangeModal
          open={true}
          onClose={vi.fn()}
          reservationId="res-10"
          currentCheckIn="2026-11-01"
          currentCheckOut="2026-11-05"
          currentGuests={2}
        />
      </QueryClientProvider>,
    );

    const checkInInput = screen.getByLabelText(/new check-in date/i);
    const checkOutInput = screen.getByLabelText(/new checkout date/i);

    fireEvent.change(checkInInput, { target: { value: '2026-11-03' } });
    fireEvent.change(checkOutInput, { target: { value: '2026-11-08' } });

    const sendBtn = screen.getByRole('button', { name: /send change request/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(requestMutate).toHaveBeenCalledWith({
        reservationId: 'res-10',
        input: {
          check_in: '2026-11-03',
          check_out: '2026-11-08',
          guests: 2,
        },
      });
    });
  });

  it('displays pending alteration and allows approval', async () => {
    const approveMutate = vi.fn().mockResolvedValue({ id: 'alt-pending', status: 'approved' });

    vi.spyOn(tripsApi, 'useReservationAlterations').mockReturnValue({
      data: [
        {
          id: 'alt-pending',
          reservation_id: 'res-10',
          requested_by: 'usr-guest',
          current_check_in: '2026-11-01',
          current_check_out: '2026-11-05',
          new_check_in: '2026-11-03',
          new_check_out: '2026-11-08',
          delta_minor: 25000,
          currency: 'EUR',
          status: 'pending',
          expires_at: '2026-11-02T10:00:00Z',
          created_at: '2026-10-31T10:00:00Z',
        },
      ],
      isLoading: false,
    } as any);

    vi.spyOn(tripsApi, 'useRequestAlteration').mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.spyOn(tripsApi, 'useApproveAlteration').mockReturnValue({
      mutateAsync: approveMutate,
      isPending: false,
    } as any);
    vi.spyOn(tripsApi, 'useDeclineAlteration').mockReturnValue({ mutateAsync: vi.fn() } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <DateChangeModal
          open={true}
          onClose={vi.fn()}
          reservationId="res-10"
          currentCheckIn="2026-11-01"
          currentCheckOut="2026-11-05"
          currentGuests={2}
          isHost={true}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/pending request/i)).toBeTruthy();
    expect(screen.getAllByText(/2026-11-03 → 2026-11-08/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/\+€250\.00/i)).toBeTruthy();

    const approveBtn = screen.getByRole('button', { name: /approve request/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(approveMutate).toHaveBeenCalledWith({
        reservationId: 'res-10',
        alterationId: 'alt-pending',
      });
    });
  });

  it('hides approve and decline from the guest who requested the change', () => {
    vi.spyOn(tripsApi, 'useReservationAlterations').mockReturnValue({
      data: [
        {
          id: 'alt-pending',
          reservation_id: 'res-10',
          requested_by: 'usr-guest',
          current_check_in: '2026-11-04',
          current_check_out: '2026-11-06',
          new_check_in: '2026-11-07',
          new_check_out: '2026-11-12',
          delta_minor: 34200,
          currency: 'EUR',
          status: 'pending',
          expires_at: '2026-11-01T10:00:00Z',
          created_at: '2026-10-31T10:00:00Z',
        },
      ],
      isLoading: false,
    } as any);

    vi.spyOn(tripsApi, 'useRequestAlteration').mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.spyOn(tripsApi, 'useApproveAlteration').mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.spyOn(tripsApi, 'useDeclineAlteration').mockReturnValue({ mutateAsync: vi.fn() } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <DateChangeModal
          open={true}
          onClose={vi.fn()}
          reservationId="res-10"
          currentCheckIn="2026-11-04"
          currentCheckOut="2026-11-06"
          currentGuests={2}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/pending request/i)).toBeTruthy();
    expect(screen.getByText(/awaiting review from the other party/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /approve request/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^decline$/i })).toBeNull();
  });
});
