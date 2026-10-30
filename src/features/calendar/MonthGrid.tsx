import { Button } from '../../components/ui';
import type { Night } from '../listings/types';
import { addDays, shiftMonth } from './dates';

export function MonthGrid({
  month,
  nights,
  onMonth,
  onSelect,
  selectedStart = '',
  selectedEnd = '',
  readOnly = false,
  busy = false,
  complete = true,
}: {
  month: string;
  nights: Night[];
  onMonth: (month: string) => void;
  onSelect?: (day: string) => void;
  selectedStart?: string;
  selectedEnd?: string;
  readOnly?: boolean;
  busy?: boolean;
  complete?: boolean;
}) {
  const next = shiftMonth(month, 1);
  const days: string[] = [];
  for (let day = month; day < next; day = addDays(day, 1)) days.push(day);
  const statuses = new Map(nights.map((entry) => [entry.night, entry.status]));
  const pad = (new Date(`${month}T00:00:00Z`).getUTCDay() + 6) % 7;
  const title = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}T00:00:00Z`));
  return (
    <div className="month-calendar">
      <div className="heading-row">
        <Button
          variant="ghost"
          disabled={busy}
          aria-label="Previous month"
          onClick={() => onMonth(shiftMonth(month, -1))}
        >
          ←
        </Button>
        <h3 aria-live="polite">{title}</h3>
        <Button
          variant="ghost"
          disabled={busy}
          aria-label="Next month"
          onClick={() => onMonth(next)}
        >
          →
        </Button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-days" aria-label={title}>
        {Array.from({ length: pad }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {days.map((day) => {
          const status = statuses.get(day) || (complete ? 'available' : 'not marked unavailable');
          const selected = (day >= selectedStart && day < selectedEnd) || day === selectedStart;
          return (
            <button
              type="button"
              key={day}
              className={`calendar-day calendar-day--${statuses.get(day) || 'available'} ${selected ? 'selected' : ''}`}
              disabled={busy || readOnly || status === 'booked'}
              aria-pressed={selected}
              aria-label={`${day}, ${status}`}
              onClick={() => onSelect?.(day)}
            >
              <span>{Number(day.slice(-2))}</span>
              <small>
                {status === 'booked' ? 'Booked' : status === 'blocked' ? 'Blocked' : ''}
              </small>
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">
        <span>○ Available{complete ? '' : ' subject to quote'}</span>
        <span>▨ Blocked</span>
        <span>● Booked</span>
      </div>
    </div>
  );
}
