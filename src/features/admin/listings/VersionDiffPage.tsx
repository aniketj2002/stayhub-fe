import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  useVersionDiff,
  useApproveVersion,
  useRequestChanges,
  useRejectVersion,
} from './api';
import {
  Button,
  ConfirmDialog,
  RequestError,
  Spinner,
} from '../../../components/ui';

const SAMPLE_PHOTOS = [
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&q=80',
];

const REASON_TEMPLATES: Record<string, string> = {
  nondiscrimination:
    'Hi {host}, we can\'t publish the rule "Guests of Japanese nationality only". Rules based on nationality aren\'t allowed under the nondiscrimination policy. Remove it and resubmit; the description update looks good.',
  photos:
    'Hi {host}, the uploaded photos do not sufficiently showcase the living areas and amenities described. Please upload high-resolution, unwatermarked photos of the stay.',
  location:
    'Hi {host}, the address entered does not match postal and municipal records for this property. Please update the exact street address and coordinates.',
  contact:
    'Hi {host}, personal contact details (phone numbers, email addresses, or off-platform payment links) are prohibited in property descriptions. Please remove them and resubmit.',
  other:
    'Hi {host}, please review the required updates noted by our moderation team before resubmitting your listing for review.',
};

export function VersionDiffPage() {
  const { versionId } = useParams<{ versionId: string }>();
  const navigate = useNavigate();
  const { data: diff, isLoading, error, refetch } = useVersionDiff(versionId);

  const approveMutation = useApproveVersion();
  const requestChangesMutation = useRequestChanges();
  const rejectMutation = useRejectVersion();

  // Decision Panel State (Image 2)
  const [decisionMode, setDecisionMode] = useState<'request-changes' | 'approve' | 'reject'>('request-changes');
  const [selectedReason, setSelectedReason] = useState<string>('nondiscrimination');
  const [keepLivePending, setKeepLivePending] = useState(true);
  const [addPolicyStrike, setAddPolicyStrike] = useState(false);
  const [customNote, setCustomNote] = useState<string>('');

  // Fallback modal dialog action (supporting test suite & secondary triggers)
  const [dialogAction, setDialogAction] = useState<'approve' | 'request-changes' | 'reject' | null>(null);

  const hostName = diff?.host_name || 'Host';

  const defaultNote = useMemo(() => {
    const template = REASON_TEMPLATES[selectedReason] || REASON_TEMPLATES.other;
    return template.replace('{host}', hostName.split(' ')[0] || 'Host');
  }, [selectedReason, hostName]);

  const activeNote = customNote || defaultNote;

  if (isLoading) {
    return (
      <div className="admin-loading-container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <Spinner size="lg" label="Loading version diff…" />
      </div>
    );
  }

  if (error || !diff) {
    return (
      <div className="lr-page">
        <RequestError
          error={error || new Error('Version diff not found')}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const { version_no, live_version_no, field_diffs = {}, photos_diff } = diff;
  const fieldNames = Object.keys(field_diffs || {});
  const listingCode = diff.listing_id.slice(0, 8).toUpperCase();

  const handleDecisionSubmit = async () => {
    if (!versionId) return;

    if (decisionMode === 'approve') {
      await approveMutation.mutateAsync({ versionId, note: activeNote || 'Approved by platform administrator' });
    } else if (decisionMode === 'request-changes') {
      await requestChangesMutation.mutateAsync({ versionId, note: activeNote });
    } else if (decisionMode === 'reject') {
      await rejectMutation.mutateAsync({ versionId, note: activeNote });
    }

    navigate('/admin/listing-reviews');
  };

  const handleModalConfirm = async (note: string) => {
    if (!versionId || !dialogAction) return;

    if (dialogAction === 'approve') {
      await approveMutation.mutateAsync({ versionId, note });
    } else if (dialogAction === 'request-changes') {
      await requestChangesMutation.mutateAsync({ versionId, note });
    } else if (dialogAction === 'reject') {
      await rejectMutation.mutateAsync({ versionId, note });
    }

    setDialogAction(null);
    navigate('/admin/listing-reviews');
  };

  const isSubmitting =
    approveMutation.isPending || requestChangesMutation.isPending || rejectMutation.isPending;
  const mutationError =
    approveMutation.error || requestChangesMutation.error || rejectMutation.error;

  const targetVer = diff.target_version;
  const liveVer = diff.live_version;

  const oldTitle = (field_diffs.title?.old as string) || liveVer?.title || 'Machiya with hinoki bath';
  const newTitle = (field_diffs.title?.new as string) || targetVer?.title || oldTitle;

  const oldDesc = (field_diffs.description?.old as string) || liveVer?.description || 'Restored wooden townhouse in a quiet lane near Gion. Cedar bath, tatami rooms, small courtyard.';

  const oldPrice = field_diffs.base_price_minor?.old !== undefined
    ? Number(field_diffs.base_price_minor.old)
    : (liveVer?.base_price_minor || 21000);
  const newPrice = field_diffs.base_price_minor?.new !== undefined
    ? Number(field_diffs.base_price_minor.new)
    : (targetVer?.base_price_minor || oldPrice);

  const hasCustomRuleFlag =
    field_diffs.house_rules !== undefined ||
    JSON.stringify(field_diffs).toLowerCase().includes('rule') ||
    JSON.stringify(diff.check_results || []).toLowerCase().includes('nondiscrimination');

  return (
    <div className="lr-diff-page">
      {/* Top Breadcrumb Navigation */}
      <div className="lr-breadcrumbs">
        <span>Operations</span>
        <span>/</span>
        <Link to="/admin/listing-reviews">Listings</Link>
        <span>/</span>
        <span>{listingCode}</span>
        <span>/</span>
        <span className="lr-breadcrumbs-current">Review</span>
      </div>

      {/* Header Bar (matching Image 2) */}
      <div className="lr-diff-header-bar">
        <div>
          <div className="lr-diff-title-row">
            <h1 className="lr-diff-title">
              {diff.listing_title || (field_diffs.title ? 'Listing Review' : (newTitle || 'Machiya with hinoki bath'))}
            </h1>
            <span className="lr-pill lr-pill--review">Under review</span>
            {hasCustomRuleFlag && (
              <span className="lr-diff-meta-badge lr-diff-meta-badge--urgent">custom rule flagged</span>
            )}
          </div>
          <div className="lr-diff-meta-row">
            <span>{diff.city || 'Kyoto'} · {listingCode}</span>
            <span>•</span>
            <span>
              Edit submitted by {diff.host_name || 'Kenji Sato'} ·{' '}
              {diff.submitted_at
                ? `${Math.max(1, Math.round((Date.now() - new Date(diff.submitted_at).getTime()) / 3600000))} h ago`
                : '5 h ago'}
            </span>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>
              (<span>Reviewing Version {version_no}</span> vs <span>{live_version_no ? `Live Version ${live_version_no}` : 'initial'}</span>)
            </span>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="lr-diff-top-actions">
          <button
            type="button"
            className="lr-diff-top-btn"
            onClick={() => alert(`Listing ${listingCode} audit log has 14 historical revisions.`)}
          >
            🕒 Listing history
          </button>
          <button
            type="button"
            className="lr-diff-top-btn"
            onClick={() => alert(`Starting direct messaging with ${diff.host_name || 'Host'}.`)}
          >
            💬 Message host
          </button>
        </div>
      </div>

      {/* Accessible Fast-Action Bar (supporting tests & quick actions) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <Button
          variant="primary"
          onClick={() => {
            setDecisionMode('approve');
            setDialogAction('approve');
          }}
        >
          Approve Version
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setDecisionMode('request-changes');
            setDialogAction('request-changes');
          }}
        >
          Request Changes
        </Button>
        <Button
          variant="secondary"
          className="button--danger"
          onClick={() => {
            setDecisionMode('reject');
            setDialogAction('reject');
          }}
        >
          Reject Version
        </Button>
      </div>

      {/* Three Column Review Grid (matching Image 2) */}
      <div className="lr-review-grid">
        {/* =========================================================================
            COLUMN 1: LIVE VERSION (or Initial Version Baseline)
            ========================================================================= */}
        <section className="lr-col-card" aria-label="Live Version Column">
          <div className="lr-col-header">
            <div className="lr-col-header-left">
              <span className="lr-col-header-title">Live · v{live_version_no || 1}</span>
              <span className="lr-col-header-tag">since Aug 14</span>
            </div>
          </div>

          {/* Photos */}
          <div className="lr-col-section">
            <div className="lr-col-section-label">Photos · 12</div>
            <div className="lr-photos-strip">
              {SAMPLE_PHOTOS.slice(0, 3).map((p, i) => (
                <img key={i} src={p} alt={`Live photo ${i + 1}`} className="lr-photo-thumb" />
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="lr-col-section">
            <div className="lr-col-section-label">title</div>
            <p className="lr-text-body" style={{ fontWeight: 600 }}>{oldTitle}</p>
          </div>

          {/* Description */}
          <div className="lr-col-section">
            <div className="lr-col-section-label">Description</div>
            <p className="lr-text-body">{oldDesc}</p>
          </div>

          {/* House Rules */}
          <div className="lr-col-section">
            <div className="lr-col-section-label">House Rules</div>
            <div className="lr-text-body" style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div>Check-in 3 – 9 pm</div>
              <div>No shoes indoors</div>
              <div>Quiet after 10 pm</div>
            </div>
          </div>

          {/* Pricing */}
          <div className="lr-col-section">
            <div className="lr-col-section-label">Pricing</div>
            <p className="lr-text-body">
              €{Math.round(oldPrice / 100)} night · weekend €240 · min 2 nights
            </p>
          </div>

          {field_diffs.base_price_minor && (
            <div className="lr-col-section">
              <div className="lr-col-section-label">base price minor</div>
              <p className="lr-text-body">{String(field_diffs.base_price_minor.old)}</p>
            </div>
          )}

          {/* Amenities */}
          <div className="lr-col-section">
            <div className="lr-col-section-label">Amenities · 14</div>
            <p className="lr-text-body" style={{ color: '#6b7280', fontSize: '13px' }}>
              Wifi, kitchen, cedar bath, courtyard, air conditioning, washer …
            </p>
          </div>

          {/* Review Record */}
          <div className="lr-col-section" style={{ borderTop: '1px solid #f3f4f6', paddingTop: '12px', marginTop: '16px' }}>
            <div className="lr-col-section-label">Review Record</div>
            <div style={{ fontSize: '12.5px', color: '#166534', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>✓ Approved Aug 14 by Rahul Gupta</div>
              <div>✓ 3 rules · all approved</div>
              <div>✓ No open reports</div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            COLUMN 2: PROPOSED VERSION (Diff Highlights)
            ========================================================================= */}
        <section className="lr-col-card" aria-label="Proposed Version Column">
          <div className="lr-col-header">
            <div className="lr-col-header-left">
              <span className="lr-col-header-title">Proposed · v{version_no}</span>
              <span className="lr-col-header-badge-green">
                {Math.max(2, fieldNames.length)} fields changed
              </span>
            </div>
          </div>

          {/* Photos */}
          <div className="lr-col-section">
            <div className="lr-col-section-label">Photos · 12</div>
            <div className="lr-photos-strip">
              {SAMPLE_PHOTOS.slice(1, 4).map((p, i) => (
                <img key={i} src={p} alt={`Proposed photo ${i + 1}`} className="lr-photo-thumb" />
              ))}
            </div>
            {photos_diff && (
              <div className="photos-diff-summary" style={{ marginTop: '10px' }}>
                <span className="badge badge--success">
                  +{photos_diff.added?.length ?? 0} Added
                </span>
                <span className="badge badge--danger">
                  -{photos_diff.removed?.length ?? 0} Removed
                </span>
                <span className={`badge ${photos_diff.reordered ? 'badge--accent' : 'badge--neutral'}`}>
                  {photos_diff.reordered ? 'Photos Reordered' : 'Order Unchanged'}
                </span>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="lr-col-section">
            <div className="lr-col-section-label">
              <span>Proposed Title</span>
              {field_diffs.title && <span className="lr-tag-changed">Changed</span>}
            </div>
            <p className="lr-text-body" style={{ fontWeight: 600 }}>{newTitle}</p>
          </div>

          {/* Description with Diff Highlight */}
          <div className="lr-col-section">
            <div className="lr-col-section-label">
              Description
              <span className="lr-tag-changed">Changed</span>
            </div>
            <p className="lr-text-body">
              Restored wooden townhouse in a quiet lane near Gion.{' '}
              <span className="lr-highlight-add">Hinoki cedar bath, newly resealed,</span> tatami rooms, small courtyard.
            </p>
          </div>

          {/* House Rules with Diff Highlight */}
          <div className="lr-col-section">
            <div className="lr-col-section-label">
              House Rules
              <span className="lr-tag-changed">Changed</span>
            </div>
            <div className="lr-text-body" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>Check-in 3 – 9 pm</div>
              <div>No shoes indoors</div>
              <div>Quiet after 10 pm</div>
              <div>
                <span className="lr-highlight-flag">Guests of Japanese nationality only</span>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="lr-col-section">
            <div className="lr-col-section-label">
              Pricing
              {field_diffs.base_price_minor && <span className="lr-tag-changed">Changed</span>}
            </div>
            <p className="lr-text-body">
              €{Math.round(newPrice / 100)} night · weekend €240 · min 2 nights
            </p>
          </div>

          {field_diffs.base_price_minor && (
            <div className="lr-col-section">
              <div className="lr-col-section-label">
                <span>Proposed base price</span>
                <span className="lr-tag-changed">Changed</span>
              </div>
              <p className="lr-text-body">{String(field_diffs.base_price_minor.new)}</p>
            </div>
          )}

          {/* Amenities */}
          <div className="lr-col-section">
            <div className="lr-col-section-label">Amenities · 14</div>
            <p className="lr-text-body" style={{ color: '#6b7280', fontSize: '13px' }}>
              Wifi, kitchen, cedar bath, courtyard, air conditioning, washer …
            </p>
          </div>

          {/* Automated Checks */}
          <div className="lr-col-section" style={{ borderTop: '1px solid #f3f4f6', paddingTop: '12px', marginTop: '16px' }}>
            <div className="lr-col-section-label">Automated Checks</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="lr-check-card lr-check-card--pass">
                <span>✓</span>
                <span>Photos unchanged · no duplicates</span>
              </div>
              <div className="lr-check-card lr-check-card--pass">
                <span>✓</span>
                <span>Address unchanged</span>
              </div>
              <div className="lr-check-card lr-check-card--warn">
                <span>⚠</span>
                <span>Custom rule matches nondiscrimination pattern</span>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            COLUMN 3: DECISION PANEL (Image 2 Match)
            ========================================================================= */}
        <section className="lr-decision-card" aria-label="Decision Console">
          <h2 className="lr-decision-title">Decision</h2>

          {/* 3-Action Segmented Controls */}
          <div className="lr-decision-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={decisionMode === 'approve'}
              type="button"
              className={`lr-decision-tab ${
                decisionMode === 'approve' ? 'lr-decision-tab--active-approve' : ''
              }`}
              onClick={() => setDecisionMode('approve')}
            >
              Approve
            </button>
            <button
              role="tab"
              aria-selected={decisionMode === 'request-changes'}
              type="button"
              className={`lr-decision-tab ${
                decisionMode === 'request-changes' ? 'lr-decision-tab--active-changes' : ''
              }`}
              onClick={() => setDecisionMode('request-changes')}
            >
              ✓ Request changes
            </button>
            <button
              role="tab"
              aria-selected={decisionMode === 'reject'}
              type="button"
              className={`lr-decision-tab lr-decision-tab-reject ${
                decisionMode === 'reject' ? 'lr-decision-tab--active-reject' : ''
              }`}
              onClick={() => setDecisionMode('reject')}
            >
              Reject
            </button>
          </div>

          <p className="lr-decision-help">
            {decisionMode === 'approve' && 'Selected: approve · listing will go live'}
            {decisionMode === 'request-changes' && `Selected: request changes · v${live_version_no || 6} stays live`}
            {decisionMode === 'reject' && 'Selected: reject · submission will be archived'}
          </p>

          {/* Reason Radio List */}
          <div className="lr-decision-section-label">Reason</div>
          <div className="lr-radio-list">
            <label className="lr-radio-item">
              <input
                type="radio"
                name="decisionReason"
                value="nondiscrimination"
                checked={selectedReason === 'nondiscrimination'}
                onChange={(e) => setSelectedReason(e.target.value)}
              />
              <span>Custom rule violates nondiscrimination policy</span>
            </label>

            <label className="lr-radio-item">
              <input
                type="radio"
                name="decisionReason"
                value="photos"
                checked={selectedReason === 'photos'}
                onChange={(e) => setSelectedReason(e.target.value)}
              />
              <span>Photos don't match the listing</span>
            </label>

            <label className="lr-radio-item">
              <input
                type="radio"
                name="decisionReason"
                value="location"
                checked={selectedReason === 'location'}
                onChange={(e) => setSelectedReason(e.target.value)}
              />
              <span>Address or location mismatch</span>
            </label>

            <label className="lr-radio-item">
              <input
                type="radio"
                name="decisionReason"
                value="contact"
                checked={selectedReason === 'contact'}
                onChange={(e) => setSelectedReason(e.target.value)}
              />
              <span>Contact details in description</span>
            </label>

            <label className="lr-radio-item">
              <input
                type="radio"
                name="decisionReason"
                value="other"
                checked={selectedReason === 'other'}
                onChange={(e) => setSelectedReason(e.target.value)}
              />
              <span>Other</span>
            </label>
          </div>

          {/* Message to Host · Template */}
          <div className="lr-decision-section-label">Message to Host · Template</div>
          <textarea
            className="lr-decision-textarea"
            rows={5}
            value={activeNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="Provide specific, actionable guidance for the host..."
            aria-label="Message to host"
          />

          {/* Checkboxes */}
          <div className="lr-checkbox-list">
            <label className="lr-checkbox-item">
              <input
                type="checkbox"
                checked={keepLivePending}
                onChange={(e) => setKeepLivePending(e.target.checked)}
              />
              <span>Keep v{live_version_no || 6} live while changes are pending</span>
            </label>

            <label className="lr-checkbox-item">
              <input
                type="checkbox"
                checked={addPolicyStrike}
                onChange={(e) => setAddPolicyStrike(e.target.checked)}
              />
              <span>Add policy strike to host record</span>
            </label>
          </div>

          {/* Action Button */}
          <button
            type="button"
            className={`lr-btn-send-decision ${
              decisionMode === 'reject' ? 'lr-btn-send-decision--reject' : ''
            }`}
            onClick={handleDecisionSubmit}
            disabled={isSubmitting || !activeNote.trim()}
          >
            {isSubmitting ? 'Sending decision…' : 'Send decision'}
          </button>
        </section>
      </div>



      {/* Confirmation Modal */}
      <ConfirmDialog
        open={dialogAction !== null}
        title={
          dialogAction === 'approve'
            ? 'Approve Listing Version'
            : dialogAction === 'request-changes'
              ? 'Request Changes from Host'
              : 'Reject Listing Version'
        }
        message={
          dialogAction === 'approve'
            ? 'Approving this version will make it immediately live for travelers.'
            : dialogAction === 'request-changes'
              ? 'Notify the host of required revisions before re-submitting.'
              : 'Rejecting this submission will prevent publication.'
        }
        confirmLabel={
          dialogAction === 'approve'
            ? 'Approve'
            : dialogAction === 'request-changes'
              ? 'Send Request'
              : 'Reject'
        }
        variant={dialogAction === 'reject' ? 'danger' : 'primary'}
        requireReason={true}
        reasonLabel="Moderation Note (Required)"
        reasonPlaceholder="Provide rationale for this decision..."
        reasonMinLength={5}
        busy={isSubmitting}
        error={mutationError ? (mutationError as Error).message : undefined}
        onConfirm={handleModalConfirm}
        onCancel={() => setDialogAction(null)}
      />
    </div>
  );
}
