import {
  useEffect,
  useId,
  useRef,
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

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'positive' | 'warning';
}) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
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

export { RequestError } from './RequestError';
