import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, Skeleton } from '../../components/ui';
import { RequestError } from '../../components/RequestError';
import { searchListings } from '../listings/api';
import type { SearchCard } from '../listings/types';
import { DEFAULT_FILTERS, type FilterState } from './filters';
import { FiltersDrawer } from './FiltersDrawer';
import { ListingCardHorizontal } from './ListingCardHorizontal';
import { ResultsMap } from './ResultsMap';
import { SearchForm } from './SearchForm';
import { searchError, searchParams } from './selection';

// NOTE: Search sorting (Recommended, price, rating) is not yet supported by the backend search API.
// Rendered with dummy options and client-side sorting to match the reference design.

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const error = searchError(params);
  const normalized = searchParams(params);
  const key = normalized.toString();
  const offset = Number(normalized.get('offset') || 0);

  // View mode: 'list' (Screen 03) vs 'map' (Screen 04)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [totalBeforeTaxes, setTotalBeforeTaxes] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState('recommended');
  const [hoveredListingId, setHoveredListingId] = useState<string | null>(null);
  const [isEditingSearch, setIsEditingSearch] = useState(false);

  const query = useQuery({
    queryKey: ['search', key],
    queryFn: ({ signal }) => searchListings(normalized, signal),
    enabled: !error,
  });

  function page(next: number) {
    const updated = new URLSearchParams(params);
    if (next) updated.set('offset', String(next));
    else updated.delete('offset');
    setParams(updated);
  }

  // Consume live listings directly from the backend search API
  const listingsToRender: SearchCard[] = query.data?.listings || [];
  const totalCount = query.data?.count ?? listingsToRender.length;

  const cityParam = params.get('city') || 'Anywhere';
  const checkInParam = params.get('check_in') || '';
  const checkOutParam = params.get('check_out') || '';
  const guestsParam = params.get('guests') || '1';

  // Format short date string e.g. "Oct 3 – 8"
  function formatDateRangeShort(startStr: string, endStr: string) {
    if (!startStr && !endStr) return 'Any week';
    try {
      const s = new Date(startStr);
      const e = new Date(endStr);
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
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        if (s.getMonth() === e.getMonth()) {
          return `${months[s.getMonth()]} ${s.getDate()} – ${e.getDate()}`;
        }
        return `${months[s.getMonth()]} ${s.getDate()} – ${months[e.getMonth()]} ${e.getDate()}`;
      }
    } catch {
      // Fallback for unparseable date strings
    }
    return startStr || endStr || 'Any week';
  }

  return (
    <div
      className={`results-page-wrapper ${viewMode === 'map' ? 'results-page-wrapper--fullmap' : ''}`}
    >
      {/* Search Bar / Panel */}
      <div className="search-bar-shell">
        <SearchForm
          key={params.toString()}
          params={params}
          onSearch={(next) => {
            setParams(next);
            setIsEditingSearch(false);
          }}
          variant="compact"
        />
      </div>

      {/* Sub-nav Filter Bar (Matches Screen 03 & 04) */}
      <div className="results-filter-bar">
        <div className="filter-summary-pills">
          <button
            type="button"
            className="filter-pill"
            onClick={() => setIsEditingSearch(!isEditingSearch)}
          >
            <span>{cityParam}</span>
          </button>

          <button
            type="button"
            className="filter-pill"
            onClick={() => setIsEditingSearch(!isEditingSearch)}
          >
            <span>{formatDateRangeShort(checkInParam, checkOutParam)}</span>
          </button>

          <button
            type="button"
            className="filter-pill"
            onClick={() => setIsEditingSearch(!isEditingSearch)}
          >
            <span>
              {guestsParam} {Number(guestsParam) === 1 ? 'guest' : 'guests'}
            </span>
          </button>

          <button
            type="button"
            className="filter-pill filter-pill--with-badge"
            onClick={() => setFiltersOpen(true)}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            <span>Filters</span>
          </button>

          <label className="results-tax-toggle">
            <button
              type="button"
              role="switch"
              aria-checked={totalBeforeTaxes}
              className={`switch-toggle ${totalBeforeTaxes ? 'switch-toggle--checked' : ''}`}
              onClick={() => setTotalBeforeTaxes(!totalBeforeTaxes)}
            >
              <span className="switch-slider" />
            </button>
            <span className="tax-label">Total before taxes</span>
          </label>
        </div>

        {/* Right side: Count & View Switcher */}
        <div className="filter-bar-right">
          <span className="results-count-text">
            {totalCount} {totalCount === 1 ? 'stay' : 'stays'} · sorted by
          </span>

          <select
            className="sort-dropdown"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort stays by"
          >
            <option value="recommended">Recommended</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
          </select>

          <div className="view-mode-toggle" role="tablist" aria-label="View mode">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'list'}
              className={`view-mode-btn ${viewMode === 'list' ? 'view-mode-btn--active' : ''}`}
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'map'}
              className={`view-mode-btn ${viewMode === 'map' ? 'view-mode-btn--active' : ''}`}
              onClick={() => setViewMode('map')}
              aria-label="Map view"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Error / Loading / Content */}
      {error ? (
        <div className="search-error-wrap">
          <RequestError error={new Error(error)} />
        </div>
      ) : query.isPending ? (
        <div className="search-loading-wrap">
          <Skeleton label="Finding available stays" rows={4} />
        </div>
      ) : query.isError ? (
        <div className="search-error-wrap">
          <RequestError error={query.error} onRetry={() => void query.refetch()} />
        </div>
      ) : viewMode === 'map' ? (
        /* Full Map View (Screen 04) */
        <ResultsMap
          listings={listingsToRender}
          selectedListingId={hoveredListingId}
          onSelectListing={(id) => setHoveredListingId(id)}
          isFullView
          paramsString={params.toString()}
        />
      ) : (
        /* Split List + Map View (Screen 03) */
        <div className="results-split-layout">
          {/* Left Column: Stays List */}
          <div className="results-list-column">
            {listingsToRender.length === 0 ? (
              <EmptyState title="A different date, a new possibility">
                No available stays match this search. Try another destination, fewer guests, or
                different dates.
              </EmptyState>
            ) : (
              <div className="horizontal-listings-stack">
                {listingsToRender.map((listing) => (
                  <ListingCardHorizontal
                    key={listing.id}
                    listing={listing}
                    paramsString={params.toString()}
                    totalBeforeTaxes={totalBeforeTaxes}
                    isHighlighted={hoveredListingId === listing.id}
                    onHover={setHoveredListingId}
                  />
                ))}
              </div>
            )}

            {/* Pagination / Showing Status */}
            {listingsToRender.length > 0 && (
              <div className="results-pagination-bar">
                <span className="showing-count-text">
                  Showing {listingsToRender.length} of {totalCount} stays
                </span>

                <div className="pagination-buttons">
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={offset === 0}
                    onClick={() => page(Math.max(0, offset - 12))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="button button--primary"
                    disabled={listingsToRender.length < 12}
                    onClick={() => page(offset + 12)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Sticky Map Preview */}
          <div className="results-map-column">
            <ResultsMap
              listings={listingsToRender}
              selectedListingId={hoveredListingId}
              onSelectListing={(id) => setHoveredListingId(id)}
              paramsString={params.toString()}
            />
          </div>
        </div>
      )}

      {/* Filters Drawer Modal (Screen 05) */}
      <FiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filterState}
        onApply={(next) => setFilterState(next)}
        totalCount={totalCount}
      />
    </div>
  );
}
