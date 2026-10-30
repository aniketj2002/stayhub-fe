import { useEffect, useState } from 'react';
import { Button, Dialog, Field, SuccessNotice } from '../../components/ui';
import { RequestError } from '../../components/RequestError';
import { useSession } from '../auth/session';
import { hasListingPermission, type ListingAccess } from '../auth/permissions';
import type { ReservationDetail } from './types';
import { useReservationAction } from './useReservationAction';
type Action = 'accept' | 'decline' | 'cancel' | 'check-in';
export function HostActions({
  detail,
  access,
}: {
  detail: ReservationDetail;
  access?: ListingAccess;
}) {
  const session = useSession();
  const r = detail.reservation;
  const action = useReservationAction(`${session.identity?.user?.id}:host-action:${r.id}`);
  const [selected, setSelected] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (r.status !== 'pending') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [r.status]);
  const allowed = hasListingPermission(access, 'can_manage_reservations');
  const expired = !!r.request_expires_at && Date.parse(r.request_expires_at) <= now;
  const labels: Record<Action, string> = {
    accept: 'Accept request',
    decline: 'Decline request',
    cancel: 'Cancel reservation',
    'check-in': 'Mark checked in',
  };
  async function submit() {
    if (!selected || action.busy || (selected === 'decline' && !reason.trim())) return;
    const result = await action.run(
      `/api/v1/host/reservations/${r.id}/${selected}`,
      selected === 'decline'
        ? { decline_reason: reason.trim() }
        : selected === 'cancel'
          ? { cancel_reason: reason.trim() }
          : {},
    );
    if (result) {
      setSelected(null);
      setDone(true);
    }
  }
  if (!allowed)
    return (
      <p className="muted">
        Reservation actions require this listing’s reservation-management permission.
      </p>
    );
  return (
    <div className="host-reservation-actions">
      {done && <SuccessNotice>Reservation updated. Refreshing your view.</SuccessNotice>}
      {action.error != null && <RequestError error={action.error} />}
      {action.attempt ? (
        <div className="recovery-panel">
          <p>
            A previous reservation action may already have succeeded. Recover its result before
            taking another action.
          </p>
          <Button
            disabled={action.busy}
            onClick={async () => {
              if (!action.attempt) return;
              const result = await action.run(action.attempt.path, action.attempt.body);
              if (result) {
                setSelected(null);
                setDone(true);
              }
            }}
          >
            Recover action result
          </Button>
        </div>
      ) : (
        !done && (
          <div className="card-actions">
            {r.status === 'pending' && (
              <>
                <Button disabled={expired || action.busy} onClick={() => setSelected('accept')}>
                  Accept request
                </Button>
                <Button
                  variant="secondary"
                  disabled={action.busy}
                  onClick={() => setSelected('decline')}
                >
                  Decline request
                </Button>
              </>
            )}
            {r.status === 'confirmed' && (
              <>
                <Button disabled={action.busy} onClick={() => setSelected('check-in')}>
                  Mark checked in
                </Button>
                <Button
                  variant="secondary"
                  disabled={action.busy}
                  onClick={() => setSelected('cancel')}
                >
                  Cancel reservation
                </Button>
              </>
            )}
          </div>
        )
      )}
      <Dialog
        open={selected !== null}
        title={selected ? labels[selected] : 'Reservation action'}
        onClose={() => {
          if (!action.busy) setSelected(null);
        }}
      >
        {selected === 'accept' && (
          <p>
            Confirm this guest’s request and schedule the payout. The guest has already completed
            simulated payment.
          </p>
        )}
        {selected === 'decline' && (
          <p>
            Declining releases the reserved nights and issues a full simulated refund to the guest.
          </p>
        )}
        {selected === 'cancel' && (
          <p>
            This cancels the confirmed stay, releases the nights, fully refunds the guest, and
            cancels the scheduled payout.
          </p>
        )}
        {selected === 'check-in' && (
          <p>
            Confirm the guest has checked in. The backend schedules payout release 24 hours after
            the recorded check-in.
          </p>
        )}
        {(selected === 'decline' || selected === 'cancel') && (
          <Field
            id={`host-reason-${r.id}`}
            label={
              selected === 'decline'
                ? 'Decline reason (required)'
                : 'Cancellation reason (optional)'
            }
            value={reason}
            disabled={action.busy || !!action.attempt}
            onChange={(event) => setReason(event.target.value)}
            required={selected === 'decline'}
          />
        )}
        {action.error != null && <RequestError error={action.error} />}
        <div className="card-actions">
          <Button variant="secondary" disabled={action.busy} onClick={() => setSelected(null)}>
            Go back
          </Button>
          <Button
            disabled={action.busy || !!action.attempt || (selected === 'decline' && !reason.trim())}
            onClick={() => void submit()}
          >
            {action.busy ? 'Updating…' : selected ? labels[selected] : 'Confirm'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
