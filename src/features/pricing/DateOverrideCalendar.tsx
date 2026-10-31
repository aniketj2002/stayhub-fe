import { useMemo, useState } from 'react';
import { useDateOverrides, useSetDateOverrides, useDeleteDateOverrides } from './api';
import { Button, Field, RequestError, Spinner } from '../../components/ui';

interface Props {
  listingId: string;
  basePriceMinor?: number;
  weekendPriceMinor?: number | null;
  currency?: string;
}

export function DateOverrideCalendar({
  listingId,
  basePriceMinor = 10000,
  weekendPriceMinor,
  currency: _currency = 'EUR',
}: Props) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const fromIso = firstDayOfMonth.toISOString().slice(0, 10);
  const toIso = lastDayOfMonth.toISOString().slice(0, 10);

  const { data: overrides, isLoading, error, refetch } = useDateOverrides(listingId, fromIso, toIso);
  const setOverridesMutation = useSetDateOverrides();
  const deleteOverridesMutation = useDeleteDateOverrides();

  // Selection range
  const [selectionStart, setSelectionStart] = useState<string | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<string | null>(null);

  // Form controls
  const [overridePriceEuros, setOverridePriceEuros] = useState('');
  const [overrideMinNights, setOverrideMinNights] = useState('');
  const [actionError, setActionError] = useState('');

  // Map of overrides for rapid lookup
  const overrideMap = useMemo(() => {
    const map = new Map<string, { price_minor: number; min_nights?: number | null }>();
    (overrides || []).forEach((ov) => {
      map.set(ov.night.slice(0, 10), { price_minor: ov.price_minor, min_nights: ov.min_nights });
    });
    return map;
  }, [overrides]);

  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0

  const handleDayClick = (isoString: string) => {
    setActionError('');
    if (!selectionStart || (selectionStart && selectionEnd)) {
      setSelectionStart(isoString);
      setSelectionEnd(null);
    } else {
      if (isoString < selectionStart) {
        setSelectionEnd(selectionStart);
        setSelectionStart(isoString);
      } else {
        setSelectionEnd(isoString);
      }
    }
  };

  const handleApplyOverride = async () => {
    if (!selectionStart) return;
    const from = selectionStart;
    const to = selectionEnd || selectionStart;

    const price = parseFloat(overridePriceEuros);
    if (isNaN(price) || price < 0) {
      setActionError('Please enter a valid non-negative price.');
      return;
    }

    const minNights = overrideMinNights ? parseInt(overrideMinNights, 10) : undefined;
    if (minNights !== undefined && (isNaN(minNights) || minNights < 1)) {
      setActionError('Minimum nights must be at least 1.');
      return;
    }

    await setOverridesMutation.mutateAsync({
      listingId,
      input: {
        from,
        to,
        price_minor: Math.round(price * 100),
        min_nights: minNights,
      },
    });

    setSelectionStart(null);
    setSelectionEnd(null);
    setOverridePriceEuros('');
    setOverrideMinNights('');
  };

  const handleClearOverride = async () => {
    if (!selectionStart) return;
    const from = selectionStart;
    const to = selectionEnd || selectionStart;

    await deleteOverridesMutation.mutateAsync({
      listingId,
      input: { from, to },
    });

    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="date-override-calendar">
      <div className="date-override-header">
        <div>
          <h2>Custom Date Price Overrides</h2>
          <p className="date-override-subtitle">
            Click a date or range to adjust custom nightly prices and minimum stays.
          </p>
        </div>
        <div className="calendar-nav-controls">
          <Button
            variant="ghost"
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            aria-label="Previous month"
          >
            ← Prev
          </Button>
          <span className="calendar-month-title">{monthName}</span>
          <Button
            variant="ghost"
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            aria-label="Next month"
          >
            Next →
          </Button>
        </div>
      </div>

      {error && <RequestError error={error} onRetry={() => void refetch()} />}
      {actionError && <p className="field-error" role="alert">{actionError}</p>}

      {isLoading ? (
        <div className="calendar-loading">
          <Spinner label="Loading calendar pricing…" />
        </div>
      ) : (
        <div className="calendar-grid-container">
          {/* Day of Week Headers */}
          <div className="calendar-weekdays-row">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <span key={day} className="calendar-weekday-label">
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="calendar-days-grid" role="grid" aria-label="Pricing calendar">
            {Array.from({ length: startingDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="calendar-day-cell calendar-day-cell--empty" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateObj = new Date(year, month, dayNum);
              const iso = dateObj.toISOString().slice(0, 10);
              const dayOfWeek = (dateObj.getDay() + 6) % 7; // 4=Fri, 5=Sat
              const isWeekend = dayOfWeek === 4 || dayOfWeek === 5;

              const customOverride = overrideMap.get(iso);
              const effectivePriceMinor = customOverride
                ? customOverride.price_minor
                : isWeekend && weekendPriceMinor
                  ? weekendPriceMinor
                  : basePriceMinor;

              const isSelected =
                (selectionStart === iso) ||
                (selectionEnd === iso) ||
                (selectionStart && selectionEnd && iso >= selectionStart && iso <= selectionEnd);

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => handleDayClick(iso)}
                  className={`calendar-day-cell ${isSelected ? 'calendar-day-cell--selected' : ''} ${
                    customOverride ? 'calendar-day-cell--override' : isWeekend ? 'calendar-day-cell--weekend' : ''
                  }`}
                  aria-label={`${iso}: €${(effectivePriceMinor / 100).toFixed(0)}`}
                >
                  <span className="calendar-day-number">{dayNum}</span>
                  <span className="calendar-day-price">
                    €{(effectivePriceMinor / 100).toFixed(0)}
                  </span>
                  {customOverride && <span className="calendar-override-dot" title="Custom override" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Override Action Bar */}
      {selectionStart && (
        <div className="calendar-override-action-panel">
          <div className="override-range-indicator">
            Selected Range: <strong>{selectionStart}</strong>
            {selectionEnd && selectionEnd !== selectionStart ? ` → ${selectionEnd}` : ''}
          </div>

          <div className="override-inputs-row">
            <div className="field">
              <Field
                id="override-price-input"
                label="Custom Price (€)"
                type="number"
                step="1"
                min="0"
                placeholder="e.g. 150"
                value={overridePriceEuros}
                onChange={(e) => setOverridePriceEuros(e.target.value)}
              />
            </div>

            <div className="field">
              <Field
                id="override-min-nights-input"
                label="Min Nights (Optional)"
                type="number"
                min="1"
                placeholder="Default"
                value={overrideMinNights}
                onChange={(e) => setOverrideMinNights(e.target.value)}
              />
            </div>

            <div className="override-btns">
              <Button
                variant="primary"
                onClick={handleApplyOverride}
                disabled={!overridePriceEuros || setOverridesMutation.isPending}
              >
                {setOverridesMutation.isPending ? 'Applying…' : 'Apply Price'}
              </Button>
              <Button
                variant="secondary"
                className="button--danger"
                onClick={handleClearOverride}
                disabled={deleteOverridesMutation.isPending}
              >
                Clear Custom Price
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectionStart(null);
                  setSelectionEnd(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
