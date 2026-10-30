// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { HostListingsPage } from './HostListingsPage';
import { HostMetrics } from './HostMetrics';
import { HostRecentActivity } from './HostRecentActivity';
import { json } from '../../test/fixtures';

describe('HostListingsPage & Host Components (Reference PDF Clone)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  it('renders HostMetrics with default values matching reference design', () => {
    render(<HostMetrics />);
    expect(screen.getByText('OCCUPANCY · OCT')).toBeTruthy();
    expect(screen.getByText('54%')).toBeTruthy();
    expect(screen.getByText('2 listed homes')).toBeTruthy();
    expect(screen.getByText('BOOKED REVENUE · OCT')).toBeTruthy();
    expect(screen.getByText('€4,120')).toBeTruthy();
    expect(screen.getByText('after host fee')).toBeTruthy();
    expect(screen.getByText('AVERAGE RATING')).toBeTruthy();
    expect(screen.getByText('4.93')).toBeTruthy();
    expect(screen.getByText('276 reviews · 2 listings')).toBeTruthy();
    expect(screen.getByText('RESPONSE RATE')).toBeTruthy();
    expect(screen.getByText('96%')).toBeTruthy();
    expect(screen.getByText('avg 42 min')).toBeTruthy();
  });

  it('renders HostRecentActivity with 4 activities from reference design', () => {
    render(<HostRecentActivity />);
    expect(screen.getByText('RECENT ACTIVITY')).toBeTruthy();
    expect(screen.getByText('New 5-star review from Rui on Azulejo Loft')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Garden house sent for review · automated checks passed')).toBeTruthy();
    expect(screen.getByText('Yesterday')).toBeTruthy();
    expect(screen.getByText('Smart Pricing adjusted 6 nights on Riverside studio')).toBeTruthy();
    expect(screen.getByText('Oct 2')).toBeTruthy();
    expect(screen.getByText('You updated house rules on Azulejo Loft')).toBeTruthy();
    expect(screen.getByText('Sep 28')).toBeTruthy();
  });

  it('renders reference dummy listings, metrics, and activity when backend returns empty listings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ listings: [], count: 0 })),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <HostListingsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // 4 Reference listings
    expect(await screen.findByText('Azulejo Loft in Alfama')).toBeTruthy();
    expect(screen.getByText('Riverside studio, Cais do Sodré')).toBeTruthy();
    expect(screen.getByText('Garden house in Sintra')).toBeTruthy();
    expect(screen.getByText('Bica apartment with tram view')).toBeTruthy();

    // Title & status summary
    expect(screen.getByText('Listings')).toBeTruthy();
    expect(screen.getByText('2 listed · 1 under review · 1 in progress')).toBeTruthy();

    // Badges
    const listedBadges = screen.getAllByText('Listed');
    expect(listedBadges.length).toBe(2);
    expect(screen.getByText('Under review')).toBeTruthy();
    expect(screen.getByText('In progress')).toBeTruthy();

    // Action buttons
    expect(screen.getAllByText('Edit').length).toBe(4);
    expect(screen.getAllByText('Calendar').length).toBe(4);
    expect(screen.getAllByText('Preview').length).toBe(4);

    // Filter dropdown works
    const select = screen.getByLabelText('Filter listings by status') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'under_review' } });
    expect(screen.getByText('Garden house in Sintra')).toBeTruthy();
    expect(screen.queryByText('Azulejo Loft in Alfama')).toBeNull();

    // Reset filter
    fireEvent.change(select, { target: { value: 'all' } });
    expect(screen.getByText('Azulejo Loft in Alfama')).toBeTruthy();

    // Metrics & Activity are rendered
    expect(screen.getByText('OCCUPANCY · OCT')).toBeTruthy();
    expect(screen.getByText('RECENT ACTIVITY')).toBeTruthy();
  });

  it('renders real backend listings when provided by API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          listings: [
            {
              id: 'real-1',
              title: 'Real Cascais Villa',
              status: 'live',
              property_type: 'villa',
              max_guests: 6,
              base_price_minor: 25000,
              currency: 'EUR',
              wizard_step: 7,
              host_access: { role: 'owner', permissions: ['can_manage_listing'] },
            },
          ],
          count: 1,
        }),
      ),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <HostListingsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Real Cascais Villa')).toBeTruthy();
    expect(screen.getByText('1 listed · 0 under review · 0 in progress')).toBeTruthy();
    expect(screen.getByText('Entire villa · 6 guests')).toBeTruthy();
    expect(screen.getByText('€250.00')).toBeTruthy();
  });
});
