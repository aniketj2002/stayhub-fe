// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ListingEditorPage } from '../features/listings/ListingEditorPage';
import { HostCalendarPage } from '../features/calendar/HostCalendarPage';
import { ListingDetailPage } from '../features/search/ListingDetailPage';
import { SearchPage } from '../features/search/SearchPage';
import { configureAuth } from '../lib/api';
import { hostDetail, json, publicDetail, quote, version } from './fixtures';

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
  configureAuth(
    () => null,
    () => {},
  );
});
function mount(path: string, route: string, element: React.ReactNode) {
  configureAuth(
    () => 'host-access',
    () => {},
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  const router = createMemoryRouter([{ path: route, element }], { initialEntries: [path] });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}
function catalog(url: string) {
  if (url.includes('/catalog/amenities'))
    return json({ amenities: [{ code: 'wifi', label: 'Wi-Fi', category: 'essentials' }] });
  if (url.includes('/catalog/cancellation-policies'))
    return json({ cancellation_policies: [publicDetail.cancellation_policy] });
  return null;
}

describe('Phase 3 workflows', () => {
  it('keeps unsaved text after a failed save, saves before advancing, and preserves the live version', async () => {
    let fail = true;
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const reference = catalog(input);
      if (reference) return reference;
      if (init?.method === 'PATCH') {
        if (fail)
          return json({ code: 'INTERNAL_ERROR', message: 'Save failed. Please retry.' }, 500);
        const patch = JSON.parse(String(init.body));
        return json({ ...hostDetail, working_version: { ...version, ...patch } });
      }
      return json(hostDetail);
    });
    vi.stubGlobal('fetch', fetchMock);
    mount('/host/listings/home-1/edit', '/host/listings/:id/edit', <ListingEditorPage />);
    const user = userEvent.setup();
    const title = await screen.findByLabelText('Listing title');
    await user.clear(title);
    await user.type(title, 'My unsaved title');
    fireEvent.click(screen.getByRole('button', { name: /Save & continue/ }));
    await screen.findByText('Save failed. Please retry.');
    expect((screen.getByLabelText('Listing title') as HTMLInputElement).value).toBe(
      'My unsaved title',
    );
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: /Save & continue/ }));
    await screen.findByLabelText('Nightly price (EUR)');
    const saves = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(String(saves[1][1]?.body))).toMatchObject({
      title: 'My unsaved title',
      wizard_step: 5,
    });
    expect(screen.getByText(/Live version 1 stays visible/)).toBeTruthy();
  });

  it('renders backend submission check failures and links to the relevant wizard step', async () => {
    const detail = { ...hostDetail, working_version: { ...version, wizard_step: 7 } };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const reference = catalog(url);
        if (reference) return reference;
        if (url.endsWith('/submit'))
          return json(
            {
              code: 'LISTING_CHECKS_FAILED',
              message: 'Checks failed',
              details: {
                all_passed: false,
                check_results: [
                  {
                    id: 'check-1',
                    check_code: 'min_photos',
                    outcome: 'fail',
                    detail: 'Add at least five confirmed photos.',
                  },
                ],
              },
            },
            422,
          );
        return json(detail);
      }),
    );
    mount('/host/listings/home-1/edit', '/host/listings/:id/edit', <ListingEditorPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Submit listing' }));
    await screen.findByText('Add at least five confirmed photos.');
    fireEvent.click(screen.getByRole('button', { name: /Edit this section/ }));
    await screen.findByLabelText('Choose photos');
  });

  it('uses listing permissions to prevent editing even for a host account', async () => {
    const fetchMock = vi.fn(
      async (url: string, init?: RequestInit) =>
        (init?.method ? json({ code: 'FORBIDDEN', message: 'Read-only' }, 403) : catalog(url)) ||
        json({ ...hostDetail, host_access: { role: 'cohost', can_manage_listing: false } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    mount('/host/listings/home-1/edit', '/host/listings/:id/edit', <ListingEditorPage />);
    const title = await screen.findByLabelText('Listing title');
    expect(title.matches(':disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Pricing/ }));
    await screen.findByLabelText('Nightly price (EUR)');
    expect(
      fetchMock.mock.calls.every(
        (args) => args.length === 1 || !(args[1] as RequestInit | undefined)?.method,
      ),
    ).toBe(true);
  });

  it('checks the entire selected calendar range and never mutates booked nights', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/calendar?')) {
        const start = new URL(url, 'http://localhost').searchParams.get('start_date');
        return json({
          listing_id: 'home-1',
          start_date: start,
          end_date: '2030-02-04',
          nights: start === '2030-02-01' ? [{ night: '2030-02-02', status: 'booked' }] : [],
        });
      }
      if (init?.method) throw new Error('Booked nights must never be changed');
      return json(hostDetail);
    });
    vi.stubGlobal('fetch', fetchMock);
    mount('/host/listings/home-1/calendar', '/host/listings/:id/calendar', <HostCalendarPage />);
    await screen.findByLabelText('First night');
    await waitFor(() =>
      expect(screen.getByLabelText('First night').matches(':disabled')).toBe(false),
    );
    fireEvent.change(screen.getByLabelText('First night'), { target: { value: '2030-02-01' } });
    fireEvent.change(screen.getByLabelText('End date (not included)'), {
      target: { value: '2030-02-04' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Block nights' }));
    await screen.findByText(/This selection includes booked nights/);
    expect(
      fetchMock.mock.calls.filter(
        ([, init]) => init?.method === 'PUT' || init?.method === 'DELETE',
      ),
    ).toHaveLength(0);
  });

  it('keeps a late old quote from replacing the quote for the current guest selection', async () => {
    let finishOld!: (response: Response) => void;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/quote')) {
        const body = JSON.parse(String(init?.body));
        if (body.guests === 1)
          return new Promise<Response>((resolve) => {
            finishOld = resolve;
          });
        return json({
          quote: { ...quote(2), breakdown: { ...quote(2).breakdown, guest_total_minor: 25080 } },
        });
      }
      return json({ listing: publicDetail });
    });
    vi.stubGlobal('fetch', fetchMock);
    mount(
      '/listings/home-1?check_in=2030-02-01&check_out=2030-02-03&guests=1',
      '/listings/:id',
      <ListingDetailPage />,
    );
    await waitFor(() => expect(finishOld).toBeTypeOf('function'));
    fireEvent.change(screen.getByLabelText('Guests'), { target: { value: '2' } });
    await screen.findByText('€250.80');
    await act(async () => {
      finishOld(json({ quote: quote(1) }));
    });
    expect(screen.queryByText('€239.40')).toBeNull();
    expect(screen.getByText('€250.80')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Reserve/ }).getAttribute('href')).toContain(
      'guests=2',
    );
  });

  it('retains search inputs in the URL and shows null ratings as new stays', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          count: 1,
          listings: [
            {
              id: 'home-1',
              title: 'Test stay',
              city: 'Lisbon',
              country: 'PT',
              property_type: 'apartment',
              max_guests: 4,
              nightly_price_minor: 10000,
              currency: 'EUR',
              rating: null,
              cover_photo_url: null,
            },
          ],
        }),
      ),
    );
    const router = mount('/search', '/search', <SearchPage />);
    await screen.findByText('Test stay');
    fireEvent.change(screen.getByLabelText('Destination'), { target: { value: 'Lisbon' } });
    fireEvent.change(screen.getByLabelText('Check-in'), { target: { value: '2030-02-01' } });
    fireEvent.change(screen.getByLabelText('Checkout'), { target: { value: '2030-02-03' } });
    fireEvent.click(screen.getByRole('button', { name: /Search stays/ }));
    await waitFor(() => expect(router.state.location.search).toContain('city=Lisbon'));
    await screen.findByText('New stay');
    expect(screen.getByRole('link', { name: /Test stay/ }).getAttribute('href')).toContain(
      'check_in=2030-02-01',
    );
  });
});
