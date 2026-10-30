import { useState, type FormEvent } from 'react';
import { DatePickerPanel } from './DatePickerPanel';

interface SearchFormProps {
  params: URLSearchParams;
  onSearch: (params: URLSearchParams) => void;
  variant?: 'hero' | 'compact';
}

export function SearchForm({ params, onSearch, variant = 'hero' }: SearchFormProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [city, setCity] = useState(params.get('city') || '');
  const [country, setCountry] = useState(params.get('country') || '');
  const [checkIn, setCheckIn] = useState(params.get('check_in') || '');
  const [checkOut, setCheckOut] = useState(params.get('check_out') || '');
  const [guests, setGuests] = useState(params.get('guests') || '1');

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setShowDatePicker(false);
    const next = new URLSearchParams(params);
    if (city.trim()) next.set('city', city.trim());
    else next.delete('city');
    if (country.trim()) next.set('country', country.trim().toUpperCase());
    else next.delete('country');
    if (checkIn.trim()) next.set('check_in', checkIn.trim());
    else next.delete('check_in');
    if (checkOut.trim()) next.set('check_out', checkOut.trim());
    else next.delete('check_out');
    if (guests && Number(guests) > 0) next.set('guests', guests.trim());
    else next.delete('guests');
    next.delete('offset');
    onSearch(next);
  }

  function formatDisplayDate(iso: string) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
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
    return `${months[d.getMonth()]} ${d.getDate()}`;
  }

  const guestCount = Math.max(1, Math.min(16, Number(guests) || 1));

  return (
    <div
      className={`search-widget-wrapper ${variant === 'compact' ? 'search-widget-wrapper--compact' : ''}`}
    >
      <form className="stayhub-search-bar" onSubmit={handleSubmit} role="search">
        {/* Segment 1: Where */}
        <div className="search-segment search-segment--where">
          <label htmlFor="search-city" className="segment-label">
            <span>WHERE</span>
            <span className="sr-only">Destination</span>
          </label>
          <input
            id="search-city"
            name="city"
            type="text"
            className="segment-input"
            placeholder="Search destinations"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            aria-label="Destination"
            autoComplete="off"
            spellCheck={false}
          />
          {/* Hidden country input for ISO country code if provided */}
          <input
            type="hidden"
            name="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>

        <div className="segment-divider" aria-hidden="true" />

        {/* Segment 2: Check in */}
        <div
          className="search-segment search-segment--checkin"
          onClick={() => setShowDatePicker(true)}
        >
          <label htmlFor="search-in" className="segment-label">
            <span>CHECK IN</span>
            <span className="sr-only">Check-in</span>
          </label>
          <div className="date-input-overlay-wrap">
            <span
              className={`date-display-text ${!checkIn ? 'date-display-text--placeholder' : ''}`}
            >
              {formatDisplayDate(checkIn) || 'Add dates'}
            </span>
            <input
              id="search-in"
              name="check_in"
              type="date"
              min={todayIso}
              className="segment-input segment-input--date segment-input--overlay"
              value={checkIn}
              onChange={(e) => {
                setCheckIn(e.target.value);
                setShowDatePicker(true);
              }}
              aria-label="Check-in"
            />
          </div>
        </div>

        <div className="segment-divider" aria-hidden="true" />

        {/* Segment 3: Check out */}
        <div
          className="search-segment search-segment--checkout"
          onClick={() => setShowDatePicker(true)}
        >
          <label htmlFor="search-out" className="segment-label">
            <span>CHECK OUT</span>
            <span className="sr-only">Checkout</span>
          </label>
          <div className="date-input-overlay-wrap">
            <span
              className={`date-display-text ${!checkOut ? 'date-display-text--placeholder' : ''}`}
            >
              {formatDisplayDate(checkOut) || 'Add dates'}
            </span>
            <input
              id="search-out"
              name="check_out"
              type="date"
              min={checkIn || todayIso}
              className="segment-input segment-input--date segment-input--overlay"
              value={checkOut}
              onChange={(e) => {
                setCheckOut(e.target.value);
                setShowDatePicker(true);
              }}
              aria-label="Checkout"
            />
          </div>
        </div>

        <div className="segment-divider" aria-hidden="true" />

        {/* Segment 4: Who with custom circular - and + side buttons */}
        <div className="search-segment search-segment--who">
          <label htmlFor="search-guests" className="segment-label">
            <span>WHO</span>
            <span className="sr-only">Guests</span>
          </label>
          <div className="who-stepper-row">
            <button
              type="button"
              className="stepper-circle-btn"
              disabled={guestCount <= 1}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setGuests(String(Math.max(1, guestCount - 1)));
              }}
              aria-label="Decrease guests"
            >
              −
            </button>

            <span className="stepper-display-text">
              {guestCount} {guestCount === 1 ? 'guest' : 'guests'}
            </span>

            <button
              type="button"
              className="stepper-circle-btn"
              disabled={guestCount >= 16}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setGuests(String(Math.min(16, guestCount + 1)));
              }}
              aria-label="Increase guests"
            >
              +
            </button>

            {/* Input maintained for form submission & automated tests */}
            <input
              id="search-guests"
              name="guests"
              type="number"
              min="1"
              max="16"
              className="segment-input segment-input--hidden-number"
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              aria-label="Guests"
            />
          </div>
        </div>

        {/* Search Submit Button */}
        <button
          type="submit"
          className="search-submit-button"
          aria-label="Search stays"
          title="Search stays"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="sr-only">Search stays</span>
        </button>
      </form>

      {/* Date Picker Popover Panel */}
      {showDatePicker && (
        <div className="search-datepicker-popover">
          <DatePickerPanel
            checkIn={checkIn}
            checkOut={checkOut}
            onChange={(inDate, outDate) => {
              setCheckIn(inDate);
              setCheckOut(outDate);
            }}
            onClose={() => setShowDatePicker(false)}
          />
        </div>
      )}
    </div>
  );
}
