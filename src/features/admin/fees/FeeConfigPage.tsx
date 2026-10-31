import { useState } from 'react';
import { useSession } from '../../auth/session';
import {
  useFeeConfigs,
  useProposeFeeConfig,
  useApproveFeeConfig,
  useRejectFeeConfig,
} from './api';
import type { FeeConfig } from './types';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  RequestError,
  type BadgeTone,
} from '../../../components/ui';

export function FeeConfigPage() {
  const session = useSession('admin');
  const currentAdminId =
    session.identity?.subject_type === 'admin' ? session.identity.admin.id : null;

  const { data, isLoading, error, refetch } = useFeeConfigs();
  const proposeMutation = useProposeFeeConfig();
  const approveMutation = useApproveFeeConfig();
  const rejectMutation = useRejectFeeConfig();

  const [proposeOpen, setProposeOpen] = useState(false);
  const [guestFeePct, setGuestFeePct] = useState('14');
  const [hostFeePct, setHostFeePct] = useState('3');
  const [proposeReason, setProposeReason] = useState('');

  const [rejectId, setRejectId] = useState<string | null>(null);

  const configs = data?.fee_configs || [];
  const activeConfig = configs.find((c) => c.status === 'active') || configs[0];

  const handleProposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const guestBps = Math.round(parseFloat(guestFeePct) * 100);
    const hostBps = Math.round(parseFloat(hostFeePct) * 100);
    await proposeMutation.mutateAsync({
      guest_fee_bps: guestBps,
      host_fee_bps: hostBps,
      reason: proposeReason.trim(),
    });
    setProposeOpen(false);
    setProposeReason('');
  };

  const handleApprove = async (configId: string) => {
    await approveMutation.mutateAsync(configId);
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectId) return;
    await rejectMutation.mutateAsync({ id: rejectId, reason });
    setRejectId(null);
  };

  const getStatusTone = (status: string): BadgeTone => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
      case 'pending_approval':
        return 'warning';
      case 'rejected':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Fees & Policy Configuration</h1>
          <p className="admin-page-subtitle">
            Configure platform commission, service charges, and enforce two-person rule approval.
          </p>
        </div>
        <Button variant="primary" onClick={() => setProposeOpen(true)}>
          Propose Fee Rate Change
        </Button>
      </div>

      {/* Active Config KPI Card */}
      {activeConfig && (
        <div className="admin-kpi-card">
          <div className="admin-kpi-header">
            <h3>Active Rate Schedule</h3>
            <Badge tone="success">Active</Badge>
          </div>
          <div className="admin-kpi-metrics">
            <div className="admin-metric">
              <span className="admin-metric-label">Guest Service Fee</span>
              <span className="admin-metric-value">
                {(activeConfig.guest_fee_bps / 100).toFixed(1)}%
              </span>
              <small className="admin-metric-sub">{activeConfig.guest_fee_bps} basis points</small>
            </div>
            <div className="admin-metric">
              <span className="admin-metric-label">Host Commission Fee</span>
              <span className="admin-metric-value">
                {(activeConfig.host_fee_bps / 100).toFixed(1)}%
              </span>
              <small className="admin-metric-sub">{activeConfig.host_fee_bps} basis points</small>
            </div>
            <div className="admin-metric">
              <span className="admin-metric-label">Effective Since</span>
              <span className="admin-metric-value" style={{ fontSize: 18 }}>
                {activeConfig.activated_at
                  ? new Date(activeConfig.activated_at).toLocaleDateString()
                  : new Date(activeConfig.created_at).toLocaleDateString()}
              </span>
              <small className="admin-metric-sub">Reason: "{activeConfig.reason}"</small>
            </div>
          </div>
        </div>
      )}

      {error ? (
        <RequestError error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>Fee Configuration History & Proposals</h2>
          </div>
          <DataTable<FeeConfig>
            columns={[
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge tone={getStatusTone(row.status)}>{row.status}</Badge>
                ),
              },
              {
                key: 'rates',
                header: 'Fee Rates',
                render: (row) => (
                  <div>
                    <strong>Guest: {(row.guest_fee_bps / 100).toFixed(2)}%</strong>
                    <span style={{ margin: '0 8px', color: '#9ca3af' }}>|</span>
                    <span>Host: {(row.host_fee_bps / 100).toFixed(2)}%</span>
                  </div>
                ),
              },
              {
                key: 'reason',
                header: 'Proposal Reason',
                render: (row) => <span>{row.reason}</span>,
              },
              {
                key: 'proposer',
                header: 'Proposed By',
                render: (row) => (
                  <div>
                    <code>{row.proposed_by.slice(0, 8)}</code>
                    {row.proposed_by === currentAdminId && (
                      <small className="admin-cell-sub"> (You)</small>
                    )}
                  </div>
                ),
              },
              {
                key: 'approver',
                header: 'Approved By',
                render: (row) => (
                  <span>{row.approved_by ? <code>{row.approved_by.slice(0, 8)}</code> : '—'}</span>
                ),
              },
              {
                key: 'created',
                header: 'Date',
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
                render: (row) => {
                  if (row.status !== 'pending' && row.status !== 'pending_approval') return null;
                  const isProposer = row.proposed_by === currentAdminId;
                  return (
                    <div className="admin-inline-actions">
                      <Button
                        variant="primary"
                        className="button--sm"
                        disabled={isProposer || approveMutation.isPending}
                        title={
                          isProposer
                            ? 'Second approver rule: You cannot approve your own proposal'
                            : 'Approve fee change'
                        }
                        onClick={() => handleApprove(row.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        className="button--sm button--danger"
                        disabled={isProposer || rejectMutation.isPending}
                        title={
                          isProposer
                            ? 'Second approver rule: You cannot reject your own proposal'
                            : 'Reject proposal'
                        }
                        onClick={() => setRejectId(row.id)}
                      >
                        Reject
                      </Button>
                    </div>
                  );
                },
              },
            ]}
            data={configs}
            keyField={(row) => row.id}
            loading={isLoading}
            emptyState={
              <EmptyState title="No Configurations Available">
                Platform fee rates will be indexed here.
              </EmptyState>
            }
          />
        </div>
      )}

      {/* Propose Fee Modal */}
      <Dialog
        open={proposeOpen}
        title="Propose Fee Schedule Adjustment"
        onClose={() => setProposeOpen(false)}
      >
        <form onSubmit={handleProposeSubmit} className="admin-dialog-form">
          <p className="admin-dialog-description">
            Submitting a fee change creates a pending proposal. In compliance with internal policy,
            a second authorized administrator must review and approve it before it takes effect.
          </p>

          <div className="field">
            <Field
              id="guest-fee-input"
              label="Guest Service Fee (%)"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={guestFeePct}
              onChange={(e) => setGuestFeePct(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <Field
              id="host-fee-input"
              label="Host Commission Fee (%)"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={hostFeePct}
              onChange={(e) => setHostFeePct(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="propose-reason-input">Business Justification / Reason</label>
            <textarea
              id="propose-reason-input"
              rows={3}
              className="confirm-reason-input"
              placeholder="Provide reason for adjustment (e.g. Q4 seasonal adjustment)…"
              value={proposeReason}
              onChange={(e) => setProposeReason(e.target.value)}
              required
            />
          </div>

          {proposeMutation.error && (
            <RequestError error={proposeMutation.error} />
          )}

          <div className="confirm-dialog-actions">
            <Button variant="ghost" onClick={() => setProposeOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={proposeMutation.isPending || !proposeReason.trim()}
            >
              {proposeMutation.isPending ? 'Submitting…' : 'Submit Proposal'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Reject Confirm Dialog */}
      <ConfirmDialog
        open={rejectId !== null}
        title="Reject Proposed Fee Schedule"
        message="Rejecting this proposal archives it without applying any rate adjustments."
        confirmLabel="Reject Proposal"
        variant="danger"
        requireReason={true}
        reasonMinLength={5}
        busy={rejectMutation.isPending}
        error={rejectMutation.error ? (rejectMutation.error as Error).message : undefined}
        onConfirm={handleRejectConfirm}
        onCancel={() => setRejectId(null)}
      />
    </div>
  );
}

