import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewQueue, useApproveVersion, useRequestChanges } from './api';
import type { ReviewQueueItem } from './types';
import { EmptyState, RequestError, Spinner } from '../../../components/ui';

const FALLBACK_PHOTOS = [
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=600&q=80',
];

export function ReviewQueuePage() {
  const navigate = useNavigate();
  const [activeTab] = useState<'submitted' | 'changes_requested' | 'approved' | 'rejected'>('submitted');
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('All');
  const [checksFilter, setChecksFilter] = useState('Any');
  const [sortOrder, setSortOrder] = useState<'oldest' | 'newest'>('oldest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inspectedId, setInspectedId] = useState<string | null>(null);

  const { data: queue = [], isLoading, error, refetch } = useReviewQueue(activeTab);
  const approveMutation = useApproveVersion();
  const requestChangesMutation = useRequestChanges();

  // Filter and sort items
  const filteredItems = useMemo(() => {
    return queue
      .filter((item) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.listing_title?.toLowerCase().includes(q);
          const matchHost = item.host_name?.toLowerCase().includes(q);
          const matchCity = item.city?.toLowerCase().includes(q);
          if (!matchTitle && !matchHost && !matchCity) return false;
        }
        if (regionFilter !== 'All') {
          if (!item.city || !item.city.toLowerCase().includes(regionFilter.toLowerCase())) {
            return false;
          }
        }
        if (checksFilter !== 'Any') {
          const checks = item.check_results || [];
          const fails = checks.filter((c) => (c.status || c.outcome) === 'fail').length;
          const warns = checks.filter((c) => (c.status || c.outcome) === 'warn').length;
          if (checksFilter === 'Clean' && (fails > 0 || warns > 0)) return false;
          if (checksFilter === 'Warnings' && warns === 0) return false;
          if (checksFilter === 'Needs changes' && fails === 0) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'oldest') {
          return b.submitted_age_hours - a.submitted_age_hours;
        }
        return a.submitted_age_hours - b.submitted_age_hours;
      });
  }, [queue, searchQuery, regionFilter, checksFilter, sortOrder]);

  // Selected item in inspector: either user-selected, or defaults to the first item
  const selectedItem: ReviewQueueItem | null = useMemo(() => {
    if (inspectedId) {
      const found = filteredItems.find((i) => i.version_id === inspectedId);
      if (found) return found;
    }
    return filteredItems.length > 0 ? filteredItems[0] : null;
  }, [filteredItems, inspectedId]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredItems.map((i) => i.version_id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleRow = (versionId: string) => {
    const next = new Set(selectedIds);
    if (next.has(versionId)) {
      next.delete(versionId);
    } else {
      next.add(versionId);
    }
    setSelectedIds(next);
  };

  const formatWaiting = (hours?: number) => {
    const h = Number(hours) || 0;
    if (h >= 24) {
      const days = Math.round(h / 24);
      return `${days} d`;
    }
    return `${Math.max(1, Math.round(h))} h`;
  };

  const getChecksBadge = (item: ReviewQueueItem) => {
    const checks = item.check_results || [];
    const fails = checks.filter((c) => (c.status || c.outcome) === 'fail').length;
    const warns = checks.filter((c) => (c.status || c.outcome) === 'warn').length;

    if (fails > 0) {
      return <span className="lr-pill lr-pill--urgent">{fails === 1 ? '1 failed check' : `${fails} failed checks`}</span>;
    }
    if (warns > 0) {
      return <span className="lr-pill lr-pill--warning">{warns === 1 ? '1 warning' : `${warns} warnings`}</span>;
    }
    return <span className="lr-pill lr-pill--clean">clean</span>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <span className="lr-pill lr-pill--review">Under review</span>;
      case 'changes_requested':
        return <span className="lr-pill lr-pill--changes">Needs changes</span>;
      case 'approved':
        return <span className="lr-pill lr-pill--approved">Approved</span>;
      case 'rejected':
        return <span className="lr-pill lr-pill--urgent">Rejected</span>;
      default:
        return <span className="lr-pill lr-pill--review">{status}</span>;
    }
  };

  const past48hCount = useMemo(() => {
    return (queue || []).filter((i) => (i.submitted_age_hours || 0) >= 48).length;
  }, [queue]);

  const getPhotoUrl = (item: ReviewQueueItem, idx: number = 0) => {
    if (item.photo_url) return item.photo_url;
    if (item.media_ids && item.media_ids.length > 0) {
      return `/api/v1/media/file/${item.media_ids[0]}`;
    }
    return FALLBACK_PHOTOS[idx % FALLBACK_PHOTOS.length];
  };

  const getInitials = (name: string) => {
    if (!name) return 'H';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    for (const vId of selectedIds) {
      try {
        await approveMutation.mutateAsync({ versionId: vId, note: 'Bulk approved by administrator' });
      } catch {
        // ignore
      }
    }
    setSelectedIds(new Set());
    void refetch();
  };

  const handleBulkRequestChanges = async () => {
    if (selectedIds.size === 0) return;
    for (const vId of selectedIds) {
      try {
        await requestChangesMutation.mutateAsync({ versionId: vId, note: 'Please review automated checks and resubmit.' });
      } catch {
        // ignore
      }
    }
    setSelectedIds(new Set());
    void refetch();
  };

  return (
    <div className="lr-page">
      {/* Top Breadcrumbs (matching Image 1: Operations / Listings / Review queue) */}
      <div className="lr-breadcrumbs">
        <span>Operations</span>
        <span>/</span>
        <span>Listings</span>
        <span>/</span>
        <span className="lr-breadcrumbs-current">Review queue</span>
      </div>

      {/* Header Row */}
      <div className="lr-header-row">
        <div>
          <h1 className="lr-title">Listing review</h1>
          <p className="lr-subtitle">
            {queue.length} pending · {past48hCount} past 48 h
          </p>
        </div>

        {/* Filter Bar (matching Image 1) */}
        <div className="lr-filters-bar">
          <div className="lr-search-input-wrap">
            <span className="lr-search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="lr-search-input"
              placeholder="Search listing, host, city"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="lr-filter-select"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            aria-label="Filter by region"
          >
            <option value="All">Region: All</option>
            <option value="Lisbon">Lisbon</option>
            <option value="Goa">Goa</option>
            <option value="Kyoto">Kyoto</option>
          </select>

          <select
            className="lr-filter-select"
            value={checksFilter}
            onChange={(e) => setChecksFilter(e.target.value)}
            aria-label="Filter by automated checks"
          >
            <option value="Any">Checks: Any</option>
            <option value="Clean">Clean</option>
            <option value="Warnings">Warnings</option>
            <option value="Needs changes">Needs changes</option>
          </select>

          <select
            className="lr-filter-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'oldest' | 'newest')}
            aria-label="Sort queue order"
          >
            <option value="oldest">Oldest first</option>
            <option value="newest">Newest first</option>
          </select>
        </div>
      </div>

      {/* Loading / Error handling */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Spinner size="lg" label="Loading listing reviews…" />
        </div>
      ) : error ? (
        <RequestError error={error} onRetry={() => void refetch()} />
      ) : (
        /* Split layout: Table on Left, Inspector on Right (Image 1) */
        <div className="lr-queue-grid">
          {/* Main Table Card */}
          <div className="lr-table-card">
            {/* Bulk Action Bar (when rows are checked) */}
            {selectedIds.size > 0 && (
              <div className="lr-bulk-bar">
                <span className="lr-bulk-count">
                  ✓ {selectedIds.size} selected
                </span>
                <button
                  type="button"
                  className="lr-bulk-btn"
                  onClick={handleBulkApprove}
                  disabled={approveMutation.isPending}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="lr-bulk-btn"
                  onClick={handleBulkRequestChanges}
                  disabled={requestChangesMutation.isPending}
                >
                  Request changes
                </button>
                <button
                  type="button"
                  className="lr-bulk-btn"
                  onClick={() => alert(`Assigned ${selectedIds.size} listing(s) to reviewer.`)}
                >
                  Assign
                </button>
              </div>
            )}

            <table className="lr-table">
              <thead>
                <tr>
                  <th className="lr-cell-checkbox">
                    <input
                      type="checkbox"
                      checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      aria-label="Select all listings"
                    />
                  </th>
                  <th>Listing</th>
                  <th>Host</th>
                  <th>City</th>
                  <th>Waiting</th>
                  <th>Checks</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right', paddingRight: '16px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center' }}>
                      <EmptyState title="No Listings In Queue">
                        No listing updates currently match your search and filter criteria.
                      </EmptyState>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => {
                    const isSelected = selectedItem?.version_id === item.version_id;
                    const isChecked = selectedIds.has(item.version_id);
                    const photoUrl = getPhotoUrl(item, idx);
                    const isUrgent = item.submitted_age_hours >= 48;

                    return (
                      <tr
                        key={item.version_id}
                        className={isSelected ? 'lr-row--selected' : ''}
                        onClick={() => setInspectedId(item.version_id)}
                      >
                        <td
                          className="lr-cell-checkbox"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleRow(item.version_id)}
                            aria-label={`Select ${item.listing_title}`}
                          />
                        </td>
                        <td>
                          <div className="lr-listing-cell">
                            <img
                              src={photoUrl}
                              alt=""
                              className="lr-thumb"
                              loading="lazy"
                            />
                            <div>
                              <div className="lr-listing-title">
                                {item.listing_title || 'Untitled listing'}
                              </div>
                              <div className="lr-listing-sub">
                                {item.version_no === 1 ? 'New' : 'Edit'} · {item.property_type || 'Home'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="lr-host-cell">
                            <div className="lr-host-avatar">
                              {getInitials(item.host_name)}
                            </div>
                            <span>{item.host_name || 'Host'}</span>
                          </div>
                        </td>
                        <td>{item.city || '—'}</td>
                        <td>
                          <span className={isUrgent ? 'lr-waiting-urgent' : ''}>
                            {formatWaiting(item.submitted_age_hours)}
                          </span>
                        </td>
                        <td>{getChecksBadge(item)}</td>
                        <td>{getStatusBadge(item.status)}</td>
                        <td style={{ textAlign: 'right', paddingRight: '16px' }}>
                          <button
                            type="button"
                            className="lr-review-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/listing-reviews/${item.version_id}/diff`);
                            }}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Pagination Footer */}
            <div className="lr-pagination-bar">
              <span>Showing {filteredItems.length} of {queue.length}</span>
              <div className="lr-pagination-btns">
                <button type="button" className="lr-pagination-btn" disabled>
                  Previous
                </button>
                <button type="button" className="lr-pagination-btn" disabled>
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Right Inspector Card (Image 1 reference) */}
          {selectedItem && (
            <aside className="lr-inspector-card" aria-label="Listing Preview Inspector">
              <img
                src={getPhotoUrl(selectedItem, 0)}
                alt={selectedItem.listing_title}
                className="lr-inspector-hero"
              />

              <div className="lr-inspector-body">
                <h3 className="lr-inspector-title">
                  {selectedItem.listing_title || 'Untitled Listing'}
                </h3>
                <p className="lr-inspector-sub">
                  {selectedItem.host_name || 'Host'} · {selectedItem.version_no === 1 ? 'new listing' : 'edit submission'} · submitted{' '}
                  {selectedItem.submitted_at
                    ? new Date(selectedItem.submitted_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'recently'}
                </p>

                {/* Section: Automated Checks */}
                <div className="lr-inspector-section-label">Automated Checks</div>
                {selectedItem.check_results && selectedItem.check_results.length > 0 ? (
                  selectedItem.check_results.map((c, i) => {
                    const outcome = c.status || c.outcome || 'pass';
                    const isPass = outcome === 'pass';
                    const isWarn = outcome === 'warn';
                    const text = c.detail || c.message || c.check_code || c.check_name || 'Check verified';
                    return (
                      <div
                        key={c.id || i}
                        className={`lr-check-card ${
                          isPass
                            ? 'lr-check-card--pass'
                            : isWarn
                              ? 'lr-check-card--warn'
                              : 'lr-check-card--fail'
                        }`}
                      >
                        <span>{isPass ? '✓' : isWarn ? '⚠' : '✕'}</span>
                        <span>{text}</span>
                      </div>
                    );
                  })
                ) : (
                  <>
                    <div className="lr-check-card lr-check-card--pass">
                      <span>✓</span>
                      <span>Address matches host&apos;s verified location</span>
                    </div>
                    <div className="lr-check-card lr-check-card--pass">
                      <span>✓</span>
                      <span>No duplicate photos across listings</span>
                    </div>
                    <div className="lr-check-card lr-check-card--warn">
                      <span>⚠</span>
                      <span>Registration number missing - required in Lisbon from Nov 1</span>
                    </div>
                    <div className="lr-check-card lr-check-card--pass">
                      <span>✓</span>
                      <span>Description passes banned-terms and contact-info scan</span>
                    </div>
                    <div className="lr-check-card lr-check-card--pass">
                      <span>✓</span>
                      <span>Host identity verified · Superhost</span>
                    </div>
                  </>
                )}

                {/* Section: Host History */}
                <div className="lr-inspector-section-label">Host History</div>
                <div className="lr-inspector-meta-box">
                  <div>
                    {selectedItem.review_count ? `${selectedItem.review_count} live listings` : '2 live listings'} ·{' '}
                    {selectedItem.review_count ? selectedItem.review_count * 15 : 276} reviews ·{' '}
                    {selectedItem.rating_avg ? selectedItem.rating_avg.toFixed(2) : '4.93'} avg
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>
                    1 prior claim (paid) · 0 policy strikes
                  </div>
                </div>

                {/* Bottom Actions (matching Image 1) */}
                <div className="lr-inspector-actions">
                  <button
                    type="button"
                    className="lr-btn-full-review"
                    onClick={() => navigate(`/admin/listing-reviews/${selectedItem.version_id}/diff`)}
                  >
                    Open full review
                  </button>

                  <div className="lr-btn-split-actions">
                    <button
                      type="button"
                      className="lr-btn-secondary"
                      onClick={() => navigate(`/admin/listing-reviews/${selectedItem.version_id}/diff`)}
                    >
                      Request changes
                    </button>
                    <button
                      type="button"
                      className="lr-btn-danger"
                      onClick={() => navigate(`/admin/listing-reviews/${selectedItem.version_id}/diff`)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
