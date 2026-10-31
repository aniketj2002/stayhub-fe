// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IcalPanel } from './IcalPanel';
import * as icalApi from './api';

const mockListingId = 'lst-test-ical';

const mockFeeds = [
  {
    id: 'feed-1',
    listing_id: mockListingId,
    name: 'Airbnb Calendar',
    url: 'https://airbnb.com/calendar.ics',
    sync_status: 'ok',
    last_synced_at: '2026-02-01T12:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
  },
];

describe('IcalPanel', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders export URL and active imported feeds', () => {
    vi.spyOn(icalApi, 'useIcalFeeds').mockReturnValue({
      data: mockFeeds,
      isLoading: false,
    } as any);
    vi.spyOn(icalApi, 'useAddIcalFeed').mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.spyOn(icalApi, 'useDeleteIcalFeed').mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.spyOn(icalApi, 'useRegenerateExportToken').mockReturnValue({ mutateAsync: vi.fn() } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <IcalPanel listingId={mockListingId} />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { name: /export your stayhub calendar/i })).toBeTruthy();
    expect(screen.getByText('Airbnb Calendar')).toBeTruthy();
    expect(screen.getByText(/last synced/i)).toBeTruthy();
  });

  it('validates URL protocol when adding a feed', async () => {
    vi.spyOn(icalApi, 'useIcalFeeds').mockReturnValue({
      data: [],
      isLoading: false,
    } as any);
    vi.spyOn(icalApi, 'useAddIcalFeed').mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.spyOn(icalApi, 'useDeleteIcalFeed').mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.spyOn(icalApi, 'useRegenerateExportToken').mockReturnValue({ mutateAsync: vi.fn() } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <IcalPanel listingId={mockListingId} />
      </QueryClientProvider>,
    );

    const nameInput = screen.getByLabelText(/calendar name/i);
    const urlInput = screen.getByLabelText(/calendar \.ics address/i);
    const addBtn = screen.getByRole('button', { name: /add calendar/i });

    fireEvent.change(nameInput, { target: { value: 'VRBO' } });
    fireEvent.change(urlInput, { target: { value: 'ftp://bad-url' } });
    fireEvent.click(addBtn);

    expect(screen.getByText(/valid web calendar url starting with http:\/\/ or https:\/\//i)).toBeTruthy();
  });

  it('submits valid new feed', async () => {
    const addMutate = vi.fn().mockResolvedValue({});
    vi.spyOn(icalApi, 'useIcalFeeds').mockReturnValue({
      data: [],
      isLoading: false,
    } as any);
    vi.spyOn(icalApi, 'useAddIcalFeed').mockReturnValue({ mutateAsync: addMutate } as any);
    vi.spyOn(icalApi, 'useDeleteIcalFeed').mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.spyOn(icalApi, 'useRegenerateExportToken').mockReturnValue({ mutateAsync: vi.fn() } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <IcalPanel listingId={mockListingId} />
      </QueryClientProvider>,
    );

    const nameInput = screen.getByLabelText(/calendar name/i);
    const urlInput = screen.getByLabelText(/calendar \.ics address/i);
    const addBtn = screen.getByRole('button', { name: /add calendar/i });

    fireEvent.change(nameInput, { target: { value: 'VRBO Feed' } });
    fireEvent.change(urlInput, { target: { value: 'https://vrbo.com/ical.ics' } });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(addMutate).toHaveBeenCalledWith({
        listingId: mockListingId,
        input: {
          name: 'VRBO Feed',
          url: 'https://vrbo.com/ical.ics',
        },
      });
    });
  });
});
