import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  OSM_TILE_URL,
  OSM_ATTRIBUTION,
  getListingCoordinates,
  saveListingCoordinates,
  getSavedListingCoordinates,
  CITY_COORDINATES,
} from '../search/geo';

interface LocationPickerMapProps {
  listingId?: string;
  city?: string;
  country?: string;
  address?: string;
  latitude?: number | string;
  longitude?: number | string;
  onChange?: (lat: number, lng: number) => void;
}

export function LocationPickerMap({
  listingId,
  city = '',
  country = '',
  address = '',
  latitude,
  longitude,
  onChange,
}: LocationPickerMapProps) {
  // Determine initial coordinates
  const getInitialCoords = (): [number, number] => {
    const latNum = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
    const lngNum = typeof longitude === 'string' ? parseFloat(longitude) : longitude;
    if (typeof latNum === 'number' && !isNaN(latNum) && typeof lngNum === 'number' && !isNaN(lngNum)) {
      return [latNum, lngNum];
    }
    if (listingId) {
      const saved = getSavedListingCoordinates(listingId);
      if (saved) return saved;
    }
    return getListingCoordinates({ id: listingId, city, country, title: address });
  };

  const initial = getInitialCoords();
  const [coords, setCoords] = useState<[number, number]>(initial);
  const [showRadius, setShowRadius] = useState(true);
  const [geoNotice, setGeoNotice] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  const initialCoordsRef = useRef<[number, number]>(coords);
  const handleUpdateRef = useRef<(lat: number, lng: number, panMap?: boolean) => void>(() => {});

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Handle position update
  const handleUpdate = useCallback(
    (lat: number, lng: number, panMap = false) => {
      const fixedLat = Number(lat.toFixed(6));
      const fixedLng = Number(lng.toFixed(6));
      setCoords([fixedLat, fixedLng]);

      if (listingId) {
        saveListingCoordinates(listingId, [fixedLat, fixedLng]);
      }
      onChangeRef.current?.(fixedLat, fixedLng);

      if (markerRef.current) {
        markerRef.current.setLatLng([fixedLat, fixedLng]);
      }
      if (circleRef.current) {
        circleRef.current.setLatLng([fixedLat, fixedLng]);
      }
      if (panMap && mapRef.current) {
        mapRef.current.panTo([fixedLat, fixedLng], { animate: true });
      }
    },
    [listingId],
  );

  useEffect(() => {
    handleUpdateRef.current = handleUpdate;
  }, [handleUpdate]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!containerRef.current) return;

    const startCoords = initialCoordsRef.current;
    const map = L.map(containerRef.current, {
      center: startCoords,
      zoom: 15,
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

    // Approximate guest privacy radius
    const circle = L.circle(startCoords, {
      radius: 350,
      color: '#0b6b5d',
      fillColor: '#0b6b5d',
      fillOpacity: 0.12,
      weight: 2,
      dashArray: '6, 6',
    }).addTo(map);
    circleRef.current = circle;

    // Draggable Location Pin Icon
    const customPin = L.divIcon({
      className: 'location-picker-marker-wrap',
      html: `
        <div class="location-picker-pin" title="Drag to adjust position">
          <div class="location-picker-pin-head">
            <span class="location-picker-pin-icon">⌂</span>
          </div>
          <div class="location-picker-pin-point"></div>
          <div class="location-picker-pin-shadow"></div>
        </div>
      `,
      iconSize: [40, 48],
      iconAnchor: [20, 46],
    });

    const marker = L.marker(startCoords, {
      draggable: true,
      icon: customPin,
      zIndexOffset: 1000,
    }).addTo(map);
    markerRef.current = marker;

    // Drag events
    marker.on('dragend', () => {
      const pt = marker.getLatLng();
      handleUpdateRef.current(pt.lat, pt.lng);
      setGeoNotice('Pin location updated via drag');
    });

    // Map click moves marker
    map.on('click', (e) => {
      handleUpdateRef.current(e.latlng.lat, e.latlng.lng);
      setGeoNotice('Pin location moved to click point');
    });

    // ResizeObserver
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(containerRef.current);
    }

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      if (resizeObserver) resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []); // Run once on mount

  // Sync circle visibility
  useEffect(() => {
    if (circleRef.current) {
      if (showRadius) {
        circleRef.current.setStyle({ opacity: 1, fillOpacity: 0.12 });
      } else {
        circleRef.current.setStyle({ opacity: 0, fillOpacity: 0 });
      }
    }
  }, [showRadius]);

  // Center map on city
  const centerOnCity = () => {
    const cityKey = (city || '').toLowerCase().trim();
    const cityCoord = CITY_COORDINATES[cityKey] || CITY_COORDINATES['lisbon'];
    handleUpdate(cityCoord[0], cityCoord[1], true);
    if (mapRef.current) {
      mapRef.current.setZoom(14);
    }
    setGeoNotice(`Centered to ${city || 'Lisbon'}`);
  };

  // Use browser geolocation
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoNotice('Geolocation is not supported by your browser');
      return;
    }
    setGeoNotice('Locating your position...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleUpdate(pos.coords.latitude, pos.coords.longitude, true);
        setGeoNotice('Location updated from device GPS');
      },
      () => {
        setGeoNotice('Could not retrieve device location. Please allow browser location access.');
      },
      { timeout: 8000 },
    );
  };

  return (
    <div className="location-picker-box" data-testid="location-picker-box">
      <div className="location-picker-header">
        <div>
          <h4 className="location-picker-title">Pin exact location on map</h4>
          <p className="location-picker-sub">
            Drag the pin or click on the map to set the exact position of your space.
          </p>
        </div>
        <div className="location-picker-actions">
          <button
            type="button"
            className="button button--secondary button--sm"
            onClick={centerOnCity}
            title="Recenter to entered city"
          >
            Center on {city ? city : 'city'}
          </button>
          <button
            type="button"
            className="button button--secondary button--sm"
            onClick={useCurrentLocation}
            title="Use device GPS location"
          >
            Locate me
          </button>
        </div>
      </div>

      {/* Interactive Leaflet Map Viewport */}
      <div className="location-picker-map-viewport">
        <div ref={containerRef} className="location-picker-canvas" />
      </div>

      {/* Coordinate Readouts & Guest Radius Toggle */}
      <div className="location-picker-footer">
        <div className="location-picker-coords">
          <span className="coord-badge">
            <strong>Lat:</strong> {coords[0].toFixed(6)}
          </span>
          <span className="coord-badge">
            <strong>Lng:</strong> {coords[1].toFixed(6)}
          </span>
          {geoNotice && <span className="coord-notice">{geoNotice}</span>}
        </div>
        <label className="location-picker-toggle">
          <input
            type="checkbox"
            checked={showRadius}
            onChange={(e) => setShowRadius(e.target.checked)}
          />
          <span>Show guest search radius (~350m)</span>
        </label>
      </div>
    </div>
  );
}
