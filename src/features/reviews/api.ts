import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '../../lib/api';
import type { CreateReviewInput, ListingReviewSummary, Review } from './types';

export function useListingReviews(listingId: string | undefined) {
  return useQuery({
    queryKey: ['listings', listingId, 'reviews'],
    queryFn: () => request<ListingReviewSummary>(`/api/v1/listings/${listingId}/reviews`, { auth: false }),
    enabled: !!listingId,
  });
}

export function useReservationReviews(reservationId: string | undefined) {
  return useQuery({
    queryKey: ['reservations', reservationId, 'reviews'],
    queryFn: async () => {
      const res = await request<{ reviews: Review[] } | Review[]>(
        `/api/v1/reservations/${reservationId}/reviews`,
      );
      if (Array.isArray(res)) return res;
      return res?.reviews || [];
    },
    enabled: !!reservationId,
  });
}

export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      reservationId,
      input,
    }: {
      reservationId: string;
      input: CreateReviewInput;
    }) =>
      request<Review>(`/api/v1/reservations/${reservationId}/reviews`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (saved, { reservationId }) => {
      qc.invalidateQueries({ queryKey: ['reservations', reservationId, 'reviews'] });
      if (saved.listing_id) {
        qc.invalidateQueries({ queryKey: ['listings', saved.listing_id, 'reviews'] });
      }
    },
  });
}

