import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { EmptyState, Skeleton } from '../../components/ui';
import { RequestError } from '../../components/RequestError';
import { formatMoney, formatStayDate, formatTimestamp } from '../../lib/format';
import { hasListingPermission } from '../auth/permissions';
import { hostListings, listingKeys } from '../listings/api';
import { getEarnings, reservationKeys } from '../reservations/api';
import { ReservationBadge } from '../reservations/ReservationBits';
export function EarningsPage() {
  const access = useQuery({
    queryKey: listingKeys.all,
    queryFn: ({ signal }) => hostListings(signal),
    staleTime: 0,
  });
  const allowed =
    access.data?.listings?.some((listing) =>
      hasListingPermission(listing.host_access, 'can_view_insights'),
    ) || false;
  const query = useQuery({
    queryKey: reservationKeys.earnings,
    queryFn: ({ signal }) => getEarnings(signal),
    enabled: allowed,
    staleTime: 0,
    refetchInterval: 30000,
  });
  return (
    <section className="page-content earnings-page">
      <div className="page-heading">
        <p className="eyebrow">HOSTING, REWARDED</p>
        <h1>Your earnings</h1>
        <p>A clear view of what your hospitality brings.</p>
      </div>
      {access.isPending ? (
        <Skeleton label="Checking earnings access" />
      ) : access.isError ? (
        <RequestError error={access.error} onRetry={() => void access.refetch()} />
      ) : !allowed ? (
        <EmptyState title="Earnings access is required">
          Earnings are available for listings you own or where you have insights permission.
        </EmptyState>
      ) : query.isPending ? (
        <Skeleton label="Loading earnings" />
      ) : query.isError ? (
        <RequestError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <div className="earnings-totals">
            {[
              ['Paid', query.data.paid_minor],
              ['Upcoming', query.data.upcoming_minor],
              ['Held', query.data.held_minor],
            ].map(([label, minor]) => (
              <article key={String(label)}>
                <p>{label}</p>
                <strong>{formatMoney(Number(minor), query.data.currency)}</strong>
              </article>
            ))}
          </div>
          <p className="muted">
            Payouts reflect backend adjustments for refunds. The host fee is separate from the
            guest’s service fee. Release is scheduled 24 hours after recorded check-in.
          </p>
          {!query.data.payouts?.length ? (
            <EmptyState title="Your next payout starts with a stay">
              Scheduled, held, released, cancelled, and failed payouts will appear here.
            </EmptyState>
          ) : (
            <div className="table-scroll">
              <table className="payout-table">
                <caption>Per-reservation payouts · all release timestamps shown in UTC</caption>
                <thead>
                  <tr>
                    <th scope="col">Reservation</th>
                    <th scope="col">Stay</th>
                    <th scope="col">Gross</th>
                    <th scope="col">Host fee</th>
                    <th scope="col">Net</th>
                    <th scope="col">Status</th>
                    <th scope="col">Release date</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.payouts.map((item) => (
                    <tr key={item.payout.id}>
                      <td>
                        <Link to={`/host/reservations/${item.payout.reservation_id}`}>
                          {item.reservation_code}
                        </Link>
                        <small>{item.listing_title}</small>
                      </td>
                      <td>
                        {formatStayDate(item.check_in.slice(0, 10))}
                        <br />
                        {formatStayDate(item.check_out.slice(0, 10))}
                      </td>
                      <td>{formatMoney(item.payout.gross_minor, item.payout.currency)}</td>
                      <td>{formatMoney(item.payout.host_fee_minor, item.payout.currency)}</td>
                      <td>{formatMoney(item.payout.net_minor, item.payout.currency)}</td>
                      <td>
                        <ReservationBadge status={item.payout.status} />
                        {item.payout.held_reason && <small>{item.payout.held_reason}</small>}
                      </td>
                      <td>
                        {item.payout.status === 'cancelled'
                          ? 'Cancelled'
                          : item.payout.released_at
                            ? formatTimestamp(item.payout.released_at, 'UTC')
                            : item.payout.release_at
                              ? formatTimestamp(item.payout.release_at, 'UTC')
                              : 'After check-in'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
