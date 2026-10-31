export interface Review {
  id: string;
  reservation_id: string;
  author_id: string;
  author_name: string;
  target_type: 'listing' | 'guest' | string;
  listing_id: string;
  target_user_id?: string | null;
  rating: number;
  cleanliness_rating?: number | null;
  accuracy_rating?: number | null;
  check_in_rating?: number | null;
  communication_rating?: number | null;
  location_rating?: number | null;
  value_rating?: number | null;
  public_review: string;
  private_note?: string | null;
  published_at?: string | null;
  created_at: string;
}

export interface ListingReviewSummary {
  rating_avg: number;
  review_count: number;
  rating_cleanliness?: number | null;
  rating_accuracy?: number | null;
  rating_checkin?: number | null;
  rating_communication?: number | null;
  rating_location?: number | null;
  rating_value?: number | null;
  reviews: Review[];
}

export interface CreateReviewInput {
  rating: number;
  cleanliness_rating?: number;
  accuracy_rating?: number;
  check_in_rating?: number;
  communication_rating?: number;
  location_rating?: number;
  value_rating?: number;
  public_review: string;
  private_note?: string;
}

