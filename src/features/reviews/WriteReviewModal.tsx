import { useState } from 'react';
import { getCurrentUserId } from '../auth/session';
import { useReservationReviews, useSubmitReview } from './api';
import type { Review } from './types';

interface WriteReviewModalProps {
  open: boolean;
  onClose: () => void;
  reservationId: string;
  listingTitle?: string;
  onSuccess?: (review: Review) => void;
}

export function WriteReviewModal({
  open,
  onClose,
  reservationId,
  listingTitle,
  onSuccess,
}: WriteReviewModalProps) {
  const submitMutation = useSubmitReview();
  const { data: existingReviews = [] } = useReservationReviews(reservationId);
  const currentUserId = getCurrentUserId();
  const myReview = existingReviews.find((r) => r.author_id === currentUserId);

  const [rating, setRating] = useState<number>(0);
  const [cleanliness, setCleanliness] = useState<number>(5);
  const [accuracy, setAccuracy] = useState<number>(5);
  const [checkin, setCheckin] = useState<number>(5);
  const [communication, setCommunication] = useState<number>(5);
  const [location, setLocation] = useState<number>(5);
  const [value, setValue] = useState<number>(5);

  const [publicReview, setPublicReview] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setErrorMsg('Please select an overall star rating.');
      return;
    }
    if (!publicReview.trim() || publicReview.trim().length < 10) {
      setErrorMsg('Please write at least 10 characters for your public review.');
      return;
    }

    setErrorMsg(null);
    try {
      const review = await submitMutation.mutateAsync({
        reservationId,
        input: {
          rating,
          cleanliness_rating: cleanliness,
          accuracy_rating: accuracy,
          check_in_rating: checkin,
          communication_rating: communication,
          location_rating: location,
          value_rating: value,
          public_review: publicReview.trim(),
          private_note: privateNote.trim() || undefined,
        },
      });

      if (onSuccess) onSuccess(review);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit review.');
    }
  };

  const renderStarSelector = (
    label: string,
    currentValue: number,
    onChange: (val: number) => void,
    required = false,
  ) => (
    <div className="star-selector-row">
      <span className="star-selector-label">
        {label} {required && <span className="required-star">*</span>}
      </span>
      <div className="interactive-stars" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`star-btn ${star <= currentValue ? 'star-btn--filled' : ''}`}
            onClick={() => onChange(star)}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            role="radio"
            aria-checked={star === currentValue}
          >
            ★
          </button>
        ))}
        <span className="star-score-text">{currentValue > 0 ? `${currentValue}/5` : 'Select'}</span>
      </div>
    </div>
  );

  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
    >
      <div className="dialog-card review-modal-card">
        <div className="dialog-header">
          <h3 id="review-modal-title">Write a Review</h3>
          <button type="button" className="dialog-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {listingTitle && (
          <p className="review-modal-subtitle">
            How was your stay at <strong>{listingTitle}</strong>?
          </p>
        )}

        {myReview ? (
          <div className="review-submitted-view" style={{ padding: '16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span className="notice-icon" style={{ fontSize: '24px' }}>
                {myReview.published_at ? '✅' : '⏳'}
              </span>
              <div>
                <strong style={{ fontSize: '16px' }}>
                  {myReview.published_at ? 'Review Published' : 'Waiting for other party'}
                </strong>
                <p className="form-help" style={{ margin: '4px 0 0 0' }}>
                  {myReview.published_at
                    ? `Published on ${new Date(myReview.published_at).toLocaleDateString()}`
                    : 'Your review has been submitted. Under double-blind review policy, it remains private until both parties submit or the 14-day window expires.'}
                </p>
              </div>
            </div>

            <div className="review-preview-box" style={{ background: 'var(--surface-sunken, #f8f9fa)', padding: '16px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#f59e0b', fontSize: '18px' }}>
                  {'★'.repeat(myReview.rating)}{'☆'.repeat(5 - myReview.rating)}
                </span>
                <span className="muted-text" style={{ fontSize: '13px' }}>
                  {new Date(myReview.created_at).toLocaleDateString()}
                </span>
              </div>
              <p style={{ margin: 0, fontStyle: 'italic' }}>"{myReview.public_review}"</p>
            </div>

            <div className="dialog-actions">
              <button type="button" className="button button--secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="review-modal-form">
          {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}

          {/* Overall Rating */}
          <div className="overall-rating-section">
            {renderStarSelector('Overall experience', rating, setRating, true)}
          </div>

          {/* Category Ratings */}
          <div className="category-ratings-section">
            <h4>Detailed ratings</h4>
            <div className="category-ratings-grid">
              {renderStarSelector('Cleanliness', cleanliness, setCleanliness)}
              {renderStarSelector('Accuracy', accuracy, setAccuracy)}
              {renderStarSelector('Check-in', checkin, setCheckin)}
              {renderStarSelector('Communication', communication, setCommunication)}
              {renderStarSelector('Location', location, setLocation)}
              {renderStarSelector('Value', value, setValue)}
            </div>
          </div>

          {/* Public Feedback */}
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label htmlFor="public-review-textarea">
              Public review <span className="required-star">*</span>
            </label>
            <textarea
              id="public-review-textarea"
              rows={4}
              required
              className="form-input"
              placeholder="What did you love about this place? How was the neighborhood, amenities, and overall experience?"
              value={publicReview}
              onChange={(e) => setPublicReview(e.target.value)}
            />
            <span className="form-help">Visible to future guests on the listing page.</span>
          </div>

          {/* Private Note */}
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label htmlFor="private-note-textarea">Private note to host (optional)</label>
            <textarea
              id="private-note-textarea"
              rows={2}
              className="form-input"
              placeholder="Thank your host or share private suggestions for improvement."
              value={privateNote}
              onChange={(e) => setPrivateNote(e.target.value)}
            />
            <span className="form-help">Only shared directly with the host. Never public.</span>
          </div>

          <div className="review-blind-notice">
            <span className="notice-icon">🔒</span>
            <p className="notice-text">
              StayHub uses double-blind reviews. Your review will be published as soon as both
              parties submit their feedback or after the 14-day review window closes.
            </p>
          </div>

          <div className="dialog-actions">
            <button type="button" className="button button--ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="button button--primary"
              disabled={submitMutation.isPending || rating === 0 || !publicReview.trim()}
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

