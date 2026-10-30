import { type ReactNode } from 'react';

// NOTE: Category tagging (Homes, Beachfront, Amazing views, Cabins, Design, Farms, Tiny homes, Pools, Off-grid, Historic)
// is not yet stored in the backend schema or accepted by the search API (/api/v1/listings/search).
// This component renders the interactive category filter strip matching the reference design.
// When backend category parameters are supported, this component will bind directly to search queries.

export interface CategoryItem {
  id: string;
  label: string;
  icon: ReactNode;
}

const CATEGORIES: CategoryItem[] = [
  {
    id: 'homes',
    label: 'Homes',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'beachfront',
    label: 'Beachfront',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 12c1.5-1 3.5-1 5 0 1.5 1 3.5 1 5 0 1.5-1 3.5-1 5 0 1.5 1 3.5 1 5 0" />
        <path d="M2 17c1.5-1 3.5-1 5 0 1.5 1 3.5 1 5 0 1.5-1 3.5-1 5 0 1.5 1 3.5 1 5 0" />
      </svg>
    ),
  },
  {
    id: 'amazing_views',
    label: 'Amazing views',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
      </svg>
    ),
  },
  {
    id: 'cabins',
    label: 'Cabins',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3 4 19h16L12 3z" />
        <path d="M12 9v10" />
      </svg>
    ),
  },
  {
    id: 'design',
    label: 'Design',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14" />
      </svg>
    ),
  },
  {
    id: 'farms',
    label: 'Farms',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
      </svg>
    ),
  },
  {
    id: 'tiny_homes',
    label: 'Tiny homes',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="18" height="12" x="3" y="7" rx="2" />
        <path d="M3 13h18" />
      </svg>
    ),
  },
  {
    id: 'pools',
    label: 'Pools',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="6" r="3" />
        <path d="M4 17c2-1 4-1 6 0s4 1 6 0 4-1 4 0" />
        <path d="M4 21c2-1 4-1 6 0s4 1 6 0 4-1 4 0" />
      </svg>
    ),
  },
  {
    id: 'off_grid',
    label: 'Off-grid',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2 2 22h20L12 2z" />
        <circle cx="12" cy="14" r="2" />
      </svg>
    ),
  },
  {
    id: 'historic',
    label: 'Historic',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 22h16M4 6h16M2 6l10-4 10 4M6 6v16M10 6v16M14 6v16M18 6v16" />
      </svg>
    ),
  },
];

export function CategoryBar({
  selected = 'homes',
  onSelect,
  onOpenFilters,
  totalBeforeTaxes = true,
  onToggleTotalBeforeTaxes,
  showControls = true,
}: {
  selected?: string;
  onSelect?: (id: string) => void;
  onOpenFilters?: () => void;
  totalBeforeTaxes?: boolean;
  onToggleTotalBeforeTaxes?: (enabled: boolean) => void;
  showControls?: boolean;
}) {
  return (
    <div className="category-strip-container">
      <div className="category-strip" role="tablist" aria-label="Stay categories">
        {CATEGORIES.map((cat) => {
          const isActive = cat.id === selected;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`category-item ${isActive ? 'category-item--active' : ''}`}
              onClick={() => onSelect?.(cat.id)}
            >
              <span className="category-icon" aria-hidden="true">
                {cat.icon}
              </span>
              <span className="category-label">{cat.label}</span>
            </button>
          );
        })}
      </div>

      {showControls && (
        <div className="category-controls">
          {onOpenFilters && (
            <button
              type="button"
              className="filter-trigger-btn"
              onClick={onOpenFilters}
              aria-label="Open search filters"
            >
              <svg
                width="16"
                height="16"
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
          )}

          {onToggleTotalBeforeTaxes && (
            <label className="tax-toggle">
              <span className="tax-toggle-label">Total before taxes</span>
              <button
                type="button"
                role="switch"
                aria-checked={totalBeforeTaxes}
                className={`switch-toggle ${totalBeforeTaxes ? 'switch-toggle--checked' : ''}`}
                onClick={() => onToggleTotalBeforeTaxes(!totalBeforeTaxes)}
              >
                <span className="switch-slider" />
              </button>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
