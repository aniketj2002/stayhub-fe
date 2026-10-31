import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, Skeleton } from '../../components/ui';
import { RequestError } from '../../components/RequestError';
import { formatMoney } from '../../lib/format';
import { getTrips, reservationKeys } from './api';
import { ReservationBadge, StayDates } from './ReservationBits';
export function TripsPage() {
  const [params, setParams] = useSearchParams();
  const tab = ['upcoming', 'past', 'cancelled', 'all'].includes(params.get('tab') || '')
    ? params.get('tab')!
    : 'upcoming';
  const query = useQuery({
    queryKey: [...reservationKeys.trips, tab],
    queryFn: ({ signal }) => getTrips(tab, signal),
    staleTime: 0,
    refetchInterval: 30000,
  });
  return (
    <section className="page-content trips-page">
      <div className="page-heading">
        <p className="eyebrow">YOUR NEXT CHAPTER</p>
        <h1>Your trips</h1>
        <p>Good memories start with a place to stay.</p>
      </div>
      <nav className="trip-tabs" aria-label="Trip categories">
        {['upcoming', 'past', 'cancelled', 'all'].map((category) => (
          <button
            type="button"
            key={category}
            aria-current={category === tab ? 'page' : undefined}
            onClick={() => setParams({ tab: category })}
          >
            {category === 'all' ? 'All trips' : category[0].toUpperCase() + category.slice(1)}
          </button>
        ))}
      </nav>
      {query.isPending ? (
        <Skeleton label="Loading trips" />
      ) : query.isError ? (
        <RequestError error={query.error} onRetry={() => void query.refetch()} />
      ) : !(query.data.trips || []).length ? (
        <EmptyState
          title="A new chapter is waiting"
          action={
            <Link className="button button--primary" to="/search">
              Find a stay
            </Link>
          }
        >
          No {tab === 'all' ? '' : tab} trips to show.
        </EmptyState>
      ) : (
        <div className="trip-grid">
          {query.data.trips?.map((detail) => (
            <Link
              className="trip-card"
              key={detail.reservation.id}
              to={`/trips/${detail.reservation.id}`}
            >
              {detail.listing.cover_photo_url && (
                <img
                  src={detail.listing.cover_photo_url}
                  alt={detail.listing.title}
                  loading="lazy"
                />
              )}
              <div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <ReservationBadge status={detail.reservation.status} />
                  {detail.reservation.status === 'reviewed' && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: '#ecfdf5',
                        color: '#065f46',
                      }}
                    >
                      Reviewed ★
                    </span>
                  )}
                  {detail.reservation.status === 'completed' && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: '#fffbeb',
                        color: '#92400e',
                      }}
                    >
                      Review Pending
                    </span>
                  )}
                </div>
                <h2>{detail.listing.title}</h2>
                <p>
                  {detail.listing.city}, {detail.listing.country}
                </p>
                <StayDates detail={detail} />
                <p>
                  {formatMoney(detail.reservation.guest_total_minor, detail.reservation.currency)} ·{' '}
                  {detail.reservation.code}
                </p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span className="text-link">View stay ↗</span>
                  <Link
                    to={`/trips/${detail.reservation.id}/itinerary`}
                    className="text-link"
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontWeight: 600 }}
                  >
                    🗺️ Itinerary
                  </Link>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
