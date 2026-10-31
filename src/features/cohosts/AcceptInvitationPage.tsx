import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useUserSession } from '../auth/session';
import { useAcceptInvitation, useCohostInvitationDetails } from './api';

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const session = useUserSession();
  const acceptMutation = useAcceptInvitation();
  const { data: details } = useCohostInvitationDetails(token);

  const [acceptedListingId, setAcceptedListingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const user = session.identity?.subject_type === 'user' ? session.identity.user : null;
  const isAuthenticated = session.status === 'ready' && !!user;

  const handleAccept = async () => {
    if (!token) return;
    setErrorMessage(null);
    try {
      const res = await acceptMutation.mutateAsync(token);
      setAcceptedListingId(res.listing_id);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Could not accept invitation. It may have expired or was issued to another account.',
      );
    }
  };

  if (!token) {
    return (
      <div className="accept-invitation-container">
        <div className="accept-invitation-card">
          <h2>Invalid Invitation Link</h2>
          <p className="muted-text">This invitation link is missing a valid token.</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (acceptedListingId) {
    return (
      <div className="accept-invitation-container">
        <div className="accept-invitation-card success">
          <div className="invitation-icon">🎉</div>
          <h2>Invitation Accepted!</h2>
          <p className="muted-text">
            You are now officially a co-host for this listing. You can manage dates, messaging, and
            reservations according to your assigned permissions.
          </p>
          <div className="action-buttons" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Link to={`/host/listings`} className="btn btn-primary">
              View Host Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="accept-invitation-container">
      <div className="accept-invitation-card">
        <div className="invitation-icon">🤝</div>
        <h2>Co-host Invitation</h2>
        <p className="muted-text">
          You have been invited to co-host a property on StayHub.
        </p>

        {details && (
          <div
            className="invitation-details-box"
            style={{
              margin: '1.5rem 0',
              padding: '1.25rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              textAlign: 'left',
              fontSize: '14px',
            }}
          >
            <div style={{ marginBottom: '0.85rem' }}>
              <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Listing
              </span>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '16px', marginTop: '2px' }}>
                {details.listing_title || 'Listing'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: details.payout_share_bps > 0 ? '1fr 1fr' : '1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Host
                </span>
                <div style={{ fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                  {details.host_name || 'Host'}
                </div>
              </div>
              {details.payout_share_bps > 0 && (
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                    Payout Share
                  </span>
                  <div style={{ fontWeight: 700, color: '#16a34a', marginTop: '2px' }}>
                    {(details.payout_share_bps / 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>

            {details.invited_email && (
              <div style={{ marginBottom: '0.85rem' }}>
                <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Invited Email
                </span>
                <div style={{ fontWeight: 500, color: '#334155', marginTop: '2px' }}>
                  {details.invited_email}
                </div>
              </div>
            )}

            {details.permissions && (
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Permissions Included
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {details.permissions.can_manage_listing && (
                    <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                      Manage Listing
                    </span>
                  )}
                  {details.permissions.can_manage_calendar && (
                    <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                      Manage Calendar
                    </span>
                  )}
                  {details.permissions.can_manage_reservations && (
                    <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                      Manage Reservations
                    </span>
                  )}
                  {details.permissions.can_message_guests && (
                    <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                      Message Guests
                    </span>
                  )}
                  {details.permissions.can_view_insights && (
                    <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                      View Insights
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {!isAuthenticated ? (
          <div className="auth-prompt" style={{ marginTop: '1.5rem' }}>
            <p>
              Please sign in or create an account with the email address that received the invitation to accept.
            </p>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <Link
                to={`/login?returnTo=${encodeURIComponent(`/cohost-invitations/${token}`)}`}
                className="btn btn-primary"
              >
                Sign In to Accept
              </Link>
              <Link
                to={`/signup?returnTo=${encodeURIComponent(`/cohost-invitations/${token}`)}`}
                className="btn btn-outline"
              >
                Create Account
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: '1.5rem' }}>
            <p>
              Signed in as <strong>{user?.email}</strong>.
            </p>

            {errorMessage && (
              <div className="alert alert-danger" style={{ marginTop: '1rem' }}>
                {errorMessage}
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary btn-lg"
              style={{ marginTop: '1.5rem', width: '100%' }}
              disabled={acceptMutation.isPending}
              onClick={handleAccept}
            >
              {acceptMutation.isPending ? 'Accepting Invitation...' : 'Accept Invitation'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
