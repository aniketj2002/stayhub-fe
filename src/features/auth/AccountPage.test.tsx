// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountPage } from './pages';
import * as session from './session';
import type { Tokens } from './types';

const mockUser = {
  id: 'usr_abc123456789',
  email: 'alex.rivera@example.com',
  full_name: 'Alex Rivera',
  is_guest: true,
  is_host: true,
  avatar_url: 'https://example.com/avatar.jpg',
  created_at: '2024-03-15T10:00:00Z',
};

const mockTokens: Tokens = {
  subject_type: 'user',
  user: mockUser,
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
};

describe('AccountPage Enhanced Experience', () => {
  beforeEach(() => {
    session.acceptSession(mockTokens);
  });

  afterEach(() => {
    cleanup();
    session.expireSession();
    vi.unstubAllGlobals();
  });

  it('renders the hero profile card with user information and badges', () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('YOUR ACCOUNT')).toBeTruthy();
    expect(screen.getByText('Hello, Alex.')).toBeTruthy();
    expect(screen.getByText('alex.rivera@example.com')).toBeTruthy();
    expect(screen.getByText('Guest & host')).toBeTruthy();
    expect(screen.getByText('Member since March 2024')).toBeTruthy();
    expect(screen.getByText(/ID: usr_abc1/)).toBeTruthy();
  });

  it('navigates between Profile details, Hosting & Stays, and Security tabs', () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );

    // Default tab is Profile details
    expect(screen.getByLabelText('Full name')).toBeTruthy();
    expect(screen.getByText('Profile photo')).toBeTruthy();

    // Click Hosting & Stays
    fireEvent.click(screen.getByRole('button', { name: /Hosting & Stays/i }));
    expect(screen.getByText('Host Workspace')).toBeTruthy();
    expect(screen.getByText('Host Today')).toBeTruthy();
    expect(screen.getByText('My Listings')).toBeTruthy();
    expect(screen.getByText('Availability Calendar')).toBeTruthy();
    expect(screen.getByText('Earnings & Payouts')).toBeTruthy();

    // Click Security & Session
    fireEvent.click(screen.getByRole('button', { name: /Security & Session/i }));
    expect(screen.getByText('Session & Security')).toBeTruthy();
    expect(screen.getByText('usr_abc123456789')).toBeTruthy();
    expect(screen.getByText('Sign out of StayHub')).toBeTruthy();
  });

  it('renders the "Become a host" showcase when the user is not a host', () => {
    session.acceptSession({
      ...mockTokens,
      user: { ...mockUser, is_host: false },
    });

    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );

    // Switch to hosting tab
    fireEvent.click(screen.getByRole('button', { name: /Hosting & Stays/i }));
    expect(screen.getByText('Turn your space into extraordinary earnings')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Become a host now/i })).toBeTruthy();
  });

  it('preserves all standard action links and buttons for compatibility', () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Hosting & Stays/i }));
    expect(screen.getByRole('link', { name: /Your trips/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Switch to hosting/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Manage photo uploads/i })).toBeTruthy();
  });
});
