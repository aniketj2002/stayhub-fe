import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { OSM_TILE_URL, OSM_ATTRIBUTION, getListingCoordinates } from './geo';

interface ListingLocationMapProps {
  listing: {
    id?: string;
    title?: string;
    city?: string;
    country?: string;
    lat?: number;
    lng?: number;
  };
}

export function ListingLocationMap({ listing }: ListingLocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const [lat, lng] = getListingCoordinates(listing);

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 14,
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    // OpenStreetMap Tile Layer
    L.tileLayer(OSM_TILE_URL, {
      maxZoom: 19,
      attribution: OSM_ATTRIBUTION,
    }).addTo(map);

    // Approximate area circle (privacy zone per reference design)
    L.circle([lat, lng], {
      radius: 350,
      color: '#0b6b5d',
      fillColor: '#0b6b5d',
      fillOpacity: 0.16,
      weight: 2,
    }).addTo(map);

    // Center Home Marker Icon
    const homeIcon = L.divIcon({
      className: 'location-home-marker-wrap',
      html: '<div class="location-home-marker-pin"><span class="location-home-icon">⌂</span></div>',
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    L.marker([lat, lng], { icon: homeIcon }).addTo(map);

    // Handle container resizing
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(containerRef.current);
    }

    // Trigger initial invalidation after layout settles
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      if (resizeObserver) resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [listing]);

  return <div ref={containerRef} className="location-leaflet-map-canvas" />;
}
