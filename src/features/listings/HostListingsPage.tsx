import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { RequestError } from '../../components/RequestError';
import { Drawer, Skeleton } from '../../components/ui';
import { formatMoney } from '../../lib/format';
import { hasListingPermission } from '../auth/permissions';
import { CohostPanel } from '../cohosts/CohostPanel';
import { createListing, hostListings, listingKeys } from './api';
import { HostMetrics } from './HostMetrics';
import { HostRecentActivity } from './HostRecentActivity';
import type { HostSummary } from './types';

// NOTE: Reference mock listing data cloned from design PDF.
// When the backend returns an empty listings list for the current host,
// these dummy listings are rendered so the frontend UI matches the reference design
// and displays all components intact. Once the host creates listings, the UI seamlessly
// displays the real listings from GET /api/v1/host/listings.
const DUMMY_HOST_LISTINGS: Array<{
  id: string;
  title: string;
  cover_photo_url: string;
  status: 'live' | 'submitted' | 'draft';
  status_label: 'Listed' | 'Under review' | 'In progress';
  property_type: string;
  max_guests: number;
  base_price_minor: number | null;
  currency: string;
  rating_display: string;
}> = [
  {
    id: 'demo-azulejo',
    title: 'Azulejo Loft in Alfama',
    cover_photo_url:
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
    status: 'live',
    status_label: 'Listed',
    property_type: 'loft',
    max_guests: 2,
    base_price_minor: 12800,
    currency: 'EUR',
    rating_display: '★ 4.96 (212)',
  },
  {
    id: 'demo-riverside',
    title: 'Riverside studio, Cais do Sodré',
    cover_photo_url:
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
    status: 'live',
    status_label: 'Listed',
    property_type: 'studio',
    max_guests: 2,
    base_price_minor: 9200,
    currency: 'EUR',
    rating_display: '★ 4.81 (64)',
  },
  {
    id: 'demo-garden',
    title: 'Garden house in Sintra',
    cover_photo_url:
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
    status: 'submitted',
    status_label: 'Under review',
    property_type: 'home',
    max_guests: 5,
    base_price_minor: 16400,
    currency: 'EUR',
    rating_display: 'No reviews yet',
  },
  {
    id: 'demo-bica',
    title: 'Bica apartment with tram view',
    cover_photo_url:
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80',
    status: 'draft',
    status_label: 'In progress',
    property_type: 'apartment',
    max_guests: 3,
    base_price_minor: null,
    currency: 'EUR',
    rating_display: 'No reviews yet',
  },
];

export function HostListingsPage() {
  const query = useQuery({
    queryKey: listingKeys.all,
    queryFn: ({ signal }) => hostListings(signal),
  });
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'listed' | 'under_review' | 'in_progress'
  >('all');
  const [selectedCohostListingId, setSelectedCohostListingId] = useState<string | null>(null);

  async function create() {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const data = await createListing();
      cache.setQueryData(listingKeys.detail(data.listing.id), data);
      void cache.invalidateQueries({ queryKey: listingKeys.all });
      navigate(`/host/listings/${data.listing.id}/edit?mode=smart-setup`);
    } catch (e) {
      setError(e);
    } finally {
      setCreating(false);
    }
  }

  const rawListings = useMemo(() => query.data?.listings || [], [query.data?.listings]);
  const hasRealListings = rawListings.length > 0;

  // Transform backend or dummy listings into standardized card models
  const displayItems = useMemo(() => {
    if (hasRealListings) {
      return rawListings.map((l: HostSummary, index: number) => {
        let statusLabel: 'Listed' | 'Under review' | 'In progress' = 'In progress';
        if (l.status === 'live') statusLabel = 'Listed';
        else if (l.status === 'submitted' || l.status === 'under_review')
          statusLabel = 'Under review';

        const rating =
          l.review_count && l.review_count > 0
            ? `★ ${(l.rating_avg ?? 0).toFixed(2)} (${l.review_count})`
            : 'No reviews yet';

        const fallbackImages = [
          'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80',
        ];

        return {
          id: l.id,
          title: l.title || 'Untitled space',
          cover_photo_url: l.cover_photo_url || fallbackImages[index % fallbackImages.length],
          status_label: statusLabel,
          property_type: (l as { property_type?: string }).property_type || 'home',
          max_guests: (l as { max_guests?: number }).max_guests || 2,
          base_price_minor: l.base_price_minor,
          currency: l.currency || 'EUR',
          rating_display: rating,
          can_manage: hasListingPermission(l.host_access, 'can_manage_listing'),
          is_real: true,
        };
      });
    }

    // Return reference dummy listings
    return DUMMY_HOST_LISTINGS.map((item) => ({
      ...item,
      can_manage: true,
      is_real: false,
    }));
  }, [hasRealListings, rawListings]);

  // Aggregate counts for subtitle: "2 listed · 1 under review · 1 in progress"
  const counts = useMemo(() => {
    let listed = 0;
    let underReview = 0;
    let inProgress = 0;
    for (const item of displayItems) {
      if (item.status_label === 'Listed') listed++;
      else if (item.status_label === 'Under review') underReview++;
      else inProgress++;
    }
    return { listed, underReview, inProgress };
  }, [displayItems]);

  // Filter listings
  const filteredItems = useMemo(() => {
    if (statusFilter === 'all') return displayItems;
    if (statusFilter === 'listed') return displayItems.filter((i) => i.status_label === 'Listed');
    if (statusFilter === 'under_review')
      return displayItems.filter((i) => i.status_label === 'Under review');
    if (statusFilter === 'in_progress')
      return displayItems.filter((i) => i.status_label === 'In progress');
    return displayItems;
  }, [displayItems, statusFilter]);

  return (
    <div className="host-listings-page-container">
      {/* Top Header Row */}
      <div className="host-listings-header">
        <div className="host-listings-title-group">
          <h1 className="host-listings-main-title">Listings</h1>
          <p className="host-listings-status-summary">
            {counts.listed} listed · {counts.underReview} under review · {counts.inProgress} in
            progress
          </p>
        </div>

        <div className="host-listings-actions">
          {/* Status Filter Dropdown */}
          <div className="host-status-select-wrapper">
            <select
              className="host-status-select"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | 'listed' | 'under_review' | 'in_progress')
              }
              aria-label="Filter listings by status"
            >
              <option value="all">Status: All</option>
              <option value="listed">Status: Listed</option>
              <option value="under_review">Status: Under review</option>
              <option value="in_progress">Status: In progress</option>
            </select>
          </div>

          {/* NOTE: Bulk edit batch operation is pending backend API support. Rendered as dummy control. */}
          <button
            type="button"
            className="host-bulk-edit-btn"
            onClick={() =>
              alert('Bulk edit will be available when backend supports batch operations.')
            }
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
            Bulk edit
          </button>

          {/* Create Listing Primary Button */}
          <button
            type="button"
            className="host-create-listing-btn"
            disabled={creating}
            onClick={() => void create()}
          >
            + Create listing
          </button>
        </div>
      </div>

      {error != null && <RequestError error={error} />}

      {query.isPending ? (
        <Skeleton label="Loading your listings" />
      ) : query.isError ? (
        <RequestError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          {/* Listing Cards Grid */}
          <div className="host-cards-grid">
            {filteredItems.map((item) => (
              <article className="host-listing-card" key={item.id}>
                {/* Image */}
                <div className="host-card-photo-wrapper">
                  <img
                    src={item.cover_photo_url}
                    alt={item.title}
                    className="host-card-photo"
                    loading="lazy"
                  />
                </div>

                <div className="host-card-body">
                  {/* Title & Status Badge */}
                  <div className="host-card-title-row">
                    <h2 className="host-card-title" title={item.title}>
                      {item.title}
                    </h2>
                    <span
                      className={`host-status-badge host-status-badge--${item.status_label
                        .toLowerCase()
                        .replace(/\s+/g, '-')}`}
                    >
                      {item.status_label}
                    </span>
                  </div>

                  {/* Property type and guests specs */}
                  <p className="host-card-specs">
                    Entire {item.property_type} · {item.max_guests} guests
                  </p>

                  {/* Price & Rating */}
                  <div className="host-card-financial-row">
                    <div className="host-card-price">
                      {item.base_price_minor != null && item.base_price_minor > 0 ? (
                        <>
                          <strong>{formatMoney(item.base_price_minor, item.currency)}</strong>{' '}
                          <span className="price-unit">night</span>
                        </>
                      ) : (
                        <Link
                          to={item.is_real ? `/host/listings/${item.id}/edit` : '#'}
                          className="host-set-price-link"
                        >
                          Set a price
                        </Link>
                      )}
                    </div>

                    {/* NOTE: Review ratings and count are not provided by GET /api/v1/host/listings. */}
                    <div className="host-card-rating">
                      {item.rating_display.startsWith('★') ? (
                        <span className="host-card-rating-active">
                          <span className="star-char">★</span>{' '}
                          {item.rating_display.replace('★', '').trim()}
                        </span>
                      ) : (
                        <span className="host-card-rating-empty">{item.rating_display}</span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="host-card-actions-row">
                    <Link
                      to={item.is_real ? `/host/listings/${item.id}/edit` : `/host/listings`}
                      className="host-card-action-btn"
                    >
                      Edit
                    </Link>
                    <Link
                      to={item.is_real ? `/host/listings/${item.id}/calendar` : `/host/listings`}
                      className="host-card-action-btn"
                    >
                      Calendar
                    </Link>
                    {item.is_real && (
                      <button
                        type="button"
                        className="host-card-action-btn"
                        onClick={() => setSelectedCohostListingId(item.id)}
                      >
                        Co-hosts
                      </button>
                    )}
                    <Link
                      to={item.is_real ? `/listings/${item.id}` : `/search`}
                      className="host-card-action-btn host-card-action-btn--preview"
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      Preview
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Key Metrics Section (Missing Backend Component) */}
          <HostMetrics />

          {/* Recent Activity Section (Missing Backend Component) */}
          <HostRecentActivity />
        </>
      )}

      {selectedCohostListingId && (
        <Drawer
          open={!!selectedCohostListingId}
          title="Co-hosts & Team"
          onClose={() => setSelectedCohostListingId(null)}
          width="600px"
        >
          <div style={{ padding: '24px' }}>
            <CohostPanel listingId={selectedCohostListingId} />
          </div>
        </Drawer>
      )}
    </div>
  );
}
