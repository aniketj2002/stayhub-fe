/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReviewQueuePage } from './ReviewQueuePage';
import * as api from './api';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('ReviewQueuePage', () => {
  afterEach(() => {
    cleanup();
  });
  it('renders queue table and inspector cleanly when data is loaded', () => {
    vi.spyOn(api, 'useReviewQueue').mockReturnValue({
      data: [
        {
          version_id: 'v-1',
          listing_id: 'l-1',
          listing_title: 'Garden house in Sintra',
          version_no: 1,
          status: 'submitted',
          submitted_at: '2026-10-07T12:00:00Z',
          submitted_age_hours: 48,
          host_name: 'Marisol Aguilar',
          host_email: 'marisol@example.com',
          property_type: 'Home',
          city: 'Lisbon',
          country: 'Portugal',
          check_results: [
            { id: '1', outcome: 'pass', detail: 'Address matches verified location' },
            { id: '2', outcome: 'warn', detail: 'Registration number missing' },
          ],
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ReviewQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Listing review')).toBeTruthy();
    expect(screen.getAllByText('Garden house in Sintra').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Marisol Aguilar')).toBeTruthy();
    expect(screen.getByText('Open full review')).toBeTruthy();
  });

  it('renders cleanly when queue items have undefined check_results and empty list', () => {
    vi.spyOn(api, 'useReviewQueue').mockReturnValue({
      data: [
        {
          version_id: 'v-2',
          listing_id: 'l-2',
          listing_title: 'Minimalist Studio',
          version_no: 2,
          status: 'submitted',
          submitted_at: '2026-10-07T12:00:00Z',
          submitted_age_hours: 5,
          host_name: 'Kenji Sato',
          host_email: 'kenji@example.com',
          property_type: 'Apartment',
          city: 'Kyoto',
          country: 'Japan',
          check_results: undefined,
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ReviewQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Listing review')).toBeTruthy();
    expect(screen.getAllByText('Minimalist Studio').length).toBeGreaterThanOrEqual(1);
  });
});
