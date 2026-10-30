import { request } from '../../lib/api';
import type {
  Amenity,
  CalendarData,
  HostListing,
  HostSummary,
  Policy,
  PublicListing,
  Quote,
  SearchCard,
  StaySelection,
  SubmitResult,
  WorkingPatch,
} from './types';
const hostPath = (id: string) => `/api/v1/host/listings/${encodeURIComponent(id)}`;
export const listingKeys = {
  all: ['host-listings'] as const,
  detail: (id: string) => ['host-listing', id] as const,
  public: (id: string) => ['public-listing', id] as const,
};
export const hostListings = (signal?: AbortSignal) =>
  request<{ listings: HostSummary[] | null; count: number }>('/api/v1/host/listings', { signal });
export const createListing = () =>
  request<HostListing>('/api/v1/host/listings', {
    method: 'POST',
    body: { currency: 'EUR', timezone: 'Europe/Lisbon' },
  });
export const hostListing = (id: string, signal?: AbortSignal) =>
  request<HostListing>(hostPath(id), { signal });
export const saveListing = (id: string, body: WorkingPatch) =>
  request<HostListing>(`${hostPath(id)}/working-version`, { method: 'PATCH', body });
export const submitListing = (id: string) =>
  request<SubmitResult>(`${hostPath(id)}/submit`, { method: 'POST' });
export const amenitiesCatalog = (signal?: AbortSignal) =>
  request<{ amenities: Amenity[] | null }>('/api/v1/catalog/amenities', { signal, auth: false });
export const policiesCatalog = (signal?: AbortSignal) =>
  request<{ cancellation_policies: Policy[] | null }>('/api/v1/catalog/cancellation-policies', {
    signal,
    auth: false,
  });
export const getCalendar = (id: string, start: string, end: string, signal?: AbortSignal) =>
  request<CalendarData>(
    `${hostPath(id)}/calendar?${new URLSearchParams({ start_date: start, end_date: end })}`,
    { signal },
  );
export const changeCalendar = (
  id: string,
  start: string,
  end: string,
  block: boolean,
  reason?: string,
) =>
  request<CalendarData>(`${hostPath(id)}/calendar/block`, {
    method: block ? 'PUT' : 'DELETE',
    body: { start_date: start, end_date: end, ...(block ? { block_reason: reason || '' } : {}) },
  });
export const searchListings = (params: URLSearchParams, signal?: AbortSignal) =>
  request<{ listings: SearchCard[] | null; count: number }>(`/api/v1/listings/search?${params}`, {
    signal,
    auth: false,
  });
export const publicListing = (id: string, signal?: AbortSignal) =>
  request<{ listing: PublicListing }>(`/api/v1/listings/${encodeURIComponent(id)}`, {
    signal,
    auth: false,
  });
export const getQuote = (id: string, selection: StaySelection, signal?: AbortSignal) =>
  request<{ quote: Quote }>(`/api/v1/listings/${encodeURIComponent(id)}/quote`, {
    method: 'POST',
    body: selection,
    signal,
    auth: false,
  });
