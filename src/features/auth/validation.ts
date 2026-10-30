import { ApiError } from '../../lib/api';

export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return {};
  return Object.fromEntries(
    error.details
      .filter((field) => typeof field?.field === 'string' && typeof field?.message === 'string')
      .map((field) => [field.field, field.message]),
  );
}
