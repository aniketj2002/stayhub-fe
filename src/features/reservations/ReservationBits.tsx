import { useEffect, useRef, useState } from 'react';
import { Badge } from '../../components/ui';
import { formatMoney, formatStayDate, formatTimestamp } from '../../lib/format';
import type { Payout, ReservationDetail } from './types';
import { statusLabel } from './presentation';
export function ReservationBadge({ status }: { status: string }) {
  return (
    <Badge
      tone={
        ['confirmed', 'checked_in', 'completed', 'released'].includes(status)
          ? 'positive'
          : ['pending', 'held'].includes(status)
            ? 'warning'
            : 'neutral'
      }
    >
      {statusLabel(status)}
    </Badge>
  );
}
export function StayDates({ detail }: { detail: ReservationDetail }) {
  const r = detail.reservation;
  return (
    <p>
      {formatStayDate(r.check_in.slice(0, 10))} – {formatStayDate(r.check_out.slice(0, 10))} ·{' '}
      {r.guests} {r.guests === 1 ? 'guest' : 'guests'}
    </p>
  );
}
export function Deadline({ at, onExpired }: { at: string; onExpired?: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const expired = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Date.parse(at) - now);
  useEffect(() => {
    if (remaining === 0 && !expired.current) {
      expired.current = true;
      onExpired?.();
    }
  }, [remaining, onExpired]);
  const minutes = Math.ceil(remaining / 60000);
  return (
    <p className="request-deadline">
      {remaining
        ? `Host response due in ${Math.floor(minutes / 60)}h ${minutes % 60}m`
        : 'Response deadline reached. Checking with the server…'}
      <br />
      <small>Deadline: {formatTimestamp(at, 'UTC')} UTC</small>
    </p>
  );
}
export function Receipt({ detail }: { detail: ReservationDetail }) {
  const r = detail.reservation;
  return (
    <section className="receipt">
      <h2>Payment receipt</h2>
      <p className="muted">Simulated payments · no card was charged.</p>
      <dl>
        <div>
          <dt>Accommodation · {detail.nights} nights</dt>
          <dd>{formatMoney(r.nightly_total_minor, r.currency)}</dd>
        </div>
        <div>
          <dt>Cleaning fee</dt>
          <dd>{formatMoney(r.cleaning_fee_minor, r.currency)}</dd>
        </div>
        <div>
          <dt>Guest service fee ({r.guest_fee_bps / 100}%)</dt>
          <dd>{formatMoney(r.guest_fee_minor, r.currency)}</dd>
        </div>
        <div className="quote-total">
          <dt>Booking total</dt>
          <dd>{formatMoney(r.guest_total_minor, r.currency)}</dd>
        </div>
      </dl>
      {detail.payments?.length ? (
        <ul className="payment-list">
          {detail.payments.map((payment) => (
            <li key={payment.id}>
              <div className="heading-row">
                <strong>
                  {payment.kind === 'charge' ? 'Simulated payment' : 'Simulated refund'}
                </strong>
                <Badge tone={payment.status === 'succeeded' ? 'positive' : 'warning'}>
                  {payment.status}
                </Badge>
              </div>
              <p>
                {formatMoney(payment.amount_minor, payment.currency)} ·{' '}
                {formatTimestamp(payment.created_at, r.timezone)}
              </p>
              {payment.simulated_ref && <small>Reference: {payment.simulated_ref}</small>}
              {payment.failure_reason && <p>{payment.failure_reason}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p>No payment records are available yet.</p>
      )}
    </section>
  );
}
export function PayoutSummary({ payout, timezone = 'UTC' }: { payout: Payout; timezone?: string }) {
  return (
    <section className="payout-summary">
      <h2>Host payout</h2>
      <ReservationBadge status={payout.status} />
      <dl>
        <div>
          <dt>Gross</dt>
          <dd>{formatMoney(payout.gross_minor, payout.currency)}</dd>
        </div>
        <div>
          <dt>Host fee</dt>
          <dd>{formatMoney(payout.host_fee_minor, payout.currency)}</dd>
        </div>
        <div>
          <dt>Net payout</dt>
          <dd>{formatMoney(payout.net_minor, payout.currency)}</dd>
        </div>
      </dl>
      <p>
        {payout.status === 'cancelled'
          ? 'This payout has been cancelled.'
          : payout.status === 'released'
            ? `Released${payout.released_at ? ` ${formatTimestamp(payout.released_at, timezone)}` : ''}.`
            : payout.release_at
              ? `Scheduled release: ${formatTimestamp(payout.release_at, timezone)} (${timezone}).`
              : 'Release time will be set after check-in.'}
      </p>
      {payout.held_reason && <p>Hold reason: {payout.held_reason}</p>}
    </section>
  );
}
