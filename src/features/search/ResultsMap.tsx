import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { formatMoney } from '../../lib/format';
import type { SearchCard } from '../listings/types';
import { OSM_TILE_URL, OSM_ATTRIBUTION, getListingCoordinates } from './geo';

export interface MapPin {
  id: string;
  listingId: string;
  label: string;
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  priceNight: string;
  priceTotal: string;
  rating: string;
  photoUrl?: string;
  badge?: string;
  reviewCount?: number;
}

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
  zoom,
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
  const [cardPos, setCardPos] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());

  const searchAsMoveRef = useRef(searchAsMove);
  const onSearchAsMoveChangeRef = useRef(onSearchAsMoveChange);
  const updateCardPositionRef = useRef<() => void>(() => {});

  useEffect(() => {
    searchAsMoveRef.current = searchAsMove;
  }, [searchAsMove]);

  useEffect(() => {
    onSearchAsMoveChangeRef.current = onSearchAsMoveChange;
  }, [onSearchAsMoveChange]);

  // Use live search results when available; fallback to reference stays for preview
  const sourceListings = listings.length > 0 ? listings : (REFERENCE_STAYS as SearchCard[]);

  // Build pins with real geographic coordinates
  const pins: MapPin[] = useMemo(() => {
    return sourceListings.map((listing) => {
      const [lat, lng] = getListingCoordinates(listing);
      const totalMinor =
        listing.stay_total_minor ?? listing.nightly_price_minor * (listing.nights || 6);

      const reviewCount =
        (listing as unknown as { review_count?: number }).review_count ??
        (listing.rating ? Math.round(listing.rating * 42.7) : 212);

      return {
        id: `pin-${listing.id}`,
        listingId: listing.id,
        label: formatMoney(listing.nightly_price_minor, listing.currency),
        lat,
        lng,
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
  }, [sourceListings]);

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

  // Update popup card pixel position relative to map container
  const updateCardPosition = useCallback(() => {
    if (!mapRef.current || !displayPin) {
      setCardPos(null);
      return;
    }
    try {
      const point = mapRef.current.latLngToContainerPoint([displayPin.lat, displayPin.lng]);
      setCardPos({ x: point.x, y: point.y });
    } catch {
      // Container not yet laid out
    }
  }, [displayPin]);

  useEffect(() => {
    updateCardPositionRef.current = updateCardPosition;
    updateCardPosition();
  }, [updateCardPosition]);

  // Initialize Leaflet Map
  const initialCenterRef = useRef<[number, number]>(
    pins.length > 0 ? [pins[0].lat, pins[0].lng] : [38.7223, -9.1393],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: initialCenterRef.current,
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
    });
    mapRef.current = map;

    // OpenStreetMap Tile Layer
    L.tileLayer(OSM_TILE_URL, {
      maxZoom: 19,
      attribution: OSM_ATTRIBUTION,
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;

    // Map click outside markers dismisses selection / hover card
    map.on('click', () => {
      setSelectedPinId(null);
      setHoveredPinId(null);
    });

    map.on('move', () => {
      updateCardPositionRef.current();
    });

    map.on('zoom', () => {
      updateCardPositionRef.current();
    });

    map.on('moveend', () => {
      updateCardPositionRef.current();
      if (searchAsMoveRef.current && onSearchAsMoveChangeRef.current) {
        onSearchAsMoveChangeRef.current(true);
      }
    });

    // ResizeObserver for robust layout updates (split view toggle, window resize)
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
        updateCardPositionRef.current();
      });
      resizeObserver.observe(containerRef.current);
    }

    const timer = setTimeout(() => {
      map.invalidateSize();
      updateCardPositionRef.current();
    }, 150);

    const markersMap = markersMapRef.current;

    return () => {
      clearTimeout(timer);
      if (resizeObserver) resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      markersMap.clear();
    };
  }, []); // Run once on mount

  // Sync zoom prop if controlled
  useEffect(() => {
    if (mapRef.current && typeof zoom === 'number' && zoom > 0) {
      mapRef.current.setZoom(Math.round(zoom * 13));
    }
  }, [zoom]);

  // Sync external selectedListingId: center map on that pin
  useEffect(() => {
    if (selectedListingId && mapRef.current) {
      const match = pins.find((p) => p.listingId === selectedListingId);
      if (match) {
        mapRef.current.panTo([match.lat, match.lng], { animate: true });
      }
    }
  }, [selectedListingId, pins]);

  // Update Markers on pins or selection change
  useEffect(() => {
    const markersGroup = markersLayerRef.current;
    if (!markersGroup || !mapRef.current) return;

    markersGroup.clearLayers();
    markersMapRef.current.clear();

    pins.forEach((pin) => {
      const isSelected =
        (selectedPinId && pin.id === selectedPinId) ||
        (selectedListingId && pin.listingId === selectedListingId);
      const isHovered = (displayPin && displayPin.id === pin.id) || hoveredPinId === pin.id;

      const markerHtml = `
        <div class="map-price-pin ${isSelected ? 'map-price-pin--selected' : ''} ${isHovered ? 'map-price-pin--hovered' : ''}">
          <span>${escapeHtml(pin.label)}</span>
        </div>
      `;

      const icon = L.divIcon({
        className: 'leaflet-stay-marker',
        html: markerHtml,
        iconSize: [64, 32],
        iconAnchor: [32, 16],
      });

      const marker = L.marker([pin.lat, pin.lng], {
        icon,
        zIndexOffset: isSelected ? 1000 : isHovered ? 800 : 100,
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedPinId(pin.id);
        onSelectListing?.(pin.listingId);
        if (mapRef.current) {
          mapRef.current.panTo([pin.lat, pin.lng], { animate: true });
        }
      });

      marker.on('mouseover', () => {
        setHoveredPinId(pin.id);
        onSelectListing?.(pin.listingId);
      });

      marker.on('mouseout', () => {
        setHoveredPinId(null);
      });

      marker.addTo(markersGroup);
      markersMapRef.current.set(pin.id, marker);
    });

    // Auto fit bounds on initial load if multiple pins
    if (pins.length > 1 && mapRef.current) {
      const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [pins, selectedPinId, selectedListingId, hoveredPinId, displayPin, onSelectListing]);

  // Handle clicking a stay from the bottom carousel
  const handleCarouselSelect = (pin: MapPin) => {
    setSelectedPinId(pin.id);
    onSelectListing?.(pin.listingId);
    if (mapRef.current) {
      mapRef.current.panTo([pin.lat, pin.lng], { animate: true });
    }
  };

  return (
    <div
      className={`results-map-container ${isFullView ? 'results-map-container--full' : ''}`}
      data-testid="results-map-container"
    >
      {/* Top Floating Controls inside Map */}
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

      {/* Leaflet + OpenStreetMap Map Container */}
      <div ref={containerRef} className="map-canvas-viewport leaflet-osm-container" />

      {/* Floating stay card anchored to active or hovered marker */}
      {displayPin && cardPos && (
        <div
          className="pin-floating-card"
          style={{
            left: `clamp(16px, calc(${cardPos.x}px - 135px), calc(100% - 286px))`,
            top:
              cardPos.y > 320
                ? `calc(${cardPos.y}px - 310px)`
                : `clamp(16px, calc(${cardPos.y}px + 24px), calc(100% - 310px))`,
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

      {/* Bottom carousel in Full Map View */}
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
                  handleCarouselSelect(pin);
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
