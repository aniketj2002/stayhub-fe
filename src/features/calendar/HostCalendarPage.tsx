import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Button, Field, Skeleton, SuccessNotice } from '../../components/ui';
import { RequestError } from '../../components/RequestError';
import { hasListingPermission } from '../auth/permissions';
import { changeCalendar, getCalendar, hostListing, listingKeys } from '../listings/api';
import { addDays, dateRangeError, isoDay, monthStart, shiftMonth } from './dates';
import { MonthGrid } from './MonthGrid';

export function HostCalendarPage() {
  const { id = '' } = useParams();
  const [month, setMonth] = useState(() => monthStart(isoDay(new Date())));
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const cache = useQueryClient();
  const detail = useQuery({
    queryKey: listingKeys.detail(id),
    queryFn: ({ signal }) => hostListing(id, signal),
  });
  const calendar = useQuery({
    queryKey: ['calendar', id, month],
    queryFn: ({ signal }) => getCalendar(id, month, shiftMonth(month, 1), signal),
  });
  const allowed = hasListingPermission(detail.data?.host_access, 'can_manage_calendar');
  async function change(block: boolean) {
    const validation = dateRangeError(start, end);
    if (validation) {
      setError(new Error(validation));
      return;
    }
    if (!allowed || busy) return;
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      // Fetch the entire selection, including nights outside the displayed month.
      const current = await getCalendar(id, start, end);
      if (current.nights.some((night) => night.status === 'booked'))
        throw new Error(
          'This selection includes booked nights. Choose a range without reservations.',
        );
      await changeCalendar(id, start, end, block, reason);
      setNotice(block ? 'Selected nights are blocked.' : 'Selected nights are available again.');
    } catch (e) {
      setError(e);
    } finally {
      await cache.invalidateQueries({ queryKey: ['calendar', id] });
      void cache.invalidateQueries({ queryKey: ['search'] });
      void cache.invalidateQueries({ queryKey: listingKeys.public(id) });
      setBusy(false);
    }
  }
  function select(day: string) {
    setNotice('');
    setError(null);
    if (!start || end || day < start) {
      setStart(day);
      setEnd('');
    } else {
      setEnd(addDays(day, 1));
    }
  }
  return (
    <section className="page-content calendar-page">
      <Link className="text-link" to="/host/listings">
        ← Your listings
      </Link>
      <div className="page-heading">
        <p className="eyebrow">OPEN DOORS, ON YOUR TERMS</p>
        <h1>Your availability</h1>
        <p>
          {detail.data?.working_version?.title ||
            detail.data?.live_version?.title ||
            'Manage the nights guests can book.'}
        </p>
      </div>
      {detail.isPending ? (
        <Skeleton label="Loading listing permissions" />
      ) : detail.isError ? (
        <RequestError error={detail.error} onRetry={() => void detail.refetch()} />
      ) : (
        <>
          {!allowed && (
            <SuccessNotice>
              You can view this calendar. Your listing permissions do not allow changes.
            </SuccessNotice>
          )}
          {calendar.isPending ? (
            <Skeleton label="Loading availability" />
          ) : calendar.isError ? (
            <RequestError error={calendar.error} onRetry={() => void calendar.refetch()} />
          ) : (
            <MonthGrid
              month={month}
              nights={calendar.data.nights || []}
              onMonth={setMonth}
              onSelect={select}
              selectedStart={start}
              selectedEnd={end}
              readOnly={!allowed}
              busy={busy}
            />
          )}
          {error != null && <RequestError error={error} />}
          {notice && <SuccessNotice>{notice}</SuccessNotice>}
          {allowed && (
            <form
              className="calendar-selection"
              onSubmit={(event) => {
                event.preventDefault();
                void change(true);
              }}
            >
              <fieldset disabled={busy || calendar.isPending || calendar.isError}>
                <h2>Choose a date range</h2>
                <p>
                  Click the first and last night above, or enter dates. The end date is exclusive.
                  Booked nights cannot be changed.
                </p>
                <div className="form-grid">
                  <Field
                    id="calendar-start"
                    label="First night"
                    type="date"
                    value={start}
                    required
                    onChange={(event) => {
                      setStart(event.target.value);
                      setNotice('');
                    }}
                  />
                  <Field
                    id="calendar-end"
                    label="End date (not included)"
                    type="date"
                    value={end}
                    required
                    min={start ? addDays(start, 1) : undefined}
                    onChange={(event) => {
                      setEnd(event.target.value);
                      setNotice('');
                    }}
                  />
                </div>
                <Field
                  id="block-reason"
                  label="Block reason (optional)"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <div className="card-actions">
                  <Button type="submit" disabled={!start || !end}>
                    {busy ? 'Updating…' : 'Block nights'}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!start || !end}
                    onClick={() => void change(false)}
                  >
                    Unblock nights
                  </Button>
                </div>
              </fieldset>
            </form>
          )}
          <Link className="text-link" to={`/host/listings/${id}/edit`}>
            Edit listing ↗
          </Link>
        </>
      )}
    </section>
  );
}
