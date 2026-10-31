// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuditLogPage } from './AuditLogPage';
import * as auditApi from './api';
import * as session from '../../auth/session';
import type { Tokens } from '../../auth/types';

const mockAdminTokens: Tokens = {
  subject_type: 'admin',
  admin: {
    id: 'adm_123',
    email: 'admin@stayhub.dev',
    full_name: 'Elena Rostova',
    role: 'super_admin',
  },
  access_token: 'test-tok',
  refresh_token: 'test-ref',
  expires_in: 3600,
};

const mockAuditResponse = {
  count: 2,
  events: [
    {
      id: 101,
      occurred_at: '2026-10-31T11:00:00Z',
      actor_type: 'admin',
      actor_id: 'adm_12345678',
      action: 'reservation.refund',
      object_type: 'reservation',
      object_id: 'res_87654321',
      reason: 'Guest lock failure compensation',
      request_id: 'req_11111111',
    },
    {
      id: 102,
      occurred_at: '2026-10-31T11:30:00Z',
      actor_type: 'system',
      action: 'payout.scheduled',
      object_type: 'payout',
      object_id: 'pay_99999999',
      reason: 'Automatic release countdown',
      request_id: 'req_22222222',
    },
  ],
};

describe('AuditLogPage', () => {
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

  it('renders audit events table and triggers CSV export on click', async () => {
    vi.spyOn(auditApi, 'useAuditLog').mockReturnValue({
      data: mockAuditResponse,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    const exportSpy = vi.spyOn(auditApi, 'exportAuditCSV').mockResolvedValue();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuditLogPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Audit log' })).toBeTruthy();
    expect(screen.getByText('Every admin action · immutable · retained 7 years')).toBeTruthy();
    expect(screen.getAllByText('Issued refund').length).toBeGreaterThan(0);
    expect(screen.getByText('Guest lock failure compensation')).toBeTruthy();
    expect(screen.getAllByText('Scheduled payout').length).toBeGreaterThan(0);
    expect(screen.getByText('Approve / release')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Before → after' })).toBeTruthy();

    // Export button click triggers export
    const exportBtn = screen.getByRole('button', { name: /export csv/i });
    fireEvent.click(exportBtn);

    expect(exportSpy).toHaveBeenCalledTimes(1);
  });
});

