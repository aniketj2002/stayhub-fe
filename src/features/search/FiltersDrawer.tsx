import { useState } from 'react';
import type { FilterState } from './filters';

// NOTE: Price distribution histogram data is not yet computed or returned by the backend API.
// This component renders a dummy frequency distribution graph based on the price range to match the reference design.
// Once the backend exposes price distribution metrics, it will consume live bucket data.

// Dummy price histogram bar heights (0 to 100%)
const HISTOGRAM_BARS = [
  8, 14, 25, 45, 60, 85, 95, 100, 90, 82, 70, 58, 48, 62, 50, 42, 35, 28, 22, 16, 12, 8, 5,
];

interface FiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (next: FilterState) => void;
  totalCount?: number;
}

export function FiltersDrawer({
  open,
  onClose,
  filters: initialFilters,
  onApply,
  totalCount = 68,
}: FiltersDrawerProps) {
  const [draft, setDraft] = useState<FilterState>(initialFilters);

  if (!open) return null;

  function toggleAmenity(code: string) {
    setDraft((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(code)
        ? prev.amenities.filter((c) => c !== code)
        : [...prev.amenities, code],
    }));
  }

  function handleClearAll() {
    setDraft({
      placeType: 'any',
      minPrice: 20,
      maxPrice: 400,
      bedrooms: null,
      beds: null,
      amenities: [],
      guestFavorite: false,
      superhost: false,
      instantBook: false,
    });
  }

  return (
    <div
      className="filter-drawer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-title"
    >
      <div className="filter-drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="filter-drawer-header">
          <h2 id="filter-title">Filters</h2>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Close filters"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="filter-drawer-content">
          {/* Section: Type of Place */}
          <section className="filter-section">
            <h3 className="filter-section-title">TYPE OF PLACE</h3>
            <div className="segmented-control" role="radiogroup" aria-label="Type of place">
              {[
                { id: 'any', label: 'Any' },
                { id: 'entire_home', label: 'Entire home' },
                { id: 'room', label: 'Room' },
                { id: 'shared', label: 'Shared' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={draft.placeType === item.id}
                  className={`segmented-item ${draft.placeType === item.id ? 'segmented-item--active' : ''}`}
                  onClick={() => setDraft((prev) => ({ ...prev, placeType: item.id }))}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          {/* Section: Price Per Night */}
          <section className="filter-section">
            <h3 className="filter-section-title">PRICE PER NIGHT · BEFORE TAXES</h3>

            {/* Histogram graph */}
            <div className="price-histogram" aria-hidden="true">
              {HISTOGRAM_BARS.map((height, i) => {
                const stepPrice = 20 + (i / (HISTOGRAM_BARS.length - 1)) * (400 - 20);
                const isInSelectedRange =
                  stepPrice >= draft.minPrice && stepPrice <= draft.maxPrice;
                return (
                  <div
                    key={i}
                    className={`histogram-bar ${isInSelectedRange ? 'histogram-bar--selected' : ''}`}
                    style={{ height: `${height}%` }}
                  />
                );
              })}
            </div>

            {/* Slider / Range */}
            <div className="price-range-slider">
              <input
                type="range"
                min="20"
                max="400"
                step="5"
                value={draft.minPrice}
                onChange={(e) => {
                  const val = Math.min(Number(e.target.value), draft.maxPrice - 10);
                  setDraft((prev) => ({ ...prev, minPrice: val }));
                }}
                aria-label="Minimum price"
              />
              <input
                type="range"
                min="20"
                max="400"
                step="5"
                value={draft.maxPrice}
                onChange={(e) => {
                  const val = Math.max(Number(e.target.value), draft.minPrice + 10);
                  setDraft((prev) => ({ ...prev, maxPrice: val }));
                }}
                aria-label="Maximum price"
              />
            </div>

            <div className="price-range-inputs">
              <div className="price-field">
                <span className="price-field-label">MINIMUM</span>
                <div className="price-input-wrap">
                  <span className="currency-prefix">€</span>
                  <input
                    type="number"
                    value={draft.minPrice}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, minPrice: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>
              <div className="price-field">
                <span className="price-field-label">MAXIMUM</span>
                <div className="price-input-wrap">
                  <span className="currency-prefix">€</span>
                  <input
                    type="number"
                    value={draft.maxPrice}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, maxPrice: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section: Rooms and Beds */}
          <section className="filter-section">
            <h3 className="filter-section-title">ROOMS AND BEDS</h3>

            <div className="stepper-row">
              <span className="stepper-label">Bedrooms</span>
              <div className="stepper-controls">
                <button
                  type="button"
                  className="stepper-btn"
                  disabled={draft.bedrooms === null || draft.bedrooms <= 0}
                  onClick={() =>
                    setDraft((p) => ({
                      ...p,
                      bedrooms: p.bedrooms && p.bedrooms > 1 ? p.bedrooms - 1 : null,
                    }))
                  }
                  aria-label="Decrease bedrooms"
                >
                  −
                </button>
                <span className="stepper-val">{draft.bedrooms ? draft.bedrooms : 'Any'}</span>
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => setDraft((p) => ({ ...p, bedrooms: (p.bedrooms || 0) + 1 }))}
                  aria-label="Increase bedrooms"
                >
                  +
                </button>
              </div>
            </div>

            <div className="stepper-row">
              <span className="stepper-label">Beds</span>
              <div className="stepper-controls">
                <button
                  type="button"
                  className="stepper-btn"
                  disabled={draft.beds === null || draft.beds <= 1}
                  onClick={() =>
                    setDraft((p) => ({
                      ...p,
                      beds: p.beds && p.beds > 1 ? p.beds - 1 : null,
                    }))
                  }
                  aria-label="Decrease beds"
                >
                  −
                </button>
                <span className="stepper-val">{draft.beds ? draft.beds : 'Any'}</span>
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => setDraft((p) => ({ ...p, beds: (p.beds || 0) + 1 }))}
                  aria-label="Increase beds"
                >
                  +
                </button>
              </div>
            </div>
          </section>

          {/* Section: Amenities */}
          <section className="filter-section">
            <h3 className="filter-section-title">AMENITIES</h3>
            <div className="amenities-checkbox-grid">
              {[
                { code: 'wifi', label: 'Wifi', icon: '📶' },
                { code: 'free_parking', label: 'Free parking', icon: '🚗' },
                { code: 'air_conditioning', label: 'Air conditioning', icon: '❄️' },
                { code: 'kitchen', label: 'Kitchen', icon: '🍳' },
                { code: 'pool', label: 'Pool', icon: '🏊' },
                { code: 'self_check_in', label: 'Self check-in', icon: '🔑' },
              ].map((item) => {
                const checked = draft.amenities.includes(item.code);
                return (
                  <label key={item.code} className="checkbox-tile">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAmenity(item.code)}
                    />
                    <span className="checkbox-icon">{item.icon}</span>
                    <span className="checkbox-name">{item.label}</span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Section: Standout Stays */}
          <section className="filter-section">
            <h3 className="filter-section-title">STANDOUT STAYS</h3>
            <div className="standout-chips">
              <button
                type="button"
                className={`standout-chip ${draft.guestFavorite ? 'standout-chip--active' : ''}`}
                onClick={() => setDraft((p) => ({ ...p, guestFavorite: !p.guestFavorite }))}
              >
                <span className="chip-icon">★</span>
                <span>Guest favorite</span>
              </button>

              <button
                type="button"
                className={`standout-chip ${draft.superhost ? 'standout-chip--active' : ''}`}
                onClick={() => setDraft((p) => ({ ...p, superhost: !p.superhost }))}
              >
                <span className="chip-icon">🛡</span>
                <span>Superhost</span>
              </button>

              <button
                type="button"
                className={`standout-chip ${draft.instantBook ? 'standout-chip--active' : ''}`}
                onClick={() => setDraft((p) => ({ ...p, instantBook: !p.instantBook }))}
              >
                <span className="chip-icon">⚡</span>
                <span>Instant book</span>
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="filter-drawer-footer">
          <button type="button" className="clear-link-btn" onClick={handleClearAll}>
            Clear all
          </button>
          <button
            type="button"
            className="button button--primary apply-filter-btn"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            Show {totalCount} stays
          </button>
        </div>
      </div>
    </div>
  );
}
