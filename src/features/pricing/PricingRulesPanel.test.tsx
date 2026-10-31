// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PricingRulesPanel } from './PricingRulesPanel';
import * as pricingApi from './api';

const mockListingId = 'lst-12345';

const mockRules = {
  listing_id: mockListingId,
  weekend_price_minor: 12000,
  min_nights: 2,
  weekly_discount_bps: 1000,
  monthly_discount_bps: 2000,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('PricingRulesPanel', () => {
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

  it('renders existing rules correctly', async () => {
    vi.spyOn(pricingApi, 'usePricingRules').mockReturnValue({
      data: mockRules,
      isLoading: false,
    } as any);

    vi.spyOn(pricingApi, 'useUpdatePricingRules').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <PricingRulesPanel listingId={mockListingId} basePriceMinor={10000} />
      </QueryClientProvider>,
    );

    expect(screen.getByDisplayValue('120.00')).toBeTruthy();
    expect(screen.getByDisplayValue('2')).toBeTruthy();
    expect(screen.getByDisplayValue('10')).toBeTruthy();
    expect(screen.getByDisplayValue('20')).toBeTruthy();
  });

  it('submits updated rules with basis points and minor units', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.spyOn(pricingApi, 'usePricingRules').mockReturnValue({
      data: mockRules,
      isLoading: false,
    } as any);

    vi.spyOn(pricingApi, 'useUpdatePricingRules').mockReturnValue({
      mutateAsync,
      isPending: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <PricingRulesPanel listingId={mockListingId} basePriceMinor={10000} />
      </QueryClientProvider>,
    );

    const weekendInput = screen.getByLabelText(/weekend price/i);
    fireEvent.change(weekendInput, { target: { value: '150.00' } });

    const submitBtn = screen.getByRole('button', { name: /save pricing rules/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        listingId: mockListingId,
        input: {
          weekend_price_minor: 15000,
          min_nights: 2,
          weekly_discount_bps: 1000,
          monthly_discount_bps: 2000,
        },
      });
    });
  });

  it('displays validation error if weekly discount is out of bounds', async () => {
    vi.spyOn(pricingApi, 'usePricingRules').mockReturnValue({
      data: mockRules,
      isLoading: false,
    } as any);

    vi.spyOn(pricingApi, 'useUpdatePricingRules').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <PricingRulesPanel listingId={mockListingId} basePriceMinor={10000} />
      </QueryClientProvider>,
    );

    const weeklyInput = screen.getByLabelText(/weekly discount/i);
    fireEvent.change(weeklyInput, { target: { value: '150' } });

    const submitBtn = screen.getByRole('button', { name: /save pricing rules/i });
    fireEvent.submit(submitBtn.closest('form')!);

    expect(screen.getByText(/weekly discount must be between 0% and 99%/i)).toBeTruthy();
  });
});
