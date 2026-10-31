import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSession, expireSession } from '../features/auth/session';
import { RequireSession } from '../features/auth/guards';
import { Badge } from '../components/ui';
import { setReservationChromeCode, useReservationChromeCode } from './adminChrome';

export function AdminLayout() {
  const session = useSession('admin');
  const location = useLocation();
  const navigate = useNavigate();
  const reservationCode = useReservationChromeCode();
  const [headerQuery, setHeaderQuery] = useState('');
  const isReservationDetail = /^\/admin\/reservations\/[^/]+$/.test(location.pathname);

  useEffect(() => {
    if (!isReservationDetail) setReservationChromeCode(null);
  }, [isReservationDetail]);

  const admin = session.identity?.subject_type === 'admin' ? session.identity.admin : null;
  const adminName = admin?.full_name || admin?.email || 'Admin User';
  const adminInitials = admin?.full_name
    ? admin.full_name
        .split(' ')
        .map((p: string) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'AD';

  const roleDisplay = admin?.role
    ? admin.role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Admin';

  // Compute section breadcrumb label
  const path = location.pathname;
  let sectionLabel = 'Dashboard';
  if (path.includes('/reservations')) {
    sectionLabel = 'Reservations';
  } else if (path.includes('/listing-reviews')) {
    sectionLabel = 'Listing Reviews';
  } else if (path.includes('/cases')) {
    sectionLabel = 'Cases & Claims';
  } else if (path.includes('/fees')) {
    sectionLabel = 'Fees & Policy';
  } else if (path.includes('/audit')) {
    sectionLabel = 'Audit Log';
  } else if (path.includes('/admins')) {
    sectionLabel = 'Admins & Roles';
  }

  return (
    <RequireSession role="admin">
      <div className="admin-dashboard-shell">
        {/* Dark Sidebar (240px rail) */}
        <aside className="admin-sidebar" aria-label="Admin Navigation">
          {/* Brand Header */}
          <div className="admin-sidebar-brand-wrapper">
            <Link to="/admin/reservations" className="admin-sidebar-brand" aria-label="StayHub Admin">
              <div className="admin-brand-top-row">
                <div className="admin-brand-badge" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.1L1 12h3v9h6v-6h4v6h6v-9h3L12 2.1zm0 3.7l6 5.4V19h-2v-6H8v6H6v-7.8l6-5.4z" />
                  </svg>
                </div>
                <span className="admin-brand-title">StayHub</span>
              </div>
              <span className="admin-brand-subtitle">Platform Admin</span>
            </Link>
          </div>

          {/* Navigation Items */}
          <nav className="admin-sidebar-nav" aria-label="Admin Sections">
            <NavLink
              to="/admin/reservations"
              className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <svg
                className="admin-sidebar-icon"
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
              <span>Reservations</span>
            </NavLink>

            <NavLink
              to="/admin/listing-reviews"
              className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <svg
                className="admin-sidebar-icon"
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
              <span>Listing Reviews</span>
            </NavLink>

            <NavLink
              to="/admin/cases"
              className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <svg
                className="admin-sidebar-icon"
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
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Cases & Claims</span>
            </NavLink>

            <NavLink
              to="/admin/fees"
              className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <svg
                className="admin-sidebar-icon"
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
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span>Fees & Policy</span>
            </NavLink>

            <NavLink
              to="/admin/audit"
              className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <svg
                className="admin-sidebar-icon"
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
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>Audit Log</span>
            </NavLink>

            <NavLink
              to="/admin/admins"
              className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <svg
                className="admin-sidebar-icon"
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
              <span>Admins & Roles</span>
            </NavLink>
          </nav>

          {/* Bottom Admin User Profile */}
          <div className="admin-sidebar-profile">
            <div className="admin-profile-avatar" aria-hidden="true">
              {adminInitials}
            </div>
            <div className="admin-profile-info">
              <span className="admin-profile-name" title={adminName}>
                {adminName}
              </span>
              <span className="admin-profile-badge">
                <Badge tone="accent">{roleDisplay}</Badge>
              </span>
            </div>
          </div>
        </aside>

        {/* Main Admin Area */}
        <div className="admin-dashboard-main">
          {/* Top Header Bar (56px) */}
          <header className="admin-top-header">
            {/* Breadcrumb / Title */}
            <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
              {isReservationDetail ? (
                <>
                  <Link to="/admin/reservations" className="admin-breadcrumb-root">
                    Operations
                  </Link>
                  <span className="admin-breadcrumb-sep">/</span>
                  <Link to="/admin/reservations" className="admin-breadcrumb-root">
                    Reservations
                  </Link>
                  <span className="admin-breadcrumb-sep">/</span>
                  <span className="admin-breadcrumb-active">{reservationCode || 'Reservation'}</span>
                </>
              ) : location.pathname.includes('/audit') ? (
                <>
                  <Link to="/admin/reservations" className="admin-breadcrumb-root">
                    Operations
                  </Link>
                  <span className="admin-breadcrumb-sep">/</span>
                  <span className="admin-breadcrumb-active">Audit Log</span>
                </>
              ) : (
                <>
                  <span className="admin-breadcrumb-root">Admin</span>
                  <span className="admin-breadcrumb-sep">/</span>
                  <span className="admin-breadcrumb-active">{sectionLabel}</span>
                </>
              )}
            </nav>

            {/* Right Top Bar Actions */}
            <div className="admin-top-actions">
              <form
                className="admin-header-search"
                role="search"
                onSubmit={(event) => {
                  event.preventDefault();
                  const code = headerQuery.trim();
                  navigate(
                    code
                      ? `/admin/reservations?code=${encodeURIComponent(code)}`
                      : '/admin/reservations',
                  );
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <line x1="16.5" y1="16.5" x2="21" y2="21" />
                </svg>
                <input
                  type="search"
                  value={headerQuery}
                  onChange={(event) => setHeaderQuery(event.target.value)}
                  placeholder="Search"
                  aria-label="Search reservations"
                />
              </form>

              {/* Dummy notification button pending F-P6 */}
              <button
                type="button"
                className="admin-notif-button"
                aria-label="Admin alerts"
                title="System alerts (Phase 6)"
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
              </button>

              <Link to="/" className="admin-switch-btn" title="Return to guest marketplace">
                Exit to site
              </Link>

              <button
                type="button"
                onClick={() => void expireSession()}
                className="admin-signout-btn"
                aria-label="Sign out"
              >
                Sign out
              </button>
            </div>
          </header>

          {/* Admin Content Outlet (28px padding) */}
          <main id="admin-main" className="admin-dashboard-content" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </RequireSession>
  );
}

