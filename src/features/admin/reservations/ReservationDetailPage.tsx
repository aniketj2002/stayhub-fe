import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { setReservationChromeCode } from '../../../app/adminChrome';
import { formatMoney } from '../../../lib/format';
import {
  Badge,
  ConfirmDialog,
  RequestError,
  Spinner,
  type BadgeTone,
} from '../../../components/ui';
import {
  useAdminReservation,
  useAdminCancelReservation,
  useAdminRefund,
  useAdminHoldPayout,
  useAdminReleasePayout,
} from './api';
import type { PaymentRecord, PayoutRecord, TimelineEvent } from './types';

type Note = { id: string; text: string; at: string };

const ACTION_TITLES: Record<string, string> = {
  'reservation.create': 'Reservation created · request sent to host',
  'reservation.accept': 'Host accepted',
  'reservation.decline': 'Host declined',
  'reservation.cancel_by_guest': 'Guest cancelled',
  'reservation.cancel_by_host': 'Host cancelled',
  'reservation.check_in': 'Guest checked in',
  'reservation.auto_check_in': 'Guest checked in',
  'reservation.auto_complete': 'Guest checked out',
  'reservation.expire_pending': 'Request expired',
  'admin.reservation.cancel': 'Reservation cancelled by admin',
  'admin.reservation.refund': 'Refund issued',
  'payment.charge': 'Payment captured',
  'payment.refund': 'Refund issued',
  'payout.schedule': 'Payout scheduled',
  'payout.schedule_release': 'Payout release scheduled',
  'payout.hold': 'Payout held pending case',
  'payout.release_hold': 'Payout hold released',
  'payout.release': 'Payout released',
  'payout.cancel': 'Payout cancelled',
  'payout.adjust_partial_refund': 'Payout adjusted after partial refund',
};

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    checked_in: 'Checked in',
    completed: 'Completed',
    reviewed: 'Reviewed',
    disputed: 'Disputed',
    declined: 'Declined',
    inquiry: 'Inquiry',
    cancelled: 'Cancelled',
    cancelled_by_guest: 'Cancelled',
    cancelled_by_host: 'Cancelled',
    expired: 'Expired',
    succeeded: 'Paid',
    paid: 'Paid',
    held: 'Held',
    scheduled: 'Scheduled',
    released: 'Released',
    failed: 'Failed',
    processing: 'Processing',
  };
  return labels[status] ?? status.replaceAll('_', ' ').replace(/^\w/, (char) => char.toUpperCase());
}

function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'confirmed':
    case 'completed':
    case 'checked_in':
    case 'reviewed':
    case 'succeeded':
    case 'paid':
    case 'released':
      return 'success';
    case 'pending':
    case 'scheduled':
    case 'held':
    case 'processing':
      return 'warning';
    case 'cancelled':
    case 'cancelled_by_guest':
    case 'cancelled_by_host':
    case 'failed':
    case 'declined':
    case 'expired':
      return 'danger';
    case 'disputed':
      return 'accent';
    default:
      return 'neutral';
  }
}

function eventTone(action: string): 'success' | 'info' | 'warning' | 'danger' {
  if (action.includes('hold') || action.includes('expire') || action.includes('decline')) return 'warning';
  if (action.includes('cancel') || action.includes('fail')) return 'danger';
  if (action.includes('refund') || action.startsWith('payout')) return 'info';
  return 'success';
}

function initials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '');
  return letters.join('') || '?';
}

function stayNights(checkIn: string, checkOut: string) {
  const start = Date.parse(`${checkIn.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${checkOut.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function formatStayDay(value: string) {
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return value;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
}

function formatMonthDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function formatEventStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
    .format(date)
    .replace(' AM', ' am')
    .replace(' PM', ' pm');
  return `${day}, ${time}`;
}

function listingCode(id: string) {
  const compact = id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
  return compact ? `LS-${compact}` : 'Listing';
}

function policyLabel(policy?: string) {
  if (!policy) return '—';
  return policy.replaceAll('_', ' ').replace(/^\w/, (char) => char.toUpperCase());
}

function guestCount(reservation: {
  guests?: number;
  adults_count?: number;
  children_count?: number;
  infants_count?: number;
}) {
  if (typeof reservation.guests === 'number') return reservation.guests;
  const summed =
    (reservation.adults_count ?? 0) +
    (reservation.children_count ?? 0) +
    (reservation.infants_count ?? 0);
  return summed > 0 ? summed : reservation.adults_count;
}

function payoutNet(payout?: PayoutRecord | null) {
  if (!payout) return undefined;
  return payout.net_minor ?? payout.amount_minor;
}

function payoutWhen(payout: PayoutRecord) {
  return payout.release_at || payout.scheduled_for || payout.released_at || payout.paid_at;
}

function payoutReason(payout: PayoutRecord) {
  return payout.held_reason || payout.hold_reason;
}

function chargePayment(payments: PaymentRecord[]) {
  return (
    payments.find((payment) => (payment.kind || payment.type) === 'charge' && payment.status === 'succeeded') ??
    payments.find((payment) => (payment.kind || payment.type) === 'charge')
  );
}

function paymentRef(payment?: PaymentRecord) {
  if (!payment) return undefined;
  return payment.simulated_ref || payment.provider_reference;
}

function notesKey(id: string) {
  return `stayhub.admin.reservation.notes.${id}`;
}

function readNotes(id: string): Note[] {
  try {
    const raw = sessionStorage.getItem(notesKey(id));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Note[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function eventTitle(action: string, guestPaid?: number, hostNet?: number, currency?: string) {
  if (action === 'payment.charge' && guestPaid != null) {
    return `Payment captured · ${formatMoney(guestPaid, currency)}`;
  }
  if ((action === 'payout.schedule' || action === 'payout.schedule_release') && hostNet != null) {
    return `Payout scheduled · ${formatMoney(hostNet, currency)} to host`;
  }
  return ACTION_TITLES[action] ?? action.replaceAll('_', ' ').replaceAll('.', ' · ');
}

function actorLabel(
  event: TimelineEvent,
  guest: { id: string; full_name: string },
  host: { id: string; full_name: string },
) {
  if (event.actor_id && event.actor_id === guest.id) return guest.full_name;
  if (event.actor_id && event.actor_id === host.id) return host.full_name;
  if (event.actor_type === 'system' || event.actor_type === 'worker') return 'system';
  if (event.actor_type === 'admin') return 'admin';
  return event.actor_type.replaceAll('_', ' ');
}

function LedgerRow({
  label,
  detail,
  amount,
  negative,
  strong,
  split,
  aside,
}: {
  label: string;
  detail?: string;
  amount: string;
  negative?: boolean;
  strong?: boolean;
  split?: boolean;
  aside?: ReactNode;
}) {
  return (
    <div
      className={`arv-ledger-row${split ? ' arv-ledger-row--split' : ''}${strong ? ' arv-ledger-row--strong' : ''}`}
    >
      <div>
        <div className="arv-ledger-label">{label}</div>
        {detail && <div className="arv-ledger-detail">{detail}</div>}
      </div>
      <div className="arv-ledger-value">
        <span className={negative ? 'arv-money arv-money--negative' : 'arv-money'}>{amount}</span>
        {aside}
      </div>
    </div>
  );
}

export function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: detail, isLoading, error, refetch } = useAdminReservation(id);

  const cancelMutation = useAdminCancelReservation();
  const refundMutation = useAdminRefund();
  const holdPayoutMutation = useAdminHoldPayout();
  const releasePayoutMutation = useAdminReleasePayout();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelIntent, setCancelIntent] = useState<'cancel' | 'override'>('cancel');
  const [cancelRefundMode, setCancelRefundMode] = useState<'policy' | 'full' | 'custom'>('full');
  const [cancelCustomAmount, setCancelCustomAmount] = useState<number>(0);

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmountEuros, setRefundAmountEuros] = useState<string>('');

  const [holdOpen, setHoldOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    setNotes(readNotes(id));
  }, [id]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  useEffect(() => {
    setReservationChromeCode(detail?.reservation.code ?? null);
    return () => setReservationChromeCode(null);
  }, [detail?.reservation.code]);

  if (isLoading) {
    return (
      <div className="admin-loading-container">
        <Spinner size="lg" label="Loading reservation details…" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="admin-page">
        <RequestError
          error={error || new Error('Reservation detail not found')}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const { reservation, listing, guest, host, payments, payout, timeline, refundable_minor } = detail;
  const currency = reservation.currency || 'EUR';
  const nights = stayNights(reservation.check_in, reservation.check_out);
  const nightly = reservation.nightly_total_minor ?? 0;
  const cleaning = reservation.cleaning_fee_minor ?? 0;
  const discount = reservation.discount_minor ?? 0;
  const accommodation = Math.max(0, nightly + cleaning - discount);
  const guestFee = reservation.guest_fee_minor ?? 0;
  const guestTotal = reservation.guest_total_minor ?? reservation.total_price_minor ?? accommodation + guestFee;
  const hostFee = reservation.host_fee_minor ?? payout?.host_fee_minor ?? 0;
  const hostBasis = accommodation > 0 ? accommodation : (reservation.nightly_total_minor ?? 0) + cleaning;
  const hostNet = reservation.host_net_minor ?? payoutNet(payout) ?? Math.max(0, hostBasis - hostFee);
  const platformMargin = guestFee + hostFee;
  const perNight = nights > 0 && nightly > 0 ? Math.round(nightly / nights) : nightly;
  const guests = guestCount(reservation);
  const charge = chargePayment(payments ?? []);
  const paidMinor = charge?.amount_minor ?? guestTotal;
  const paidStatus = charge?.status ?? (guestTotal > 0 ? 'succeeded' : 'pending');
  const ref = paymentRef(charge);
  const payoutAmount = payoutNet(payout);
  const payoutStatus = payout?.status;
  const closed = reservation.status.startsWith('cancel') || reservation.status === 'declined';
  const disputed = reservation.status === 'disputed';

  const orderedEvents = [...(timeline ?? [])].sort(
    (a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at),
  );

  const openCancel = (intent: 'cancel' | 'override') => {
    setCancelIntent(intent);
    setCancelRefundMode(intent === 'override' ? 'policy' : 'full');
    setCancelOpen(true);
  };

  const saveNote = (text: string) => {
    if (!id) return;
    const next = [...notes, { id: crypto.randomUUID(), text, at: new Date().toISOString() }];
    setNotes(next);
    sessionStorage.setItem(notesKey(id), JSON.stringify(next));
    setNoteOpen(false);
  };

  const message = (email: string) => {
    const subject = encodeURIComponent(`StayHub reservation ${reservation.code}`);
    window.open(`mailto:${email}?subject=${subject}`, '_blank', 'noopener');
  };

  const handleCancelConfirm = async (reason: string) => {
    if (!id) return;
    await cancelMutation.mutateAsync({
      id,
      input: {
        reason,
        refund_mode: cancelRefundMode,
        amount_minor: cancelRefundMode === 'custom' ? Math.round(cancelCustomAmount * 100) : undefined,
      },
    });
    setCancelOpen(false);
  };

  const handleRefundConfirm = async (reason: string) => {
    if (!id) return;
    const amountMinor = Math.round(parseFloat(refundAmountEuros) * 100);
    await refundMutation.mutateAsync({
      id,
      input: { reason, amount_minor: amountMinor },
    });
    setRefundOpen(false);
  };

  const handleHoldPayoutConfirm = async (reason: string) => {
    if (!payout) return;
    await holdPayoutMutation.mutateAsync({ payoutId: payout.id, reason });
    setHoldOpen(false);
  };

  const handleReleasePayoutConfirm = async (reason: string) => {
    if (!payout) return;
    await releasePayoutMutation.mutateAsync({ payoutId: payout.id, reason });
    setReleaseOpen(false);
  };

  const guestFeeDetail =
    reservation.guest_fee_bps != null && accommodation > 0
      ? `${(reservation.guest_fee_bps / 100).toFixed(0)}% of ${formatMoney(accommodation, currency)}`
      : undefined;
  const hostFeeDetail = reservation.host_fee_bps != null ? `${(reservation.host_fee_bps / 100).toFixed(0)}%` : undefined;
  const holdText = payout ? payoutReason(payout) : undefined;

  return (
    <div className="admin-reservation-view">
      <header className="arv-header">
        <div className="arv-title-row">
          <h1 className="arv-title">Reservation {reservation.code}</h1>
          <Badge tone={statusTone(reservation.status)}>{statusLabel(reservation.status)}</Badge>
        </div>
        <div className="arv-header-actions">
          <button type="button" className="arv-outline-btn" onClick={() => message(guest.email)}>
            <ChatIcon />
            Message guest
          </button>
          <button type="button" className="arv-outline-btn" onClick={() => message(host.email)}>
            <ChatIcon />
            Message host
          </button>
          <div className="arv-menu" ref={menuRef}>
            <button
              type="button"
              className="arv-outline-btn"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              Actions
              <ChevronIcon />
            </button>
            {menuOpen && (
              <div className="arv-menu-panel" role="menu">
                {payout?.status === 'scheduled' && (
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setHoldOpen(true); }}>
                    Hold payout
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    void navigator.clipboard?.writeText(reservation.code);
                  }}
                >
                  Copy reservation code
                </button>
                <Link role="menuitem" to="/admin/audit" onClick={() => setMenuOpen(false)}>
                  Open audit log
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="arv-grid">
        <div className="arv-column">
          <section className="arv-card arv-listing-card">
            {listing.cover_photo_url ? (
              <img className="arv-photo" src={listing.cover_photo_url} alt={listing.title} />
            ) : (
              <div className="arv-photo arv-photo--empty" role="img" aria-label={`${listing.title} photo unavailable`} />
            )}
            <h2 className="arv-listing-title">{listing.title}</h2>
            <p className="arv-listing-meta">
              {listing.city} · {listingCode(listing.id)} · {host.full_name}
            </p>
            <dl className="arv-facts">
              <div>
                <dt>Dates</dt>
                <dd>
                  {formatStayDay(reservation.check_in)} — {formatStayDay(reservation.check_out)}
                </dd>
              </div>
              <div>
                <dt>Guests</dt>
                <dd>{guests == null ? '—' : `${guests} ${guests === 1 ? 'guest' : 'guests'}`}</dd>
              </div>
              <div>
                <dt>Policy</dt>
                <dd>{policyLabel(reservation.cancellation_policy)}</dd>
              </div>
              <div>
                <dt>Booked via</dt>
                <dd>{reservation.is_instant_book ? 'Web · Instant' : 'Web · Request'}</dd>
              </div>
            </dl>
          </section>

          <section className="arv-card">
            <h2 className="arv-kicker">Parties</h2>
            <Party
              name={guest.full_name}
              role="guest"
              detail={guest.email}
              initials={initials(guest.full_name)}
              tone="guest"
            />
            <Party
              name={host.full_name}
              role="host"
              detail={host.email}
              initials={initials(host.full_name)}
              tone="host"
            />
          </section>

          {disputed && (
            <section className="arv-card">
              <h2 className="arv-kicker">Linked case</h2>
              <p className="arv-case-title">Dispute open on {reservation.code}</p>
              <p className="arv-case-meta">Open · review the claim before releasing payout</p>
              <Link to="/admin/cases" className="arv-case-link">
                Open case
                <ExternalIcon />
              </Link>
            </section>
          )}
        </div>

        <section className="arv-card arv-timeline-card" aria-label="Timeline">
          <h2 className="arv-card-title">Timeline</h2>
          {orderedEvents.length === 0 && notes.length === 0 ? (
            <p className="arv-empty">No timeline events recorded.</p>
          ) : (
            <ol className="arv-timeline">
              {orderedEvents.map((event) => (
                <li key={event.id} className="arv-event">
                  <span className={`arv-dot arv-dot--${eventTone(event.action)}`} aria-hidden="true" />
                  <div>
                    <p className="arv-event-title">
                      {eventTitle(event.action, guestTotal, hostNet, currency)}
                    </p>
                    <p className="arv-event-meta">
                      {formatEventStamp(event.occurred_at)} · {actorLabel(event, guest, host)}
                      {event.reason ? ` · ${event.reason}` : ''}
                    </p>
                  </div>
                </li>
              ))}
              {notes.map((note) => (
                <li key={note.id} className="arv-event">
                  <span className="arv-dot arv-dot--warning" aria-hidden="true" />
                  <div>
                    <p className="arv-event-title">Internal note</p>
                    <p className="arv-event-meta">
                      {formatEventStamp(note.at)} · you · {note.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="arv-column">
          <section className="arv-card" aria-label="Ledger">
            <h2 className="arv-card-title">Ledger</h2>
            <div className="arv-ledger-row">
              <div>
                <div className="arv-ledger-label">Guest paid</div>
                {ref && <div className="arv-ledger-detail">{ref}</div>}
              </div>
              <div className="arv-ledger-value">
                {charge?.created_at && <span className="arv-ledger-muted">{formatMonthDay(charge.created_at)}</span>}
                <span className="arv-money">{formatMoney(paidMinor, currency)}</span>
                <Badge tone={statusTone(paidStatus)}>{statusLabel(paidStatus)}</Badge>
              </div>
            </div>
            {nightly > 0 && (
              <LedgerRow
                label={nights > 0 ? `Nights · ${formatMoney(perNight, currency)} × ${nights}` : 'Nights'}
                amount={formatMoney(nightly, currency)}
              />
            )}
            {cleaning > 0 && <LedgerRow label="Cleaning fee" amount={formatMoney(cleaning, currency)} />}
            {discount > 0 && (
              <LedgerRow label="Discount" amount={`−${formatMoney(discount, currency)}`} negative />
            )}
            {guestFee > 0 && (
              <LedgerRow
                label="Guest service fee"
                detail={guestFeeDetail}
                amount={formatMoney(guestFee, currency)}
              />
            )}
            <LedgerRow
              split
              label="Host payout basis"
              detail="nights + cleaning"
              amount={formatMoney(hostBasis, currency)}
            />
            {hostFee > 0 && (
              <LedgerRow
                label="Host fee"
                detail={hostFeeDetail}
                amount={`−${formatMoney(hostFee, currency)}`}
                negative
              />
            )}
            <div className="arv-ledger-row arv-ledger-row--split arv-ledger-row--strong">
              <div>
                <div className="arv-ledger-label">
                  Host payout
                  {payout?.simulated_ref && <span className="arv-ledger-muted"> · {payout.simulated_ref}</span>}
                </div>
              </div>
              <div className="arv-ledger-value">
                {payout && payoutWhen(payout) && (
                  <span className="arv-ledger-muted">{formatMonthDay(payoutWhen(payout)!)}</span>
                )}
                <span className="arv-money">{formatMoney(payoutAmount ?? hostNet, currency)}</span>
                {payoutStatus && <Badge tone={statusTone(payoutStatus)}>{statusLabel(payoutStatus)}</Badge>}
              </div>
            </div>
            <LedgerRow split strong label="Platform margin" detail="service fee + host fee" amount={formatMoney(platformMargin, currency)} />
            {payout && payoutStatus === 'held' && (
              <p className="arv-ledger-footnote">
                Payout held
                {(payout.updated_at || payoutWhen(payout)) &&
                  ` on ${formatMonthDay(payout.updated_at || payoutWhen(payout)!)}`}
                {holdText ? ` · ${holdText}` : ''}.
              </p>
            )}
          </section>

          <section className="arv-card">
            <h2 className="arv-kicker">Admin actions</h2>
            <div className="arv-actions">
              <button
                type="button"
                className="arv-action-btn"
                disabled={refundable_minor <= 0}
                onClick={() => setRefundOpen(true)}
              >
                Issue refund
              </button>
              <button
                type="button"
                className="arv-action-btn"
                disabled={!payout || payout.status !== 'held'}
                onClick={() => setReleaseOpen(true)}
              >
                Release payout
              </button>
              <button type="button" className="arv-action-btn" disabled={closed} onClick={() => openCancel('override')}>
                Override policy
              </button>
              <button
                type="button"
                className="arv-action-btn"
                onClick={() => window.open(`/listings/${listing.id}`, '_blank', 'noopener')}
              >
                Rebook guest
              </button>
              <button
                type="button"
                className="arv-action-btn arv-action-btn--danger"
                disabled={closed}
                onClick={() => openCancel('cancel')}
              >
                Cancel reservation
              </button>
              <button type="button" className="arv-action-btn arv-action-btn--quiet" onClick={() => setNoteOpen(true)}>
                <PencilIcon />
                Add internal note
              </button>
            </div>
            <p className="arv-actions-note">Every action is logged with your name and a required reason.</p>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title={cancelIntent === 'override' ? 'Override cancellation policy' : 'Cancel reservation'}
        message={
          cancelIntent === 'override'
            ? 'Apply a policy, full, or custom refund. This cancels the reservation and writes the reason to the audit log.'
            : 'Cancelling this reservation adjusts the host payout and applies the refund you choose.'
        }
        confirmLabel={cancelIntent === 'override' ? 'Apply override' : 'Cancel reservation'}
        variant="danger"
        requireReason
        reasonMinLength={10}
        busy={cancelMutation.isPending}
        error={cancelMutation.error ? (cancelMutation.error as Error).message : undefined}
        onConfirm={handleCancelConfirm}
        onCancel={() => setCancelOpen(false)}
      >
        <div className="field">
          <label htmlFor="cancel-refund-mode">Refund mode</label>
          <select
            id="cancel-refund-mode"
            className="admin-select"
            value={cancelRefundMode}
            onChange={(event) => setCancelRefundMode(event.target.value as 'policy' | 'full' | 'custom')}
          >
            <option value="full">Full refund (100%)</option>
            <option value="policy">According to cancellation policy</option>
            <option value="custom">Custom amount</option>
          </select>
        </div>
        {cancelRefundMode === 'custom' && (
          <div className="field">
            <label htmlFor="cancel-custom-amount">Custom amount ({currency})</label>
            <input
              id="cancel-custom-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={cancelCustomAmount || ''}
              onChange={(event) => setCancelCustomAmount(parseFloat(event.target.value) || 0)}
              required
            />
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={refundOpen}
        title="Issue refund"
        message={`Refund the guest directly. Maximum refundable: ${formatMoney(refundable_minor, currency)}.`}
        confirmLabel="Issue refund"
        requireReason
        reasonMinLength={10}
        busy={refundMutation.isPending}
        error={refundMutation.error ? (refundMutation.error as Error).message : undefined}
        onConfirm={handleRefundConfirm}
        onCancel={() => setRefundOpen(false)}
      >
        <div className="field">
          <label htmlFor="refund-amount">Refund amount ({currency})</label>
          <input
            id="refund-amount"
            type="number"
            step="0.01"
            min="0.01"
            max={(refundable_minor / 100).toString()}
            value={refundAmountEuros}
            onChange={(event) => setRefundAmountEuros(event.target.value)}
            required
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={holdOpen}
        title="Hold host payout"
        message="A hold stops the payout until an administrator releases it."
        confirmLabel="Hold payout"
        variant="danger"
        requireReason
        reasonMinLength={10}
        busy={holdPayoutMutation.isPending}
        error={holdPayoutMutation.error ? (holdPayoutMutation.error as Error).message : undefined}
        onConfirm={handleHoldPayoutConfirm}
        onCancel={() => setHoldOpen(false)}
      />

      <ConfirmDialog
        open={releaseOpen}
        title="Release host payout"
        message="Release the hold so this payout can be disbursed."
        confirmLabel="Release payout"
        requireReason
        reasonMinLength={10}
        busy={releasePayoutMutation.isPending}
        error={releasePayoutMutation.error ? (releasePayoutMutation.error as Error).message : undefined}
        onConfirm={handleReleasePayoutConfirm}
        onCancel={() => setReleaseOpen(false)}
      />

      <ConfirmDialog
        open={noteOpen}
        title="Add internal note"
        message="The note is kept in this browser for the reservation and shown on the timeline."
        confirmLabel="Save note"
        requireReason
        reasonMinLength={3}
        reasonLabel="Note"
        reasonPlaceholder="What should the next admin know?"
        onConfirm={saveNote}
        onCancel={() => setNoteOpen(false)}
      />
    </div>
  );
}

function Party({
  name,
  role,
  detail,
  initials: letters,
  tone,
}: {
  name: string;
  role: string;
  detail: string;
  initials: string;
  tone: 'guest' | 'host';
}) {
  return (
    <div className="arv-party">
      <span className={`arv-avatar arv-avatar--${tone}`} aria-hidden="true">
        {letters}
      </span>
      <div>
        <p className="arv-party-name">
          {name} <span>· {role}</span>
        </p>
        <p className="arv-party-detail">{detail}</p>
      </div>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 1 1 18 0Z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
  );
}
