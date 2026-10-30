import { fieldErrors } from './validation';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, ErrorPanel, Field, Skeleton, SuccessNotice } from '../../components/ui';
import { ApiError, request } from '../../lib/api';
import { PhotoUploader } from '../media/PhotoUploader';
import { acceptSession, safeReturnTo, signOut, updateProfile, useSession } from './session';
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
  if (!identity) return null;
  const account = identity.subject_type === 'user' ? identity.user : identity.admin;
  return (
    <section className="page-content account-page">
      <div className="page-heading">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>Hello, {account.full_name.split(' ')[0]}.</h1>
        <p>{account.email}</p>
        <Badge tone="positive">
          {identity.subject_type === 'admin'
            ? 'Administrator'
            : identity.user.is_host
              ? 'Guest & host'
              : 'Guest'}
        </Badge>
      </div>
      {error != null && (
        <ErrorPanel
          message={error instanceof Error ? error.message : 'Unable to save.'}
          requestId={error instanceof ApiError ? error.requestId : undefined}
        />
      )}
      {saved && <SuccessNotice>{saved}</SuccessNotice>}
      {identity.subject_type === 'admin' ? (
        <p>You’re signed in as an administrator. Admin tooling is planned for V2.</p>
      ) : (
        <>
          <form
            className="profile-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError(null);
              setSaved('');
              try {
                await updateProfile({ full_name: name.trim() });
                setSaved('Profile updated.');
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
            />
            <Button disabled={busy} type="submit">
              {busy ? 'Saving…' : 'Save profile'}
            </Button>
          </form>
          <div className="profile-photo">
            <h2>Profile photo</h2>
            {identity.user.avatar_url && (
              <img
                src={identity.user.avatar_url}
                alt="Your current profile"
                className="profile-avatar"
              />
            )}
            <PhotoUploader
              key={identity.user.id}
              purpose="avatar"
              multiple={false}
              onUploaded={(media) => {
                setAvatarId(media.id);
                setSaved('Photo uploaded. Choose Use uploaded photo to save it to your profile.');
              }}
            />
            {avatarId && (
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
            )}
          </div>
          <div className="account-actions">
            <Link className="button button--secondary" to="/trips">
              Your trips
            </Link>
            <Link className="button button--secondary" to="/host/today">
              {identity.user.is_host ? 'Switch to hosting' : 'Become a host'}
            </Link>
            <Link className="text-link" to="/account/media">
              Manage photo uploads
            </Link>
          </div>
        </>
      )}
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
