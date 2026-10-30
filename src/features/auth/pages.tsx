import { fieldErrors } from './validation';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, ErrorPanel, Field, Skeleton, SuccessNotice } from '../../components/ui';
import { ApiError, request } from '../../lib/api';
import { PhotoUploader } from '../media/PhotoUploader';
import { acceptSession, becomeHost, safeReturnTo, signOut, updateProfile, useSession } from './session';
import type { Tokens } from './types';

export function AuthPage({ mode }: { mode: 'login' | 'register' | 'admin' }) {
  const session = useSession();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const fields = fieldErrors(error);
  const registering = mode === 'register';
  const admin = mode === 'admin';
  const returnTo = safeReturnTo(params.get('returnTo'));
  if (session.status === 'loading')
    return (
      <div className="page-content">
        <Skeleton label="Restoring your session" />
      </div>
    );
  if (session.identity) {
    if (
      (admin && session.identity.subject_type === 'admin') ||
      (!admin && session.identity.subject_type === 'user')
    )
      return <Navigate to={admin ? '/account' : returnTo} replace />;
    return (
      <div className="page-content">
        <h1>Switch accounts</h1>
        <p>
          You are signed in with a {session.identity.subject_type} account. Sign out on your account
          page before using this login.
        </p>
        <Link className="button button--primary" to="/account">
          Your account
        </Link>
      </div>
    );
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password'));
    if (
      registering &&
      (new TextEncoder().encode(password).length < 8 ||
        new TextEncoder().encode(password).length > 72)
    ) {
      setError(
        new ApiError(400, 'VALIDATION_ERROR', 'Please check your password.', [
          { field: 'password', message: 'Use 8–72 UTF-8 bytes for your password.' },
        ]),
      );
      setBusy(false);
      return;
    }
    try {
      const tokens = await request<Tokens>(
        `/api/v1/auth/${registering ? 'register' : admin ? 'admin/login' : 'login'}`,
        {
          method: 'POST',
          auth: false,
          body: {
            email: String(data.get('email')).trim(),
            password,
            ...(registering
              ? {
                  full_name: String(data.get('full_name')).trim(),
                  is_host: data.get('is_host') === 'on',
                }
              : {}),
          },
        },
      );
      acceptSession(tokens);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const query = `?returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <section className="page-content auth-form">
      <p className="eyebrow">{admin ? 'STAYHUB ADMIN' : 'YOUR ACCOUNT'}</p>
      <h1>{registering ? 'Make yourself at home' : admin ? 'Admin sign in' : 'Welcome back'}</h1>
      <p>
        {registering
          ? 'Your next great stay starts here.'
          : admin
            ? 'Separate access for platform administrators.'
            : 'Pick up where you left off.'}
      </p>
      {error != null && (
        <ErrorPanel
          message={error instanceof Error ? error.message : 'Unable to sign in.'}
          requestId={error instanceof ApiError ? error.requestId : undefined}
        />
      )}
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          {registering && (
            <Field
              label="Full name"
              id="full_name"
              name="full_name"
              required
              autoComplete="name"
              maxLength={120}
              error={fields.full_name}
            />
          )}
          <Field
            label="Email"
            id="email"
            name="email"
            required
            type="email"
            autoComplete="username"
            error={fields.email}
          />
          <Field
            label="Password"
            id="password"
            name="password"
            required
            type="password"
            autoComplete={registering ? 'new-password' : 'current-password'}
            hint={registering ? 'At least 8 characters; maximum 72 UTF-8 bytes.' : undefined}
            error={fields.password}
          />
          {registering && (
            <label className="checkbox-row">
              <input type="checkbox" name="is_host" /> I’d also like to host
            </label>
          )}
          <Button type="submit">
            {busy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}
          </Button>
        </fieldset>
      </form>
      {!admin && (
        <p className="form-link">
          {registering ? 'Already feel at home? ' : 'New to StayHub? '}
          <Link to={`${registering ? '/login' : '/register'}${query}`}>
            {registering ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      )}
      <Link className="text-link" to={admin ? '/login' : '/admin/login'}>
        {admin ? 'Guest and host sign in' : 'Administrator sign in'}
      </Link>
    </section>
  );
}

export function AccountPage() {
  const { identity } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState('');
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [name, setName] = useState(identity?.user?.full_name || '');
  const [activeTab, setActiveTab] = useState<'profile' | 'hosting' | 'security'>('profile');
  const [copied, setCopied] = useState(false);
  const [hostingBusy, setHostingBusy] = useState(false);
  const [hostingError, setHostingError] = useState('');

  useEffect(() => {
    if (identity?.user?.full_name) {
      setName(identity.user.full_name);
    }
  }, [identity?.user?.full_name]);

  if (!identity) return null;
  const isUser = identity.subject_type === 'user';
  const account = isUser ? identity.user : identity.admin;

  const userInitials = account.full_name
    ? account.full_name
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const memberSince = account.created_at
    ? new Date(account.created_at).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : null;

  const handleCopyId = () => {
    if (!account.id) return;
    navigator.clipboard.writeText(account.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleBecomeHost = async () => {
    setHostingBusy(true);
    setHostingError('');
    setError(null);
    try {
      await becomeHost();
      setSaved('Congratulations! You are now registered as a host. Your hosting workspace is ready.');
    } catch (e) {
      setHostingError(e instanceof Error ? e.message : 'Unable to enable hosting.');
    } finally {
      setHostingBusy(false);
    }
  };

  const handleAvatarUploaded = async (media: { id: string }) => {
    setAvatarId(media.id);
    setBusy(true);
    setError(null);
    try {
      await updateProfile({ avatar_media_id: media.id });
      setSaved('Profile photo updated successfully!');
    } catch (e) {
      setError(e);
      setSaved('Photo uploaded. Choose Use uploaded photo to retry saving it to your profile.');
    } finally {
      setBusy(false);
    }
  };

  const isNameChanged = isUser && name.trim() !== (identity.user.full_name || '').trim();

  return (
    <section className="page-content account-page">
      {/* Hero Profile Banner */}
      <div className="account-hero-card">
        <div className="account-hero-avatar-wrap">
          {isUser && identity.user.avatar_url ? (
            <img
              src={identity.user.avatar_url}
              alt={account.full_name}
              className="account-hero-avatar profile-avatar"
            />
          ) : (
            <div className="account-hero-avatar-fallback" aria-hidden="true">
              {userInitials}
            </div>
          )}
          <span className="account-hero-status-dot" title="Account active" aria-hidden="true" />
        </div>

        <div className="account-hero-body">
          <div className="account-hero-top-row">
            <p className="eyebrow">YOUR ACCOUNT</p>
            <div className="account-hero-badges">
              <Badge tone="positive">
                {identity.subject_type === 'admin'
                  ? 'Administrator'
                  : identity.user.is_host
                    ? 'Guest & host'
                    : 'Guest'}
              </Badge>
              {memberSince && (
                <span className="account-member-since">Member since {memberSince}</span>
              )}
            </div>
          </div>

          <h1 className="account-hero-name">Hello, {account.full_name.split(' ')[0]}.</h1>

          <div className="account-hero-meta">
            <span className="account-hero-email">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              {account.email}
              <span className="verified-badge" title="Verified email">✓ Verified</span>
            </span>

            <button
              type="button"
              className="account-id-chip"
              onClick={handleCopyId}
              title="Click to copy Account ID"
            >
              <span>ID: {account.id.slice(0, 8)}…</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              {copied && <span className="copied-pill">Copied!</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Status Notifications */}
      {error != null && (
        <ErrorPanel
          message={error instanceof Error ? error.message : 'Unable to save.'}
          requestId={error instanceof ApiError ? error.requestId : undefined}
        />
      )}
      {hostingError && <ErrorPanel message={hostingError} />}
      {saved && <SuccessNotice>{saved}</SuccessNotice>}

      {identity.subject_type === 'admin' ? (
        <div className="account-card admin-notice-card">
          <div className="account-card-header">
            <h2>Administrator Portal</h2>
            <p>You are signed in with administrative credentials.</p>
          </div>
          <p>
            Administrative privileges allow access to backend metrics, database inspects, and platform audit logs.
            Additional admin web tools are scheduled for upcoming releases.
          </p>
          <div className="account-actions">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await signOut();
                } catch {
                  /* Session infrastructure displays the server revocation failure. */
                } finally {
                  setBusy(false);
                }
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Nav Tabs */}
          <nav className="account-tabs" aria-label="Account sections">
            <button
              type="button"
              className={`account-tab-btn ${activeTab === 'profile' ? 'account-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Profile details
            </button>

            <button
              type="button"
              className={`account-tab-btn ${activeTab === 'hosting' ? 'account-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('hosting')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Hosting & Stays
            </button>

            <button
              type="button"
              className={`account-tab-btn ${activeTab === 'security' ? 'account-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Security & Session
            </button>
          </nav>

          {/* TAB 1: Profile Details */}
          {activeTab === 'profile' && (
            <div className="account-tab-content">
              <div className="account-sections-grid">
                {/* Personal Information Form */}
                <div className="account-card">
                  <div className="account-card-header">
                    <h2>Personal Information</h2>
                    <p>Update your public display name and account information.</p>
                  </div>

                  <form
                    className="profile-form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      setBusy(true);
                      setError(null);
                      setSaved('');
                      try {
                        await updateProfile({ full_name: name.trim() });
                        setSaved('Profile updated successfully.');
                      } catch (e) {
                        setError(e);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Field
                      label="Full name"
                      id="profile-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                      maxLength={120}
                      error={fieldErrors(error).full_name}
                      hint="Your name is displayed to hosts and guests on reservations."
                    />

                    <div className="field">
                      <label htmlFor="account-email-display">Email address</label>
                      <input
                        id="account-email-display"
                        type="email"
                        value={account.email}
                        readOnly
                        disabled
                        className="input--readonly"
                      />
                      <small>Used for sign-in, booking confirmations, and receipts.</small>
                    </div>

                    <div className="form-actions-row">
                      <Button disabled={busy || !isNameChanged} type="submit">
                        {busy ? 'Saving…' : 'Save profile'}
                      </Button>
                      {isNameChanged && (
                        <span className="unsaved-hint">You have unsaved name changes</span>
                      )}
                    </div>
                  </form>
                </div>

                {/* Profile Photo Management */}
                <div className="account-card profile-photo">
                  <div className="account-card-header">
                    <h2>Profile photo</h2>
                    <p>A clear profile photo helps hosts and guests get to know you.</p>
                  </div>

                  <div className="profile-photo-preview-box">
                    {identity.user.avatar_url ? (
                      <div className="avatar-preview-wrap">
                        <img
                          src={identity.user.avatar_url}
                          alt="Your current profile"
                          className="profile-avatar avatar-preview-img"
                        />
                      </div>
                    ) : (
                      <div className="avatar-placeholder-box">
                        <span className="avatar-placeholder-initials">{userInitials}</span>
                        <span className="avatar-placeholder-text">No photo uploaded yet</span>
                      </div>
                    )}
                  </div>

                  <PhotoUploader
                    key={identity.user.id}
                    purpose="avatar"
                    multiple={false}
                    onUploaded={handleAvatarUploaded}
                  />

                  {avatarId && (
                    <div className="avatar-apply-row">
                      <Button
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setError(null);
                          try {
                            await updateProfile({ avatar_media_id: avatarId });
                            setAvatarId(null);
                            setSaved('Profile photo updated.');
                          } catch (e) {
                            setError(e);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Use uploaded photo
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Hosting & Stays */}
          {activeTab === 'hosting' && (
            <div className="account-tab-content">
              {identity.user.is_host ? (
                <div className="account-card host-hub-card">
                  <div className="account-card-header">
                    <div className="badge-row">
                      <Badge tone="positive">Host Active</Badge>
                    </div>
                    <h2>Host Workspace</h2>
                    <p>Quick access to your property listings, availability calendar, and host earnings.</p>
                  </div>

                  <div className="host-quick-tiles">
                    <Link to="/host/today" className="host-tile">
                      <div className="host-tile-icon host-tile-icon--today">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </div>
                      <div className="host-tile-info">
                        <strong>Host Today</strong>
                        <span>Check-ins, check-outs, and pending guest requests</span>
                      </div>
                      <span className="host-tile-arrow" aria-hidden="true">→</span>
                    </Link>

                    <Link to="/host/listings" className="host-tile">
                      <div className="host-tile-icon host-tile-icon--listings">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                          <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                      </div>
                      <div className="host-tile-info">
                        <strong>My Listings</strong>
                        <span>Edit listings, room amenities, and publish new stays</span>
                      </div>
                      <span className="host-tile-arrow" aria-hidden="true">→</span>
                    </Link>

                    <Link to="/host/calendar" className="host-tile">
                      <div className="host-tile-icon host-tile-icon--calendar">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <div className="host-tile-info">
                        <strong>Availability Calendar</strong>
                        <span>Manage availability, block nights, and adjust pricing</span>
                      </div>
                      <span className="host-tile-arrow" aria-hidden="true">→</span>
                    </Link>

                    <Link to="/host/earnings" className="host-tile">
                      <div className="host-tile-icon host-tile-icon--earnings">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="1" x2="12" y2="23" />
                          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                      </div>
                      <div className="host-tile-info">
                        <strong>Earnings & Payouts</strong>
                        <span>Review gross volume, payouts, and financial records</span>
                      </div>
                      <span className="host-tile-arrow" aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="account-card become-host-showcase">
                  <div className="become-host-content">
                    <p className="eyebrow">HOSTING ON STAYHUB</p>
                    <h2>Turn your space into extraordinary earnings</h2>
                    <p>
                      Join our global host community. Share your spare room, apartment, or villa
                      with verified travelers and earn flexible income with complete control.
                    </p>

                    <div className="become-host-perks">
                      <div className="perk-item">
                        <span className="perk-check">✓</span>
                        <div>
                          <strong>Zero listing fees</strong>
                          <p>List your property for free and keep high payout margins.</p>
                        </div>
                      </div>
                      <div className="perk-item">
                        <span className="perk-check">✓</span>
                        <div>
                          <strong>Host protection included</strong>
                          <p>Every stay includes coverage for property protection and support.</p>
                        </div>
                      </div>
                      <div className="perk-item">
                        <span className="perk-check">✓</span>
                        <div>
                          <strong>Total schedule control</strong>
                          <p>Choose when you host, set house rules, and adjust seasonal pricing.</p>
                        </div>
                      </div>
                    </div>

                    <div className="become-host-cta-row">
                      <Button disabled={hostingBusy} onClick={handleBecomeHost}>
                        {hostingBusy ? 'Activating host account…' : 'Become a host now'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Travel and Photos section */}
              <div className="account-card">
                <div className="account-card-header">
                  <h2>Travel & Itineraries</h2>
                  <p>View your confirmed bookings, reservation history, and listing media.</p>
                </div>

                <div className="account-actions">
                  <Link className="button button--secondary" to="/trips">
                    Your trips
                  </Link>
                  <Link className="button button--secondary" to="/host/today">
                    {identity.user.is_host ? 'Switch to hosting' : 'Become a host'}
                  </Link>
                  <Link className="button button--secondary" to="/search">
                    Browse stays
                  </Link>
                  <Link className="text-link" to="/account/media">
                    Manage photo uploads
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Security & Session */}
          {activeTab === 'security' && (
            <div className="account-tab-content">
              <div className="account-card">
                <div className="account-card-header">
                  <h2>Session & Security</h2>
                  <p>Review active session credentials and authentication status.</p>
                </div>

                <div className="security-specs-list">
                  <div className="spec-row">
                    <span className="spec-label">Account ID</span>
                    <span className="spec-value mono-text">{account.id}</span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-label">Authentication method</span>
                    <span className="spec-value">Email & Encrypted Password</span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-label">Account status</span>
                    <span className="spec-value">
                      <span className="status-pill status-pill--active">Active & Verified</span>
                    </span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-label">Session encryption</span>
                    <span className="spec-value">TLS / Token-based JWT</span>
                  </div>
                </div>
              </div>

              {/* Sign out section */}
              <div className="account-card danger-zone-card">
                <div className="account-card-header">
                  <h2>Sign Out</h2>
                  <p>Sign out of your account on this browser. Your bookings, messages, and listings will remain safe.</p>
                </div>

                <div className="signout-actions-row">
                  <Button
                    variant="ghost"
                    className="button--signout"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await signOut();
                      } catch {
                        /* Session infrastructure displays the server revocation failure. */
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Sign out of StayHub
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function MediaPage() {
  return (
    <section className="page-content">
      <div className="page-heading">
        <p className="eyebrow">YOUR PHOTOS</p>
        <h1>A picture of your space.</h1>
        <p>
          Upload photos for your future listings. Adding them to a listing will be available with
          the listing editor.
        </p>
      </div>
      <PhotoUploader />
      <Link className="text-link" to="/account">
        Back to account
      </Link>
    </section>
  );
}
