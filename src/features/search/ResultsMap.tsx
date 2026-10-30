import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../../lib/format';
import type { SearchCard } from '../listings/types';

// NOTE: The backend search API (/api/v1/listings/search) does not yet return latitude/longitude coordinates or support bounding-box geo queries.
// This Map component is rendered as an interactive UI component with dummy coordinate anchors and interactive price markers so the layout matches the reference design.
// When backend geolocation data is enabled, this component will directly consume live coordinates from the search payload.

export interface MapPin {
  id: string;
  listingId: string;
  label: string;
  x: number;
  y: number;
  title: string;
  subtitle: string;
  priceNight: string;
  priceTotal: string;
  rating: string;
  photoUrl?: string;
  badge?: string;
}

// Coordinate distribution presets for plotting live listings on map preview
const ANCHOR_COORDINATES = [
  { x: 23, y: 35 },
  { x: 78, y: 52 },
  { x: 74, y: 43 },
  { x: 12, y: 61 },
  { x: 55, y: 25 },
  { x: 64, y: 45 },
  { x: 72, y: 67 },
  { x: 49, y: 76 },
];

interface ResultsMapProps {
  listings?: SearchCard[];
  selectedListingId?: string | null;
  onSelectListing?: (id: string) => void;
  isFullView?: boolean;
  paramsString?: string;
}

export function ResultsMap({
  listings = [],
  selectedListingId,
  onSelectListing,
  isFullView = false,
  paramsString = '',
}: ResultsMapProps) {
  const [searchAsMove, setSearchAsMove] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  // Derive pins purely from live backend listings passed in props
  const pins: MapPin[] = listings.map((listing, i) => {
    const coord = ANCHOR_COORDINATES[i % ANCHOR_COORDINATES.length];
    const totalMinor =
      listing.stay_total_minor ?? listing.nightly_price_minor * (listing.nights || 6);

    return {
      id: `pin-${listing.id}`,
      listingId: listing.id,
      label: formatMoney(listing.nightly_price_minor, listing.currency),
      x: coord.x,
      y: coord.y,
      title: listing.title,
      subtitle: `${listing.city} · ${listing.property_type ? listing.property_type.replace(/_/g, ' ') : 'Entire place'} · ${listing.max_guests} guests`,
      priceNight: `${formatMoney(listing.nightly_price_minor, listing.currency)} night`,
      priceTotal: `${formatMoney(totalMinor, listing.currency)} total`,
      rating: listing.rating != null ? `★ ${listing.rating.toFixed(2)}` : 'New stay',
      photoUrl: listing.cover_photo_url || undefined,
      badge: listing.instant_book ? 'Instant book' : undefined,
    };
  });

  const activePin =
    pins.find(
      (p) =>
        (selectedPinId && p.id === selectedPinId) ||
        (selectedListingId && p.listingId === selectedListingId),
    ) || pins[0];

  return (
    <div className={`results-map-container ${isFullView ? 'results-map-container--full' : ''}`}>
      {/* Top Controls Overlay */}
      <div className="map-top-bar">
        <label className="map-search-move-toggle">
          <input
            type="checkbox"
            checked={searchAsMove}
            onChange={(e) => setSearchAsMove(e.target.checked)}
          />
          <span>Search as I move the map</span>
        </label>

        {isFullView && (
          <div className="map-zoom-controls">
            <button
              type="button"
              className="zoom-btn"
              onClick={() => setZoom((z) => Math.min(z + 0.2, 1.8))}
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="zoom-btn"
              onClick={() => setZoom((z) => Math.max(z - 0.2, 0.8))}
              aria-label="Zoom out"
            >
              −
            </button>
          </div>
        )}
      </div>

      {/* Styled Interactive Map Canvas */}
      <div
        className="map-canvas-viewport"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
      >
        <svg className="map-svg-background" viewBox="0 0 1000 800" preserveAspectRatio="none">
          {/* Base ground */}
          <rect width="1000" height="800" fill="#f4f4f2" />

          {/* River Tagus / water body on south-east */}
          <path d="M 500 800 Q 650 620, 800 500 T 1000 350 L 1000 800 Z" fill="#e2eff1" />
          <path d="M 0 780 Q 200 740, 400 770 T 700 800 Z" fill="#e8f3f5" />

          {/* Stylized street lines grid */}
          <g stroke="#ffffff" strokeWidth="6" opacity="0.95">
            <line x1="80" y1="0" x2="250" y2="800" />
            <line x1="280" y1="0" x2="420" y2="800" />
            <line x1="480" y1="0" x2="620" y2="800" />
            <line x1="680" y1="0" x2="800" y2="800" />
            <line x1="0" y1="180" x2="1000" y2="240" />
            <line x1="0" y1="360" x2="1000" y2="400" />
            <line x1="0" y1="520" x2="1000" y2="560" />
            <line x1="0" y1="680" x2="1000" y2="700" />
          </g>

          {/* Secondary streets */}
          <g stroke="#eaeae6" strokeWidth="2.5" opacity="0.8">
            <line x1="160" y1="0" x2="330" y2="800" />
            <line x1="380" y1="0" x2="520" y2="800" />
            <line x1="580" y1="0" x2="720" y2="800" />
            <line x1="0" y1="100" x2="1000" y2="150" />
            <line x1="0" y1="280" x2="1000" y2="320" />
            <line x1="0" y1="440" x2="1000" y2="480" />
            <line x1="0" y1="600" x2="1000" y2="630" />
          </g>

          {/* Green parks */}
          <rect x="760" y="160" width="45" height="45" rx="10" fill="#e5eee0" />
          <rect x="340" y="90" width="35" height="35" rx="8" fill="#e5eee0" />
          <rect x="180" y="480" width="60" height="40" rx="8" fill="#e5eee0" />

          {/* Neighborhood Labels */}
          <text x="600" y="320" fill="#9ca3af" fontSize="13" fontWeight="600" letterSpacing="0.5">
            Graça
          </text>
          <text x="62" y="420" fill="#9ca3af" fontSize="13" fontWeight="600" letterSpacing="0.5">
            Alfama
          </text>
          <text x="708" y="525" fill="#9ca3af" fontSize="13" fontWeight="600" letterSpacing="0.5">
            Baixa
          </text>
          <text x="330" y="750" fill="#9ca3af" fontSize="13" fontWeight="600" letterSpacing="0.5">
            Cais do Sodré
          </text>
          <text x="735" y="585" fill="#9ca3af" fontSize="13" fontWeight="600" letterSpacing="0.5">
            Príncipe Real
          </text>
        </svg>

        {/* Price Pins */}
        <div className="map-pins-layer">
          {pins.map((pin) => {
            const isSelected =
              (selectedPinId && pin.id === selectedPinId) ||
              (selectedListingId && pin.listingId === selectedListingId);

            return (
              <div
                key={pin.id}
                className={`map-price-pin ${isSelected ? 'map-price-pin--selected' : ''}`}
                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                onClick={() => {
                  setSelectedPinId(pin.id);
                  if (onSelectListing) onSelectListing(pin.listingId);
                }}
              >
                <span>{pin.label}</span>
              </div>
            );
          })}
        </div>

        {/* Floating popover card on selected pin (Matches Screen 04 only) */}
        {isFullView && activePin && (
          <div
            className="pin-floating-card"
            style={{
              left: `clamp(180px, ${activePin.x}%, 820px)`,
              top: `clamp(220px, ${activePin.y}%, 620px)`,
            }}
          >
            {activePin.photoUrl && (
              <img
                src={activePin.photoUrl}
                alt={activePin.title}
                className="pin-card-photo"
                loading="lazy"
              />
            )}
            <div className="pin-card-content">
              <h4 className="pin-card-title">
                <Link to={`/listings/${activePin.listingId}?${paramsString}`}>
                  {activePin.title}
                </Link>
              </h4>
              <p className="pin-card-sub">{activePin.subtitle}</p>
              <div className="pin-card-row">
                <span className="pin-card-price">
                  <strong>{activePin.priceNight}</strong> · {activePin.priceTotal}
                </span>
                <span className="pin-card-rating">{activePin.rating}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom carousel in Full Map View (Matches Screen 04) */}
      {isFullView && pins.length > 0 && (
        <div className="map-bottom-carousel">
          {pins.slice(0, 4).map((pin) => {
            const isSelected = activePin?.id === pin.id;
            return (
              <div
                key={pin.id}
                className={`carousel-stay-card ${isSelected ? 'carousel-stay-card--selected' : ''}`}
                onClick={() => {
                  setSelectedPinId(pin.id);
                  if (onSelectListing) onSelectListing(pin.listingId);
                }}
              >
                {pin.photoUrl ? (
                  <img src={pin.photoUrl} alt={pin.title} className="carousel-photo" />
                ) : (
                  <div className="carousel-photo-fallback">⌂</div>
                )}
                <div className="carousel-info">
                  <h4 className="carousel-title">{pin.title}</h4>
                  <div className="carousel-meta">
                    <span className="carousel-rating">{pin.rating}</span>
                    <span className="carousel-price">
                      <strong>{pin.priceNight}</strong>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {pins.length > 4 && (
            <div className="carousel-more-card">
              <span>+ {pins.length - 4} more</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
