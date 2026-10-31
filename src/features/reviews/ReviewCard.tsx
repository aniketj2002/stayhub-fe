import type { Review } from './types';

interface ReviewCardProps {
  review: Review;
}

export function ReviewCard({ review }: ReviewCardProps) {
  const authorInitials = (review.author_name || 'Guest')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const formattedDate = new Date(review.published_at || review.created_at).toLocaleDateString(
    undefined,
    {
      year: 'numeric',
      month: 'long',
    },
  );

  return (
    <article className="review-card" data-testid={`review-card-${review.id}`}>
      <div className="review-card-header">
        <div className="review-author-avatar">{authorInitials}</div>
        <div className="review-author-meta">
          <span className="review-author-name">{review.author_name || 'Guest'}</span>
          <span className="review-date">{formattedDate}</span>
        </div>
      </div>

      <div className="review-rating-row" aria-label={`Rating: ${review.rating} out of 5 stars`}>
        <span className="review-stars">{'★'.repeat(Math.max(1, Math.min(5, review.rating)))}</span>
        <span className="review-stars-empty">
          {'☆'.repeat(Math.max(0, 5 - Math.max(1, Math.min(5, review.rating))))}
        </span>
      </div>

      <p className="review-text">{review.public_review}</p>

      {/* Category breakdown pills if provided */}
      {(review.cleanliness_rating ||
        review.accuracy_rating ||
        review.communication_rating ||
        review.location_rating ||
        review.value_rating) && (
        <div className="review-category-pills">
          {review.cleanliness_rating && (
            <span className="category-pill">Cleanliness: {review.cleanliness_rating}/5</span>
          )}
          {review.accuracy_rating && (
            <span className="category-pill">Accuracy: {review.accuracy_rating}/5</span>
          )}
          {review.communication_rating && (
            <span className="category-pill">Communication: {review.communication_rating}/5</span>
          )}
          {review.location_rating && (
            <span className="category-pill">Location: {review.location_rating}/5</span>
          )}
          {review.value_rating && (
            <span className="category-pill">Value: {review.value_rating}/5</span>
          )}
        </div>
      )}
    </article>
  );
}

