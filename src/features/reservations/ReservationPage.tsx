import { useEffect, useRef, useState } from 'react';
import { hasListingPermission } from '../auth/permissions';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Skeleton, SuccessNotice } from '../../components/ui';
import { RequestError } from '../../components/RequestError';
import { formatMoney, formatTimestamp } from '../../lib/format';
import { useSession } from '../auth/session';
import { hostListing, listingKeys } from '../listings/api';
import { getReservation, reservationKeys } from './api';
import { useGetOrCreateConversation } from '../messaging/api';
import { GuestCancellation } from './GuestCancellation';
import { HostActions } from './HostActions';
import { Deadline, PayoutSummary, Receipt, ReservationBadge, StayDates } from './ReservationBits';
import { WriteReviewModal } from '../reviews/WriteReviewModal';
import { useReservationAlterations } from '../trips/api';
import { DateChangeModal } from '../trips/DateChangeModal';

export function ReservationPage({ host = false }: { host?: boolean }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const getOrCreateConv = useGetOrCreateConversation();
  const [params] = useSearchParams();
  const session = useSession();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [dateChangeOpen, setDateChangeOpen] = useState(false);

  const handleMessage = async (reservationId: string) => {
    const basePath = host ? '/host/messages' : '/messages';
    try {
      const conv = await getOrCreateConv.mutateAsync(reservationId);
      navigate(`${basePath}/${conv.id}`);
    } catch {
      navigate(basePath);
    }
  };
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
  const alterationsQuery = useReservationAlterations(id || undefined);
  const pendingAlteration = alterationsQuery.data?.find((alt) => alt.status === 'pending');
  const canReviewDateChange = Boolean(
    host &&
      pendingAlteration &&
      pendingAlteration.requested_by !== session.identity?.user?.id &&
      hasListingPermission(access.data?.host_access, 'can_manage_reservations'),
  );

  const openedDateReview = useRef(false);
  useEffect(() => {
    if (!canReviewDateChange || params.get('review') !== 'dates' || openedDateReview.current) return;
    openedDateReview.current = true;
    setDateChangeOpen(true);
  }, [canReviewDateChange, params]);

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

            {canReviewDateChange && pendingAlteration && (
              <div className="host-alert-banner" style={{ marginTop: '16px' }}>
                <div className="host-alert-left">
                  <div className="host-alert-text">
                    <strong className="host-alert-headline">
                      {detail.guest.full_name} requested a date change
                    </strong>
                    <p className="host-alert-subtext">
                      {pendingAlteration.current_check_in} – {pendingAlteration.current_check_out} →{' '}
                      {pendingAlteration.new_check_in} – {pendingAlteration.new_check_out}
                      {' · '}
                      Price adjustment {pendingAlteration.delta_minor > 0 ? '+' : ''}
                      {formatMoney(
                        pendingAlteration.delta_minor,
                        pendingAlteration.currency || r.currency,
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="host-alert-review-btn"
                  onClick={() => setDateChangeOpen(true)}
                >
                  Review request
                </button>
              </div>
            )}
            {!host && pendingAlteration && pendingAlteration.requested_by === session.identity?.user?.id && (
              <p className="guest-note">Date change request sent. Awaiting review from the host.</p>
            )}

            <div className="reservation-action-bar" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => handleMessage(r.id)}
                disabled={getOrCreateConv.isPending}
              >
                💬 {getOrCreateConv.isPending ? 'Connecting...' : `Message ${host ? 'Guest' : 'Host'}`}
              </button>
              {!host && (
                <Link to={`/trips/${r.id}/itinerary`} className="button button--secondary">
                  🗺️ View Itinerary
                </Link>
              )}
              {r.status === 'confirmed' && !canReviewDateChange && (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setDateChangeOpen(true)}
                >
                  📅 {pendingAlteration ? 'View date request' : 'Change Dates'}
                </button>
              )}
              {(() => {
                const isReviewWindowOpen = r.completed_at
                  ? Date.now() - new Date(r.completed_at).getTime() <= 14 * 24 * 60 * 60 * 1000
                  : true;
                return (
                  !host &&
                  (r.status === 'completed' || r.status === 'reviewed') &&
                  isReviewWindowOpen && (
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={() => setReviewOpen(true)}
                    >
                      ★ {r.status === 'reviewed' ? 'View Review' : 'Write a Review'}
                    </button>
                  )
                );
              })()}
            </div>
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

      <WriteReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        reservationId={r.id}
        listingTitle={detail.listing.title}
        onSuccess={() => void query.refetch()}
      />

      <DateChangeModal
        open={dateChangeOpen}
        onClose={() => setDateChangeOpen(false)}
        reservationId={r.id}
        currentCheckIn={r.check_in_at ? r.check_in_at.slice(0, 10) : ''}
        currentCheckOut={r.check_out_at ? r.check_out_at.slice(0, 10) : ''}
        currentGuests={r.guests}
        currency={detail.reservation.currency || 'EUR'}
        isHost={host}
      />
    </section>
  );
}
