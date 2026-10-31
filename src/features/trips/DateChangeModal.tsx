import { useMemo, useState } from 'react';
import { Badge } from '../../components/ui';
import { getCurrentUserId } from '../auth/session';
import { formatMoney } from '../../lib/format';
import { addDays, nightsInRange, shiftMonth } from '../calendar/dates';
import {
  useApproveAlteration,
  useDeclineAlteration,
  useRequestAlteration,
  useReservationAlterations,
} from './api';

function formatShortDate(val: string) {
  if (!val) return '';
  const [y, m, d] = val.split('-');
  if (!y || !m || !d) return val;
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const mIndex = parseInt(m, 10) - 1;
  return `${monthNames[mIndex] || m} ${parseInt(d, 10)}`;
}

interface DateChangeModalProps {
  open: boolean;
  onClose: () => void;
  reservationId: string;
  currentCheckIn: string;
  currentCheckOut: string;
  currentGuests: number;
  currency?: string;
  isHost?: boolean;
}

export function DateChangeModal({
  open,
  onClose,
  reservationId,
  currentCheckIn,
  currentCheckOut,
  currentGuests,
  currency = 'EUR',
  isHost = false,
}: DateChangeModalProps) {
  const { data: alterations = [] } = useReservationAlterations(reservationId);
  const requestMutation = useRequestAlteration();
  const approveMutation = useApproveAlteration();
  const declineMutation = useDeclineAlteration();

  const [newCheckIn, setNewCheckIn] = useState(currentCheckIn);
  const [newCheckOut, setNewCheckOut] = useState(currentCheckOut);
  const [newGuests, setNewGuests] = useState(currentGuests);
  const [declineReason, setDeclineReason] = useState('');
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const currentUserId = getCurrentUserId();

  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const defaultMonth =
    newCheckIn && newCheckIn.length >= 7
      ? `${newCheckIn.slice(0, 7)}-01`
      : `${todayString.slice(0, 7)}-01`;
  const [navMonth, setNavMonth] = useState<string | null>(null);
  const viewMonth = navMonth ?? defaultMonth;
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

  const selectedNights = useMemo(() => {
    if (!newCheckIn || !newCheckOut || newCheckIn >= newCheckOut) return [];
    return nightsInRange(newCheckIn, newCheckOut);
  }, [newCheckIn, newCheckOut]);

  if (!open) return null;

  const pendingAlteration = alterations.find((alt) => alt.status === 'pending');
  const canReviewPending = Boolean(
    pendingAlteration &&
      isHost &&
      pendingAlteration.requested_by !== currentUserId,
  );

  function handleDayClick(day: string) {
    if (day < todayString) {
      setErrorMsg('Cannot select dates in the past.');
      return;
    }

    setErrorMsg(null);

    // If starting fresh or resetting
    if (!newCheckIn || (newCheckIn && newCheckOut)) {
      setNewCheckIn(day);
      setNewCheckOut('');
      return;
    }

    // If newCheckIn is set, waiting for newCheckOut
    if (newCheckIn && !newCheckOut) {
      if (day < newCheckIn) {
        setNewCheckIn(day);
        setNewCheckOut('');
        return;
      }
      if (day === newCheckIn) {
        setErrorMsg('Checkout must be at least 1 night after check-in.');
        return;
      }

      setNewCheckOut(day);
    }
  }

  const handleRequestAlteration = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newCheckIn >= newCheckOut) {
      setErrorMsg('Checkout date must be after check-in date.');
      return;
    }

    try {
      await requestMutation.mutateAsync({
        reservationId,
        input: {
          check_in: newCheckIn,
          check_out: newCheckOut,
          guests: newGuests,
        },
      });
      setSuccessMsg('Date change request sent. Awaiting review from the other party.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to request reservation alteration.');
    }
  };

  const handleApprove = async (alterationId: string) => {
    setErrorMsg(null);
    try {
      await approveMutation.mutateAsync({ reservationId, alterationId });
      setSuccessMsg('Alteration approved successfully!');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to approve alteration.');
    }
  };

  const handleDecline = async (alterationId: string) => {
    if (!declineReason.trim()) {
      setErrorMsg('Please specify a reason for declining.');
      return;
    }
    setErrorMsg(null);
    try {
      await declineMutation.mutateAsync({
        reservationId,
        alterationId,
        input: { reason: declineReason.trim() },
      });
      setDecliningId(null);
      setDeclineReason('');
      setSuccessMsg('Alteration request declined.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to decline alteration.');
    }
  };

  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alteration-modal-title"
    >
      <div className="dialog-card alteration-modal-card" style={{ maxWidth: '520px' }}>
        <div className="dialog-header">
          <h3 id="alteration-modal-title">Change Reservation Dates</h3>
          <button type="button" className="dialog-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {errorMsg && <div className="alert alert-danger" style={{ marginTop: '12px' }}>{errorMsg}</div>}
        {successMsg && <div className="alert alert-success" style={{ marginTop: '12px' }}>{successMsg}</div>}

        {/* Existing Pending Request Notice if any */}
        {pendingAlteration && (
          <div className="pending-alteration-banner" style={{ marginTop: '14px' }}>
            <div className="pending-alteration-header">
              <Badge tone="warning">Pending Request</Badge>
              <span className="pending-expiry">
                Expires {new Date(pendingAlteration.expires_at).toLocaleDateString()}
              </span>
            </div>
            <div className="pending-alteration-dates">
              <div>
                <span className="sub-label">Current:</span>{' '}
                <strong>{pendingAlteration.current_check_in} → {pendingAlteration.current_check_out}</strong>
              </div>
              <div>
                <span className="sub-label">Requested:</span>{' '}
                <strong style={{ color: '#2563eb' }}>
                  {pendingAlteration.new_check_in} → {pendingAlteration.new_check_out}
                </strong>
              </div>
            </div>
            <div className="pending-alteration-delta">
              Price adjustment:{' '}
              <strong>
                {pendingAlteration.delta_minor > 0 ? '+' : ''}
                {formatMoney(pendingAlteration.delta_minor, pendingAlteration.currency || currency)}
              </strong>
            </div>

            {canReviewPending ? (
              <div className="pending-alteration-actions" style={{ display: 'flex', gap: '10px', marginTop: '12px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="button button--primary button--sm"
                  disabled={approveMutation.isPending}
                  onClick={() => handleApprove(pendingAlteration.id)}
                >
                  {approveMutation.isPending ? 'Approving...' : 'Approve Request'}
                </button>

                {decliningId === pendingAlteration.id ? (
                  <div className="decline-reason-box" style={{ width: '100%', marginTop: '8px' }}>
                    <input
                      type="text"
                      placeholder="Reason for declining..."
                      className="form-input"
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button
                        type="button"
                        className="button button--danger button--sm"
                        disabled={declineMutation.isPending}
                        onClick={() => handleDecline(pendingAlteration.id)}
                      >
                        Confirm Decline
                      </button>
                      <button
                        type="button"
                        className="button button--ghost button--sm"
                        onClick={() => setDecliningId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="button button--secondary button--sm"
                    onClick={() => setDecliningId(pendingAlteration.id)}
                  >
                    Decline
                  </button>
                )}
              </div>
            ) : (
              <p className="alteration-policy-note">
                Awaiting review from the other party.
              </p>
            )}
          </div>
        )}

        {/* New Request Form (Only if no pending request) */}
        {!pendingAlteration && (
          <form onSubmit={handleRequestAlteration} className="alteration-form" style={{ marginTop: '16px' }}>
            {/* Same Box as Booking UI (Screen 06 Box Layout) */}
            <div className="quote-inputs-box">
              <div className="quote-dates-split">
                <div className="quote-input-cell quote-input-cell--dates">
                  <label htmlFor="alter-checkin" className="cell-tiny-label">
                    NEW CHECK IN
                  </label>
                  <div className="cell-input-wrapper">
                    <span className={`cell-display-val ${!newCheckIn ? 'cell-display-val--placeholder' : ''}`}>
                      {formatShortDate(newCheckIn) || 'Add date'}
                    </span>
                    <input
                      id="alter-checkin"
                      type="date"
                      min={todayString}
                      className="cell-hidden-native-input"
                      value={newCheckIn}
                      onChange={(e) => {
                        setNewCheckIn(e.target.value);
                        if (e.target.value) {
                          setNavMonth(`${e.target.value.slice(0, 7)}-01`);
                        }
                      }}
                      aria-label="New check-in date"
                    />
                  </div>
                </div>

                <div className="quote-input-cell quote-input-cell--border-left quote-input-cell--dates">
                  <label htmlFor="alter-checkout" className="cell-tiny-label">
                    NEW CHECK OUT
                  </label>
                  <div className="cell-input-wrapper">
                    <span className={`cell-display-val ${!newCheckOut ? 'cell-display-val--placeholder' : ''}`}>
                      {formatShortDate(newCheckOut) || 'Add date'}
                    </span>
                    <input
                      id="alter-checkout"
                      type="date"
                      min={newCheckIn ? addDays(newCheckIn, 1) : todayString}
                      className="cell-hidden-native-input"
                      value={newCheckOut}
                      onChange={(e) => {
                        setNewCheckOut(e.target.value);
                      }}
                      aria-label="New checkout date"
                    />
                  </div>
                </div>
              </div>

              <div className="quote-input-cell quote-input-cell--guests">
                <label htmlFor="alter-guests" className="cell-tiny-label">
                  GUESTS
                </label>
                <div className="cell-input-wrapper">
                  <input
                    id="alter-guests"
                    type="number"
                    min="1"
                    max="20"
                    value={newGuests}
                    onChange={(e) => setNewGuests(parseInt(e.target.value, 10) || 1)}
                    className="cell-input-field"
                    style={{ width: '100%', fontSize: '13.5px' }}
                  />
                </div>
              </div>
            </div>

            {/* Same Availability Calendar Card as Booking UI (Screen 07) */}
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
                  const isPast = day < todayString;

                  const isCheckIn = day === newCheckIn;
                  const isCheckOut = day === newCheckOut;
                  const isInRange = Boolean(
                    newCheckIn && newCheckOut && day > newCheckIn && day < newCheckOut,
                  );
                  const isCurrentBooking = Boolean(
                    currentCheckIn && currentCheckOut && day >= currentCheckIn && day <= currentCheckOut,
                  );

                  let cellClass = 'cal-day-cell';
                  if (isInRange) cellClass += ' cal-day-cell--in-range';
                  if (isCheckIn) cellClass += ' cal-day-cell--range-start';
                  if (isCheckIn && newCheckOut) cellClass += ' cal-day-cell--has-end';
                  if (isCheckOut) cellClass += ' cal-day-cell--range-end';
                  if (isPast) cellClass += ' cal-day-cell--past';

                  let btnClass = 'cal-day-btn';
                  if (isCheckIn || isCheckOut) btnClass += ' cal-day-btn--selected';
                  if (isInRange) btnClass += ' cal-day-btn--in-range';
                  if (isPast) btnClass += ' cal-day-btn--past';

                  const ariaStatus = isPast
                    ? ', Past date'
                    : isCheckIn
                      ? ', Check-in'
                      : isCheckOut
                        ? ', Checkout'
                        : isCurrentBooking
                          ? ', Current booking'
                          : '';

                  return (
                    <div
                      key={day}
                      className={cellClass}
                      style={
                        isCurrentBooking && !isCheckIn && !isCheckOut && !isInRange
                          ? { outline: '2px dashed #f59e0b', outlineOffset: '-2px', borderRadius: '4px' }
                          : undefined
                      }
                    >
                      <button
                        type="button"
                        className={btnClass}
                        disabled={isPast}
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

              <div
                style={{
                  marginTop: '14px',
                  paddingTop: '10px',
                  borderTop: '1px solid var(--color-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12.5px',
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#111827' }} />
                    New Selection
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#b45309' }}>
                    <span style={{ width: '8px', height: '8px', border: '1.5px dashed #f59e0b', borderRadius: '2px' }} />
                    Current ({currentCheckIn} – {currentCheckOut})
                  </span>
                </div>

                {selectedNights.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        background: '#ecfdf5',
                        color: '#065f46',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      {selectedNights.length} night{selectedNights.length > 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewCheckIn('');
                        setNewCheckOut('');
                      }}
                      className="text-link"
                      style={{ fontSize: '12px', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>
            </div>

            <p className="alteration-policy-note">
              ℹ️ Requesting a change does not alter your reservation immediately. The host will have
              up to 48 hours to accept or decline. If accepted, your payment will be adjusted automatically.
            </p>

            <div className="dialog-actions">
              <button type="button" className="button button--ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="button button--primary"
                disabled={requestMutation.isPending || !newCheckIn || !newCheckOut || newCheckIn >= newCheckOut}
              >
                {requestMutation.isPending ? 'Sending Request...' : 'Send Change Request'}
              </button>
            </div>
          </form>
        )}

        {/* History of Past Alterations */}
        {alterations.length > 0 && (
          <div className="alterations-history-section" style={{ marginTop: '24px' }}>
            <h4>Past Alteration Requests</h4>
            <div className="alterations-history-list">
              {alterations.map((alt) => (
                <div key={alt.id} className="alteration-history-item">
                  <div className="history-dates">
                    <span>{alt.new_check_in} → {alt.new_check_out}</span>
                    <Badge
                      tone={
                        alt.status === 'approved'
                          ? 'success'
                          : alt.status === 'declined'
                          ? 'danger'
                          : 'neutral'
                      }
                    >
                      {alt.status}
                    </Badge>
                  </div>
                  <span className="history-created">
                    {new Date(alt.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
