import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../../lib/format';
import type { SearchCard } from '../listings/types';

// NOTE: The backend search API (/api/v1/listings/search) does not yet return latitude/longitude coordinates or support bounding-box geo queries.
// This Map component is rendered as an interactive vector UI component with coordinate anchors and interactive price markers so the layout matches the reference design.
// When backend geolocation data is enabled, this component can directly consume live coordinates from the search payload.

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
  reviewCount?: number;
}

// Coordinate distribution presets for full map view (Screen 04 / Image 1)
const FULL_VIEW_COORDINATES = [
  { x: 19, y: 26 }, // €128 (Alfama - selected)
  { x: 55, y: 23 }, // €142 (Graça)
  { x: 63, y: 41 }, // €79
  { x: 70, y: 61 }, // €101 (Príncipe Real)
  { x: 49, y: 69 }, // €88 (Cais do Sodré)
  { x: 16, y: 56 }, // €164
  { x: 38, y: 45 }, // Extra anchor
  { x: 80, y: 32 }, // Extra anchor
];

// Coordinate distribution presets for split list+map view (Screen 03 / Image 2)
const SPLIT_VIEW_COORDINATES = [
  { x: 66, y: 29 }, // €128 (Alfama - selected)
  { x: 71, y: 39 }, // €115
  { x: 76, y: 47 }, // €92 (Cais do Sodré)
  { x: 65, y: 61 }, // €164
  { x: 57, y: 52 }, // Extra anchor
  { x: 78, y: 22 }, // Extra anchor
];

// Reference stays fallback matching Lisbon reference mocks if backend listings are not yet loaded
const REFERENCE_STAYS: Partial<SearchCard>[] = [
  {
    id: 'stay-azulejo-loft',
    title: 'Azulejo Loft in Alfama',
    city: 'Lisbon',
    country: 'Portugal',
    property_type: 'entire_loft',
    max_guests: 2,
    nightly_price_minor: 12800,
    currency: 'EUR',
    rating: 4.96,
    cover_photo_url:
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80#lisbon-alfama-1',
    instant_book: true,
  },
  {
    id: 'stay-riverside-studio',
    title: 'Riverside studio, Cais do Sodré',
    city: 'Lisbon',
    country: 'Portugal',
    property_type: 'entire_studio',
    max_guests: 2,
    nightly_price_minor: 9200,
    currency: 'EUR',
    rating: 4.81,
    cover_photo_url:
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80#lisbon-alfama-2',
    instant_book: true,
  },
  {
    id: 'stay-bica-apartment',
    title: 'Bica apartment with tram view',
    city: 'Lisbon',
    country: 'Portugal',
    property_type: 'entire_apartment',
    max_guests: 3,
    nightly_price_minor: 11500,
    currency: 'EUR',
    rating: 4.77,
    cover_photo_url:
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80#lisbon-alfama-3',
    instant_book: true,
  },
  {
    id: 'stay-garden-house-sintra',
    title: 'Garden house in Sintra',
    city: 'Sintra',
    country: 'Portugal',
    property_type: 'entire_home',
    max_guests: 5,
    nightly_price_minor: 16400,
    currency: 'EUR',
    rating: 4.9,
    cover_photo_url:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80#lisbon-principe-1',
    instant_book: true,
  },
  {
    id: 'stay-graca-terrace',
    title: 'Graça Panorama Terrace',
    city: 'Lisbon',
    country: 'Portugal',
    property_type: 'entire_apartment',
    max_guests: 4,
    nightly_price_minor: 14200,
    currency: 'EUR',
    rating: 4.88,
    cover_photo_url:
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80#lisbon-alfama-4',
    instant_book: true,
  },
  {
    id: 'stay-baixa-vintage',
    title: 'Baixa Vintage Studio',
    city: 'Lisbon',
    country: 'Portugal',
    property_type: 'studio',
    max_guests: 2,
    nightly_price_minor: 7900,
    currency: 'EUR',
    rating: 4.75,
    cover_photo_url:
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80#lisbon-alfama-5',
    instant_book: false,
  },
  {
    id: 'stay-santos-river',
    title: 'Santos River Loft',
    city: 'Lisbon',
    country: 'Portugal',
    property_type: 'entire_loft',
    max_guests: 2,
    nightly_price_minor: 8800,
    currency: 'EUR',
    rating: 4.84,
    cover_photo_url:
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80#lisbon-principe-2',
    instant_book: true,
  },
  {
    id: 'stay-principe-garden',
    title: 'Príncipe Real Garden Suite',
    city: 'Lisbon',
    country: 'Portugal',
    property_type: 'entire_apartment',
    max_guests: 2,
    nightly_price_minor: 10100,
    currency: 'EUR',
    rating: 4.92,
    cover_photo_url:
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80#lisbon-principe-3',
    instant_book: true,
  },
];

interface ResultsMapProps {
  listings?: SearchCard[];
  selectedListingId?: string | null;
  onSelectListing?: (id: string) => void;
  isFullView?: boolean;
  paramsString?: string;
  searchAsMove?: boolean;
  onSearchAsMoveChange?: (val: boolean) => void;
  onSwitchToList?: () => void;
  zoom?: number;
}

export function ResultsMap({
  listings = [],
  selectedListingId,
  onSelectListing,
  isFullView = false,
  paramsString = '',
  searchAsMove: controlledSearchAsMove,
  onSearchAsMoveChange,
  onSwitchToList,
  zoom = 1,
}: ResultsMapProps) {
  const [internalSearchAsMove, setInternalSearchAsMove] = useState(true);
  const searchAsMove =
    controlledSearchAsMove !== undefined ? controlledSearchAsMove : internalSearchAsMove;
  const setSearchAsMove = (val: boolean) => {
    setInternalSearchAsMove(val);
    onSearchAsMoveChange?.(val);
  };

  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);

  // Smooth click & drag pan interaction
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const activeCoordinates = isFullView ? FULL_VIEW_COORDINATES : SPLIT_VIEW_COORDINATES;

  // Use live search results when available; fallback to reference stays for preview
  const sourceListings = listings.length > 0 ? listings : (REFERENCE_STAYS as SearchCard[]);

  // Build pins
  const pins: MapPin[] = sourceListings.map((listing, i) => {
    const coord = activeCoordinates[i % activeCoordinates.length];
    const totalMinor =
      listing.stay_total_minor ?? listing.nightly_price_minor * (listing.nights || 6);

    const reviewCount =
      (listing as unknown as { review_count?: number }).review_count ??
      (listing.rating ? Math.round(listing.rating * 42.7) : 212);

    return {
      id: `pin-${listing.id}`,
      listingId: listing.id,
      label: formatMoney(listing.nightly_price_minor, listing.currency),
      x: coord.x,
      y: coord.y,
      title: listing.title,
      subtitle: `${listing.city || 'Lisbon'} · ${listing.property_type ? listing.property_type.replace(/_/g, ' ') : 'Entire loft'} · ${listing.max_guests || 1} guests${listing.instant_book ? ' · Guest favorite' : ''}`,
      priceNight: `${formatMoney(listing.nightly_price_minor, listing.currency)} night`,
      priceTotal: `${formatMoney(totalMinor, listing.currency)} total`,
      rating:
        listing.rating != null ? `★ ${listing.rating.toFixed(2)} (${reviewCount})` : 'New stay',
      photoUrl: listing.cover_photo_url || undefined,
      badge: listing.instant_book ? 'Guest favorite' : undefined,
      reviewCount,
    };
  });

  // Active pin resolves to selected pin or selected listing, or default to first pin
  const activePin =
    pins.find(
      (p) =>
        (selectedPinId && p.id === selectedPinId) ||
        (selectedListingId && p.listingId === selectedListingId),
    ) || pins[0];

  // Pin currently shown in detail card view: prioritize hovered pin, then active/selected pin
  const displayPin =
    (hoveredPinId && pins.find((p) => p.id === hoveredPinId)) ||
    (isFullView
      ? activePin
      : selectedListingId
        ? pins.find((p) => p.listingId === selectedListingId)
        : null);

  useEffect(() => {
    if (selectedListingId) {
      const match = pins.find((p) => p.listingId === selectedListingId);
      if (match) setSelectedPinId(match.id);
    }
  }, [selectedListingId, pins]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (
      (e.target as HTMLElement).closest(
        '.map-price-pin-wrap, .pin-floating-card, .map-bottom-carousel, .map-top-bar, button, a',
      )
    ) {
      return;
    }
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className={`results-map-container ${isFullView ? 'results-map-container--full' : ''}`}>
      {/* Top Floating Controls inside Map (Shown in Split View per Image 2) */}
      {!isFullView && (
        <div className="map-top-bar">
          <label className="map-search-move-toggle">
            <input
              type="checkbox"
              checked={searchAsMove}
              onChange={(e) => setSearchAsMove(e.target.checked)}
            />
            <span className="checkbox-custom-mark">✓</span>
            <span>Search as I move the map</span>
          </label>
        </div>
      )}

      {/* Interactive Map Viewport with SVG Background & Coordinate Layer */}
      <div
        className={`map-canvas-viewport ${isDragging ? 'map-canvas-viewport--dragging' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
      >
        <svg
          className="map-svg-background"
          viewBox="0 0 1000 750"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Base terrain */}
          <rect width="1000" height="750" fill="#f2f5f1" />

          {/* Lisbon Tagus River Estuary (Rio Tejo) on South / Bottom */}
          <path
            d="M 0 540 Q 220 580, 480 540 T 780 490 Q 900 480, 1000 450 L 1000 750 L 0 750 Z"
            fill="#dbe8ee"
          />
          {/* Coastal water depth contour line */}
          <path
            d="M 0 570 Q 240 600, 500 565 T 800 520 Q 910 505, 1000 480 L 1000 750 L 0 750 Z"
            fill="#d3e4ec"
          />
          <path
            d="M 0 540 Q 220 580, 480 540 T 780 490 Q 900 480, 1000 450"
            stroke="#c8dbe4"
            strokeWidth="2"
            fill="none"
            opacity="0.8"
          />

          {/* Lisbon Parks / Green Spaces */}
          {/* Graça / East Park */}
          <rect x="740" y="130" width="120" height="95" rx="26" fill="#ddeae0" />
          {/* Baixa / Central Park */}
          <rect x="670" y="380" width="90" height="85" rx="20" fill="#ddeae0" />
          {/* Alfama / West Park */}
          <rect x="130" y="440" width="90" height="120" rx="22" fill="#ddeae0" />
          {/* Upper North Park */}
          <rect x="320" y="70" width="85" height="60" rx="16" fill="#ddeae0" />

          {/* Major Lisbon Avenues (Crisp White Lines) */}
          <g
            stroke="#ffffff"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="1"
          >
            {/* Diagonal main avenues */}
            <line x1="80" y1="0" x2="310" y2="750" />
            <line x1="280" y1="0" x2="490" y2="750" />
            <line x1="560" y1="0" x2="730" y2="750" />
            <line x1="720" y1="0" x2="880" y2="750" />
            {/* Horizontal & crossing thoroughfares */}
            <line x1="0" y1="160" x2="1000" y2="230" />
            <line x1="0" y1="330" x2="1000" y2="390" />
            <line x1="0" y1="500" x2="1000" y2="540" />
            <line x1="0" y1="640" x2="1000" y2="670" />
            {/* Diagonal interconnects */}
            <line x1="0" y1="410" x2="1000" y2="550" />
          </g>

          {/* Secondary streets */}
          <g stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.85">
            <line x1="180" y1="0" x2="390" y2="750" />
            <line x1="420" y1="0" x2="610" y2="750" />
            <line x1="640" y1="0" x2="810" y2="750" />
            <line x1="0" y1="85" x2="1000" y2="135" />
            <line x1="0" y1="240" x2="1000" y2="300" />
            <line x1="0" y1="420" x2="1000" y2="460" />
            <line x1="0" y1="580" x2="1000" y2="610" />
          </g>

          {/* Neighborhood Labels matching reference images */}
          <text
            x="590"
            y="235"
            fill="#7b8798"
            fontSize="13"
            fontWeight="600"
            letterSpacing="0.4"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          >
            Graça
          </text>
          <text
            x="115"
            y="310"
            fill="#7b8798"
            fontSize="13"
            fontWeight="600"
            letterSpacing="0.4"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          >
            Alfama
          </text>
          <text
            x="685"
            y="415"
            fill="#7b8798"
            fontSize="13"
            fontWeight="600"
            letterSpacing="0.4"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          >
            Baixa
          </text>
          <text
            x="715"
            y="460"
            fill="#7b8798"
            fontSize="13"
            fontWeight="600"
            letterSpacing="0.4"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          >
            Príncipe Real
          </text>
          <text
            x="360"
            y="545"
            fill="#7b8798"
            fontSize="13"
            fontWeight="600"
            letterSpacing="0.4"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          >
            Cais do Sodré
          </text>
        </svg>

        {/* Map Price Pins Layer with Backdrop Tiles */}
        <div className="map-pins-layer">
          {pins.map((pin) => {
            const isSelected = activePin?.id === pin.id;
            const isHovered = (displayPin && displayPin.id === pin.id) || hoveredPinId === pin.id;

            return (
              <div
                key={pin.id}
                className={`map-price-pin-wrap ${isSelected ? 'map-price-pin-wrap--selected' : ''} ${isHovered ? 'map-price-pin-wrap--hovered' : ''}`}
                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPinId(pin.id);
                  if (onSelectListing) onSelectListing(pin.listingId);
                }}
                onMouseEnter={() => {
                  setHoveredPinId(pin.id);
                  if (onSelectListing) onSelectListing(pin.listingId);
                }}
                onMouseLeave={() => {
                  setHoveredPinId(null);
                }}
              >
                {/* Architectural backdrop tile behind marker */}
                <div className="map-pin-backdrop-tile" />

                {/* Interactive Price Capsule */}
                <div
                  className={`map-price-pin ${isSelected || isHovered ? 'map-price-pin--selected' : ''}`}
                >
                  <span>{pin.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating popover card on hovered or active pin */}
        {displayPin && (
          <div
            className="pin-floating-card"
            style={{
              left:
                displayPin.x > 55
                  ? `clamp(12px, calc(${displayPin.x}% - 275px), calc(100% - 275px))`
                  : `clamp(12px, calc(${displayPin.x}% + 24px), calc(100% - 275px))`,
              top: `clamp(16px, calc(${displayPin.y}% - 40px), calc(100% - 320px))`,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={() => setHoveredPinId(displayPin.id)}
            onMouseLeave={() => setHoveredPinId(null)}
          >
            {displayPin.photoUrl && (
              <div className="pin-card-photo-wrap">
                <Link to={`/listings/${displayPin.listingId}?${paramsString}`}>
                  <img
                    src={displayPin.photoUrl}
                    alt={displayPin.title}
                    className="pin-card-photo"
                    loading="lazy"
                  />
                </Link>
              </div>
            )}
            <div className="pin-card-content">
              <h4 className="pin-card-title">
                <Link to={`/listings/${displayPin.listingId}?${paramsString}`}>
                  {displayPin.title}
                </Link>
              </h4>
              <p className="pin-card-sub">{displayPin.subtitle}</p>
              <div className="pin-card-row">
                <span className="pin-card-price">
                  <strong>{displayPin.priceNight}</strong> · {displayPin.priceTotal}
                </span>
                <span className="pin-card-rating">{displayPin.rating}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom carousel in Full Map View (Screen 04 / Image 1) */}
      {isFullView && pins.length > 0 && (
        <div className="map-bottom-carousel">
          {pins.slice(0, 4).map((pin) => {
            const isSelected = activePin?.id === pin.id;
            return (
              <div
                key={pin.id}
                className={`carousel-stay-card ${isSelected ? 'carousel-stay-card--selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
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
                  <div className="carousel-rating">{pin.rating}</div>
                  <div className="carousel-price">
                    <strong>{pin.priceNight}</strong>
                  </div>
                </div>
              </div>
            );
          })}
          {pins.length > 4 && (
            <div
              className="carousel-more-card"
              onClick={() => onSwitchToList?.()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSwitchToList?.();
              }}
            >
              <span>+ {Math.max(64, pins.length - 4)} more</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
