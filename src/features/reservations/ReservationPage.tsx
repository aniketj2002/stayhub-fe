import { hasListingPermission } from '../auth/permissions';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Skeleton, SuccessNotice } from '../../components/ui';
import { RequestError } from '../../components/RequestError';
import { formatTimestamp } from '../../lib/format';
import { useSession } from '../auth/session';
import { hostListing, listingKeys } from '../listings/api';
import { getReservation, reservationKeys } from './api';
import { GuestCancellation } from './GuestCancellation';
import { HostActions } from './HostActions';
import { Deadline, PayoutSummary, Receipt, ReservationBadge, StayDates } from './ReservationBits';

export function ReservationPage({ host = false }: { host?: boolean }) {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const session = useSession();
  const query = useQuery({
    queryKey: reservationKeys.detail(id),
    queryFn: ({ signal }) => getReservation(id, signal),
    staleTime: 0,
    refetchInterval: 30000,
  });
  const listingId = query.data?.reservation.listing_id || '';
  const access = useQuery({
    queryKey: listingKeys.detail(listingId),
    queryFn: ({ signal }) => hostListing(listingId, signal),
    enabled: host && !!listingId,
    staleTime: 0,
  });
  if (query.isPending)
    return (
      <section className="page-content">
        <Skeleton label="Loading reservation" />
      </section>
    );
  if (query.isError)
    return (
      <section className="page-content">
        <RequestError error={query.error} onRetry={() => void query.refetch()} />
      </section>
    );
  const detail = query.data;
  const r = detail.reservation;
  const isGuest = session.identity?.user?.id === r.guest_id;
  if (!host && !isGuest)
    return (
      <section className="page-content">
        <RequestError
          error={
            new Error(
              'This is not a guest reservation for your account. Use your hosting area to view reservations you manage.',
            )
          }
        />
        <Link className="text-link" to="/host/today">
          Go to hosting
        </Link>
      </section>
    );
  return (
    <section className="page-content reservation-page">
      <Link className="text-link" to={host ? '/host/today' : '/trips'}>
        ← {host ? 'Host Today' : 'Your trips'}
      </Link>
      <div className="page-heading">
        <p className="eyebrow">RESERVATION {r.code}</p>
        <h1>{detail.listing.title}</h1>
        <ReservationBadge status={r.status} />
      </div>
      {params.get('booked') === '1' && isGuest && (
        <SuccessNotice>
          {r.status === 'pending'
            ? 'Your simulated payment was recorded. The host has up to 24 hours to respond.'
            : r.status === 'confirmed'
              ? 'Your stay is confirmed. Your simulated payment receipt is below.'
              : 'Booking result recovered. The current reservation status is shown above.'}
        </SuccessNotice>
      )}
      <div className="reservation-columns">
        <div>
          <section className="reservation-overview">
            {detail.listing.cover_photo_url && (
              <img
                src={detail.listing.cover_photo_url}
                alt={detail.listing.title}
                className="reservation-cover"
              />
            )}
            <h2>Your stay</h2>
            <StayDates detail={detail} />
            <p>
              {detail.listing.address_line1}
              <br />
              {detail.listing.city}, {detail.listing.country}
            </p>
            <p>
              Check-in: {formatTimestamp(r.check_in_at, r.timezone)}
              <br />
              Checkout: {formatTimestamp(r.check_out_at, r.timezone)}
              <br />
              Property timezone: {r.timezone}
            </p>
            <p>{host ? `Guest: ${detail.guest.full_name}` : `Host: ${detail.host.full_name}`}</p>
            {r.guest_message && <p className="guest-note">{r.guest_message}</p>}
            {r.status === 'pending' && r.request_expires_at && (
              <Deadline at={r.request_expires_at} onExpired={() => void query.refetch()} />
            )}
            {r.decline_reason && <p>Decline reason: {r.decline_reason}</p>}
            {r.cancel_reason && <p>Cancellation reason: {r.cancel_reason}</p>}
          </section>
          <section className="cancellation-policy">
            <h2>{detail.cancellation_policy.name} cancellation</h2>
            <p>{detail.cancellation_policy.description}</p>
            {detail.cancellation_policy.rules?.map((rule) => (
              <p key={rule.min_hours_before}>
                {rule.refund_pct}% accommodation refund at least {rule.min_hours_before} hours
                before check-in; service fee{' '}
                {rule.refunds_service_fee ? 'refundable' : 'not refundable'}.
              </p>
            ))}
            {!host && <GuestCancellation key={r.id} detail={detail} />}
          </section>
          {host &&
            (access.isPending ? (
              <Skeleton label="Checking listing permissions" />
            ) : access.isError ? (
              <RequestError error={access.error} onRetry={() => void access.refetch()} />
            ) : (
              <HostActions key={r.status} detail={detail} access={access.data?.host_access} />
            ))}
        </div>
        <aside>
          <Receipt detail={detail} />
          {host &&
            detail.payout &&
            hasListingPermission(access.data?.host_access, 'can_view_insights') && (
              <PayoutSummary payout={detail.payout} timezone={r.timezone} />
            )}
        </aside>
      </div>
    </section>
  );
}
