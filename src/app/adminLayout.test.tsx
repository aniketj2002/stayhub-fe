// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminLayout } from './adminLayout';
import * as session from '../features/auth/session';
import type { Tokens } from '../features/auth/types';

const mockAdminTokens: Tokens = {
  subject_type: 'admin',
  admin: {
    id: 'adm_987654321',
    email: 'admin.elena@stayhub.dev',
    full_name: 'Elena Rostova',
    role: 'super_admin',
  },
  access_token: 'test-admin-token',
  refresh_token: 'test-admin-refresh',
  expires_in: 3600,
};

describe('AdminLayout Shell', () => {
  beforeEach(() => {
    session.acceptSession(mockAdminTokens);
  });

  afterEach(() => {
    cleanup();
    session.expireSession();
    vi.unstubAllGlobals();
  });

  it('renders all admin sidebar navigation links', () => {
    render(
      <MemoryRouter initialEntries={['/admin/reservations']}>
        <AdminLayout />
      </MemoryRouter>,
    );

    // Sidebar Brand
    expect(screen.getByText('StayHub')).toBeTruthy();
    expect(screen.getByText('Platform Admin')).toBeTruthy();

    // Nav links
    expect(screen.getByRole('link', { name: /reservations/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /listing reviews/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /cases & claims/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /fees & policy/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /audit log/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /admins & roles/i })).toBeTruthy();
  });

  it('renders logged-in admin user identity and role badge in the dark sidebar', () => {
    render(
      <MemoryRouter initialEntries={['/admin/reservations']}>
        <AdminLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText('Elena Rostova')).toBeTruthy();
    expect(screen.getByText('Super Admin')).toBeTruthy();
    expect(screen.getByText('ER')).toBeTruthy(); // Initials
  });

  it('renders header top bar with breadcrumb and exit controls', () => {
    render(
      <MemoryRouter initialEntries={['/admin/reservations']}>
        <AdminLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText('Exit to site')).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy();
    const breadcrumbs = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(breadcrumbs.textContent).toContain('Reservations');
  });

  it('restricts access when user is not an admin', () => {
    session.expireSession('admin');
    session.acceptSession({
      subject_type: 'user',
      user: {
        id: 'usr_1',
        email: 'traveler@example.com',
        full_name: 'Traveler Joe',
        is_guest: true,
        is_host: false,
      },
      access_token: 'usr-tok',
      refresh_token: 'usr-ref',
      expires_in: 3600,
    });

    render(
      <MemoryRouter initialEntries={['/admin/reservations']}>
        <AdminLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText('This area uses a different account')).toBeTruthy();
    expect(screen.queryByText('Platform Admin')).toBeNull();
  });
});
