import { ApiError } from '../lib/api';
import { ErrorPanel } from './ui';
export function RequestError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const api = error instanceof ApiError ? error : undefined;
  return (
    <ErrorPanel
      title={
        api?.status === 403
          ? 'You don’t have permission for this action'
          : api?.status === 404
            ? 'This item is no longer available'
            : api?.status === 409
              ? ['DATES_UNAVAILABLE', 'CALENDAR_NIGHT_BOOKED'].includes(api.code)
                ? 'Availability has changed'
                : 'The reservation has changed'
              : 'Unable to complete your request'
      }
      message={error instanceof Error ? error.message : 'Please try again.'}
      requestId={api?.requestId}
      onRetry={onRetry}
    />
  );
}
