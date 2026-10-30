import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Button, EmptyState, ErrorPanel, Skeleton } from '../../components/ui';
import { becomeHost, expireSession, restoreSession, useSession } from './session';
import { useState, type ReactNode } from 'react';

export function RequireSession({
  role,
  children,
}: {
  role?: 'user' | 'admin' | 'host';
  children?: ReactNode;
}) {
  const session = useSession();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (session.status === 'loading')
    return (
      <div className="page-content">
        <Skeleton label="Restoring your session" />
      </div>
    );
  if (session.status === 'error')
    return (
      <div className="page-content">
        <ErrorPanel
          title="Couldn’t restore your session"
          message={session.error || 'Try again.'}
          onRetry={() => void restoreSession()}
        />
        <Button variant="ghost" onClick={expireSession}>
          Continue signed out
        </Button>
      </div>
    );
  if (!session.identity)
    return (
      <Navigate
        replace
        to={`${role === 'admin' ? '/admin/login' : '/login'}?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
      />
    );
  if (
    (role === 'admin' && session.identity.subject_type !== 'admin') ||
    (role && role !== 'admin' && session.identity.subject_type !== 'user')
  )
    return (
      <div className="page-content">
        <EmptyState title="This area uses a different account">
          Sign out from your account page, then sign in with the appropriate account.
        </EmptyState>
      </div>
    );
  if (role === 'host' && !session.identity.user?.is_host)
    return (
      <div className="page-content">
        <p className="eyebrow">OPEN YOUR DOORS</p>
        <h1>Make room for hosting.</h1>
        <p>Keep your guest account and add hosting to share your space.</p>
        {error && <ErrorPanel message={error} />}
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await becomeHost();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Unable to enable hosting.');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Setting up…' : 'Become a host'}
        </Button>
      </div>
    );
  return children || <Outlet />;
}
