// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeeConfigPage } from './FeeConfigPage';
import * as feeApi from './api';
import * as session from '../../auth/session';
import type { Tokens } from '../../auth/types';

const currentAdminId = 'adm_123';

const mockAdminTokens: Tokens = {
  subject_type: 'admin',
  admin: {
    id: currentAdminId,
    email: 'finance.lead@stayhub.dev',
    full_name: 'Elena Rostova',
    role: 'finance',
  },
  access_token: 'test-tok',
  refresh_token: 'test-ref',
  expires_in: 3600,
};

const mockFeeConfigs = {
  count: 3,
  fee_configs: [
    {
      id: 'cfg-active',
      guest_fee_bps: 1400,
      host_fee_bps: 300,
      status: 'active',
      proposed_by: 'adm_old',
      approved_by: 'adm_super',
      reason: 'Standard baseline schedule',
      created_at: '2026-01-01T00:00:00Z',
      activated_at: '2026-01-02T00:00:00Z',
    },
    {
      id: 'cfg-prop-by-me',
      guest_fee_bps: 1500,
      host_fee_bps: 350,
      status: 'pending',
      proposed_by: currentAdminId, // PROPOSED BY ME
      reason: 'Inflation adjustment proposal',
      created_at: '2026-10-30T10:00:00Z',
    },
    {
      id: 'cfg-prop-by-other',
      guest_fee_bps: 1200,
      host_fee_bps: 250,
      status: 'pending',
      proposed_by: 'adm_other_456', // PROPOSED BY ANOTHER ADMIN
      reason: 'Summer promotion proposal',
      created_at: '2026-10-31T08:00:00Z',
    },
  ],
};

describe('FeeConfigPage - Second Approver Rule', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    session.acceptSession(mockAdminTokens);
  });

  afterEach(() => {
    cleanup();
    session.expireSession();
    vi.restoreAllMocks();
  });

  it('disables approve and reject buttons when the logged-in admin is the proposer', () => {
    vi.spyOn(feeApi, 'useFeeConfigs').mockReturnValue({
      data: mockFeeConfigs,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FeeConfigPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Active KPI schedule rendered
    expect(screen.getByText('Active Rate Schedule')).toBeTruthy();
    expect(screen.getByText('14.0%')).toBeTruthy();
    expect(screen.getByText('3.0%')).toBeTruthy();

    // Query approve buttons
    const approveButtons = screen.getAllByRole('button', { name: /^approve$/i });
    expect(approveButtons.length).toBe(2);

    // First pending proposal (proposed by me) should have DISABLED approve button
    expect((approveButtons[0] as HTMLButtonElement).disabled).toBe(true);

    // Second pending proposal (proposed by other) should have ENABLED approve button
    expect((approveButtons[1] as HTMLButtonElement).disabled).toBe(false);

    // Same for reject buttons
    const rejectButtons = screen.getAllByRole('button', { name: /^reject$/i });
    expect(rejectButtons.length).toBe(2);
    expect((rejectButtons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((rejectButtons[1] as HTMLButtonElement).disabled).toBe(false);
  });
});
