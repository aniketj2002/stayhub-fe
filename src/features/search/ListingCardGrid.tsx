import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../../lib/format';
import type { SearchCard } from '../listings/types';

// NOTE: Detailed badges (Guest favorite, Superhost) and ratings count are not yet calculated in V1 backend.
// Rendered as fallback dummy attributes so cards in explore grids and map carousels match the reference design.

export interface ListingCardGridProps {
  listing: SearchCard;
  paramsString?: string;
  badge?: 'guest_favorite' | 'superhost' | null;
  onClick?: () => void;
  isSelected?: boolean;
}

export function ListingCardGrid({
  listing,
  paramsString = '',
  badge = null,
  onClick,
  isSelected = false,
}: ListingCardGridProps) {
  const [wishlist, setWishlist] = useState(false);

  const subtitle = `${listing.city} · ${listing.property_type ? listing.property_type.replace(/_/g, ' ') : 'Entire place'} · ${listing.max_guests} guests`;
  const nightlyFormatted = formatMoney(listing.nightly_price_minor, listing.currency);
  const url = `/listings/${listing.id}${paramsString ? `?${paramsString}` : ''}`;

  return (
    <article
      className={`listing-card-grid ${isSelected ? 'listing-card-grid--selected' : ''}`}
      onClick={onClick}
    >
      <div className="grid-card-media">
        <Link to={url} className="grid-image-link" tabIndex={-1}>
          {listing.cover_photo_url ? (
            <img src={listing.cover_photo_url} alt={listing.title} loading="lazy" />
          ) : (
            <div className="grid-image-fallback">⌂</div>
          )}
        </Link>

        {badge === 'guest_favorite' && <span className="guest-favorite-badge">Guest favorite</span>}
        {badge === 'superhost' && <span className="superhost-badge">Superhost</span>}

        <button
          type="button"
          className={`wishlist-heart-btn ${wishlist ? 'wishlist-heart-btn--active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setWishlist(!wishlist);
          }}
          aria-label={wishlist ? 'Remove from wishlist' : 'Save to wishlist'}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill={wishlist ? '#e8590c' : 'rgba(0,0,0,0.35)'}
            stroke="#ffffff"
            strokeWidth="2"
          >
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </button>
      </div>

      <div className="grid-card-body">
        <h3 className="grid-card-title">
          <Link to={url}>{listing.title}</Link>
        </h3>
        <p className="grid-card-subtitle">{subtitle}</p>
        <div className="grid-card-footer">
          <span className="grid-card-price">
            <strong>{nightlyFormatted}</strong> night
          </span>
          <span className="grid-card-rating">
            {listing.rating == null ? (
              <span className="new-stay-badge">New stay</span>
            ) : (
              <>
                <span className="star-char">★</span> {listing.rating.toFixed(2)}
              </>
            )}
          </span>
        </div>
      </div>
    </article>
  );
}
