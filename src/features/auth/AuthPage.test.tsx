// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthPage } from './pages';
import { SiteLayout } from '../../app/layouts';
import * as session from './session';
import * as api from '../../lib/api';
import type { Tokens } from './types';

const mockAdminTokens: Tokens = {
  subject_type: 'admin',
  admin: {
    id: 'adm_123',
    email: 'admin@stayhub.dev',
    full_name: 'Elena Rostova',
    role: 'super_admin',
  },
  access_token: 'test-admin-access',
  refresh_token: 'test-admin-refresh',
  expires_in: 3600,
};

const mockUserTokens: Tokens = {
  subject_type: 'user',
  user: {
    id: 'usr_123',
    email: 'claire.dubois@stayhub.dev',
    full_name: 'Claire Dubois',
    is_guest: true,
    is_host: false,
  },
  access_token: 'test-user-access',
  refresh_token: 'test-user-refresh',
  expires_in: 3600,
};

describe('AuthPage Redesigned Experience & Admin Routing', () => {
  beforeEach(() => {
    session.expireSession();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    session.expireSession();
    vi.unstubAllGlobals();
  });

  it('renders two workspace login tabs (Guest and Host) on normal login page', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthPage mode="login" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('tab', { name: /guest/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /host/i })).toBeTruthy();
    // Admin tab should NOT be present on normal /login
    expect(screen.queryByRole('tab', { name: /admin/i })).toBeNull();
    expect(screen.getByText('Quick demo:')).toBeTruthy();
    expect(screen.getByRole('button', { name: /claire \(guest\)/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /inês \(host\)/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /admin/i })).toBeNull();
  });

  it('renders dedicated admin console sign in on /admin/login', () => {
    render(
      <MemoryRouter initialEntries={['/admin/login']}>
        <AuthPage mode="admin" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Admin console sign in')).toBeTruthy();
    expect(screen.getByText('STAYHUB ADMIN · PLATFORM OPS')).toBeTruthy();
    expect(screen.getByRole('button', { name: /elena rostova \(super admin\)/i })).toBeTruthy();
    // Guest and host tabs should not appear on admin login
    expect(screen.queryByRole('tab', { name: /guest/i })).toBeNull();
  });

  it('switches persona tabs on normal login and updates contextual titles and copy', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthPage mode="login" />
      </MemoryRouter>,
    );

    // Initial is guest
    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.getByText('GUEST PORTAL · STAYHUB')).toBeTruthy();

    // Click Host tab
    fireEvent.click(screen.getByRole('tab', { name: /host/i }));
    expect(screen.getByText('Welcome back, host')).toBeTruthy();
    expect(screen.getByText('HOST WORKSPACE · STAYHUB')).toBeTruthy();
  });

  it('populates credentials when quick demo buttons are clicked on normal login', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthPage mode="login" />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^password/i) as HTMLInputElement;

    // Click Claire (Guest)
    fireEvent.click(screen.getByRole('button', { name: /claire \(guest\)/i }));
    expect(emailInput.value).toBe('claire.dubois@stayhub.dev');
    expect(passwordInput.value).toBe('Password123!');

    // Click Inês (Host)
    fireEvent.click(screen.getByRole('button', { name: /inês \(host\)/i }));
    expect(emailInput.value).toBe('ines.costa@stayhub.dev');
    expect(passwordInput.value).toBe('Password123!');
  });

  it('toggles password visibility with the eye icon', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthPage mode="login" />
      </MemoryRouter>,
    );

    const passwordInput = screen.getByLabelText(/^password/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    const toggleBtn = screen.getByLabelText(/show password/i);
    fireEvent.click(toggleBtn);
    expect(passwordInput.type).toBe('text');

    fireEvent.click(screen.getByLabelText(/hide password/i));
    expect(passwordInput.type).toBe('password');
  });

  it('routes admin user directly to /admin dashboard on /admin/login (never to /account)', async () => {
    vi.spyOn(api, 'request').mockResolvedValueOnce(mockAdminTokens);

    render(
      <MemoryRouter initialEntries={['/admin/login']}>
        <Routes>
          <Route path="/admin/login" element={<AuthPage mode="admin" />} />
          <Route path="/admin" element={<div data-testid="admin-dashboard">Admin Dashboard</div>} />
          <Route path="/account" element={<div data-testid="user-account">User Account</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /elena rostova \(super admin\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /sign in to admin dashboard/i }));

    await waitFor(() => {
      expect(screen.getByTestId('admin-dashboard')).toBeTruthy();
      expect(screen.queryByTestId('user-account')).toBeNull();
    });
  });

  it('manages user and admin sessions independently without leaking across portals', () => {
    // Start clean: both logged out
    expect(session.getUserSession().identity).toBeNull();
    expect(session.getAdminSession().identity).toBeNull();

    // Log in as user
    session.acceptSession(mockUserTokens);
    expect(session.getUserSession().identity?.user?.id).toBe('usr_123');
    expect(session.getAdminSession().identity).toBeNull();

    // Log in as admin
    session.acceptSession(mockAdminTokens);
    expect(session.getUserSession().identity?.user?.id).toBe('usr_123');
    expect(session.getAdminSession().identity?.admin?.id).toBe('adm_123');

    // Sign out user only
    session.expireSession('user');
    expect(session.getUserSession().identity).toBeNull();
    expect(session.getAdminSession().identity?.admin?.id).toBe('adm_123');

    // Sign out admin only
    session.expireSession('admin');
    expect(session.getAdminSession().identity).toBeNull();
  });

  it('redirects already logged-in admin users immediately to /admin when opening /admin/login', () => {
    session.acceptSession(mockAdminTokens);

    render(
      <MemoryRouter initialEntries={['/admin/login']}>
        <Routes>
          <Route path="/admin/login" element={<AuthPage mode="admin" />} />
          <Route path="/admin" element={<div data-testid="admin-dashboard">Admin Dashboard</div>} />
          <Route path="/account" element={<div data-testid="user-account">User Account</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('admin-dashboard')).toBeTruthy();
    expect(screen.queryByTestId('user-account')).toBeNull();
  });

  it('routes standard user to /account or returnTo on login', async () => {
    vi.spyOn(api, 'request').mockResolvedValueOnce(mockUserTokens);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/account" element={<div data-testid="user-account">User Account</div>} />
          <Route path="/admin" element={<div data-testid="admin-dashboard">Admin Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /claire \(guest\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /sign in as guest/i }));

    await waitFor(() => {
      expect(screen.getByTestId('user-account')).toBeTruthy();
      expect(screen.queryByTestId('admin-dashboard')).toBeNull();
    });
  });

  it('provides navigation between normal login and admin login portals', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthPage mode="login" />
      </MemoryRouter>,
    );

    const adminLink = screen.getByRole('link', { name: /platform administrator console/i });
    expect(adminLink.getAttribute('href')).toBe('/admin/login');
  });

  it('navigates to normal /login when clicking profile icon from SiteLayout while unauthenticated, even if admin session exists', () => {
    // Admin is logged in in adminState
    session.acceptSession(mockAdminTokens);

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<SiteLayout />} />
        </Routes>
      </MemoryRouter>,
    );

    const profileLink = screen.getByRole('link', { name: /log in menu/i });
    expect(profileLink.getAttribute('href')).toBe('/login');
  });

  it('normal /login page remains on guest/host login screen and does not redirect to /admin when admin session is active', () => {
    // Admin is logged in in adminState
    session.acceptSession(mockAdminTokens);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/admin" element={<div data-testid="admin-dashboard">Admin Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    // Should stay on normal login page, NOT redirect to admin dashboard
    expect(screen.queryByTestId('admin-dashboard')).toBeNull();
    expect(screen.getByRole('tab', { name: /guest/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /host/i })).toBeTruthy();
  });
});

