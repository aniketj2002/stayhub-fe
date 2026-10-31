// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VersionDiffPage } from './VersionDiffPage';
import * as listingsApi from './api';
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

const mockDiffResponse = {
  version_id: 'ver-2',
  listing_id: 'list-1',
  version_no: 2,
  live_version_no: 1,
  status: 'submitted',
  submitted_at: '2026-10-31T09:00:00Z',
  field_diffs: {
    title: {
      old: 'Old Alfama Loft',
      new: 'Azulejo Loft in Alfama with Terrace',
    },
    base_price_minor: {
      old: 10000,
      new: 12800,
    },
    description: {
      old: 'A basic flat.',
      new: 'A newly renovated loft featuring original azulejos.',
    },
  },
  photos_diff: {
    added: ['photo-uuid-1', 'photo-uuid-2'],
    removed: ['photo-uuid-old'],
    reordered: true,
  },
};

describe('VersionDiffPage', () => {
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

  it('renders side-by-side field diffs and photos diff', () => {
    vi.spyOn(listingsApi, 'useVersionDiff').mockReturnValue({
      data: mockDiffResponse,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin/listing-reviews/ver-2/diff']}>
          <Routes>
            <Route
              path="/admin/listing-reviews/:versionId/diff"
              element={<VersionDiffPage />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Header info
    expect(screen.getByText('Reviewing Version 2')).toBeTruthy();
    expect(screen.getByText(/Live Version 1/)).toBeTruthy();

    // Field names and diff values
    expect(screen.getByText('title')).toBeTruthy();
    expect(screen.getByText('Old Alfama Loft')).toBeTruthy();
    expect(screen.getByText('Azulejo Loft in Alfama with Terrace')).toBeTruthy();

    expect(screen.getByText('base price minor')).toBeTruthy();
    expect(screen.getByText('10000')).toBeTruthy();
    expect(screen.getByText('12800')).toBeTruthy();

    // Photos diff
    expect(screen.getByText('+2 Added')).toBeTruthy();
    expect(screen.getByText('-1 Removed')).toBeTruthy();
    expect(screen.getByText('Photos Reordered')).toBeTruthy();

    // Action buttons
    expect(screen.getByRole('button', { name: /approve version/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /request changes/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /reject version/i })).toBeTruthy();
  });
});

