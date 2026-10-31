// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ItineraryPage } from './ItineraryPage';
import * as tripsApi from './api';
import type { TripItinerary } from './types';

const mockItinerary: TripItinerary = {
  reservation_id: 'res-confirmed-1',
  code: 'STAY-9821',
  status: 'confirmed',
  listing_id: 'lst-1',
  listing_title: 'Alfama Azulejo Loft',
  city: 'Lisbon',
  country: 'Portugal',
  address: 'Rua dos Remédios 142',
  check_in_date: '2026-11-01',
  check_out_date: '2026-11-05',
  check_in_time: '15:00',
  check_out_time: '11:00',
  timezone: 'Europe/Lisbon',
  check_in_instant: '2026-11-01T15:00:00Z',
  check_out_instant: '2026-11-05T11:00:00Z',
  host_name: 'Marisol Aguilar',
  host_email: 'marisol@stayhub.dev',
  guests: 2,
  nightly_total_minor: 48000,
  cleaning_fee_minor: 3500,
  discount_minor: 4800,
  guest_fee_minor: 6538,
  guest_total_minor: 53238,
  currency: 'EUR',
  timeline: [
    {
      date: '2026-11-01',
      title: 'Check-in at Alfama Azulejo Loft',
      description: 'Host will meet you at the door.',
      is_check_in: true,
      is_check_out: false,
    },
    {
      date: '2026-11-05',
      title: 'Checkout',
      description: 'Leave keys on the counter.',
      is_check_in: false,
      is_check_out: true,
    },
  ],
  receipts: [
    {
      id: 'pay-1',
      type: 'charge',
      amount_eur: 532.38,
      amount_minor: 53238,
      status: 'succeeded',
      created_at: '2026-10-20T10:00:00Z',
    },
  ],
};

describe('ItineraryPage', () => {
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

  it('renders check-in details, unlocked address, timeline and receipts when confirmed', () => {
    vi.spyOn(tripsApi, 'useTripItinerary').mockReturnValue({
      data: mockItinerary,
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/trips/res-confirmed-1/itinerary']}>
          <Routes>
            <Route path="/trips/:id/itinerary" element={<ItineraryPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Alfama Azulejo Loft')).toBeTruthy();
    expect(screen.getByText(/Code: STAY-9821/i)).toBeTruthy();
    expect(screen.getByText(/Rua dos Remédios 142/i)).toBeTruthy();
    expect(screen.getByText('Marisol Aguilar')).toBeTruthy();
    expect(screen.getByText('Check-in at Alfama Azulejo Loft')).toBeTruthy();
    expect(screen.getByText('Payment Transactions')).toBeTruthy();
  });

  it('hides address when reservation is not confirmed', () => {
    vi.spyOn(tripsApi, 'useTripItinerary').mockReturnValue({
      data: {
        ...mockItinerary,
        status: 'pending',
        address: null,
      },
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/trips/res-pending/itinerary']}>
          <Routes>
            <Route path="/trips/:id/itinerary" element={<ItineraryPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      screen.getByText(/address will be unlocked once your reservation is confirmed/i),
    ).toBeTruthy();
    expect(screen.queryByText(/Rua dos Remédios 142/i)).toBeNull();
  });
});

