import { ApiError } from '../../lib/api';
import type { Quote } from '../listings/types';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Badge, Button, Skeleton, SuccessNotice } from '../../components/ui';
import { RequestError } from '../../components/RequestError';
import { formatMoney, formatStayDate } from '../../lib/format';
import { useSession } from '../auth/session';
import { dateRangeError } from '../calendar/dates';
import { getQuote, publicListing, listingKeys } from '../listings/api';
import { quoteSignature } from './presentation';
import { useReservationAction } from './useReservationAction';

export function CheckoutPage() {
  const { listingId = '' } = useParams();
  const [params] = useSearchParams();
  const session = useSession();
  return (
    <Checkout
      key={`${session.identity?.user?.id}:${listingId}`}
      id={listingId}
      params={params}
      userId={session.identity?.user?.id || ''}
    />
  );
}
function Checkout({ id, params, userId }: { id: string; params: URLSearchParams; userId: string }) {
  const checkIn = params.get('check_in') || '';
  const checkOut = params.get('check_out') || '';
  const guests = Number(params.get('guests') || '1');
  const validation =
    dateRangeError(checkIn, checkOut) ||
    (!Number.isSafeInteger(guests) || guests < 1
      ? 'Choose a positive whole number of guests.'
      : '');
  const selection = { check_in: checkIn, check_out: checkOut, guests };
  const listing = useQuery({
    queryKey: listingKeys.public(id),
    queryFn: ({ signal }) => publicListing(id, signal),
  });
  const quoteKey = ['quote', id, checkIn, checkOut, guests];
  const quote = useQuery({
    queryKey: quoteKey,
    queryFn: ({ signal }) => getQuote(id, selection, signal),
    enabled: !validation,
    staleTime: 0,
    retry: false,
  });
  const [message, setMessage] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const [recoveryQuote, setRecoveryQuote] = useState<Quote | null>(null);
  const lock = useRef(false);
  const action = useReservationAction(`${userId}:booking:${id}`);
  const cache = useQueryClient();
  const navigate = useNavigate();
  const current = quote.data?.quote;
  async function pay() {
    if (lock.current || action.busy || !current || !agreed || validation) return;
    lock.current = true;
    setChecking(true);
    setError(null);
    setNotice('');
    try {
      const fresh = await getQuote(id, selection);
      if (quoteSignature(fresh.quote) !== quoteSignature(current)) {
        cache.setQueryData(quoteKey, fresh);
        setAgreed(false);
        setNotice(
          'Your quote or booking terms changed. Please review the updated details and confirm again.',
        );
        return;
      }
      const result = await action.run(
        '/api/v1/reservations',
        {
          listing_id: id,
          ...selection,
          guest_message: message.trim(),
          payment_method_token: 'tok_simulated_default',
        },
        quoteSignature(fresh.quote),
      );
      if (result) navigate(`/trips/${result.reservation.id}?booked=1`, { replace: true });
    } catch (e) {
      setError(e);
      void cache.invalidateQueries({ queryKey: quoteKey });
    } finally {
      setChecking(false);
      lock.current = false;
    }
  }
  async function recover() {
    if (!action.attempt || lock.current) return;
    lock.current = true;
    setChecking(true);
    setError(null);
    try {
      try {
        const body = action.attempt.body;
        const fresh = await getQuote(id, {
          check_in: String(body.check_in),
          check_out: String(body.check_out),
          guests: Number(body.guests),
        });
        const reviewed = recoveryQuote ? quoteSignature(recoveryQuote) : action.attempt.review;
        if (quoteSignature(fresh.quote) !== reviewed) {
          setRecoveryQuote(fresh.quote);
          setNotice(
            'The current price or booking terms changed. Review the retry total above and confirm again.',
          );
          return;
        }
      } catch (e) {
        // A completed booking can make its own dates unavailable. A replay may still recover it.
        if (!(e instanceof ApiError) || !(e.status === 404 || e.code === 'DATES_UNAVAILABLE'))
          throw e;
      }
      const result = await action.run(action.attempt.path, action.attempt.body);
      if (result) navigate(`/trips/${result.reservation.id}?booked=1`, { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setChecking(false);
      lock.current = false;
    }
  }
  const busy = checking || action.busy;
  return (
    <section className="page-content checkout-page">
      <Link className="text-link" to={`/listings/${id}?${params}`}>
        ← Back to listing
      </Link>
      <div className="page-heading">
        <p className="eyebrow">YOUR NEXT CHAPTER</p>
        <h1>Make it a stay.</h1>
        <p>Review the details, then complete your simulated payment.</p>
      </div>
      {action.attempt && (
        <div className="recovery-panel">
          <h2>Finish checking your booking</h2>
          <p>
            A previous request may already have succeeded. Retry that exact request to recover its
            result before making another booking here.
          </p>
          <p>
            {String(action.attempt.body.check_in)} – {String(action.attempt.body.check_out)} ·{' '}
            {String(action.attempt.body.guests)} guests
          </p>
          {recoveryQuote && (
            <div>
              <p>
                Current retry total:{' '}
                <strong>
                  {formatMoney(recoveryQuote.breakdown.guest_total_minor, recoveryQuote.currency)}
                </strong>
              </p>
              <p>
                {recoveryQuote.cancellation_policy.name}:{' '}
                {recoveryQuote.cancellation_policy.description}
              </p>
              <p>{recoveryQuote.instant_book ? 'Instant booking' : 'Request to book'}</p>
            </div>
          )}
          <Button disabled={busy} onClick={() => void recover()}>
            {busy
              ? 'Checking booking…'
              : recoveryQuote
                ? 'Confirm reviewed booking retry'
                : 'Recover booking result'}
          </Button>
          <Link className="text-link" to="/trips">
            Check your trips ↗
          </Link>
        </div>
      )}
      {validation && <RequestError error={new Error(validation)} />}
      {error != null && <RequestError error={error} />}
      {action.error != null && <RequestError error={action.error} />}
      {notice && <SuccessNotice>{notice}</SuccessNotice>}
      <div className="checkout-columns">
        <div>
          <section className="checkout-section">
            <h2>Your stay</h2>
            {listing.isPending ? (
              <Skeleton label="Loading stay" />
            ) : listing.isError ? (
              <RequestError error={listing.error} onRetry={() => void listing.refetch()} />
            ) : (
              <div className="checkout-property">
                {listing.data.listing.photos?.[0] && (
                  <img
                    src={listing.data.listing.photos[0].public_url}
                    alt={listing.data.listing.title}
                  />
                )}
                <div>
                  <h3>{listing.data.listing.title}</h3>
                  <p>
                    {listing.data.listing.city}, {listing.data.listing.country}
                  </p>
                </div>
              </div>
            )}
            {!validation && (
              <>
                <p>
                  {formatStayDate(checkIn)} – {formatStayDate(checkOut)} · {guests}{' '}
                  {guests === 1 ? 'guest' : 'guests'}
                </p>
                <Link className="text-link" to={`/listings/${id}?${params}`}>
                  Edit dates or guests
                </Link>
              </>
            )}
          </section>
          <section className="checkout-section">
            <h2>A note for your host</h2>
            <div className="field">
              <label htmlFor="guest-message">Introduce yourself (optional)</label>
              <textarea
                id="guest-message"
                rows={4}
                value={message}
                disabled={busy || !!action.attempt}
                onChange={(event) => setMessage(event.target.value)}
              />
            </div>
          </section>
          <section className="checkout-section">
            <h2>Payment</h2>
            <Badge tone="positive">Simulated payment</Badge>
            <p>
              This exercise records a simulated payment. No card details are needed and no real
              money is charged.
            </p>
          </section>
        </div>
        <aside className="quote-card">
          {!validation && (quote.isPending || quote.isFetching) ? (
            <Skeleton label="Refreshing booking quote" />
          ) : quote.isError ? (
            <RequestError error={quote.error} onRetry={() => void quote.refetch()} />
          ) : (
            current && (
              <>
                <h2>Price details</h2>
                <dl>
                  <div>
                    <dt>{current.breakdown.nights} nights</dt>
                    <dd>{formatMoney(current.breakdown.nightly_total_minor, current.currency)}</dd>
                  </div>
                  <div>
                    <dt>Cleaning fee</dt>
                    <dd>{formatMoney(current.breakdown.cleaning_fee_minor, current.currency)}</dd>
                  </div>
                  <div>
                    <dt>Guest service fee ({current.breakdown.guest_fee_bps / 100}%)</dt>
                    <dd>{formatMoney(current.breakdown.guest_fee_minor, current.currency)}</dd>
                  </div>
                  <div className="quote-total">
                    <dt>Total</dt>
                    <dd>{formatMoney(current.breakdown.guest_total_minor, current.currency)}</dd>
                  </div>
                </dl>
                <h3>{current.cancellation_policy.name} cancellation</h3>
                <p>{current.cancellation_policy.description}</p>
                <p>
                  {current.instant_book
                    ? 'Your reservation confirms immediately after successful simulated payment.'
                    : 'You pay when requesting. Your host has 24 hours to respond; a decline or expiry results in a full refund.'}
                </p>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={agreed}
                    disabled={busy || !!action.attempt}
                    onChange={(event) => setAgreed(event.target.checked)}
                  />
                  I’ve reviewed the price, house rules, and cancellation policy.
                </label>
                <Button
                  disabled={busy || !agreed || !!action.attempt || quote.isFetching || !!validation}
                  onClick={() => void pay()}
                >
                  {busy
                    ? 'Processing…'
                    : current.instant_book
                      ? 'Simulate payment & reserve'
                      : 'Simulate payment & request'}
                </Button>
                <p className="muted">
                  Dates are held only when the server successfully creates the reservation.
                </p>
              </>
            )
          )}
        </aside>
      </div>
    </section>
  );
}
