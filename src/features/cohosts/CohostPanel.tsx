import { useState } from 'react';
import { Badge, ConfirmDialog } from '../../components/ui';
import {
  useCancelInvitation,
  useCohostInvitations,
  useCohosts,
  useInviteCohost,
  useRemoveCohost,
  useUpdateCohost,
} from './api';
import type { CohostMember, CohostPermissions } from './types';

interface CohostPanelProps {
  listingId: string;
}

const DEFAULT_PERMISSIONS: CohostPermissions = {
  can_manage_listing: true,
  can_manage_calendar: true,
  can_manage_reservations: true,
  can_message_guests: true,
  can_view_insights: false,
};

export function CohostPanel({ listingId }: CohostPanelProps) {
  const { data: cohosts, isLoading: loadingCohosts } = useCohosts(listingId);
  const { data: invitations, isLoading: loadingInvites } = useCohostInvitations(listingId);

  const inviteMutation = useInviteCohost();
  const cancelMutation = useCancelInvitation();
  const updateMutation = useUpdateCohost();
  const removeMutation = useRemoveCohost();

  // Invite Form State
  const [email, setEmail] = useState('');
  const [payoutPercent, setPayoutPercent] = useState('0');
  const [permissions, setPermissions] = useState<CohostPermissions>(DEFAULT_PERMISSIONS);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Remove confirmation modal
  const [memberToRemove, setMemberToRemove] = useState<CohostMember | null>(null);

  // Edit member modal
  const [editingMember, setEditingMember] = useState<CohostMember | null>(null);
  const [editPermissions, setEditPermissions] = useState<CohostPermissions>(DEFAULT_PERMISSIONS);
  const [editPayoutPercent, setEditPayoutPercent] = useState('0');

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLastInviteLink(null);

    const shareBps = Math.round(parseFloat(payoutPercent || '0') * 100);
    if (isNaN(shareBps) || shareBps < 0 || shareBps > 10000) {
      setErrorMessage('Payout share must be between 0% and 100%.');
      return;
    }

    try {
      const res = await inviteMutation.mutateAsync({
        listingId,
        input: {
          email: email.trim().toLowerCase(),
          permissions,
          payout_share_bps: shareBps,
        },
      });

      setEmail('');
      setPayoutPercent('0');
      setPermissions(DEFAULT_PERMISSIONS);

      if (res?.token) {
        setLastInviteLink(`${window.location.origin}/cohost-invitations/${res.token}`);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to send co-host invitation.');
    }
  };

  const handleCopyLink = () => {
    if (!lastInviteLink) return;
    navigator.clipboard.writeText(lastInviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleOpenEdit = (member: CohostMember) => {
    setEditingMember(member);
    setEditPermissions(member.permissions);
    setEditPayoutPercent((member.payout_share_bps / 100).toString());
  };

  const handleSaveEdit = async () => {
    if (!editingMember) return;
    const shareBps = Math.round(parseFloat(editPayoutPercent || '0') * 100);
    try {
      await updateMutation.mutateAsync({
        listingId,
        userId: editingMember.user_id,
        input: {
          permissions: editPermissions,
          payout_share_bps: shareBps,
        },
      });
      setEditingMember(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update co-host.');
    }
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    try {
      await removeMutation.mutateAsync({
        listingId,
        userId: memberToRemove.user_id,
      });
      setMemberToRemove(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to remove co-host.');
    }
  };

  return (
    <div className="cohost-panel">
      <div className="panel-header">
        <div>
          <h3>Co-hosts &amp; Team</h3>
          <p className="panel-subtitle">
            Share hosting responsibilities, calendar management, and automated payout splits.
          </p>
        </div>
      </div>

      {/* Active Team / Co-hosts */}
      <section className="cohost-section">
        <h4>Team members</h4>
        {loadingCohosts ? (
          <p className="muted-text">Loading team members...</p>
        ) : !cohosts || cohosts.length === 0 ? (
          <p className="muted-text">No co-hosts assigned yet.</p>
        ) : (
          <div className="cohost-list">
            {cohosts.map((member) => (
              <div key={member.user_id} className="cohost-card">
                <div className="cohost-info">
                  <div className="cohost-name-row">
                    <span className="cohost-name">{member.full_name || member.email}</span>
                    <Badge tone={member.role === 'owner' ? 'accent' : 'neutral'}>
                      {member.role === 'owner' ? 'Owner' : 'Co-host'}
                    </Badge>
                    {member.payout_share_bps > 0 && (
                      <Badge tone="success">
                        {(member.payout_share_bps / 100).toFixed(1)}% payout share
                      </Badge>
                    )}
                  </div>
                  <span className="cohost-email">{member.email}</span>

                  <div className="cohost-chips">
                    {member.role === 'owner' ? (
                      <span className="permission-tag">Full Owner Access</span>
                    ) : (
                      <>
                        {member.permissions.can_manage_listing && (
                          <span className="permission-tag">Listing</span>
                        )}
                        {member.permissions.can_manage_calendar && (
                          <span className="permission-tag">Calendar &amp; Pricing</span>
                        )}
                        {member.permissions.can_manage_reservations && (
                          <span className="permission-tag">Reservations</span>
                        )}
                        {member.permissions.can_message_guests && (
                          <span className="permission-tag">Messaging</span>
                        )}
                        {member.permissions.can_view_insights && (
                          <span className="permission-tag">Insights</span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {member.role !== 'owner' && (
                  <div className="cohost-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenEdit(member)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setMemberToRemove(member)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pending Invitations */}
      <section className="cohost-section">
        <h4>Pending invitations</h4>
        {loadingInvites ? (
          <p className="muted-text">Loading invitations...</p>
        ) : !invitations || invitations.filter((i) => i.status === 'pending').length === 0 ? (
          <p className="muted-text">No pending invitations.</p>
        ) : (
          <div className="invitations-list">
            {invitations
              .filter((i) => i.status === 'pending')
              .map((invite) => (
                <div key={invite.id} className="invite-card">
                  <div className="invite-details">
                    <span className="invite-email">{invite.email}</span>
                    <span className="invite-share">
                      Payout: {(invite.payout_share_bps / 100).toFixed(1)}%
                    </span>
                    <Badge tone="warning">Pending</Badge>
                    <span className="invite-expiry">
                      Expires {new Date(invite.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate({ listingId, inviteId: invite.id })}
                  >
                    Cancel
                  </button>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Invite Link Banner if generated */}
      {lastInviteLink && (
        <div className="invite-link-banner">
          <div>
            <strong>Invitation Link Created</strong>
            <p className="muted-text">
              Share this link with your co-host to accept the invitation:
            </p>
            <input
              type="text"
              readOnly
              value={lastInviteLink}
              className="form-input invite-link-input"
            />
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleCopyLink}>
            {copiedLink ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      )}

      {/* Invite Form */}
      <section className="cohost-section invite-form-section">
        <h4>Invite a new co-host</h4>
        {errorMessage && <div className="alert alert-danger">{errorMessage}</div>}

        <form onSubmit={handleSendInvite} className="cohost-form">
          <div className="form-group">
            <label htmlFor="cohost-email">Co-host email address</label>
            <input
              id="cohost-email"
              type="email"
              required
              placeholder="partner@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="cohost-payout">Payout share percentage (%)</label>
            <div className="input-with-suffix">
              <input
                id="cohost-payout"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={payoutPercent}
                onChange={(e) => setPayoutPercent(e.target.value)}
                className="form-input"
              />
              <span className="suffix">%</span>
            </div>
            <span className="form-help">
              Automatically transferred to this co-host upon reservation payout release.
            </span>
          </div>

          <fieldset className="permissions-fieldset">
            <legend>Permissions</legend>
            <div className="permission-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={permissions.can_manage_listing}
                  onChange={(e) =>
                    setPermissions((p) => ({ ...p, can_manage_listing: e.target.checked }))
                  }
                />
                <div>
                  <strong>Manage listing details</strong>
                  <p className="muted-text">Edit title, description, amenities, and photos.</p>
                </div>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={permissions.can_manage_calendar}
                  onChange={(e) =>
                    setPermissions((p) => ({ ...p, can_manage_calendar: e.target.checked }))
                  }
                />
                <div>
                  <strong>Manage calendar &amp; pricing</strong>
                  <p className="muted-text">Update nightly rates, date overrides, and iCal feeds.</p>
                </div>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={permissions.can_manage_reservations}
                  onChange={(e) =>
                    setPermissions((p) => ({ ...p, can_manage_reservations: e.target.checked }))
                  }
                />
                <div>
                  <strong>Manage reservations</strong>
                  <p className="muted-text">Accept/decline requests, cancel, and oversee check-in.</p>
                </div>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={permissions.can_message_guests}
                  onChange={(e) =>
                    setPermissions((p) => ({ ...p, can_message_guests: e.target.checked }))
                  }
                />
                <div>
                  <strong>Message guests</strong>
                  <p className="muted-text">Reply to guest inquiries and active booking chats.</p>
                </div>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={permissions.can_view_insights}
                  onChange={(e) =>
                    setPermissions((p) => ({ ...p, can_view_insights: e.target.checked }))
                  }
                />
                <div>
                  <strong>View performance &amp; insights</strong>
                  <p className="muted-text">Access revenue history, occupancy rates, and analytics.</p>
                </div>
              </label>
            </div>
          </fieldset>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={inviteMutation.isPending || !email}
          >
            {inviteMutation.isPending ? 'Sending Invitation...' : 'Send Invitation'}
          </button>
        </form>
      </section>

      {/* Remove Confirm Modal */}
      {memberToRemove && (
        <ConfirmDialog
          open={!!memberToRemove}
          title="Remove Co-host"
          message={`Are you sure you want to remove ${
            memberToRemove.full_name || memberToRemove.email
          } from this listing? They will lose access immediately.`}
          confirmLabel="Remove Co-host"
          variant="danger"
          onConfirm={handleConfirmRemove}
          onCancel={() => setMemberToRemove(null)}
        />
      )}

      {/* Edit Modal */}
      {editingMember && (
        <div className="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-dialog-title">
          <div className="dialog-card">
            <h3 id="edit-dialog-title">Edit Co-host Permissions</h3>
            <p className="muted-text">{editingMember.email}</p>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label htmlFor="edit-payout">Payout share percentage (%)</label>
              <div className="input-with-suffix">
                <input
                  id="edit-payout"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={editPayoutPercent}
                  onChange={(e) => setEditPayoutPercent(e.target.value)}
                  className="form-input"
                />
                <span className="suffix">%</span>
              </div>
            </div>

            <fieldset className="permissions-fieldset">
              <legend>Permissions</legend>
              <div className="permission-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editPermissions.can_manage_listing}
                    onChange={(e) =>
                      setEditPermissions((p) => ({ ...p, can_manage_listing: e.target.checked }))
                    }
                  />
                  <span>Manage listing</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editPermissions.can_manage_calendar}
                    onChange={(e) =>
                      setEditPermissions((p) => ({ ...p, can_manage_calendar: e.target.checked }))
                    }
                  />
                  <span>Manage calendar &amp; pricing</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editPermissions.can_manage_reservations}
                    onChange={(e) =>
                      setEditPermissions((p) => ({
                        ...p,
                        can_manage_reservations: e.target.checked,
                      }))
                    }
                  />
                  <span>Manage reservations</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editPermissions.can_message_guests}
                    onChange={(e) =>
                      setEditPermissions((p) => ({ ...p, can_message_guests: e.target.checked }))
                    }
                  />
                  <span>Message guests</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editPermissions.can_view_insights}
                    onChange={(e) =>
                      setEditPermissions((p) => ({ ...p, can_view_insights: e.target.checked }))
                    }
                  />
                  <span>View performance &amp; insights</span>
                </label>
              </div>
            </fieldset>

            <div className="dialog-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditingMember(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={updateMutation.isPending}
                onClick={handleSaveEdit}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
