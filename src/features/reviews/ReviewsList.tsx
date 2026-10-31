import { useListingReviews } from './api';
import { ReviewCard } from './ReviewCard';
import type { ListingReviewSummary } from './types';

interface ReviewsListProps {
  listingId: string;
  initialSummary?: ListingReviewSummary | null;
}

export function ReviewsList({ listingId, initialSummary }: ReviewsListProps) {
  const { data, isLoading } = useListingReviews(listingId);

  const summary = data || initialSummary;

  if (isLoading && !summary) {
    return (
      <section className="reviews-section" aria-label="Guest Reviews">
        <div className="reviews-header">
          <h3>Guest Reviews</h3>
          <p className="muted-text">Loading reviews...</p>
        </div>
      </section>
    );
  }

  const reviewCount = summary?.review_count || 0;
  const ratingAvg = summary?.rating_avg || 0;
  const reviews = summary?.reviews || [];

  return (
    <section className="reviews-section" aria-label="Guest Reviews" id="reviews">
      <div className="reviews-header">
        <h3 className="reviews-score-heading">
          <span className="reviews-star">★</span>{' '}
          {reviewCount > 0 ? (
            <>
              {ratingAvg.toFixed(2)} ·{' '}
              <span className="reviews-count">
                {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
              </span>
            </>
          ) : (
            'No reviews yet'
          )}
        </h3>
        {reviewCount === 0 && (
          <p className="muted-text">
            Guests who complete their stay here will be able to leave honest feedback.
          </p>
        )}
      </div>

      {/* Category breakdown bars when ratings exist */}
      {reviewCount > 0 && (
        <div className="reviews-categories-grid">
          {summary?.rating_cleanliness != null && (
            <div className="category-rating-bar">
              <span className="category-name">Cleanliness</span>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${(summary.rating_cleanliness / 5) * 100}%` }}
                />
              </div>
              <span className="category-value">{summary.rating_cleanliness.toFixed(1)}</span>
            </div>
          )}

          {summary?.rating_accuracy != null && (
            <div className="category-rating-bar">
              <span className="category-name">Accuracy</span>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${(summary.rating_accuracy / 5) * 100}%` }}
                />
              </div>
              <span className="category-value">{summary.rating_accuracy.toFixed(1)}</span>
            </div>
          )}

          {summary?.rating_checkin != null && (
            <div className="category-rating-bar">
              <span className="category-name">Check-in</span>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${(summary.rating_checkin / 5) * 100}%` }}
                />
              </div>
              <span className="category-value">{summary.rating_checkin.toFixed(1)}</span>
            </div>
          )}

          {summary?.rating_communication != null && (
            <div className="category-rating-bar">
              <span className="category-name">Communication</span>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${(summary.rating_communication / 5) * 100}%` }}
                />
              </div>
              <span className="category-value">{summary.rating_communication.toFixed(1)}</span>
            </div>
          )}

          {summary?.rating_location != null && (
            <div className="category-rating-bar">
              <span className="category-name">Location</span>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${(summary.rating_location / 5) * 100}%` }}
                />
              </div>
              <span className="category-value">{summary.rating_location.toFixed(1)}</span>
            </div>
          )}

          {summary?.rating_value != null && (
            <div className="category-rating-bar">
              <span className="category-name">Value</span>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${(summary.rating_value / 5) * 100}%` }}
                />
              </div>
              <span className="category-value">{summary.rating_value.toFixed(1)}</span>
            </div>
          )}
        </div>
      )}

      {/* Reviews Cards Grid */}
      {reviews.length > 0 && (
        <div className="reviews-cards-grid">
          {reviews.map((rev) => (
            <ReviewCard key={rev.id} review={rev} />
          ))}
        </div>
      )}
    </section>
  );
}

