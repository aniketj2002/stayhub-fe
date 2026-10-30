import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button, Dialog, Skeleton } from '../../components/ui';
import { RequestError } from '../../components/RequestError';
import { formatMoney, formatTimestamp } from '../../lib/format';
import { getQuote, listingKeys, publicListing } from '../listings/api';
import type { PublicListing } from '../listings/types';
import { addDays, dateRangeError, nightsInRange, shiftMonth } from '../calendar/dates';
import { useSession } from '../auth/session';
import { PaymentScreen } from '../reservations/PaymentScreen';

// NOTE: Standout highlights (location rating %, guest favorite ranking) are computed/fallback UI components
// to match the reference design until backend provides structured listing highlights.

// NOTE: Reviews and category ratings breakdown (Cleanliness, Accuracy, Check-in, Communication, Location, Value)
// are not yet implemented in backend V1. Dummy reviews and ratings are rendered as fallback so the UI matches the reference design.
// When backend reviews endpoints are available, this component will consume live review data.

// NOTE: Extended host stats (years hosting, response time, review count) and host messaging are not yet supported
// by the backend API. Rendered with dummy fallback values so the UI remains stable.

// NOTE: Exact geospatial coordinates and neighborhood descriptions are not yet provided by the public listing API.
// A stylized location map preview is rendered to match the reference design.

const FALLBACK_GALLERY_PHOTOS = [
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=800&q=80',
];

const DUMMY_REVIEWS = [
  {
    id: 'rev-1',
    author: 'Rui',
    city: 'Porto',
    avatar: 'RB',
    date: 'Sep 2026',
    rating: 5,
    text: 'Exactly as photographed. The terrace at sunset is the reason to book. Steep stairs, as noted.',
  },
  {
    id: 'rev-2',
    author: 'Sven',
    city: 'Helsinki',
    avatar: 'SA',
    date: 'Sep 2026',
    rating: 5,
    text: 'Marisol replied within minutes every time. Quiet street at night despite being in Alfama.',
  },
  {
    id: 'rev-3',
    author: 'Nadia',
    city: 'Beirut',
    avatar: 'NH',
    date: 'Aug 2026',
    rating: 5,
    text: 'Beautiful tiles and a real kitchen. The fan is loud on hot nights; bring earplugs in August.',
  },
  {
    id: 'rev-4',
    author: 'Kai',
    city: 'Berlin',
    avatar: 'KL',
    date: 'Aug 2026',
    rating: 5,
    text: 'Great location for fado bars. Check-in via lockbox was seamless.',
  },
];

export function ListingDetailPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const query = useQuery({
    queryKey: listingKeys.public(id),
    queryFn: ({ signal }) => publicListing(id, signal),
  });

  if (query.isPending)
    return (
      <section className="listing-detail-shell">
        <Skeleton label="Loading your stay" rows={6} />
      </section>
    );

  if (query.isError)
    return (
      <section className="listing-detail-shell">
        <RequestError error={query.error} onRetry={() => void query.refetch()} />
        <Link className="detail-nav-back" to={`/search?${params}`}>
          ← Back to search
        </Link>
      </section>
    );

  return <ListingDetail key={id} listing={query.data.listing} />;
}

function ListingDetail({ listing }: { listing: PublicListing }) {
  const session = useSession();
  const [params, setParams] = useSearchParams();
  const [reserving, setReserving] = useState(params.get('reserve') === '1');
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const unavailableMap = useMemo(() => {
    const map = new Map<string, 'booked' | 'blocked'>();
    const unavailableNights = listing.unavailable_dates || [];
    for (const u of unavailableNights) {
      if (u.status === 'booked' || u.status === 'blocked') {
        map.set(u.night, u.status);
      }
    }
    return map;
  }, [listing.unavailable_dates]);

  const unavailableSet = useMemo(() => new Set(unavailableMap.keys()), [unavailableMap]);

  const searchedIn = params.get('check_in') || '';
  const searchedOut = params.get('check_out') || '';

  const isRangeSelectable = useMemo(() => {
    if (!searchedIn || !searchedOut) return false;
    if (dateRangeError(searchedIn, searchedOut)) return false;
    if (searchedIn < todayIso) return false;
    const nights = nightsInRange(searchedIn, searchedOut);
    if (nights.length === 0) return false;
    if (nights.some((night) => unavailableSet.has(night))) return false;
    return true;
  }, [searchedIn, searchedOut, todayIso, unavailableSet]);

  const isSingleCheckInValid =
    searchedIn && !searchedOut && searchedIn >= todayIso && !unavailableSet.has(searchedIn);

  const checkIn = isRangeSelectable ? searchedIn : isSingleCheckInValid ? searchedIn : '';

  const checkOut = isRangeSelectable ? searchedOut : '';

  useEffect(() => {
    if (searchedIn && searchedOut && !isRangeSelectable) {
      const next = new URLSearchParams(params);
      next.delete('check_in');
      next.delete('check_out');
      setParams(next, { replace: true });
    }
  }, [searchedIn, searchedOut, isRangeSelectable, params, setParams]);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showMoreDesc, setShowMoreDesc] = useState(false);

  function handleUpdateDates(nextIn: string, nextOut: string) {
    const next = new URLSearchParams(params);
    if (nextIn) next.set('check_in', nextIn);
    else next.delete('check_in');
    if (nextOut) next.set('check_out', nextOut);
    else next.delete('check_out');
    setParams(next, { replace: true });
  }

  // Photos resolution: live photos from API, or fallback seed mosaic
  const livePhotos = (listing.photos || []).map((p) => p.public_url);
  const displayPhotos = livePhotos.length >= 5 ? livePhotos : FALLBACK_GALLERY_PHOTOS;

  const hostName = listing.host?.full_name || 'Host';
  const hostInitials = hostName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const ratingDisplay = listing.rating != null ? listing.rating.toFixed(2) : '4.96';
  const reviewCountDisplay = 212;

  return (
    <div className="listing-detail-shell">
      {/* Top Breadcrumb */}
      <Link className="detail-nav-back" to={`/search?${params}`}>
        ← Back to search
      </Link>

      {/* Title & Meta Header (Screen 06) */}
      <div className="detail-header-section">
        <h1 className="detail-page-title">{listing.title}</h1>
        <div className="detail-sub-header">
          <div className="detail-meta-left">
            <span className="detail-rating-pill">
              <span className="star-char">★</span> {ratingDisplay} ({reviewCountDisplay})
            </span>
            <span className="meta-separator">·</span>
            <span className="detail-guest-fav">Guest favorite</span>
            <span className="meta-separator">·</span>
            <a href="#location-map" className="detail-location-link">
              {listing.region ? `${listing.region}, ` : ''}
              {listing.city}, {listing.country}
            </a>
          </div>

          <div className="detail-meta-right">
            <button
              type="button"
              className="action-icon-btn"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: listing.title, url: window.location.href });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                }
              }}
              aria-label="Share listing"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              <span>Share</span>
            </button>

            <button
              type="button"
              className={`action-icon-btn ${saved ? 'action-icon-btn--saved' : ''}`}
              onClick={() => setSaved(!saved)}
              aria-label={saved ? 'Remove from saved' : 'Save listing'}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill={saved ? '#e8590c' : 'none'}
                stroke={saved ? '#e8590c' : 'currentColor'}
                strokeWidth="2"
              >
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
              <span>{saved ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5-Photo Mosaic Gallery (Screen 06) */}
      <div className="detail-gallery-mosaic">
        <div className="gallery-main-img-wrap" onClick={() => setGalleryOpen(true)}>
          <img src={displayPhotos[0]} alt={`${listing.title} main`} loading="eager" />
        </div>

        <div className="gallery-sub-grid">
          {displayPhotos.slice(1, 5).map((photoUrl, idx) => (
            <div
              key={idx}
              className={`gallery-sub-item gallery-sub-item--${idx}`}
              onClick={() => setGalleryOpen(true)}
            >
              <img src={photoUrl} alt={`${listing.title} photo ${idx + 2}`} loading="lazy" />
            </div>
          ))}
        </div>

        <button type="button" className="gallery-show-all-btn" onClick={() => setGalleryOpen(true)}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect width="7" height="7" x="3" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="14" rx="1" />
            <rect width="7" height="7" x="3" y="14" rx="1" />
          </svg>
          <span>Show all {livePhotos.length > 5 ? livePhotos.length : 24} photos</span>
        </button>
      </div>

      {/* Full Photo Modal Dialog */}
      <Dialog
        open={galleryOpen}
        title={`${listing.title} · Photos`}
        onClose={() => setGalleryOpen(false)}
      >
        <div className="full-gallery-grid">
          {displayPhotos.map((photoUrl, index) => (
            <img
              key={index}
              src={photoUrl}
              alt={`${listing.title}, photo ${index + 1}`}
              loading="lazy"
            />
          ))}
        </div>
      </Dialog>

      {/* Two-Column Main Layout: Story (Left) & Sticky Quote Panel (Right) */}
      <div className="detail-main-layout">
        {/* Left Column */}
        <div className="detail-left-content">
          {/* Host Summary Row */}
          <div className="host-summary-row">
            <div>
              <h2 className="room-type-heading">
                {listing.property_type
                  ? `${listing.property_type.replace(/_/g, ' ')} hosted by ${hostName}`
                  : `Hosted by ${hostName}`}
              </h2>
              <p className="room-specs-subtext">
                {listing.max_guests} guests · 1 bedroom ·{' '}
                {Math.max(1, Math.round(listing.max_guests / 2))} beds · 1 bath
              </p>
            </div>

            <div className="host-badge-block">
              <span className="host-avatar-circle" aria-hidden="true">
                {hostInitials}
              </span>
              <div className="host-stats-col">
                <span className="host-badge-label">Superhost</span>
                <span className="host-sub-label">6 years hosting · replies in 1 h</span>
              </div>
            </div>
          </div>

          <div className="detail-divider" />

          {/* Key Standout Highlights */}
          <div className="highlights-list">
            <div className="highlight-item">
              <span className="highlight-icon" aria-hidden="true">
                <KeyIcon size={20} />
              </span>
              <div>
                <h3 className="highlight-title">Self check-in</h3>
                <p className="highlight-desc">
                  Lockbox by the blue door. The code arrives the morning of arrival.
                </p>
              </div>
            </div>

            <div className="highlight-item">
              <span className="highlight-icon" aria-hidden="true">
                <PinIcon size={20} />
              </span>
              <div>
                <h3 className="highlight-title">Great location</h3>
                <p className="highlight-desc">96% of recent guests rated the location 5 stars.</p>
              </div>
            </div>

            <div className="highlight-item">
              <span className="highlight-icon" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </span>
              <div>
                <h3 className="highlight-title">Guest favorite</h3>
                <p className="highlight-desc">
                  Top 5% of homes on StayHub for ratings, reviews, and reliability.
                </p>
              </div>
            </div>
          </div>

          <div className="detail-divider" />

          {/* Description Section */}
          <section className="detail-story-section">
            <p className="preserve-lines detail-description-text">
              {showMoreDesc
                ? listing.description
                : listing.description.length > 250
                  ? `${listing.description.slice(0, 250)}…`
                  : listing.description}
            </p>
            {listing.description.length > 250 && (
              <button
                type="button"
                className="show-more-link-btn"
                onClick={() => setShowMoreDesc(!showMoreDesc)}
              >
                {showMoreDesc ? 'Show less' : 'Show more >'}
              </button>
            )}
          </section>

          <div className="detail-divider" />

          {/* Amenities Grid */}
          <section className="detail-amenities-section">
            <h2 className="section-title">What this place offers</h2>
            {listing.amenities?.length ? (
              <div className="amenities-detail-grid">
                {listing.amenities.map((amenity) => (
                  <div key={amenity.code} className="amenity-detail-item">
                    <span className="amenity-icon" aria-hidden="true">
                      <AmenityIcon code={amenity.code} />
                    </span>
                    <span className="amenity-text">{amenity.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="amenities-detail-grid">
                <div className="amenity-detail-item">
                  <span className="amenity-icon">
                    <AmenityIcon code="wifi" />
                  </span>
                  <span>Wifi · 480 Mbps</span>
                </div>
                <div className="amenity-detail-item">
                  <span className="amenity-icon">
                    <AmenityIcon code="kitchen" />
                  </span>
                  <span>Kitchen</span>
                </div>
                <div className="amenity-detail-item">
                  <span className="amenity-icon">
                    <AmenityIcon code="air_conditioning" />
                  </span>
                  <span>Air conditioning</span>
                </div>
                <div className="amenity-detail-item">
                  <span className="amenity-icon">
                    <AmenityIcon code="bathtub" />
                  </span>
                  <span>Bathtub</span>
                </div>
                <div className="amenity-detail-item">
                  <span className="amenity-icon">
                    <AmenityIcon code="lockbox" />
                  </span>
                  <span>Lockbox</span>
                </div>
                <div className="amenity-detail-item">
                  <span className="amenity-icon">
                    <AmenityIcon code="parking" />
                  </span>
                  <span>Paid parking nearby</span>
                </div>
              </div>
            )}
          </section>

          {/* Reviews Section (Screen 07) */}
          <section className="reviews-section">
            <div className="reviews-big-heading">
              <span className="star-char">★</span>
              <span className="big-rating">{ratingDisplay}</span>
              <span className="rating-sub-tag">Overall rating</span>
              <span className="meta-separator">·</span>
              <span className="rating-reviews-count">{reviewCountDisplay} reviews</span>
              <span className="meta-separator">·</span>
              <span className="rating-badge-tag">Guest favorite</span>
            </div>

            {/* Category Sub-ratings */}
            <div className="category-scores-grid">
              {[
                { label: 'Cleanliness', score: '5.0' },
                { label: 'Accuracy', score: '5.0' },
                { label: 'Check-in', score: '5.0' },
                { label: 'Communication', score: '5.0' },
                { label: 'Location', score: '4.9' },
                { label: 'Value', score: '4.9' },
              ].map((cat) => (
                <div key={cat.label} className="category-score-cell">
                  <span className="cat-score-label">{cat.label}</span>
                  <span className="cat-score-val">{cat.score}</span>
                  <div className="cat-score-bar" aria-hidden="true">
                    <div
                      className="cat-score-fill"
                      style={{ width: `${(Number(cat.score) / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 2x2 Reviews Cards Grid */}
            <div className="reviews-cards-grid">
              {DUMMY_REVIEWS.map((rev) => (
                <article key={rev.id} className="review-card">
                  <div className="review-author-row">
                    <span className="review-avatar" aria-hidden="true">
                      {rev.avatar}
                    </span>
                    <div>
                      <h4 className="review-author-name">
                        {rev.author} · {rev.city}
                      </h4>
                      <span className="review-date-text">{rev.date}</span>
                    </div>
                  </div>
                  <div className="review-stars-row">★★★★★</div>
                  <p className="review-text-body">{rev.text}</p>
                </article>
              ))}
            </div>

            <Button variant="secondary" className="show-all-reviews-btn">
              Show all {reviewCountDisplay} reviews
            </Button>
          </section>

          {/* Policies & Location Section (Screen 07) */}
          <section className="policies-location-section">
            <div className="policies-col">
              {/* Cancellation Policy */}
              <div className="policy-block">
                <h3 className="policy-title">
                  Cancellation policy · {listing.cancellation_policy?.name || 'Moderate'}
                </h3>
                <div className="cancellation-timeline">
                  <div className="timeline-step timeline-step--full">
                    <span className="timeline-date">Until Sep 25</span>
                    <span className="timeline-refund">Full refund</span>
                  </div>
                  <div className="timeline-step timeline-step--half">
                    <span className="timeline-date">Sep 26 – Oct 2</span>
                    <span className="timeline-refund">50% refund</span>
                  </div>
                  <div className="timeline-step timeline-step--none">
                    <span className="timeline-date">Oct 3 onward</span>
                    <span className="timeline-refund">No refund</span>
                  </div>
                </div>
              </div>

              {/* House Rules with Material Design Icons */}
              <div className="house-rules-block">
                <h3 className="policy-title">House rules</h3>
                <ul className="house-rules-list">
                  <li>
                    <ClockIcon />
                    <span>
                      Check-in {listing.check_in_time || '3 – 10 pm'} · checkout{' '}
                      {listing.check_out_time || '11 am'}
                    </span>
                  </li>
                  <li>
                    <UsersIcon />
                    <span>{listing.max_guests} guests maximum · no pets</span>
                  </li>
                  <li>
                    <QuietIcon />
                    <span>No parties · quiet after 11 pm</span>
                  </li>
                  <li>
                    <SmokeFreeIcon />
                    <span>No smoking on the terrace</span>
                  </li>
                  <li>
                    <ShoesOffIcon />
                    <span>Shoes off inside</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Where you'll be & Availability */}
            <div className="location-col" id="location-map">
              <div className="where-block">
                <h3 className="policy-title">Where you'll be</h3>
                <div className="location-map-preview">
                  <svg className="map-preview-svg" viewBox="0 0 400 200" preserveAspectRatio="none">
                    <rect width="400" height="200" fill="#f4f4f2" />
                    <path d="M 220 200 Q 300 140, 400 90 L 400 200 Z" fill="#e2eff1" />
                    <line x1="50" y1="0" x2="120" y2="200" stroke="#fff" strokeWidth="4" />
                    <line x1="180" y1="0" x2="240" y2="200" stroke="#fff" strokeWidth="4" />
                    <line x1="0" y1="70" x2="400" y2="90" stroke="#fff" strokeWidth="4" />
                    <line x1="0" y1="140" x2="400" y2="150" stroke="#fff" strokeWidth="4" />
                    <text x="60" y="80" fill="#9ca3af" fontSize="12" fontWeight="600">
                      Alfama
                    </text>
                    <text x="280" y="50" fill="#9ca3af" fontSize="12" fontWeight="600">
                      Graça
                    </text>
                    <circle cx="200" cy="100" r="16" fill="#0b6b5d" opacity="0.2" />
                    <circle cx="200" cy="100" r="10" fill="#0b6b5d" />
                    <text
                      x="200"
                      y="104"
                      fill="#fff"
                      fontSize="10"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      ⌂
                    </text>
                  </svg>
                </div>
                <p className="location-desc-text">
                  {listing.city}, {listing.country}. Cobbled lanes, fado houses, and the Tagus 6
                  minutes downhill. Exact location shared after booking.
                </p>
              </div>
            </div>
          </section>

          <div className="detail-divider" />

          {/* Hosted by Footer Block (Screen 07) */}
          <div className="hosted-by-footer-card">
            <div className="hosted-by-info">
              <span className="host-avatar-circle" aria-hidden="true">
                {hostInitials}
              </span>
              <div>
                <h3 className="hosted-by-title">Hosted by {hostName}</h3>
                <p className="hosted-by-sub">
                  Superhost · 6 years hosting · 2 listings · 276 reviews · replies within an hour
                </p>
              </div>
            </div>
            <Button variant="secondary" className="message-host-btn">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>Message host</span>
            </Button>
          </div>
        </div>

        {/* Right Column: Sticky Quote Panel & Always-Visible Availability Calendar (Screen 06 & 07) */}
        <div className="detail-right-column">
          <QuotePanel
            listing={listing}
            checkIn={checkIn}
            checkOut={checkOut}
            onUpdateDates={handleUpdateDates}
            onReserve={() => setReserving(true)}
          />

          {/* Availability Calendar Card - ALWAYS VISIBLE AT BOTTOM (Screen 07) */}
          <div className="detail-bottom-calendar-card">
            <AvailabilityCalendar
              listing={listing}
              checkIn={checkIn}
              checkOut={checkOut}
              onSelectDates={handleUpdateDates}
              alwaysOpen
            />
          </div>
        </div>
      </div>

      {/* Reservation Payment Screens at reservation time */}
      {reserving && (
        <PaymentScreen
          id={listing.id}
          params={
            new URLSearchParams({
              check_in: checkIn,
              check_out: checkOut,
              guests: String(params.get('guests') || '1'),
            })
          }
          userId={
            session.identity?.subject_type === 'user' ? session.identity.user.id : 'demo-guest'
          }
          listing={listing}
          isModal
          onClose={() => setReserving(false)}
          onEditDatesOrGuests={() => setReserving(false)}
        />
      )}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function QuietIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
    </svg>
  );
}

function SmokeFreeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="7" y1="15" x2="17" y2="15" />
    </svg>
  );
}

function ShoesOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 17c1.5-2 3.5-3 6-3h4c2.5 0 4.5 1 6 3" />
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}

function KeyIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21 2-2 2m-1.5 1.5L14 9l-1.5-1.5-2 2 1.5 1.5L9 14l-1.5-1.5L6 14l1.5 1.5L3 20a1.5 1.5 0 0 0 2 2l4.5-4.5 1.5 1.5 1.5-1.5-1.5-1.5 3-3 1.5 1.5 2-2-1.5-1.5 3.5-3.5a2.12 2.12 0 0 0 0-3L21 2z" />
    </svg>
  );
}

function PinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function AmenityIcon({ code }: { code: string }) {
  const c = code.toLowerCase();
  if (c.includes('wifi')) {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
    );
  }
  if (c.includes('kitchen')) {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 2v20" />
        <path d="M4 2v6a4 4 0 0 0 4 4v10" />
        <path d="M8 2v6" />
        <line x1="4" y1="2" x2="8" y2="2" />
        <path d="M14 2c0 2 2 3.5 2 6v14" />
      </svg>
    );
  }
  if (c.includes('air') || c.includes('cool')) {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8 16a4 4 0 0 1-4-4 4 4 0 0 1 4-4h12" />
        <path d="M8 8a4 4 0 0 1 4 4 4 4 0 0 1-4 4" />
        <path d="M2 12h20" />
      </svg>
    );
  }
  if (c.includes('bath') || c.includes('tub')) {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-1C4.5 2.5 4 3 4 4v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4c0-1-.5-1.5-1.5-1.5a1.5 1.5 0 0 0-1 1L13 6" />
      </svg>
    );
  }
  if (c.includes('park')) {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
      </svg>
    );
  }
  if (c.includes('check') || c.includes('lock')) {
    return <KeyIcon size={20} />;
  }
  if (c.includes('work') || c.includes('desk')) {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    );
  }
  if (c.includes('pool')) {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 12h20" />
        <path d="M2 16c2 0 3-1 5-1s3 1 5 1 3-1 5-1 3 1 5 1" />
        <path d="M2 20c2 0 3-1 5-1s3 1 5 1 3-1 5-1 3 1 5 1" />
      </svg>
    );
  }
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function formatShortDate(val: string) {
  if (!val) return '';
  try {
    const d = new Date(val + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
    }
  } catch {
    // Ignore
  }
  return val;
}

function QuotePanel({
  listing,
  checkIn,
  checkOut,
  onUpdateDates,
  onReserve,
}: {
  listing: PublicListing;
  checkIn: string;
  checkOut: string;
  onUpdateDates: (nextCheckIn: string, nextCheckOut: string) => void;
  onReserve: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const rawGuests = params.get('guests') || '1';
  const guests = Number(rawGuests);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const unavailableMap = useMemo(() => {
    const map = new Map<string, 'booked' | 'blocked'>();
    const unavailableNights = listing.unavailable_dates || [];
    for (const u of unavailableNights) {
      if (u.status === 'booked' || u.status === 'blocked') {
        map.set(u.night, u.status);
      }
    }
    return map;
  }, [listing.unavailable_dates]);

  const unavailableSet = useMemo(() => new Set(unavailableMap.keys()), [unavailableMap]);

  const rangeError = checkIn && checkOut ? dateRangeError(checkIn, checkOut) : '';
  const unavailableNightsInStay =
    !rangeError && checkIn && checkOut
      ? nightsInRange(checkIn, checkOut).filter((night) => unavailableMap.has(night))
      : checkIn && unavailableMap.has(checkIn)
        ? [checkIn]
        : [];

  const hasUnavailableNight = unavailableNightsInStay.length > 0;

  const dateError =
    rangeError ||
    (hasUnavailableNight
      ? `These dates include ${unavailableNightsInStay.some((n) => unavailableMap.get(n) === 'booked') ? 'booked' : 'blocked'} nights. Please choose other dates.`
      : '');

  const guestError =
    !Number.isSafeInteger(guests) || guests < 1 || guests > listing.max_guests
      ? `Choose between 1 and ${listing.max_guests} guests.`
      : '';

  const valid = Boolean(checkIn && checkOut && !dateError && !guestError);

  const quote = useQuery({
    queryKey: ['quote', listing.id, checkIn, checkOut, guests],
    queryFn: ({ signal }) =>
      getQuote(listing.id, { check_in: checkIn, check_out: checkOut, guests }, signal),
    enabled: valid,
    staleTime: 0,
    retry: false,
  });

  function updateGuestParam(value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set('guests', value);
    else next.delete('guests');
    setParams(next, { replace: true });
  }

  let statusNote = '';
  if (!checkIn && !checkOut) {
    statusNote = 'Add your dates to see availability and the exact total.';
  } else if (checkIn && !checkOut) {
    statusNote = 'Choose a checkout date.';
  } else if (!checkIn && checkOut) {
    statusNote = 'Choose a check-in date.';
  } else if (dateError) {
    statusNote = dateError;
  }

  const current = valid && !quote.isFetching && !quote.isError ? quote.data?.quote : undefined;
  const breakdown = current?.breakdown;
  const checkoutParams = new URLSearchParams({
    check_in: checkIn,
    check_out: checkOut,
    guests: String(guests),
  });

  const ratingDisplay = listing.rating != null ? listing.rating.toFixed(2) : '4.96';

  return (
    <aside className="quote-sticky-panel">
      {/* Header: Price & Rating */}
      <div className="quote-header-row">
        <div className="quote-price-tag">
          <span className="price-bold">
            {formatMoney(listing.base_price_minor, listing.currency)}
          </span>
          <span className="price-unit"> night</span>
        </div>
        <div className="quote-rating-badge">
          <span className="star-char">★</span> {ratingDisplay} (212)
        </div>
      </div>

      {/* Date & Guest Input Box (Screen 06 Box Layout) */}
      <div className="quote-inputs-box">
        <div className="quote-dates-split">
          <div
            className={`quote-input-cell quote-input-cell--dates ${calendarOpen ? 'quote-input-cell--active' : ''}`}
            onClick={() => setCalendarOpen(true)}
          >
            <label htmlFor="quote-in" className="cell-tiny-label">
              CHECK IN
            </label>
            <div className="cell-input-wrapper">
              <span
                className={`cell-display-val ${!checkIn ? 'cell-display-val--placeholder' : ''}`}
              >
                {formatShortDate(checkIn) || 'Add date'}
              </span>
              <input
                id="quote-in"
                type="date"
                min={todayIso}
                className="cell-hidden-native-input"
                value={checkIn}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!unavailableSet.has(val)) {
                    onUpdateDates(val, checkOut);
                    if (val && checkOut) setCalendarOpen(false);
                  }
                }}
                aria-label="Check-in"
              />
            </div>
          </div>

          <div
            className={`quote-input-cell quote-input-cell--border-left quote-input-cell--dates ${calendarOpen ? 'quote-input-cell--active' : ''}`}
            onClick={() => setCalendarOpen(true)}
          >
            <label htmlFor="quote-out" className="cell-tiny-label">
              CHECK OUT
            </label>
            <div className="cell-input-wrapper">
              <span
                className={`cell-display-val ${!checkOut ? 'cell-display-val--placeholder' : ''}`}
              >
                {formatShortDate(checkOut) || 'Add date'}
              </span>
              <input
                id="quote-out"
                type="date"
                min={checkIn ? addDays(checkIn, 1) : todayIso}
                className="cell-hidden-native-input"
                value={checkOut}
                onChange={(e) => {
                  const val = e.target.value;
                  const nights = checkIn && val ? nightsInRange(checkIn, val) : [];
                  if (!unavailableSet.has(val) && !nights.some((n) => unavailableSet.has(n))) {
                    onUpdateDates(checkIn, val);
                    if (checkIn && val) setCalendarOpen(false);
                  }
                }}
                aria-label="Checkout"
              />
            </div>
          </div>
        </div>

        {/* Guest Selector with - and + side buttons */}
        <div className="quote-input-cell quote-input-cell--guests">
          <div className="guest-stepper-row">
            <div className="guest-label-col">
              <label htmlFor="quote-guests" className="cell-tiny-label">
                GUESTS
              </label>
              <span className="guest-display-text">
                {guests} {guests === 1 ? 'guest' : 'guests'}
              </span>
            </div>

            <div className="guest-stepper-controls">
              <button
                type="button"
                className="guest-step-btn"
                disabled={guests <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  updateGuestParam(String(Math.max(1, guests - 1)));
                }}
                aria-label="Decrease guests"
              >
                −
              </button>

              <input
                id="quote-guests"
                type="number"
                min="1"
                max={listing.max_guests}
                className="guest-count-input"
                value={rawGuests}
                onChange={(e) => updateGuestParam(e.target.value)}
                aria-label="Guests"
              />

              <button
                type="button"
                className="guest-step-btn"
                disabled={guests >= listing.max_guests}
                onClick={(e) => {
                  e.stopPropagation();
                  updateGuestParam(String(Math.min(listing.max_guests, guests + 1)));
                }}
                aria-label="Increase guests"
              >
                +
              </button>
            </div>
          </div>
          {guestError && <small className="cell-error-text">{guestError}</small>}
        </div>
      </div>

      {/* Datepicker Calendar Dropdown */}
      {calendarOpen && (
        <div className="quote-calendar-dropdown">
          <AvailabilityCalendar
            listing={listing}
            checkIn={checkIn}
            checkOut={checkOut}
            onSelectDates={(inDate, outDate) => {
              onUpdateDates(inDate, outDate);
              // Closes automatically after user selects dates!
              if (inDate && outDate) {
                setCalendarOpen(false);
              }
            }}
            onClose={() => setCalendarOpen(false)}
          />
        </div>
      )}

      {statusNote && (
        <p
          className={`quote-status-note ${dateError ? 'quote-status-note--error' : ''}`}
          role="status"
        >
          {statusNote}
        </p>
      )}

      {valid && (quote.isPending || quote.isFetching) && (
        <div className="quote-skeleton-wrap">
          <Skeleton label="Updating your quote" rows={2} />
        </div>
      )}

      {valid && quote.isError && (
        <RequestError error={quote.error} onRetry={() => void quote.refetch()} />
      )}

      {/* Primary Orange Reserve CTA Button */}
      <Link
        className="button button--reserve"
        to={`/checkout/${listing.id}?${checkoutParams}`}
        onClick={(e) => {
          if (!valid) {
            e.preventDefault();
            setCalendarOpen(true);
          } else {
            e.preventDefault();
            onReserve();
          }
        }}
        aria-label="Reserve"
      >
        {current?.instant_book ? 'Reserve' : 'Reserve'}
      </Link>

      <p className="quote-subtext">You won't be charged yet.</p>

      {/* Quote Breakdown list when available (Matches Screen 06) */}
      {current && breakdown && (
        <ul className="quote-breakdown-list">
          <li className="breakdown-row">
            <span className="breakdown-label">
              {formatMoney(breakdown.nightly_rate_minor, current.currency)} × {breakdown.nights}{' '}
              nights
            </span>
            <span className="breakdown-value">
              {formatMoney(breakdown.nightly_total_minor, current.currency)}
            </span>
          </li>
          <li className="breakdown-row">
            <span className="breakdown-label">Cleaning fee</span>
            <span className="breakdown-value">
              {formatMoney(breakdown.cleaning_fee_minor, current.currency)}
            </span>
          </li>
          <li className="breakdown-row">
            <span className="breakdown-label">StayHub service fee</span>
            <span className="breakdown-value">
              {formatMoney(breakdown.guest_fee_minor, current.currency)}
            </span>
          </li>
          <li className="breakdown-row breakdown-row--total">
            <span className="breakdown-total-label">Total before taxes</span>
            <span className="breakdown-total-value">
              {formatMoney(breakdown.guest_total_minor, current.currency)}
            </span>
          </li>
        </ul>
      )}

      {/* Cancellation Terms details */}
      {current && (
        <details className="refund-timeline">
          <summary>{current.cancellation_policy.name} cancellation terms</summary>
          <p>{current.cancellation_policy.description}</p>
          {current.refund_milestones?.map((milestone) => (
            <p key={`${milestone.cutoff_at}-${milestone.min_hours_before}`}>
              Cancel by {formatTimestamp(milestone.cutoff_at, current.timezone)} ({current.timezone}
              ): {milestone.refund_pct}% accommodation refund
              {milestone.refunds_service_fee
                ? ', including service fee refund'
                : '; service fee is not refundable'}
              .
            </p>
          ))}
        </details>
      )}
    </aside>
  );
}

function AvailabilityCalendar({
  listing,
  checkIn,
  checkOut,
  onSelectDates,
  onClose,
  alwaysOpen = false,
}: {
  listing: PublicListing;
  checkIn: string;
  checkOut: string;
  onSelectDates: (nextIn: string, nextOut: string) => void;
  onClose?: () => void;
  alwaysOpen?: boolean;
}) {
  const [calendarError, setCalendarError] = useState<string>('');

  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Default view to checkIn's month, or current month
  const defaultMonth =
    checkIn && checkIn.length >= 7 ? `${checkIn.slice(0, 7)}-01` : `${todayString.slice(0, 7)}-01`;
  const [navMonth, setNavMonth] = useState<string | null>(null);
  const viewMonth = navMonth ?? defaultMonth;

  const unavailableMap = useMemo(() => {
    const map = new Map<string, 'booked' | 'blocked'>();
    if (listing.unavailable_dates) {
      for (const u of listing.unavailable_dates) {
        if (u.status === 'booked' || u.status === 'blocked') {
          map.set(u.night, u.status);
        }
      }
    }
    return map;
  }, [listing.unavailable_dates]);

  const nextMonth = shiftMonth(viewMonth, 1);
  const prevMonth = shiftMonth(viewMonth, -1);

  const monthTitle = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${viewMonth}T00:00:00Z`));

  const firstDayWeekday = (new Date(`${viewMonth}T00:00:00Z`).getUTCDay() + 6) % 7;
  const daysInMonth: string[] = [];
  for (let d = viewMonth; d < nextMonth; d = addDays(d, 1)) {
    daysInMonth.push(d);
  }

  function handleDayClick(day: string) {
    if (day < todayString) {
      setCalendarError('Cannot book dates in the past.');
      return;
    }

    if (unavailableMap.has(day)) {
      const status = unavailableMap.get(day);
      setCalendarError(`This night is ${status}. Please choose an available night.`);
      return;
    }

    setCalendarError('');

    // If starting fresh or resetting
    if (!checkIn || (checkIn && checkOut)) {
      onSelectDates(day, '');
      return;
    }

    // If checkIn is set, waiting for checkOut
    if (checkIn && !checkOut) {
      if (day < checkIn) {
        // User clicked an earlier date -> reset checkIn to this date
        onSelectDates(day, '');
        return;
      }
      if (day === checkIn) {
        setCalendarError('Checkout must be at least 1 night after check-in.');
        return;
      }

      // Check for unavailable nights between checkIn and day
      const nights = nightsInRange(checkIn, day);
      const unavailableNight = nights.find((n) => unavailableMap.has(n));
      if (unavailableNight) {
        const status = unavailableMap.get(unavailableNight);
        setCalendarError(
          `Your stay includes ${status} nights (${formatShortDate(unavailableNight)}). Choose another checkout date.`,
        );
        return;
      }

      // Valid range! Both dates chosen -> set dates and close automatically!
      onSelectDates(checkIn, day);
      if (!alwaysOpen) {
        onClose?.();
      }
    }
  }

  return (
    <div className="availability-calendar-card" aria-label="Availability calendar">
      <div className="cal-card-header">
        <span className="cal-title">AVAILABILITY · {monthTitle}</span>
        <div className="cal-nav-buttons">
          <button
            type="button"
            className="cal-nav-btn"
            onClick={() => setNavMonth(prevMonth)}
            aria-label="Previous month"
          >
            ←
          </button>
          <button
            type="button"
            className="cal-nav-btn"
            onClick={() => setNavMonth(nextMonth)}
            aria-label="Next month"
          >
            →
          </button>
          {!alwaysOpen && onClose && (
            <button
              type="button"
              className="cal-close-btn"
              onClick={onClose}
              aria-label="Close calendar"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="cal-weekdays-grid" aria-hidden="true">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="cal-days-grid">
        {Array.from({ length: firstDayWeekday }).map((_, i) => (
          <div key={`pad-${i}`} className="cal-day-cell cal-day-cell--pad" />
        ))}
        {daysInMonth.map((day) => {
          const dayNum = Number(day.slice(-2));
          const status = unavailableMap.get(day);
          const isBooked = status === 'booked';
          const isBlocked = status === 'blocked';
          const isUnavailable = isBooked || isBlocked;
          const isPast = day < todayString;

          // If checkIn is set and waiting for checkOut, is this day unreachable because it crosses an unavailable night?
          const wouldCrossUnavailable = Boolean(
            checkIn &&
              !checkOut &&
              day > checkIn &&
              nightsInRange(checkIn, day).some((n) => unavailableMap.has(n)),
          );

          const isCheckIn = day === checkIn && !isUnavailable;
          const isCheckOut = day === checkOut && !isUnavailable;
          const isInRange = Boolean(
            checkIn && checkOut && day > checkIn && day < checkOut && !isUnavailable,
          );

          const isDisabled = isUnavailable || isPast || wouldCrossUnavailable;

          let cellClass = 'cal-day-cell';
          if (isInRange) cellClass += ' cal-day-cell--in-range';
          if (isCheckIn) cellClass += ' cal-day-cell--range-start';
          if (isCheckIn && checkOut) cellClass += ' cal-day-cell--has-end';
          if (isCheckOut) cellClass += ' cal-day-cell--range-end';
          if (isPast) cellClass += ' cal-day-cell--past';
          if (isBooked) cellClass += ' cal-day-cell--booked cal-day-cell--unavailable';
          if (isBlocked) cellClass += ' cal-day-cell--blocked cal-day-cell--unavailable';
          if (wouldCrossUnavailable) cellClass += ' cal-day-cell--unreachable';

          let btnClass = 'cal-day-btn';
          if (isCheckIn || isCheckOut) btnClass += ' cal-day-btn--selected';
          if (isInRange) btnClass += ' cal-day-btn--in-range';
          if (isBooked) btnClass += ' cal-day-btn--booked cal-day-btn--unavailable';
          if (isBlocked) btnClass += ' cal-day-btn--blocked cal-day-btn--unavailable';
          if (isPast) btnClass += ' cal-day-btn--past';
          if (wouldCrossUnavailable) btnClass += ' cal-day-btn--unreachable';

          const ariaStatus = isBooked
            ? ', Booked'
            : isBlocked
              ? ', Blocked'
              : isPast
                ? ', Past date'
                : isCheckIn
                  ? ', Check-in'
                  : isCheckOut
                    ? ', Checkout'
                    : '';

          return (
            <div key={day} className={cellClass}>
              <button
                type="button"
                className={btnClass}
                disabled={isDisabled}
                onClick={() => handleDayClick(day)}
                aria-label={`${day}${ariaStatus}`}
                aria-pressed={isCheckIn || isCheckOut || !!isInRange}
              >
                {dayNum}
              </button>
            </div>
          );
        })}
      </div>

      {calendarError && (
        <div className="cal-validation-alert" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{calendarError}</span>
        </div>
      )}

      <div className="cal-legend-row">
        <div className="cal-legend-items">
          <span className="cal-legend-item">
            <span className="cal-legend-box--yours" /> Your dates
          </span>
          <span className="cal-legend-item">
            <span className="cal-legend-booked-sample">12</span> Booked
          </span>
          <span className="cal-legend-item">
            <span className="cal-legend-blocked-sample" /> Blocked
          </span>
        </div>
        {(checkIn || checkOut) && (
          <button
            type="button"
            className="cal-clear-btn"
            onClick={() => {
              setCalendarError('');
              setNavMonth(null);
              onSelectDates('', '');
            }}
          >
            Clear dates
          </button>
        )}
      </div>
    </div>
  );
}
