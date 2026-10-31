import { useState } from 'react';
import { useSession } from '../features/auth/session';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { HostBreadcrumbContext } from './breadcrumbContext';

export function Brand() {
  return (
    <Link className="stayhub-brand" to="/" aria-label="StayHub home">
      <div className="brand-logo-icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.1L1 12h3v9h6v-6h4v6h6v-9h3L12 2.1zm0 3.7l6 5.4V19h-2v-6H8v6H6v-7.8l6-5.4z" />
        </svg>
      </div>
      <span className="brand-name">StayHub</span>
    </Link>
  );
}

export function SiteLayout() {
  const location = useLocation();
  const session = useSession('user');
  const [activeTab, setActiveTab] = useState<'stays' | 'experiences' | 'services'>('stays');

  const isHost = location.pathname.startsWith('/host');
  const isAdmin = location.pathname.startsWith('/admin') && location.pathname !== '/admin/login';

  const user = session.identity?.subject_type === 'user' ? session.identity.user : null;

  const userInitials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((p: string) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '';

  // In hosting view (/host/*) or admin view (/admin/*), the dedicated shells render their own full-bleed layouts
  // matching the reference PDF design.
  if (isHost || isAdmin) {
    return (
      <div className={`site-wrapper ${isHost ? 'host-site-wrapper' : 'admin-site-wrapper'}`}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <main id="main" key={location.pathname} tabIndex={-1} className={isHost ? 'host-main-container' : 'admin-main-container'}>
          {session.status === 'ready' && session.error && (
            <p className="session-notice" role="alert">
              {session.error}
            </p>
          )}
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="site-wrapper">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {/* Top Navigation Shell (64px header · 48px gutters) */}
      <header className="stayhub-header">
        <div className="header-gutters">
          {/* Left: Brand */}
          <div className="header-left">
            <Brand />
          </div>

          {/* Center: Stays / Experiences / Services */}
          <nav className="header-nav-center" aria-label="Main category navigation">
            <NavLink
              to="/search"
              className={({ isActive }) =>
                `header-nav-link ${isActive || activeTab === 'stays' ? 'header-nav-link--active' : ''}`
              }
              onClick={() => setActiveTab('stays')}
            >
              Stays
            </NavLink>
            <button
              type="button"
              className={`header-nav-link ${activeTab === 'experiences' ? 'header-nav-link--active' : ''}`}
              onClick={() => setActiveTab('experiences')}
            >
              Experiences
            </button>
            <button
              type="button"
              className={`header-nav-link ${activeTab === 'services' ? 'header-nav-link--active' : ''}`}
              onClick={() => setActiveTab('services')}
            >
              Services
            </button>
          </nav>

          {/* Right: Switch to hosting / Globe / User pill */}
          <div className="header-right">
            {user && (
              <>
                <NavLink to="/trips" className="switch-hosting-btn">
                  Trips
                </NavLink>
                <NavLink to="/messages" className="switch-hosting-btn">
                  Messages
                </NavLink>
              </>
            )}
            <NavLink to="/host/listings" className="switch-hosting-btn">
              Switch to hosting
            </NavLink>

            <button type="button" className="globe-button" aria-label="Language and currency">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </button>

            <Link
              to={user ? '/account' : '/login'}
              className="user-menu-pill"
              aria-label={user ? 'Your account menu' : 'Log in menu'}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                aria-hidden="true"
              >
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              {user ? (
                user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name || 'Profile'}
                    className="user-avatar-circle"
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <span className="user-avatar-circle" aria-hidden="true">
                    {userInitials || 'U'}
                  </span>
                )
              ) : (
                <div className="user-avatar-placeholder" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main id="main" key={location.pathname} tabIndex={-1} className="main-content-area">
        {session.status === 'ready' && session.error && (
          <p className="session-notice" role="alert">
            {session.error}
          </p>
        )}
        <Outlet />
      </main>

      <footer className="site-footer">
        <div>
          <Brand />
          <span>Good places. Great memories.</span>
        </div>
        <p>
          © {new Date().getFullYear()} StayHub <span>Made for feeling at home.</span>
        </p>
      </footer>
    </div>
  );
}

export function HostLayout() {
  const location = useLocation();
  const session = useSession();
  const [breadcrumbTrail, setBreadcrumbTrail] = useState<string[] | null>(null);

  const user = session.identity?.subject_type === 'user' ? session.identity.user : null;
  const userInitials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((p: string) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'MA';
  const userName = user?.full_name || 'Marisol Aguilar';

  // Compute breadcrumbs dynamically based on path
  const path = location.pathname;
  let defaultItems = ['Listings'];
  if (path.includes('/calendar')) {
    defaultItems = ['Calendar'];
  } else if (path.includes('/edit')) {
    defaultItems = ['Listings', 'Edit'];
  } else if (path.includes('/today')) {
    defaultItems = ['Today'];
  } else if (path.includes('/earnings')) {
    defaultItems = ['Earnings'];
  } else if (path.includes('/reservations')) {
    defaultItems = ['Reservations'];
  } else if (path.includes('/messages')) {
    defaultItems = ['Messages'];
  }

  const breadcrumbItems = breadcrumbTrail || defaultItems;

  return (
    <HostBreadcrumbContext.Provider value={{ breadcrumbTrail, setBreadcrumbTrail }}>
      <div className="host-dashboard-shell">
        {/* Left Sidebar */}
        <aside className="host-sidebar" aria-label="Hosting navigation">
          {/* Brand Header */}
          <div className="host-sidebar-brand-wrapper">
            <Link to="/host/listings" className="host-sidebar-brand" aria-label="StayHub Hosting">
              <div className="host-brand-top-row">
                <div className="host-brand-badge" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.1L1 12h3v9h6v-6h4v6h6v-9h3L12 2.1zm0 3.7l6 5.4V19h-2v-6H8v6H6v-7.8l6-5.4z" />
                  </svg>
                </div>
                <span className="host-brand-title">StayHub</span>
              </div>
              <span className="host-brand-subtitle">Hosting</span>
            </Link>
          </div>

          {/* Navigation List */}
          <nav className="host-sidebar-nav" aria-label="Host sections">
            <NavLink
              to="/host/today"
              className={({ isActive }) => `host-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <svg
                className="host-sidebar-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
                <polyline points="9 21 9 12 15 12 15 21" />
              </svg>
              <span>Today</span>
            </NavLink>

            <NavLink
              to="/host/calendar"
              className={({ isActive }) => `host-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <svg
                className="host-sidebar-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>Calendar</span>
            </NavLink>

            <NavLink
              to="/host/listings"
              className={({ isActive }) => `host-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <svg
                className="host-sidebar-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="7.5" height="7.5" rx="1.2" />
                <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.2" />
                <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.2" />
                <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.2" />
              </svg>
              <span>Listings</span>
            </NavLink>

            {/* NOTE: Backend routes for host sub-features (Messages, Insights, Reviews, Co-hosts,
              Resources, Settings) are pending implementation. Rendered as dummy nav items for UI fidelity. */}
            <NavLink
              to="/host/messages"
              className={({ isActive }) => `host-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <svg
                className="host-sidebar-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>Messages</span>
            </NavLink>

            <NavLink
              to="/host/earnings"
              className={({ isActive }) => `host-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <svg
                className="host-sidebar-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              <span>Earnings</span>
            </NavLink>

            <NavLink
              to="/host/insights"
              className={({ isActive }) => `host-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <svg
                className="host-sidebar-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              <span>Insights</span>
            </NavLink>

            <NavLink
              to="/host/reviews"
              className={({ isActive }) => `host-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <svg
                className="host-sidebar-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>Reviews</span>
            </NavLink>

            <NavLink
              to="/host/co-hosts"
              className={({ isActive }) => `host-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <svg
                className="host-sidebar-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>Co-hosts</span>
            </NavLink>

            <NavLink
              to="/host/resources"
              className={({ isActive }) => `host-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <svg
                className="host-sidebar-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <line x1="7" y1="9" x2="17" y2="9" />
                <line x1="7" y1="13" x2="13" y2="13" />
              </svg>
              <span>Resources</span>
            </NavLink>

            <NavLink
              to="/host/settings"
              className={({ isActive }) => `host-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <svg
                className="host-sidebar-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Settings</span>
            </NavLink>
          </nav>

          {/* Bottom Host User Profile */}
          {/* NOTE: Superhost calculation and listing count aggregates are not yet implemented in backend.
            Rendered with session user or dummy fallback data. */}
          <div className="host-sidebar-profile">
            <div className="host-profile-avatar" aria-hidden="true">
              {userInitials}
            </div>
            <div className="host-profile-info">
              <span className="host-profile-name">{userName}</span>
              <span className="host-profile-badge">Superhost · 3 listings</span>
            </div>
          </div>
        </aside>

        {/* Main Host Area */}
        <div className="host-dashboard-main">
          {/* Top Header Bar */}
          <header className="host-top-header">
            {/* Breadcrumbs */}
            <nav className="host-breadcrumbs" aria-label="Breadcrumb">
              <span className="host-breadcrumb-root">Hosting</span>
              {breadcrumbItems.map((item, idx) => (
                <span key={item} className="host-breadcrumb-part">
                  <span className="host-breadcrumb-sep">/</span>
                  <span
                    className={
                      idx === breadcrumbItems.length - 1
                        ? 'host-breadcrumb-active'
                        : 'host-breadcrumb-link'
                    }
                  >
                    {item}
                  </span>
                </span>
              ))}
            </nav>

            {/* Right Top Bar Actions */}
            <div className="host-top-actions">
              {/* NOTE: Global host search index is pending backend implementation. Rendered as dummy control. */}
              <div className="host-search-container">
                <svg
                  className="host-search-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="host-search-input"
                  placeholder="Search"
                  aria-label="Search hosting"
                />
              </div>

              {/* NOTE: Host notification alerts API is pending implementation. Rendered as dummy button. */}
              <button
                type="button"
                className="host-notif-button"
                aria-label="Host notifications (1 unread)"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span className="host-notif-badge" aria-hidden="true" />
              </button>

              <Link to="/" className="host-switch-travel-btn">
                Switch to traveling
              </Link>
            </div>
          </header>

          {/* Content View */}
          <div className="host-dashboard-content">
            <Outlet />
          </div>
        </div>
      </div>
    </HostBreadcrumbContext.Provider>
  );
}

export function AuthLayout() {
  const location = useLocation();
  const isAdminPortal = location.pathname.startsWith('/admin');

  return (
    <div className="auth-shell">
      {/* Left Column: Authentic Brand Narrative & Reference Listing Mock (Page 2) */}
      <aside className="auth-story" aria-label="StayHub Brand Showcase">
        <div className="auth-story-inner">
          <div className="auth-story-brand">
            <Link to="/" className="auth-story-logo" aria-label="StayHub Home">
              <div className="brand-logo-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.1L1 12h3v9h6v-6h4v6h6v-9h3L12 2.1zm0 3.7l6 5.4V19h-2v-6H8v6H6v-7.8l6-5.4z" />
                </svg>
              </div>
              <span className="brand-name">StayHub</span>
            </Link>
            <span className="auth-brand-badge">
              {isAdminPortal ? 'Platform Operations' : 'Guest & Host Workspace'}
            </span>
          </div>

          <div className="auth-story-hero">
            <p className="auth-story-eyebrow">A PLACE FOR EVERY STAY</p>
            <h1 className="auth-story-headline">
              Arrive somewhere.
              <span className="auth-story-accent">Feel at home.</span>
            </h1>
            <p className="auth-story-desc">
              Discover unique architect-designed stays, manage boutique guest houses, or supervise platform operations across the global catalog.
            </p>
          </div>

          {/* Reference Listing Preview Card (Base Guide Mock Page 2) */}
          <div className="auth-preview-card" aria-hidden="true">
            <div className="auth-preview-media">
              <img
                src="https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80"
                alt="Azulejo Loft in Alfama"
                className="auth-preview-img"
              />
              <span className="auth-preview-pill">Guest favorite</span>
              <div className="auth-preview-like">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
            </div>
            <div className="auth-preview-details">
              <div className="auth-preview-header">
                <h3 className="auth-preview-title">Azulejo Loft in Alfama</h3>
                <span className="auth-preview-rating">★ 4.96 (212)</span>
              </div>
              <p className="auth-preview-meta">Lisbon · Entire loft · 2 guests</p>
              <div className="auth-preview-price-row">
                <span className="auth-preview-price"><strong>€128</strong> night</span>
                <span className="auth-preview-dates">Oct 14–19</span>
              </div>
            </div>
          </div>

          <div className="auth-story-footer">
            <div className="auth-story-chips">
              <span className="auth-token-chip">Figtree 800</span>
              <span className="auth-token-chip">Teal #0b6b5d</span>
              <span className="auth-token-chip">4px Base Grid</span>
            </div>
            <p className="auth-story-note">StayHub Platform & Design System · Desktop 1440 × 900</p>
          </div>
        </div>
      </aside>

      {/* Right Column: Active Auth Form Screen */}
      <div className="auth-content">
        <Outlet />
      </div>
    </div>
  );
}
