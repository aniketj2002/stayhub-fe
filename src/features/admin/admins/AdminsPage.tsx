import { useState } from 'react';
import { useAdminList, useCreateAdmin, useUpdateAdminRole } from './api';
import type { AdminUserDetail } from './types';
import type { AdminRole } from '../../auth/types';
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  RequestError,
  type BadgeTone,
} from '../../../components/ui';

export function AdminsPage() {
  const { data, isLoading, error, refetch } = useAdminList();
  const createMutation = useCreateAdmin();
  const updateMutation = useUpdateAdminRole();

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('support_l1');

  // Edit Role Modal
  const [editAdmin, setEditAdmin] = useState<AdminUserDetail | null>(null);
  const [editRole, setEditRole] = useState<AdminRole>('support_l1');

  const admins = data?.admins || [];

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync({
      full_name: newName.trim(),
      email: newEmail.trim(),
      password: newPassword,
      role: newRole,
    });
    setCreateOpen(false);
    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewRole('support_l1');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAdmin) return;
    await updateMutation.mutateAsync({
      id: editAdmin.id,
      input: { role: editRole },
    });
    setEditAdmin(null);
  };

  const getRoleTone = (role: string): BadgeTone => {
    switch (role) {
      case 'super_admin':
        return 'danger';
      case 'finance':
        return 'success';
      case 'trust_safety':
        return 'warning';
      case 'catalog_manager':
        return 'accent';
      case 'support_l2':
        return 'info';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Admins & Roles</h1>
          <p className="admin-page-subtitle">
            Manage administrative privileges, assign functional roles, and audit access.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          Invite Admin
        </Button>
      </div>

      {error ? (
        <RequestError error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="admin-card">
          <DataTable<AdminUserDetail>
            columns={[
              {
                key: 'name',
                header: 'Full Name',
                render: (row) => (
                  <div>
                    <strong>{row.full_name}</strong>
                    <small className="admin-cell-sub">ID: {row.id.slice(0, 8)}</small>
                  </div>
                ),
              },
              {
                key: 'email',
                header: 'Email',
                render: (row) => <span>{row.email}</span>,
              },
              {
                key: 'role',
                header: 'Assigned Role',
                render: (row) => (
                  <Badge tone={getRoleTone(row.role)}>
                    {row.role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Badge>
                ),
              },
              {
                key: 'permissions',
                header: 'Permissions',
                render: (row) => (
                  <span className="badge badge--neutral">
                    {row.permissions ? `${row.permissions.length} grants` : 'Default'}
                  </span>
                ),
              },
              {
                key: 'created',
                header: 'Member Since',
                render: (row) => (
                  <time dateTime={row.created_at}>
                    {new Date(row.created_at).toLocaleDateString()}
                  </time>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (row) => (
                  <Button
                    variant="ghost"
                    className="button--sm"
                    onClick={() => {
                      setEditAdmin(row);
                      setEditRole((row.role as AdminRole) || 'support_l1');
                    }}
                  >
                    Edit Role
                  </Button>
                ),
              },
            ]}
            data={admins}
            keyField={(row) => row.id}
            loading={isLoading}
            emptyState={
              <EmptyState title="No Admins Found">
                There are no administrative accounts registered.
              </EmptyState>
            }
          />
        </div>
      )}

      {/* Invite Admin Dialog */}
      <Dialog
        open={createOpen}
        title="Invite New Administrator"
        onClose={() => setCreateOpen(false)}
      >
        <form onSubmit={handleCreateSubmit} className="admin-dialog-form">
          <div className="field">
            <Field
              id="admin-new-name"
              label="Full Name"
              placeholder="e.g. Elena Rostova"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <Field
              id="admin-new-email"
              label="Email Address"
              type="email"
              placeholder="e.g. elena@stayhub.dev"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <Field
              id="admin-new-password"
              label="Initial Password"
              type="password"
              placeholder="Min 8 characters…"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div className="field select-field">
            <label htmlFor="admin-new-role">Administrative Role</label>
            <select
              id="admin-new-role"
              className="admin-select"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as AdminRole)}
            >
              <option value="support_l1">Support L1 (Read & Triage)</option>
              <option value="support_l2">Support L2 (Disputes & Refunds)</option>
              <option value="trust_safety">Trust & Safety (Listing Reviews & Claims)</option>
              <option value="finance">Finance (Refunds, Payouts, Fees)</option>
              <option value="catalog_manager">Catalog Manager (Listings & Content)</option>
              <option value="super_admin">Super Admin (Full Platform Access)</option>
            </select>
          </div>

          {createMutation.error && (
            <RequestError error={createMutation.error} />
          )}

          <div className="confirm-dialog-actions">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={createMutation.isPending || !newName || !newEmail || !newPassword}
            >
              {createMutation.isPending ? 'Inviting…' : 'Create Account'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog
        open={editAdmin !== null}
        title="Update Admin Role"
        onClose={() => setEditAdmin(null)}
      >
        <form onSubmit={handleEditSubmit} className="admin-dialog-form">
          <p className="admin-dialog-description">
            Assigning a new role updates the effective permissions for{' '}
            <strong>{editAdmin?.full_name}</strong> ({editAdmin?.email}).
          </p>

          <div className="field select-field">
            <label htmlFor="admin-edit-role">Assigned Role</label>
            <select
              id="admin-edit-role"
              className="admin-select"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as AdminRole)}
            >
              <option value="support_l1">Support L1 (Read & Triage)</option>
              <option value="support_l2">Support L2 (Disputes & Refunds)</option>
              <option value="trust_safety">Trust & Safety (Listing Reviews & Claims)</option>
              <option value="finance">Finance (Refunds, Payouts, Fees)</option>
              <option value="catalog_manager">Catalog Manager (Listings & Content)</option>
              <option value="super_admin">Super Admin (Full Platform Access)</option>
            </select>
          </div>

          {updateMutation.error && (
            <RequestError error={updateMutation.error} />
          )}

          <div className="confirm-dialog-actions">
            <Button variant="ghost" onClick={() => setEditAdmin(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

