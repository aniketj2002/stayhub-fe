export interface FilterState {
  placeType: string; // 'any' | 'entire_home' | 'room' | 'shared'
  minPrice: number;
  maxPrice: number;
  bedrooms: number | null;
  beds: number | null;
  amenities: string[];
  guestFavorite: boolean;
  superhost: boolean;
  instantBook: boolean;
}

export const DEFAULT_FILTERS: FilterState = {
  placeType: 'entire_home',
  minPrice: 60,
  maxPrice: 180,
  bedrooms: null,
  beds: 2,
  amenities: ['wifi', 'kitchen', 'self_check_in'],
  guestFavorite: true,
  superhost: false,
  instantBook: false,
};
