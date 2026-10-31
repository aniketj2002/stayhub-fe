// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
import { MemoryRouter } from 'react-router-dom';
import { ResultsMap } from './ResultsMap';
import { ListingLocationMap } from './ListingLocationMap';
import { LocationPickerMap } from '../listings/LocationPickerMap';
import {
  getListingCoordinates,
  saveListingCoordinates,
  getSavedListingCoordinates,
  OSM_TILE_URL,
  OSM_ATTRIBUTION,
} from './geo';
import type { SearchCard } from '../listings/types';

describe('Geo utilities', () => {
  it('exports valid OpenStreetMap tile URL and attribution', () => {
    expect(OSM_TILE_URL).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(OSM_ATTRIBUTION).toContain('OpenStreetMap');
  });

  it('resolves coordinates for known listings', () => {
    const coords = getListingCoordinates({ id: 'stay-azulejo-loft' });
    expect(coords).toEqual([38.7126, -9.1303]);
  });

  it('resolves coordinates by neighborhood matching in title', () => {
    const coords = getListingCoordinates({ title: 'Sunny flat in Alfama' });
    expect(coords).toEqual([38.7126, -9.1303]);
  });

  it('resolves coordinates for cities with deterministic offset', () => {
    const coords1 = getListingCoordinates({ id: 'listing-a', city: 'Lisbon' });
    const coords2 = getListingCoordinates({ id: 'listing-a', city: 'Lisbon' });
    const coords3 = getListingCoordinates({ id: 'listing-b', city: 'Lisbon' });

    // Deterministic for same ID
    expect(coords1).toEqual(coords2);
    // Dispersed for different IDs in same city
    expect(coords1).not.toEqual(coords3);
    expect(coords1[0]).toBeCloseTo(38.72, 1);
  });

  it('persists and retrieves custom host-selected coordinates', () => {
    saveListingCoordinates('host-custom-stay-123', [38.7456, -9.1567]);
    const saved = getSavedListingCoordinates('host-custom-stay-123');
    expect(saved).toEqual([38.7456, -9.1567]);

    // getListingCoordinates immediately uses the host-saved coordinates
    const resolved = getListingCoordinates({ id: 'host-custom-stay-123', city: 'Lisbon' });
    expect(resolved).toEqual([38.7456, -9.1567]);
  });
});

describe('ResultsMap with Leaflet and OpenStreetMap', () => {
  const mockListings: SearchCard[] = [
    {
      id: 'stay-1',
      title: 'Alfama Terracotta Loft',
      city: 'Lisbon',
      country: 'Portugal',
      property_type: 'entire_loft',
      max_guests: 2,
      nightly_price_minor: 14500,
      currency: 'EUR',
      rating: 4.95,
      cover_photo_url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688',
      instant_book: true,
    },
    {
      id: 'stay-2',
      title: 'Príncipe Real Townhouse',
      city: 'Lisbon',
      country: 'Portugal',
      property_type: 'entire_home',
      max_guests: 4,
      nightly_price_minor: 21000,
      currency: 'EUR',
      rating: 4.88,
      cover_photo_url: null,
      instant_book: false,
    },
  ];

  it('renders Leaflet map container and controls in split view', () => {
    const onSelect = vi.fn();
    render(
      <MemoryRouter>
        <ResultsMap
          listings={mockListings}
          onSelectListing={onSelect}
          searchAsMove={true}
        />
      </MemoryRouter>,
    );

    const mapContainer = screen.getByTestId('results-map-container');
    expect(mapContainer).toBeTruthy();
    expect(mapContainer.querySelector('.leaflet-osm-container')).toBeTruthy();
    expect(screen.getByText('Search as I move the map')).toBeTruthy();

    // Check Leaflet OpenStreetMap attribution
    expect(screen.getByText(/OpenStreetMap/i)).toBeTruthy();
  });

  it('renders full map view with carousel cards', () => {
    render(
      <MemoryRouter>
        <ResultsMap listings={mockListings} isFullView={true} />
      </MemoryRouter>,
    );

    const titles = screen.getAllByText('Alfama Terracotta Loft');
    expect(titles.length).toBeGreaterThanOrEqual(1);
  });

  it('allows toggling search as move checkbox', () => {
    const onToggle = vi.fn();
    render(
      <MemoryRouter>
        <ResultsMap
          listings={mockListings}
          isFullView={false}
          searchAsMove={true}
          onSearchAsMoveChange={onToggle}
        />
      </MemoryRouter>,
    );

    const checkbox = screen.getByRole('checkbox');
    expect((checkbox as HTMLInputElement).checked).toBe(true);
    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith(false);
  });
});

describe('ListingLocationMap with Leaflet and OpenStreetMap', () => {
  it('renders location map preview for a listing', () => {
    const { container } = render(
      <ListingLocationMap
        listing={{
          id: 'stay-azulejo-loft',
          title: 'Azulejo Loft in Alfama',
          city: 'Lisbon',
          country: 'Portugal',
        }}
      />,
    );

    expect(container.querySelector('.location-leaflet-map-canvas')).toBeTruthy();
    expect(container.querySelector('.leaflet-container')).toBeTruthy();
    expect(screen.getByText(/OpenStreetMap/i)).toBeTruthy();
  });
});

describe('LocationPickerMap for Host in Listing Editor', () => {
  it('renders map with draggable pin and coordinate controls', () => {
    const onChange = vi.fn();
    const { container } = render(
      <LocationPickerMap
        listingId="listing-editor-1"
        city="Lisbon"
        country="PT"
        address="Rua Garrett 24"
        onChange={onChange}
      />,
    );

    expect(screen.getByText('Pin exact location on map')).toBeTruthy();
    expect(container.querySelector('.location-picker-canvas')).toBeTruthy();
    expect(container.querySelector('.leaflet-container')).toBeTruthy();
    expect(screen.getByText(/Lat:/i)).toBeTruthy();
    expect(screen.getByText(/Lng:/i)).toBeTruthy();
    expect(screen.getByText(/Show guest search radius/i)).toBeTruthy();

    const centerBtn = screen.getByRole('button', { name: /Center on Lisbon/i });
    expect(centerBtn).toBeTruthy();
    fireEvent.click(centerBtn);
    expect(onChange).toHaveBeenCalled();
  });
});
