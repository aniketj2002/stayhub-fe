// Geolocation utilities for Leaflet + OpenStreetMap integration

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

export const CITY_COORDINATES: Record<string, [number, number]> = {
  lisbon: [38.7223, -9.1393],
  lisboa: [38.7223, -9.1393],
  sintra: [38.7984, -9.388],
  porto: [41.1579, -8.6291],
  goa: [15.2993, 74.124],
  kyoto: [35.0116, 135.7681],
  tokyo: [35.6762, 139.6503],
  paris: [48.8566, 2.3522],
  london: [51.5074, -0.1278],
  rome: [41.9028, 12.4964],
  barcelona: [41.3879, 2.1699],
  madrid: [40.4168, -3.7038],
  amsterdam: [52.3676, 4.9041],
  berlin: [52.52, 13.405],
  'new york': [40.7128, -74.006],
  'san francisco': [37.7749, -122.4194],
};

export const NEIGHBORHOOD_COORDINATES: Record<string, [number, number]> = {
  alfama: [38.7126, -9.1303],
  graça: [38.7176, -9.1299],
  graca: [38.7176, -9.1299],
  baixa: [38.7115, -9.139],
  'cais do sodré': [38.7071, -9.1436],
  'cais do sodre': [38.7071, -9.1436],
  'príncipe real': [38.7169, -9.1488],
  'principe real': [38.7169, -9.1488],
  bica: [38.7105, -9.1455],
  santos: [38.7079, -9.1554],
  chiado: [38.7108, -9.1413],
  belém: [38.6979, -9.2064],
  belem: [38.6979, -9.2064],
  anjuna: [15.5871, 73.7438],
  calangute: [15.5439, 73.7553],
  candolim: [15.5173, 73.7632],
  gion: [35.0037, 135.777],
  higashiyama: [34.9984, 135.7828],
  arashiyama: [35.0163, 135.6712],
};

export const KNOWN_LISTING_COORDINATES: Record<string, [number, number]> = {
  'stay-azulejo-loft': [38.7126, -9.1303],
  'stay-riverside-studio': [38.7071, -9.1436],
  'stay-bica-apartment': [38.7105, -9.1455],
  'stay-garden-house-sintra': [38.7984, -9.388],
  'stay-graca-terrace': [38.7176, -9.1299],
  'stay-baixa-vintage': [38.7115, -9.139],
  'stay-santos-river': [38.7079, -9.1554],
  'stay-principe-garden': [38.7169, -9.1488],
  'home-1': [38.7126, -9.1303],
  'home-2': [38.7169, -9.1488],
  'home-3': [15.5871, 73.7438],
  'home-4': [15.2993, 74.124],
  'home-5': [35.0037, 135.777],
  'home-6': [34.9984, 135.7828],
};

export const CUSTOM_LISTING_COORDINATES: Record<string, [number, number]> = {};

export function saveListingCoordinates(listingId: string, coords: [number, number]): void {
  CUSTOM_LISTING_COORDINATES[listingId] = coords;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`stayhub_coords_${listingId}`, JSON.stringify(coords));
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function getSavedListingCoordinates(listingId: string): [number, number] | null {
  if (CUSTOM_LISTING_COORDINATES[listingId]) {
    return CUSTOM_LISTING_COORDINATES[listingId];
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(`stayhub_coords_${listingId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          Array.isArray(parsed) &&
          parsed.length === 2 &&
          typeof parsed[0] === 'number' &&
          typeof parsed[1] === 'number'
        ) {
          CUSTOM_LISTING_COORDINATES[listingId] = [parsed[0], parsed[1]];
          return [parsed[0], parsed[1]];
        }
      }
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
}

export interface GeoTarget {
  id?: string;
  title?: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
}

/**
 * Returns [latitude, longitude] for any listing, falling back to neighborhood,
 * city, or deterministic coordinates around city center.
 */
export function getListingCoordinates(target: GeoTarget): [number, number] {
  if (typeof target.lat === 'number' && typeof target.lng === 'number') {
    return [target.lat, target.lng];
  }
  if (typeof target.latitude === 'number' && typeof target.longitude === 'number') {
    return [target.latitude, target.longitude];
  }

  if (target.id) {
    const saved = getSavedListingCoordinates(target.id);
    if (saved) return saved;
    if (KNOWN_LISTING_COORDINATES[target.id]) {
      return KNOWN_LISTING_COORDINATES[target.id];
    }
  }

  const titleLower = (target.title || '').toLowerCase();
  for (const [key, coords] of Object.entries(NEIGHBORHOOD_COORDINATES)) {
    if (titleLower.includes(key)) {
      return coords;
    }
  }

  const cityKey = (target.city || '').toLowerCase().trim();
  const baseCenter: [number, number] = CITY_COORDINATES[cityKey] || CITY_COORDINATES['lisbon'];

  // If there's an id, produce a stable deterministic scatter around the city center
  const idStr = target.id || target.title || 'default';
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) {
    hash = (hash << 5) - hash + idStr.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = (((Math.abs(hash) % 1000) / 1000) - 0.5) * 0.024;
  const lngOffset = (((Math.abs(hash * 37) % 1000) / 1000) - 0.5) * 0.032;

  return [
    Number((baseCenter[0] + latOffset).toFixed(6)),
    Number((baseCenter[1] + lngOffset).toFixed(6)),
  ];
}
