import { ApiError } from '../../lib/api';
import type { RefundPreview } from './types';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Dialog, Field, Skeleton, SuccessNotice } from '../../components/ui';
import { RequestError } from '../../components/RequestError';
import { formatMoney, formatTimestamp } from '../../lib/format';
import { useSession } from '../auth/session';
import { getCancelPreview } from './api';
import { cancellable, refundSignature } from './presentation';
import type { ReservationDetail } from './types';
import { useReservationAction } from './useReservationAction';

export function GuestCancellation({ detail }: { detail: ReservationDetail }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState('');
  const [recoveryPreview, setRecoveryPreview] = useState<RefundPreview | null>(null);
  const [error, setError] = useState<unknown>(null);
  const session = useSession();
  const id = detail.reservation.id;
  const action = useReservationAction(`${session.identity?.user?.id}:cancel:${id}`);
  const preview = useQuery({
    queryKey: ['cancel-preview', id],
    queryFn: ({ signal }) => getCancelPreview(id, signal),
    enabled: open && !action.attempt && cancellable(detail.reservation.status),
    staleTime: 0,
    refetchInterval: 30000,
  });
  const busy = checking || action.busy;
  async function confirm() {
    if (busy || !preview.data || preview.isFetching) return;
    setChecking(true);
    setNotice('');
    setError(null);
    try {
      const fresh = await preview.refetch();
      if (fresh.error || !fresh.data)
        throw fresh.error || new Error('Unable to refresh refund preview.');
      if (
        refundSignature(fresh.data.cancel_preview) !== refundSignature(preview.data.cancel_preview)
      ) {
        setNotice('Your refund terms changed. Review the updated refund and confirm again.');
        return;
      }
      const result = await action.run(
        `/api/v1/reservations/${id}/cancel`,
        { cancel_reason: reason.trim() },
        refundSignature(fresh.data.cancel_preview),
      );
      if (result) {
        setOpen(false);
        setNotice('Reservation cancelled. Your receipt shows the server-recorded refund.');
      }
    } catch (e) {
      setError(e);
    } finally {
      setChecking(false);
    }
  }
  async function recover() {
    if (!action.attempt || busy) return;
    setChecking(true);
    setError(null);
    try {
      try {
        const fresh = await getCancelPreview(id);
        const reviewed = recoveryPreview ? refundSignature(recoveryPreview) : action.attempt.review;
        if (refundSignature(fresh.cancel_preview) !== reviewed) {
          setRecoveryPreview(fresh.cancel_preview);
          setNotice(
            'The refund terms changed. Review the current refund and confirm this retry again.',
          );
          return;
        }
      } catch (e) {
        if (!(e instanceof ApiError) || e.code !== 'INVALID_STATE_TRANSITION') throw e;
      }
      const result = await action.run(action.attempt.path, action.attempt.body);
      if (result) {
        setOpen(false);
        setNotice('Cancellation result recovered.');
      }
    } catch (e) {
      setError(e);
    } finally {
      setChecking(false);
    }
  }
  const data = preview.data?.cancel_preview;
  return (
    <section className="cancellation-section">
      {notice && !open && <SuccessNotice>{notice}</SuccessNotice>}
      {action.attempt ? (
        <div className="recovery-panel">
          <p>
            A cancellation request may already have succeeded. Retry the same request to recover its
            result.
          </p>
          {recoveryPreview && (
            <p>
              Current refund:{' '}
              <strong>
                {formatMoney(
                  recoveryPreview.breakdown.refund_amount_minor,
                  recoveryPreview.currency,
                )}
              </strong>
              . Non-refundable:{' '}
              {formatMoney(
                recoveryPreview.breakdown.non_refundable_minor,
                recoveryPreview.currency,
              )}
              .
            </p>
          )}
          {error != null && <RequestError error={error} />}
          <Button disabled={busy} onClick={() => void recover()}>
            {recoveryPreview
              ? 'Confirm reviewed cancellation retry'
              : 'Recover cancellation result'}
          </Button>
          {action.error != null && <RequestError error={action.error} />}
        </div>
      ) : (
        cancellable(detail.reservation.status) && (
          <Button
            variant="secondary"
            onClick={() => {
              setOpen(true);
              setNotice('');
            }}
          >
            Preview cancellation
          </Button>
        )
      )}
      <Dialog
        open={open}
        title="Review your cancellation"
        onClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        {notice && open && <SuccessNotice>{notice}</SuccessNotice>}
        {error != null && <RequestError error={error} />}
        {action.error != null && <RequestError error={action.error} />}
        {preview.isPending || preview.isFetching ? (
          <Skeleton label="Calculating your refund" />
        ) : preview.isError ? (
          <RequestError error={preview.error} onRetry={() => void preview.refetch()} />
        ) : (
          data && (
            <>
              <p>These amounts are calculated by StayHub for your reservation.</p>
              <dl>
                <div>
                  <dt>Originally paid</dt>
                  <dd>{formatMoney(data.guest_paid_minor, data.currency)}</dd>
                </div>
                <div>
                  <dt>Accommodation refund ({data.breakdown.refund_pct}%)</dt>
                  <dd>{formatMoney(data.breakdown.refunded_accommodation_minor, data.currency)}</dd>
                </div>
                <div>
                  <dt>Guest service fee refunded</dt>
                  <dd>{formatMoney(data.breakdown.refunded_guest_fee_minor, data.currency)}</dd>
                </div>
                <div>
                  <dt>Non-refundable amount</dt>
                  <dd>{formatMoney(data.breakdown.non_refundable_minor, data.currency)}</dd>
                </div>
                <div className="quote-total">
                  <dt>Your refund</dt>
                  <dd>{formatMoney(data.breakdown.refund_amount_minor, data.currency)}</dd>
                </div>
              </dl>
              <p className="muted">
                Evaluated {formatTimestamp(data.evaluated_at, detail.reservation.timezone)} (
                {detail.reservation.timezone}). {data.breakdown.hours_before_check_in} hours before
                check-in.
              </p>
              <Field
                id="cancel-reason"
                label="Reason (optional)"
                value={reason}
                disabled={busy || !!action.attempt}
                onChange={(event) => setReason(event.target.value)}
              />
              <p>
                Confirming cancels your stay and releases the booked nights. Refunds are simulated.
              </p>
              <div className="card-actions">
                <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
                  {action.attempt ? 'Close review to recover result' : 'Keep my trip'}
                </Button>
                <Button
                  disabled={busy || preview.isFetching || !!action.attempt}
                  onClick={() => void confirm()}
                >
                  {busy ? 'Cancelling…' : 'Confirm cancellation'}
                </Button>
              </div>
            </>
          )
        )}
      </Dialog>
    </section>
  );
}
