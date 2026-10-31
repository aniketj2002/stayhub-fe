// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReviewsList } from './ReviewsList';
import * as reviewApi from './api';
import type { ListingReviewSummary } from './types';

const mockSummary: ListingReviewSummary = {
  rating_avg: 4.88,
  review_count: 24,
  rating_cleanliness: 4.9,
  rating_accuracy: 4.8,
  rating_checkin: 5.0,
  rating_communication: 4.9,
  rating_location: 5.0,
  rating_value: 4.7,
  reviews: [
    {
      id: 'rev-1',
      reservation_id: 'res-1',
      author_id: 'usr-1',
      author_name: 'Camila Duarte',
      target_type: 'listing',
      listing_id: 'lst-1',
      rating: 5,
      public_review: 'Authentic tiles, peaceful mornings, and walking distance to the tram.',
      created_at: '2026-10-15T00:00:00Z',
    },
  ],
};

describe('ReviewsList', () => {
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

  it('renders overall score, category breakdown bars, and review cards', () => {
    vi.spyOn(reviewApi, 'useListingReviews').mockReturnValue({
      data: mockSummary,
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <ReviewsList listingId="lst-1" />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/4.88/i)).toBeTruthy();
    expect(screen.getByText(/24 reviews/i)).toBeTruthy();
    expect(screen.getByText('Cleanliness')).toBeTruthy();
    expect(screen.getByText('Camila Duarte')).toBeTruthy();
    expect(screen.getByText(/authentic tiles, peaceful mornings/i)).toBeTruthy();
  });

  it('renders empty notice when listing has no reviews yet', () => {
    vi.spyOn(reviewApi, 'useListingReviews').mockReturnValue({
      data: {
        rating_avg: 0,
        review_count: 0,
        reviews: [],
      },
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <ReviewsList listingId="lst-empty" />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/no reviews yet/i)).toBeTruthy();
  });
});

