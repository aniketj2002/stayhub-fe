// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DateOverrideCalendar } from './DateOverrideCalendar';
import * as pricingApi from './api';

const mockListingId = 'lst-test-calendar';

describe('DateOverrideCalendar', () => {
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

  it('renders days of the current month with base price', () => {
    vi.spyOn(pricingApi, 'useDateOverrides').mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <DateOverrideCalendar listingId={mockListingId} basePriceMinor={12000} />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/custom date price overrides/i)).toBeTruthy();
    // Verify some day elements exist with base price €120
    const dayElements = screen.getAllByText('€120');
    expect(dayElements.length).toBeGreaterThan(0);
  });

  it('allows clicking a day to open override actions and apply custom price', async () => {
    const mutateSet = vi.fn().mockResolvedValue([]);
    vi.spyOn(pricingApi, 'useDateOverrides').mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    vi.spyOn(pricingApi, 'useSetDateOverrides').mockReturnValue({
      mutateAsync: mutateSet,
      isPending: false,
    } as any);

    vi.spyOn(pricingApi, 'useDeleteDateOverrides').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <DateOverrideCalendar listingId={mockListingId} basePriceMinor={10000} />
      </QueryClientProvider>,
    );

    // Click the 15th day
    const day15Buttons = screen.getAllByRole('button').filter((b) => b.textContent?.includes('15'));
    expect(day15Buttons.length).toBeGreaterThan(0);
    fireEvent.click(day15Buttons[0]);

    // Override action panel should appear
    expect(screen.getByText(/selected range:/i)).toBeTruthy();

    const priceInput = screen.getByLabelText(/custom price/i);
    fireEvent.change(priceInput, { target: { value: '185' } });

    const applyBtn = screen.getByRole('button', { name: /apply price/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(mutateSet).toHaveBeenCalled();
      const callArg = mutateSet.mock.calls[0][0];
      expect(callArg.listingId).toBe(mockListingId);
      expect(callArg.input.price_minor).toBe(18500);
    });
  });

  it('allows clearing overrides for a selected range', async () => {
    const mutateDelete = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(pricingApi, 'useDateOverrides').mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    vi.spyOn(pricingApi, 'useSetDateOverrides').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.spyOn(pricingApi, 'useDeleteDateOverrides').mockReturnValue({
      mutateAsync: mutateDelete,
      isPending: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <DateOverrideCalendar listingId={mockListingId} basePriceMinor={10000} />
      </QueryClientProvider>,
    );

    const day10Buttons = screen.getAllByRole('button').filter((b) => b.textContent?.includes('10'));
    fireEvent.click(day10Buttons[0]);

    const clearBtn = screen.getByRole('button', { name: /clear custom price/i });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(mutateDelete).toHaveBeenCalled();
    });
  });
});
