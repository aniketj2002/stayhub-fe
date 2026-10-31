import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../../auth/session';
import { EmptyState, RequestError, Spinner } from '../../../components/ui';
import { exportAuditCSV, useAuditLog } from './api';
import type { AuditEvent } from './types';

type ActionTone = 'approve' | 'financial' | 'restrict';

type SavedFilter = {
  id: string;
  name: string;
  q: string;
  actor: string;
  action: string;
  objectType: string;
  from: string;
  to: string;
};

const SAVED_KEY = 'stayhub.admin.audit.saved-filters';

const ACTION_OPTIONS = [
  ['', 'All'],
  ['reservation.create', 'Created reservation'],
  ['reservation.accept', 'Accepted reservation'],
  ['reservation.decline', 'Declined reservation'],
  ['admin.reservation.cancel', 'Cancelled reservation'],
  ['admin.reservation.refund', 'Issued refund'],
  ['payment.refund', 'Issued refund'],
  ['payment.charge', 'Captured payment'],
  ['payout.schedule', 'Scheduled payout'],
  ['payout.hold', 'Held payout'],
  ['payout.release', 'Released payout'],
  ['listing.approve', 'Approved listing'],
  ['listing.reject', 'Rejected listing'],
  ['listing.request_changes', 'Requested changes'],
  ['fee_config.propose', 'Edited fee config'],
] as const;

const OBJECT_OPTIONS = [
  ['', 'All'],
  ['reservation', 'Reservation'],
  ['listing', 'Listing'],
  ['payout', 'Payout'],
  ['payment', 'Payment'],
  ['fee_config', 'Fees'],
  ['admin', 'Admin'],
] as const;

const ACTION_LABELS: Record<string, string> = {
  ...Object.fromEntries(ACTION_OPTIONS.filter(([value]) => value).map(([value, label]) => [value, label])),
  'reservation.refund': 'Issued refund',
  'payout.scheduled': 'Scheduled payout',
  'payout.schedule': 'Scheduled payout',
};

function actionLabel(action: string) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const tail = action.split('.').pop() || action;
  const words = tail.replaceAll('_', ' ');
  return words.replace(/^\w/, (char) => char.toUpperCase());
}

function actionTone(action: string): ActionTone {
  const value = action.toLowerCase();
  if (/restrict|suspend|impersonat|reject|decline|cancel|hold|fail|request_changes/.test(value)) {
    return 'restrict';
  }
  if (/approv|release|resolv|accept|complete/.test(value)) return 'approve';
  return 'financial';
}

function actorPresentation(event: AuditEvent, adminName?: string, adminId?: string) {
  if (event.actor_type === 'system' || event.actor_type === 'worker') {
    return { initials: 'SY', name: 'System', tone: 'system' };
  }
  if (adminId && event.actor_id === adminId && adminName) {
    const initials = adminName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
    return { initials: initials || 'AD', name: adminName, tone: 'admin' };
  }
  const labels: Record<string, string> = {
    admin: 'Admin',
    guest: 'Guest',
    host: 'Host',
    cohost: 'Cohost',
    user: 'User',
  };
  const name = labels[event.actor_type] || event.actor_type.replaceAll('_', ' ');
  return { initials: name.slice(0, 2).toUpperCase(), name, tone: event.actor_type };
}

function objectLabel(event: AuditEvent) {
  const type = event.object_type.replaceAll('_', ' ').replace(/^\w/, (char) => char.toUpperCase());
  const compact = event.object_id.replace(/-/g, '').slice(0, 8).toUpperCase();
  return compact ? `${type} · ${compact}` : type;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function previewValue(value: unknown) {
  if (value == null || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  const text = JSON.stringify(value);
  return text.length > 48 ? `${text.slice(0, 45)}…` : text;
}

function changeSummary(event: AuditEvent) {
  const before = asRecord(event.before_state);
  const after = asRecord(event.after_state);
  if (before && after) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    const parts = keys
      .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      .slice(0, 2)
      .map(
        (key) =>
          `${key.replaceAll('_', ' ')} ${previewValue(before[key])} → ${previewValue(after[key])}`,
      );
    if (parts.length) return parts.join(' · ');
  }
  return event.reason || '—';
}

function eventIp(event: AuditEvent) {
  const ip = event.metadata?.ip || event.metadata?.ip_address || event.metadata?.remote_ip;
  return typeof ip === 'string' && ip ? ip : '—';
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${day} · ${time}`;
}

function readSaved(): SavedFilter[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedFilter[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function AuditLogPage() {
  const session = useSession('admin');
  const admin = session.identity?.subject_type === 'admin' ? session.identity.admin : null;

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [objectType, setObjectType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [exporting, setExporting] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [saved, setSaved] = useState<SavedFilter[]>(() => readSaved());
  const [filterName, setFilterName] = useState('');
  const savedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    if (!savedOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!savedRef.current?.contains(event.target as Node)) setSavedOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [savedOpen]);

  const filters = useMemo(
    () => ({
      q: debouncedQ || undefined,
      actor_type: actor || undefined,
      action: action || undefined,
      object_type: objectType || undefined,
      from: from || undefined,
      to: to || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    [debouncedQ, actor, action, objectType, from, to, pageSize, page],
  );

  const { data, isLoading, error, refetch } = useAuditLog(filters);
  const events = data?.events || [];
  const start = events.length === 0 ? 0 : filters.offset + 1;
  const end = filters.offset + events.length;
  const canNext = events.length === pageSize;

  const resetPage = () => setPage(1);

  const applySaved = (item: SavedFilter) => {
    setQ(item.q);
    setDebouncedQ(item.q);
    setActor(item.actor);
    setAction(item.action);
    setObjectType(item.objectType);
    setFrom(item.from);
    setTo(item.to);
    setPage(1);
    setSavedOpen(false);
  };

  const saveCurrent = () => {
    const name = filterName.trim();
    if (!name) return;
    const next = [
      {
        id: crypto.randomUUID(),
        name,
        q,
        actor,
        action,
        objectType,
        from,
        to,
      },
      ...saved,
    ].slice(0, 8);
    setSaved(next);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    setFilterName('');
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportAuditCSV(filters);
    } catch (err) {
      console.error('Failed to export CSV', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="audit-page">
      <header className="audit-header">
        <div>
          <h1 className="audit-title">Audit log</h1>
          <p className="audit-subtitle">Every admin action · immutable · retained 7 years</p>
        </div>
        <div className="audit-header-actions">
          <div className="audit-saved" ref={savedRef}>
            <button
              type="button"
              className="audit-outline-btn"
              aria-expanded={savedOpen}
              onClick={() => setSavedOpen((open) => !open)}
            >
              Saved filters
            </button>
            {savedOpen && (
              <div className="audit-saved-panel">
                {saved.length === 0 && <p className="audit-saved-empty">No saved filters yet.</p>}
                {saved.map((item) => (
                  <button key={item.id} type="button" onClick={() => applySaved(item)}>
                    {item.name}
                  </button>
                ))}
                <div className="audit-saved-form">
                  <input
                    value={filterName}
                    onChange={(event) => setFilterName(event.target.value)}
                    placeholder="Name this view"
                    aria-label="Filter name"
                  />
                  <button type="button" onClick={saveCurrent} disabled={!filterName.trim()}>
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
          <button type="button" className="audit-export-btn" onClick={handleExport} disabled={exporting}>
            <DownloadIcon />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </header>

      <section className="audit-panel">
        <div className="audit-toolbar">
          <label className="audit-search">
            <SearchIcon />
            <input
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                resetPage();
              }}
              placeholder="Search actor, object, or value"
              aria-label="Search actor, object, or value"
            />
          </label>
          <FilterSelect
            label="Actor"
            value={actor}
            onChange={(value) => {
              setActor(value);
              resetPage();
            }}
            options={[
              ['', 'All'],
              ['admin', 'Admin'],
              ['guest', 'Guest'],
              ['host', 'Host'],
              ['system', 'System'],
            ]}
          />
          <FilterSelect
            label="Action"
            value={action}
            onChange={(value) => {
              setAction(value);
              resetPage();
            }}
            options={ACTION_OPTIONS}
          />
          <FilterSelect
            label="Object"
            value={objectType}
            onChange={(value) => {
              setObjectType(value);
              resetPage();
            }}
            options={OBJECT_OPTIONS}
          />
          <div className="audit-dates">
            <CalendarIcon />
            <input
              type="date"
              value={from}
              aria-label="From date"
              onChange={(event) => {
                setFrom(event.target.value);
                resetPage();
              }}
            />
            <span aria-hidden="true">–</span>
            <input
              type="date"
              value={to}
              aria-label="To date"
              onChange={(event) => {
                setTo(event.target.value);
                resetPage();
              }}
            />
          </div>
          <div className="audit-legend" aria-hidden="true">
            <span>
              <i className="audit-dot audit-dot--approve" /> Approve / release
            </span>
            <span>
              <i className="audit-dot audit-dot--financial" /> Financial / config
            </span>
            <span>
              <i className="audit-dot audit-dot--restrict" /> Restrictive
            </span>
          </div>
        </div>

        {error ? (
          <div className="audit-error">
            <RequestError error={error} onRetry={() => void refetch()} />
          </div>
        ) : (
          <div className="audit-table-scroll">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Object</th>
                  <th>Before → after</th>
                  <th>IP</th>
                  <th aria-label="Details" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="audit-table-status">
                      <Spinner label="Loading audit events…" />
                    </td>
                  </tr>
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="audit-table-status">
                      <EmptyState title="No audit records">
                        Events and system interactions will be logged here.
                      </EmptyState>
                    </td>
                  </tr>
                ) : (
                  events.map((event) => {
                    const actorView = actorPresentation(event, admin?.full_name, admin?.id);
                    const open = openId === event.id;
                    return (
                      <Fragment key={event.id}>
                        <tr className={open ? 'is-open' : undefined}>
                          <td className="audit-when">
                            <time dateTime={event.occurred_at}>{formatWhen(event.occurred_at)}</time>
                          </td>
                          <td>
                            <div className="audit-actor">
                              <span className={`audit-avatar audit-avatar--${actorView.tone}`} aria-hidden="true">
                                {actorView.initials}
                              </span>
                              <span>{actorView.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`audit-action audit-action--${actionTone(event.action)}`}>
                              {actionLabel(event.action)}
                            </span>
                          </td>
                          <td className="audit-object">{objectLabel(event)}</td>
                          <td className="audit-change">{changeSummary(event)}</td>
                          <td className="audit-ip">{eventIp(event)}</td>
                          <td className="audit-chevron-cell">
                            <button
                              type="button"
                              className="audit-chevron"
                              aria-expanded={open}
                              aria-label={open ? 'Hide event details' : 'Show event details'}
                              onClick={() => setOpenId(open ? null : event.id)}
                            >
                              <ChevronIcon open={open} />
                            </button>
                          </td>
                        </tr>
                        {open && (
                          <tr className="audit-detail-row">
                            <td colSpan={7}>
                              <div className="audit-detail">
                                <p>
                                  <strong>Action</strong> {event.action}
                                </p>
                                <p>
                                  <strong>Object</strong> {event.object_type} {event.object_id}
                                </p>
                                <p>
                                  <strong>Request</strong> {event.request_id || '—'}
                                </p>
                                {event.reason && (
                                  <p>
                                    <strong>Reason</strong> {event.reason}
                                  </p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        <footer className="audit-footer">
          <p>
            Showing {start}–{end}
            {events.length === 1 ? ' event' : ' events'}
          </p>
          <div className="audit-footer-controls">
            <label className="audit-page-size">
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </label>
            <button type="button" className="audit-prev" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
              Previous
            </button>
            <button type="button" className="audit-next" disabled={!canNext} onClick={() => setPage((n) => n + 1)}>
              Next
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <label className="audit-filter">
      <span>{label}</span>
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || 'all'} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 4v11" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 19h14" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      style={{ transform: open ? 'rotate(90deg)' : undefined }}
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}
