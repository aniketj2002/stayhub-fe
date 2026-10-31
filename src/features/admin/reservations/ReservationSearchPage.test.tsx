// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReservationSearchPage } from './ReservationSearchPage';
import * as reservationsApi from './api';
import * as session from '../../auth/session';
import type { Tokens } from '../../auth/types';

const mockAdminTokens: Tokens = {
  subject_type: 'admin',
  admin: {
    id: 'adm_123',
    email: 'admin@stayhub.dev',
    full_name: 'Elena Rostova',
    role: 'super_admin',
  },
  access_token: 'test-tok',
  refresh_token: 'test-ref',
  expires_in: 3600,
};

const mockReservationsResponse = {
  total: 2,
  reservations: [
    {
      reservation: {
        id: 'res-1',
        code: 'HMR7Q2KD',
        listing_id: 'list-1',
        guest_id: 'guest-1',
        host_id: 'host-1',
        status: 'confirmed',
        check_in: '2026-11-10',
        check_out: '2026-11-15',
        adults_count: 2,
        children_count: 0,
        infants_count: 0,
        pets_count: 0,
        total_price_minor: 64000,
        currency: 'EUR',
        created_at: '2026-10-31T00:00:00Z',
        updated_at: '2026-10-31T00:00:00Z',
      },
      listing: {
        id: 'list-1',
        title: 'Azulejo Loft in Alfama',
        city: 'Lisbon',
        country: 'Portugal',
      },
      guest: {
        id: 'guest-1',
        full_name: 'Rui Silva',
        email: 'rui@example.com',
      },
      host: {
        id: 'host-1',
        full_name: 'Marisol Aguilar',
        email: 'marisol@stayhub.dev',
      },
    },
    {
      reservation: {
        id: 'res-2',
        code: 'BK89XPL2',
        listing_id: 'list-2',
        guest_id: 'guest-2',
        host_id: 'host-1',
        status: 'cancelled',
        check_in: '2026-12-01',
        check_out: '2026-12-05',
        adults_count: 1,
        children_count: 0,
        infants_count: 0,
        pets_count: 0,
        total_price_minor: 40000,
        currency: 'EUR',
        created_at: '2026-10-31T00:00:00Z',
        updated_at: '2026-10-31T00:00:00Z',
      },
      listing: {
        id: 'list-2',
        title: 'Riverside Studio Cais do Sodre',
        city: 'Lisbon',
        country: 'Portugal',
      },
      guest: {
        id: 'guest-2',
        full_name: 'Claire Dupont',
        email: 'claire@example.com',
      },
      host: {
        id: 'host-1',
        full_name: 'Marisol Aguilar',
        email: 'marisol@stayhub.dev',
      },
    },
  ],
};

describe('ReservationSearchPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    session.acceptSession(mockAdminTokens);
  });

  afterEach(() => {
    cleanup();
    session.expireSession();
    vi.restoreAllMocks();
  });

  it('renders search results table with booking information', () => {
    vi.spyOn(reservationsApi, 'useAdminReservations').mockReturnValue({
      data: mockReservationsResponse,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ReservationSearchPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Header and filter controls
    expect(screen.getByText('Reservations')).toBeTruthy();
    expect(screen.getByLabelText(/reservation code/i)).toBeTruthy();

    // Table rows
    expect(screen.getByText('HMR7Q2KD')).toBeTruthy();
    expect(screen.getByText('Rui Silva')).toBeTruthy();
    expect(screen.getByText('Azulejo Loft in Alfama')).toBeTruthy();
    expect(screen.getByText('confirmed')).toBeTruthy();
    expect(screen.getByText('€640.00')).toBeTruthy();

    expect(screen.getByText('BK89XPL2')).toBeTruthy();
    expect(screen.getByText('Claire Dupont')).toBeTruthy();
    expect(screen.getByText('cancelled')).toBeTruthy();
    expect(screen.getByText('€400.00')).toBeTruthy();
  });

  it('renders empty state when no reservations match query', () => {
    vi.spyOn(reservationsApi, 'useAdminReservations').mockReturnValue({
      data: { total: 0, reservations: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ReservationSearchPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('No Reservations Found')).toBeTruthy();
  });
});

