import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

export function Button({
  type = 'button',
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return <button type={type} className={`button button--${variant} ${className}`} {...props} />;
}

export function Field({
  label,
  id,
  error,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
  error?: string;
  hint?: string;
}) {
  const description = error || hint;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={description ? `${id}-description` : undefined}
        {...props}
      />
      {description && (
        <small id={`${id}-description`} className={error ? 'field-error' : ''}>
          {description}
        </small>
      )}
    </div>
  );
}

export type BadgeTone =
  | 'neutral'
  | 'positive'
  | 'warning'
  | 'danger'
  | 'info'
  | 'accent'
  | 'success';

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return <span className={`badge badge--${tone} ${className}`}>{children}</span>;
}

export function Spinner({
  size = 'md',
  label = 'Loading…',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}) {
  return (
    <div className={`spinner-wrapper spinner-wrapper--${size} ${className}`} role="status">
      <div className={`spinner spinner--${size}`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="empty-state">
      <span className="empty-icon" aria-hidden="true">
        ⌂
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </section>
  );
}

export function ErrorPanel({
  title = 'Something went wrong',
  message,
  onRetry,
  requestId,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  requestId?: string;
}) {
  return (
    <section className="error-panel" role="alert">
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
        {requestId && <small>Request reference: {requestId}</small>}
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </section>
  );
}

export function Skeleton({ label = 'Loading', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-label={label} className="skeleton-group">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" aria-hidden="true" />
      ))}
    </div>
  );
}

export function SuccessNotice({ children }: { children: ReactNode }) {
  return (
    <div className="success-notice" role="status">
      {children}
    </div>
  );
}

export function Dialog({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    else if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <Button variant="ghost" onClick={onClose} aria-label="Close dialog">
          ✕
        </Button>
      </div>
      {children}
    </dialog>
  );
}

/* =========================================================================
   V2 Foundation UI Primitives (F-P0)
   Tabs, DataTable, Timeline, Drawer, ConfirmDialog
   ========================================================================= */

export interface TabItem {
  id: string;
  label: string;
  count?: number | string;
  badge?: ReactNode;
  disabled?: boolean;
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  className = '',
}: {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={`tabs-list ${className}`} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            disabled={tab.disabled}
            className={`tab-item ${isActive ? 'tab-item--active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            <span className="tab-item-label">{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`tab-item-count ${isActive ? 'tab-item-count--active' : ''}`}>
                {tab.count}
              </span>
            )}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  render?: (row: T, index: number) => ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyField?: keyof T | ((row: T) => string);
  loading?: boolean;
  emptyState?: ReactNode;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  currentPage?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyField = 'id' as keyof T,
  loading = false,
  emptyState,
  sortKey,
  sortDirection = 'asc',
  onSort,
  currentPage = 1,
  pageSize = 10,
  totalCount,
  onPageChange,
  onRowClick,
  className = '',
}: DataTableProps<T>) {
  // If controlled pagination is not provided, calculate client-side
  const isClientPaginated = onPageChange === undefined && totalCount === undefined && data.length > pageSize;
  const [clientPage, setClientPage] = useState(1);
  const activePage = onPageChange ? currentPage : clientPage;
  const effectiveTotal = totalCount !== undefined ? totalCount : data.length;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));

  // Determine current slice of data
  const displayedData = isClientPaginated
    ? data.slice((activePage - 1) * pageSize, activePage * pageSize)
    : data;

  const handlePageSelect = (page: number) => {
    if (page < 1 || page > totalPages) return;
    if (onPageChange) {
      onPageChange(page);
    } else {
      setClientPage(page);
    }
  };

  const getRowKey = (row: T, idx: number): string => {
    if (typeof keyField === 'function') return keyField(row);
    const val = row[keyField];
    if (val !== undefined && val !== null) return String(val);
    return String(idx);
  };

  const startRecord = effectiveTotal === 0 ? 0 : (activePage - 1) * pageSize + 1;
  const endRecord = Math.min(activePage * pageSize, effectiveTotal);

  return (
    <div className={`data-table-wrapper ${className}`}>
      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    style={{
                      width: col.width,
                      textAlign: col.align || 'left',
                    }}
                    className={`data-table-th ${col.sortable ? 'data-table-th--sortable' : ''}`}
                    aria-sort={isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {col.sortable && onSort ? (
                      <button
                        type="button"
                        className="data-table-sort-trigger"
                        onClick={() => {
                          const nextDir = isSorted && sortDirection === 'asc' ? 'desc' : 'asc';
                          onSort(col.key, nextDir);
                        }}
                      >
                        <span>{col.header}</span>
                        <span className="data-table-sort-icon" aria-hidden="true">
                          {isSorted ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                        </span>
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="data-table-td--loading">
                  <Spinner label="Loading records…" />
                </td>
              </tr>
            ) : displayedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="data-table-td--empty">
                  {emptyState || <EmptyState title="No records found">There is nothing to display here yet.</EmptyState>}
                </td>
              </tr>
            ) : (
              displayedData.map((row, rowIdx) => (
                <tr
                  key={getRowKey(row, rowIdx)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`data-table-row ${onRowClick ? 'data-table-row--clickable' : ''}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{ textAlign: col.align || 'left' }}
                      className="data-table-td"
                    >
                      {col.render
                        ? col.render(row, (activePage - 1) * pageSize + rowIdx)
                        : (row as Record<string, unknown>)[col.key] !== undefined
                          ? String((row as Record<string, unknown>)[col.key])
                          : null}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {(totalPages > 1 || effectiveTotal > 0) && (
        <div className="data-table-pagination" aria-label="Table pagination">
          <div className="data-table-pagination-info">
            Showing <strong>{startRecord}</strong>–<strong>{endRecord}</strong> of{' '}
            <strong>{effectiveTotal}</strong>
          </div>
          <div className="data-table-pagination-controls">
            <Button
              variant="ghost"
              disabled={activePage <= 1}
              onClick={() => handlePageSelect(activePage - 1)}
              aria-label="Previous page"
              className="pagination-btn"
            >
              Previous
            </Button>
            <span className="pagination-current" aria-current="page">
              Page {activePage} of {totalPages}
            </span>
            <Button
              variant="ghost"
              disabled={activePage >= totalPages}
              onClick={() => handlePageSelect(activePage + 1)}
              aria-label="Next page"
              className="pagination-btn"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export interface TimelineItem {
  id: string;
  timestamp: string | Date;
  title: ReactNode;
  description?: ReactNode;
  actor?: string;
  icon?: ReactNode;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}

export function Timeline({
  items,
  className = '',
}: {
  items: TimelineItem[];
  className?: string;
}) {
  return (
    <div className={`timeline ${className}`} role="feed" aria-label="Event timeline">
      {items.map((item, index) => {
        const tone = item.tone || 'neutral';
        const formattedDate =
          typeof item.timestamp === 'string'
            ? item.timestamp
            : item.timestamp.toLocaleString();
        return (
          <div key={item.id || index} className={`timeline-item timeline-item--${tone}`}>
            <div className="timeline-marker" aria-hidden="true">
              <span className={`timeline-dot timeline-dot--${tone}`}>
                {item.icon}
              </span>
              {index < items.length - 1 && <span className="timeline-connector" />}
            </div>
            <div className="timeline-content">
              <div className="timeline-header">
                <span className="timeline-title">{item.title}</span>
                <time className="timeline-time" dateTime={String(item.timestamp)}>
                  {formattedDate}
                </time>
              </div>
              {item.description && <div className="timeline-desc">{item.description}</div>}
              {item.actor && <span className="timeline-actor">by {item.actor}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
  width = '480px',
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="drawer-panel" style={{ width, maxWidth: '100vw' }}>
        <header className="drawer-header">
          <div id={titleId} className="drawer-title">
            {typeof title === 'string' ? <h2>{title}</h2> : title}
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Close drawer" className="drawer-close-btn">
            ✕
          </Button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-footer">{footer}</footer>}
      </aside>
    </div>
  );
}

function ConfirmDialogForm({
  message,
  children,
  confirmLabel,
  cancelLabel,
  variant,
  requireReason,
  reasonMinLength,
  reasonLabel,
  reasonPlaceholder,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  message?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'primary' | 'danger';
  requireReason: boolean;
  reasonMinLength: number;
  reasonLabel: string;
  reasonPlaceholder: string;
  busy: boolean;
  error?: string;
  onConfirm: (reason: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const reasonValid = !requireReason || reason.trim().length >= reasonMinLength;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonValid || busy) return;
    void onConfirm(reason.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="confirm-dialog-form">
      {message && <div className="confirm-dialog-message">{message}</div>}
      {children}

      {requireReason && (
        <div className="field confirm-dialog-reason">
          <label htmlFor="confirm-reason">{reasonLabel}</label>
          <textarea
            id="confirm-reason"
            rows={3}
            className="confirm-reason-input"
            placeholder={reasonPlaceholder}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
            required
          />
          {reason.length > 0 && reason.trim().length < reasonMinLength && (
            <small className="field-error">
              Please enter at least {reasonMinLength} characters ({reason.trim().length}/{reasonMinLength})
            </small>
          )}
        </div>
      )}

      {error && <ErrorPanel message={error} />}

      <div className="confirm-dialog-actions">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          type="submit"
          variant={variant === 'danger' ? 'secondary' : 'primary'}
          className={variant === 'danger' ? 'button--danger' : ''}
          disabled={!reasonValid || busy}
        >
          {busy ? 'Processing…' : confirmLabel}
        </Button>
      </div>
    </form>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  requireReason = false,
  reasonMinLength = 10,
  reasonLabel = 'Reason (required)',
  reasonPlaceholder = 'Provide a reason (min 10 characters)…',
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  requireReason?: boolean;
  reasonMinLength?: number;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  busy?: boolean;
  error?: string;
  onConfirm: (reason: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <Dialog open={open} title={title} onClose={onCancel}>
      <ConfirmDialogForm
        message={message}
        children={children}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        variant={variant}
        requireReason={requireReason}
        reasonMinLength={reasonMinLength}
        reasonLabel={reasonLabel}
        reasonPlaceholder={reasonPlaceholder}
        busy={busy}
        error={error}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </Dialog>
  );
}

export { RequestError } from './RequestError';
