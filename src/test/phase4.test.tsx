// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { CheckoutPage } from '../features/reservations/CheckoutPage';
import { ReservationPage } from '../features/reservations/ReservationPage';
import { GuestCancellation } from '../features/reservations/GuestCancellation';
import { HostActions } from '../features/reservations/HostActions';
import { EarningsPage } from '../features/earnings/EarningsPage';
import { acceptSession, configureSession, expireSession } from '../features/auth/session';
import { clearAttempt } from '../features/reservations/attempts';
import { json, publicDetail, quote } from './fixtures';
import { refundPreview, reservationDetail } from './reservationFixtures';
const clients: QueryClient[] = [];
const bookingPath = '/checkout/home-1?check_in=2030-02-01&check_out=2030-02-03&guests=1';
beforeEach(() => {
  sessionStorage.clear();
  for (const scope of [
    'phase4-user:booking:home-1',
    'phase4-user:cancel:res-1',
    'phase4-user:host-action:res-1',
  ])
    clearAttempt(scope);
  configureSession(() => {});
  acceptSession({
    subject_type: 'user',
    user: {
      id: 'phase4-user',
      full_name: 'Test Guest',
      email: 'guest@example.test',
      is_guest: true,
      is_host: true,
    },
    access_token: 'access',
    refresh_token: 'refresh',
    expires_in: 3600,
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
  expireSession();
  vi.unstubAllGlobals();
});
function mount(element: React.ReactNode, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  const router = createMemoryRouter(
    [
      { path: '/checkout/:listingId', element },
      { path: '/trips/:id', element: <ReservationPage /> },
      { path: '/', element },
    ],
    { initialEntries: [path] },
  );
  return {
    ...render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
    router,
  };
}

describe('Phase 4 financial and lifecycle flows', () => {
  it('recovers a lost booking response after remount with the exact same payload and key, even if dates are now unavailable', async () => {
    let bookingCalls = 0;
    let unavailable = false;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/v1/reservations' && init?.method === 'POST') {
        bookingCalls++;
        if (bookingCalls === 1) {
          unavailable = true;
          throw new TypeError('Connection dropped after commit');
        }
        return json(reservationDetail, 201);
      }
      if (url.endsWith('/quote'))
        return unavailable
          ? json({ code: 'DATES_UNAVAILABLE', message: 'Dates are already reserved' }, 409)
          : json({ quote: { ...quote(), instant_book: false } });
      if (url === '/api/v1/reservations/res-1') return json(reservationDetail);
      return json({ listing: publicDetail });
    });
    vi.stubGlobal('fetch', fetchMock);
    const first = mount(<CheckoutPage />, bookingPath);
    fireEvent.click(await screen.findByLabelText(/I’ve reviewed/));
    fireEvent.click(screen.getByRole('button', { name: 'Simulate payment & request' }));
    await screen.findByRole('button', { name: 'Recover booking result' });
    expect(bookingCalls).toBe(1);
    first.unmount();
    mount(<CheckoutPage />, bookingPath);
    fireEvent.click(await screen.findByRole('button', { name: 'Recover booking result' }));
    await screen.findByText('RESERVATION STAY-ABC123');
    expect(await screen.findByText('Payment receipt')).toBeTruthy();
    expect(screen.getAllByText('Awaiting host response').length).toBeGreaterThan(0);
    const posts = fetchMock.mock.calls.filter(([url]) => url === '/api/v1/reservations');
    expect(posts).toHaveLength(2);
    expect(posts[0][1]?.body).toBe(posts[1][1]?.body);
    expect(new Headers(posts[0][1]?.headers).get('Idempotency-Key')).toBe(
      new Headers(posts[1][1]?.headers).get('Idempotency-Key'),
    );
    expect(sessionStorage.getItem('stayhub.attempt.phase4-user:booking:home-1')).toBeNull();
  });

  it('requires renewed review when the price changes immediately before simulated payment', async () => {
    let quotes = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/quote')) {
        quotes++;
        return json({
          quote:
            quotes === 1
              ? quote()
              : { ...quote(), breakdown: { ...quote().breakdown, guest_total_minor: 25080 } },
        });
      }
      return json({ listing: publicDetail });
    });
    vi.stubGlobal('fetch', fetchMock);
    mount(<CheckoutPage />, bookingPath);
    fireEvent.click(await screen.findByLabelText(/I’ve reviewed/));
    fireEvent.click(screen.getByRole('button', { name: 'Simulate payment & reserve' }));
    await screen.findByText(/Your quote or booking terms changed/);
    expect(screen.getByText('€250.80')).toBeTruthy();
    expect((screen.getByLabelText(/I’ve reviewed/) as HTMLInputElement).checked).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/v1/reservations')).toBe(false);
  });

  it('requires reviewing cancellation policy and terms before continuing through checkout', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/quote')) return json({ quote: quote() });
      return json({ listing: publicDetail });
    });
    vi.stubGlobal('fetch', fetchMock);
    mount(<CheckoutPage />, bookingPath);

    const continueBtn = await screen.findByRole('button', { name: 'Continue to identity check' });
    const agreementCheckbox = screen.getByLabelText(/I’ve reviewed the price, house rules, and cancellation policy/i) as HTMLInputElement;

    expect(agreementCheckbox.checked).toBe(false);
    expect(continueBtn.matches(':disabled')).toBe(true);

    // Clicking agreement enables continue
    fireEvent.click(agreementCheckbox);
    expect(agreementCheckbox.checked).toBe(true);
    expect(continueBtn.matches(':disabled')).toBe(false);

    // Unchecking disables continue again
    fireEvent.click(agreementCheckbox);
    expect(agreementCheckbox.checked).toBe(false);
    expect(continueBtn.matches(':disabled')).toBe(true);
  });

  it('refreshes a stale refund preview, requires reconfirmation, then records cancellation', async () => {
    let previews = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/cancel-preview'))
        return json({ cancel_preview: refundPreview(++previews === 1 ? 23940 : 10500) });
      if (url.endsWith('/cancel') && init?.method === 'POST')
        return json({
          ...reservationDetail,
          reservation: { ...reservationDetail.reservation, status: 'cancelled_by_guest' },
        });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    mount(
      <GuestCancellation
        detail={{
          ...reservationDetail,
          reservation: { ...reservationDetail.reservation, status: 'confirmed' },
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Preview cancellation' }));
    await screen.findByRole('button', { name: 'Confirm cancellation' });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
    await screen.findAllByText(/Your refund terms changed/);
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/cancel'))).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
    await screen.findByText(/Reservation cancelled. Your receipt shows/);
    const post = fetchMock.mock.calls.find(([url]) => url.endsWith('/cancel'));
    expect(new Headers(post?.[1]?.headers).get('Idempotency-Key')).toBeTruthy();
  });

  it('requires a decline reason and sends an idempotent host action after confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json({
        ...reservationDetail,
        reservation: { ...reservationDetail.reservation, status: 'declined' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    mount(
      <HostActions
        detail={reservationDetail}
        access={{ role: 'cohost', can_manage_reservations: true }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Decline request' }));
    const dialog = screen.getByRole('dialog');
    expect(
      (within(dialog).getByRole('button', { name: 'Decline request' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('Decline reason (required)'), {
      target: { value: 'Property maintenance' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Decline request' }));
    await screen.findByText('Reservation updated. Refreshing your view.');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      decline_reason: 'Property maintenance',
    });
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Idempotency-Key')).toBeTruthy();
  });

  it('does not show mutation controls to a co-host without reservation permission', () => {
    mount(
      <HostActions
        detail={reservationDetail}
        access={{ role: 'cohost', can_manage_calendar: true }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Accept request' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Decline request' })).toBeNull();
  });

  it('shows adjusted server payout amounts and keeps a scheduled payout upcoming past its release time', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/host/listings')
          ? json({ listings: [{ id: 'home-1', host_access: { role: 'owner' } }] })
          : json({
              currency: 'EUR',
              paid_minor: 0,
              upcoming_minor: 10185,
              held_minor: 0,
              cancelled_minor: 0,
              payouts: [
                {
                  payout: {
                    id: 'payout-1',
                    reservation_id: 'res-1',
                    status: 'scheduled',
                    gross_minor: 10500,
                    host_fee_minor: 315,
                    net_minor: 10185,
                    currency: 'EUR',
                    release_at: '2020-01-02T00:00:00Z',
                  },
                  reservation_code: 'STAY-ABC123',
                  listing_id: 'home-1',
                  listing_title: 'Lisbon courtyard home',
                  check_in: '2030-02-01',
                  check_out: '2030-02-03',
                },
              ],
            }),
      ),
    );
    mount(<EarningsPage />);
    await screen.findByRole('table');
    expect(screen.getByText('€105.00')).toBeTruthy();
    expect(screen.getByText('€3.15')).toBeTruthy();
    expect(screen.getAllByText('€101.85')).toHaveLength(2);
    expect(screen.getByText('scheduled')).toBeTruthy();
    expect(screen.queryByText('Released')).toBeNull();
  });

  it('does not request earnings for listings without insights permission', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json({
        listings: [{ id: 'home-1', host_access: { role: 'cohost', can_view_insights: false } }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    mount(<EarningsPage />);
    await screen.findByText('Earnings access is required');
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/earnings'))).toBe(false);
  });
});
