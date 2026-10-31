// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReservationDetailPage } from './ReservationDetailPage';
import * as reservationsApi from './api';
import type { AdminReservationDetail } from './types';

const detail: AdminReservationDetail = {
  reservation: {
    id: 'res-1',
    code: 'HMR7Q2KD',
    listing_id: 'list-1',
    guest_id: 'guest-1',
    host_id: 'host-1',
    status: 'completed',
    check_in: '2026-10-03',
    check_out: '2026-10-08',
    guests: 2,
    is_instant_book: false,
    nightly_total_minor: 64000,
    cleaning_fee_minor: 3500,
    guest_fee_bps: 1400,
    guest_fee_minor: 9500,
    guest_total_minor: 79800,
    host_fee_bps: 300,
    host_fee_minor: 2025,
    host_net_minor: 65475,
    cancellation_policy: 'moderate',
    currency: 'EUR',
    created_at: '2026-09-08T12:42:00Z',
    updated_at: '2026-10-09T14:20:00Z',
  },
  listing: {
    id: 'list-1',
    title: 'Azulejo Loft in Alfama',
    city: 'Lisbon',
    country: 'Portugal',
  },
  guest: { id: 'guest-1', full_name: 'Maya Kapoor', email: 'maya@example.com' },
  host: { id: 'host-1', full_name: 'Marisol Aguilar', email: 'marisol@stayhub.dev' },
  payments: [
    {
      id: 'pay-1',
      reservation_id: 'res-1',
      amount_minor: 79800,
      currency: 'EUR',
      status: 'succeeded',
      kind: 'charge',
      simulated_ref: 'Visa 4421',
      created_at: '2026-09-08T12:42:00Z',
    },
  ],
  payout: {
    id: 'po-1',
    reservation_id: 'res-1',
    host_id: 'host-1',
    net_minor: 65475,
    currency: 'EUR',
    status: 'held',
    simulated_ref: 'SEPA',
    release_at: '2026-10-04T00:00:00Z',
    held_reason: 'pending claim',
    created_at: '2026-09-08T13:00:00Z',
    updated_at: '2026-10-09T14:20:00Z',
  },
  ledger_entries: [],
  timeline: [
    {
      id: 1,
      occurred_at: '2026-09-08T12:42:00Z',
      actor_type: 'guest',
      actor_id: 'guest-1',
      action: 'reservation.create',
      object_type: 'reservation',
      object_id: 'res-1',
    },
    {
      id: 2,
      occurred_at: '2026-09-08T13:38:00Z',
      actor_type: 'host',
      actor_id: 'host-1',
      action: 'reservation.accept',
      object_type: 'reservation',
      object_id: 'res-1',
    },
    {
      id: 3,
      occurred_at: '2026-10-09T14:20:00Z',
      actor_type: 'system',
      action: 'payout.hold',
      object_type: 'reservation',
      object_id: 'res-1',
    },
  ],
  refundable_minor: 79800,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/reservations/res-1']}>
        <Routes>
          <Route path="/admin/reservations/:id" element={<ReservationDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReservationDetailPage', () => {
  beforeEach(() => {
    vi.spyOn(reservationsApi, 'useAdminReservation').mockReturnValue({
      data: detail,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof reservationsApi.useAdminReservation>);
    vi.spyOn(reservationsApi, 'useAdminCancelReservation').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof reservationsApi.useAdminCancelReservation>);
    vi.spyOn(reservationsApi, 'useAdminRefund').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof reservationsApi.useAdminRefund>);
    vi.spyOn(reservationsApi, 'useAdminHoldPayout').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof reservationsApi.useAdminHoldPayout>);
    vi.spyOn(reservationsApi, 'useAdminReleasePayout').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof reservationsApi.useAdminReleasePayout>);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the operations layout for a reservation', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Reservation HMR7Q2KD' })).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Azulejo Loft in Alfama' })).toBeTruthy();
    expect(screen.getByText(/Lisbon · LS-LIST1 · Marisol Aguilar/)).toBeTruthy();
    expect(screen.getByText('Sat, Oct 3 — Thu, Oct 8')).toBeTruthy();
    expect(screen.getByText('2 guests')).toBeTruthy();
    expect(screen.getByText('Moderate')).toBeTruthy();
    expect(screen.getByText('Web · Request')).toBeTruthy();
    expect(screen.getAllByText(/Maya Kapoor/).length).toBeGreaterThan(0);
    expect(screen.getByText('maya@example.com')).toBeTruthy();
    expect(screen.getByText('marisol@stayhub.dev')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Timeline' })).toBeTruthy();
    expect(screen.getByText('Reservation created · request sent to host')).toBeTruthy();
    expect(screen.getByText('Host accepted')).toBeTruthy();
    expect(screen.getByText('Payout held pending case')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Ledger' })).toBeTruthy();
    expect(screen.getByText(/Visa 4421/)).toBeTruthy();
    expect(screen.getByText(/Nights ·/)).toBeTruthy();
    expect(screen.getByText('Cleaning fee')).toBeTruthy();
    expect(screen.getByText('Guest service fee')).toBeTruthy();
    expect(screen.getByText('Host payout basis')).toBeTruthy();
    expect(screen.getByText('Platform margin')).toBeTruthy();
    expect(screen.getByText(/Payout held on Oct 9/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Issue refund' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Release payout' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Override policy' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rebook guest' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel reservation' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add internal note' })).toBeTruthy();
    expect(screen.getByText(/Every action is logged with your name/)).toBeTruthy();
  });

  it('shows a linked case when the reservation is disputed', () => {
    vi.spyOn(reservationsApi, 'useAdminReservation').mockReturnValue({
      data: {
        ...detail,
        reservation: { ...detail.reservation, status: 'disputed' },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof reservationsApi.useAdminReservation>);

    renderPage();
    expect(screen.getByText('Disputed')).toBeTruthy();
    expect(screen.getByRole('link', { name: /open case/i })).toBeTruthy();
  });
});
