import { useState } from 'react';

// NOTE: Date flexibility (± 1 day, ± 2 days, ± 3 days, ± 7 days, Months, Flexible) is a frontend search UX helper.
// The backend currently only accepts exact check_in and check_out date strings (YYYY-MM-DD).
// This component renders the interactive dual-month datepicker and flexibility options to match the reference design.

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface DatePickerPanelProps {
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
  onClose?: () => void;
}

export function DatePickerPanel({ checkIn, checkOut, onChange, onClose }: DatePickerPanelProps) {
  const [activeTab, setActiveTab] = useState<'dates' | 'months' | 'flexible'>('dates');
  const [flexibility, setFlexibility] = useState<string>('exact');

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Parse check-in / check-out or default to current date
  const initialDate = checkIn ? new Date(checkIn + 'T00:00:00') : today;
  const [viewYear, setViewYear] = useState(() =>
    isNaN(initialDate.getTime()) ? today.getFullYear() : initialDate.getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(() =>
    isNaN(initialDate.getTime()) ? today.getMonth() : initialDate.getMonth(),
  );

  // Next month
  const nextMonthYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;

  function handleDateClick(isoString: string) {
    // Prevent selecting past dates
    if (isoString < todayIso) return;

    if (!checkIn || (checkIn && checkOut)) {
      onChange(isoString, '');
    } else if (checkIn && !checkOut) {
      if (isoString < checkIn) {
        onChange(isoString, '');
      } else {
        onChange(checkIn, isoString);
        // Auto-close calendar when both check-in and checkout dates are chosen
        if (onClose) {
          onClose();
        }
      }
    }
  }

  function formatDisplayDate(iso: string) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  }

  const nights =
    checkIn && checkOut
      ? Math.max(
          1,
          Math.round(
            (new Date(checkOut + 'T00:00:00').getTime() -
              new Date(checkIn + 'T00:00:00').getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;

  return (
    <div className="datepicker-panel" role="region" aria-label="Select dates">
      {/* Top tabs: Dates, Months, Flexible */}
      <div className="datepicker-tabs-row">
        <div className="datepicker-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'dates'}
            className={`datepicker-tab ${activeTab === 'dates' ? 'datepicker-tab--active' : ''}`}
            onClick={() => setActiveTab('dates')}
          >
            Dates
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'months'}
            className={`datepicker-tab ${activeTab === 'months' ? 'datepicker-tab--active' : ''}`}
            onClick={() => setActiveTab('months')}
          >
            Months
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'flexible'}
            className={`datepicker-tab ${activeTab === 'flexible' ? 'datepicker-tab--active' : ''}`}
            onClick={() => setActiveTab('flexible')}
          >
            Flexible
          </button>
        </div>
        {onClose && (
          <button
            type="button"
            className="datepicker-close-btn"
            onClick={onClose}
            aria-label="Close datepicker"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dual Month Calendar */}
      <div className="datepicker-calendars">
        <CalendarMonth
          year={viewYear}
          month={viewMonth}
          checkIn={checkIn}
          checkOut={checkOut}
          todayIso={todayIso}
          onSelectDate={handleDateClick}
          onPrev={() => {
            if (viewMonth === 0) {
              setViewMonth(11);
              setViewYear((y) => y - 1);
            } else {
              setViewMonth((m) => m - 1);
            }
          }}
          showPrev
        />
        <CalendarMonth
          year={nextMonthYear}
          month={nextMonth}
          checkIn={checkIn}
          checkOut={checkOut}
          todayIso={todayIso}
          onSelectDate={handleDateClick}
          onNext={() => {
            if (viewMonth === 11) {
              setViewMonth(0);
              setViewYear((y) => y + 1);
            } else {
              setViewMonth((m) => m + 1);
            }
          }}
          showNext
        />
      </div>

      {/* Date flexibility chips & Summary */}
      <div className="datepicker-footer">
        <div className="flexibility-chips">
          {[
            { id: 'exact', label: 'Exact dates' },
            { id: '1day', label: '± 1 day' },
            { id: '2days', label: '± 2 days' },
            { id: '3days', label: '± 3 days' },
            { id: '7days', label: '± 7 days' },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`flex-chip ${flexibility === chip.id ? 'flex-chip--active' : ''}`}
              onClick={() => setFlexibility(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="datepicker-summary">
          {checkIn && checkOut ? (
            <span>
              <strong>{nights} nights</strong> · {formatDisplayDate(checkIn)} –{' '}
              {formatDisplayDate(checkOut)}
            </span>
          ) : checkIn ? (
            <span>Check-in: {formatDisplayDate(checkIn)} — Select checkout date</span>
          ) : (
            <span>Select check-in and checkout dates</span>
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarMonth({
  year,
  month,
  checkIn,
  checkOut,
  todayIso,
  onSelectDate,
  onPrev,
  onNext,
  showPrev = false,
  showNext = false,
}: {
  year: number;
  month: number;
  checkIn: string;
  checkOut: string;
  todayIso: string;
  onSelectDate: (iso: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  showPrev?: boolean;
  showNext?: boolean;
}) {
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <div className="calendar-month-view">
      <div className="calendar-month-header">
        {showPrev && (
          <button
            type="button"
            className="cal-nav-btn"
            onClick={onPrev}
            aria-label="Previous month"
          >
            ‹
          </button>
        )}
        <h3 className="cal-month-title">
          {MONTH_NAMES[month]} {year}
        </h3>
        {showNext && (
          <button type="button" className="cal-nav-btn" onClick={onNext} aria-label="Next month">
            ›
          </button>
        )}
      </div>

      <div className="cal-weekdays-grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="cal-weekday">
            {w}
          </span>
        ))}
      </div>

      <div className="cal-days-grid">
        {Array.from({ length: firstDayIndex }).map((_, i) => (
          <span key={`empty-${i}`} className="cal-day-cell cal-day-cell--empty" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const mm = String(month + 1).padStart(2, '0');
          const dd = String(day).padStart(2, '0');
          const iso = `${year}-${mm}-${dd}`;
          const isCheckIn = checkIn === iso;
          const isCheckOut = checkOut === iso;
          const isInRange = checkIn && checkOut && iso > checkIn && iso < checkOut;
          const isPast = iso < todayIso;

          let cellClass = 'cal-day-cell';
          if (isCheckIn) cellClass += ' cal-day-cell--checkin';
          if (isCheckOut) cellClass += ' cal-day-cell--checkout';
          if (isInRange) cellClass += ' cal-day-cell--in-range';
          if (isPast) cellClass += ' cal-day-cell--past';

          return (
            <button
              key={iso}
              type="button"
              className={cellClass}
              onClick={() => onSelectDate(iso)}
              aria-label={iso}
              disabled={isPast}
              aria-disabled={isPast}
            >
              <span>{day}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
