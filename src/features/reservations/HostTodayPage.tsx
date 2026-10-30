import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { EmptyState, Skeleton } from '../../components/ui';
import { RequestError } from '../../components/RequestError';
import { hostListings, listingKeys } from '../listings/api';
import { getToday, reservationKeys } from './api';
import { HostActions } from './HostActions';
import { Deadline, ReservationBadge, StayDates } from './ReservationBits';
import type { Today } from './types';
const groups: [keyof Today, string][] = [
  ['pending_requests', 'Pending requests'],
  ['arriving_today', 'Arriving today'],
  ['currently_hosting', 'Currently hosting'],
  ['checking_out_today', 'Checking out today'],
  ['upcoming', 'Upcoming stays'],
];
export function HostTodayPage() {
  const query = useQuery({
    queryKey: reservationKeys.today,
    queryFn: ({ signal }) => getToday(signal),
    staleTime: 0,
    refetchInterval: 30000,
  });
  const listings = useQuery({
    queryKey: listingKeys.all,
    queryFn: ({ signal }) => hostListings(signal),
    staleTime: 0,
  });
  const access = new Map(
    listings.data?.listings?.map((listing) => [listing.id, listing.host_access]),
  );
  return (
    <section className="page-content today-page">
      <div className="page-heading">
        <p className="eyebrow">YOUR HOSTING SPACE</p>
        <h1>A good day to host.</h1>
        <p>Your requests, arrivals, and departures at a glance.</p>
      </div>
      {listings.isError && (
        <RequestError error={listings.error} onRetry={() => void listings.refetch()} />
      )}
      {query.isPending ? (
        <Skeleton label="Loading your hosting day" />
      ) : query.isError ? (
        <RequestError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          {groups.every(([key]) => !(query.data[key] || []).length) && (
            <EmptyState title="A quiet moment between stays">
              New booking requests and upcoming arrivals will appear here.
            </EmptyState>
          )}
          {groups.map(([key, title]) => (
            <section className="today-group" key={key}>
              <div className="heading-row">
                <h2>{title}</h2>
                <span className="muted">{query.data[key]?.length || 0}</span>
              </div>
              {!(query.data[key] || []).length ? (
                <p className="group-empty">No {title.toLowerCase()}.</p>
              ) : (
                query.data[key]?.map((detail) => (
                  <article className="today-card" key={detail.reservation.id}>
                    <div className="heading-row">
                      <div>
                        <p className="eyebrow">{detail.listing.title}</p>
                        <h3>{detail.guest.full_name}</h3>
                      </div>
                      <ReservationBadge status={detail.reservation.status} />
                    </div>
                    <StayDates detail={detail} />
                    <p>Reservation {detail.reservation.code}</p>
                    {detail.reservation.status === 'pending' &&
                      detail.reservation.request_expires_at && (
                        <Deadline
                          at={detail.reservation.request_expires_at}
                          onExpired={() => void query.refetch()}
                        />
                      )}
                    {detail.reservation.guest_message && (
                      <p className="guest-note">“{detail.reservation.guest_message}”</p>
                    )}
                    <Link className="text-link" to={`/host/reservations/${detail.reservation.id}`}>
                      View reservation & receipt ↗
                    </Link>
                    <HostActions
                      key={detail.reservation.status}
                      detail={detail}
                      access={access.get(detail.reservation.listing_id)}
                    />
                  </article>
                ))
              )}
            </section>
          ))}
        </>
      )}
    </section>
  );
}
