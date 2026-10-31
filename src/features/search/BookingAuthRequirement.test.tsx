// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ListingDetailPage } from './ListingDetailPage';
import * as session from '../auth/session';
import type { Tokens } from '../auth/types';
import { json, publicDetail, quote } from '../../test/fixtures';

const mockUserTokens: Tokens = {
  subject_type: 'user',
  user: {
    id: 'usr_guest_456',
    email: 'traveler@example.com',
    full_name: 'Happy Traveler',
    is_guest: true,
    is_host: false,
  },
  access_token: 'test-token',
  refresh_token: 'test-refresh',
  expires_in: 3600,
};

describe('Booking Login Requirement on ListingDetailPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    session.expireSession();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      value: function () {
        this.open = true;
      },
      writable: true,
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      value: function () {
        this.open = false;
      },
      writable: true,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/quote')) {
          return json({ quote: quote(2) });
        }
        return json({ listing: publicDetail });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    session.expireSession();
    vi.restoreAllMocks();
  });

  it('prompts the user to log in when clicking Reserve while unauthenticated', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            '/listings/home-1?check_in=2030-02-01&check_out=2030-02-03&guests=2',
          ]}
        >
          <Routes>
            <Route path="/listings/:id" element={<ListingDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Wait for the quote to load
    await screen.findByText('€239.40');

    // Click Reserve button
    const reserveButton = screen.getByRole('link', { name: 'Reserve' });
    fireEvent.click(reserveButton);

    // Verify Login Prompt Modal appears
    await waitFor(() => {
      expect(screen.getByText('You need to sign in to book')).toBeTruthy();
      expect(screen.getByText(/A StayHub guest account is required to reserve this stay/)).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Sign in to continue' })).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Create an account' })).toBeTruthy();
    });

    // Verify the sign-in link preserves the checkout redirect returnTo
    const signInLink = screen.getByRole('link', { name: 'Sign in to continue' });
    expect(signInLink.getAttribute('href')).toContain('/login?returnTo=');
    expect(signInLink.getAttribute('href')).toContain('checkout%2Fhome-1');

    // Ensure PaymentScreen was NOT rendered
    expect(screen.queryByText('Confirm and pay')).toBeNull();
  });

  it('allows the user to proceed to PaymentScreen when logged in as a guest', async () => {
    session.acceptSession(mockUserTokens);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            '/listings/home-1?check_in=2030-02-01&check_out=2030-02-03&guests=2',
          ]}
        >
          <Routes>
            <Route path="/listings/:id" element={<ListingDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText('€239.40');

    const reserveButton = screen.getByRole('link', { name: 'Reserve' });
    fireEvent.click(reserveButton);

    // Since user is logged in, PaymentScreen opens and login prompt does NOT appear
    await waitFor(() => {
      expect(screen.queryByText('You need to sign in to book')).toBeNull();
      expect(screen.getByText('Confirm and pay')).toBeTruthy();
    });
  });
});
