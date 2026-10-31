// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as sessionModule from '../auth/session';
import { WriteReviewModal } from './WriteReviewModal';
import * as reviewApi from './api';

describe('WriteReviewModal', () => {
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

  it('renders rating selectors and disables submit until requirements are met', () => {
    vi.spyOn(reviewApi, 'useSubmitReview').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <WriteReviewModal
          open={true}
          onClose={vi.fn()}
          reservationId="res-123"
          listingTitle="Azulejo Loft"
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/write a review/i)).toBeTruthy();
    expect(screen.getByText(/Azulejo Loft/i)).toBeTruthy();

    const submitBtn = screen.getByRole('button', { name: /submit review/i }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('submits review when rating and review text are provided', async () => {
    const submitMutate = vi.fn().mockResolvedValue({ id: 'rev-1', listing_id: 'lst-1' });

    vi.spyOn(reviewApi, 'useSubmitReview').mockReturnValue({
      mutateAsync: submitMutate,
      isPending: false,
    } as any);

    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <WriteReviewModal
          open={true}
          onClose={onClose}
          reservationId="res-123"
          listingTitle="Azulejo Loft"
          onSuccess={onSuccess}
        />
      </QueryClientProvider>,
    );

    // Select overall 5 stars
    const starButtons = screen.getAllByRole('radio', { name: /5 stars/i });
    fireEvent.click(starButtons[0]);

    // Fill public review
    const textarea = screen.getByLabelText(/public review/i);
    fireEvent.change(textarea, {
      target: { value: 'Wonderful stay in Lisbon! The terrace views were unbelievable.' },
    });

    const submitBtn = screen.getByRole('button', { name: /submit review/i }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitMutate).toHaveBeenCalledWith({
        reservationId: 'res-123',
        input: {
          rating: 5,
          cleanliness_rating: 5,
          accuracy_rating: 5,
          check_in_rating: 5,
          communication_rating: 5,
          location_rating: 5,
          value_rating: 5,
          public_review: 'Wonderful stay in Lisbon! The terrace views were unbelievable.',
          private_note: undefined,
        },
      });
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('displays waiting for other party status when user has already submitted a review', () => {
    vi.spyOn(sessionModule, 'getCurrentUserId').mockReturnValue('user-me');
    vi.spyOn(reviewApi, 'useReservationReviews').mockReturnValue({
      data: [
        {
          id: 'rev-existing',
          reservation_id: 'res-123',
          author_id: 'user-me',
          author_name: 'Me',
          target_type: 'listing',
          listing_id: 'lst-1',
          rating: 5,
          public_review: 'Already loved this place!',
          published_at: null,
          created_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <WriteReviewModal
          open={true}
          onClose={vi.fn()}
          reservationId="res-123"
          listingTitle="Azulejo Loft"
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/waiting for other party/i)).toBeTruthy();
  });
});

