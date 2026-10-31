import { useQuery } from '@tanstack/react-query';
import { request } from '../../../lib/api';
import { downloadCSV } from '../../../lib/export';
import type { AuditEvent, AuditFilters, AuditListResponse } from './types';

function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      searchParams.set(key, String(val));
    }
  });
  return searchParams.toString();
}

export function useAuditLog(filters: AuditFilters) {
  const qs = buildQueryString(filters as Record<string, unknown>);
  return useQuery({
    queryKey: ['admin', 'events', filters],
    queryFn: () => request<AuditListResponse>(`/api/v1/admin/events${qs ? `?${qs}` : ''}`),
  });
}

export async function exportAuditCSV(filters: AuditFilters): Promise<void> {
  const exportFilters = { ...filters, limit: 1000, offset: 0 };
  const qs = buildQueryString(exportFilters as Record<string, unknown>);
  const res = await request<AuditListResponse>(`/api/v1/admin/events${qs ? `?${qs}` : ''}`);

  const rows = (res?.events || []).map((e: AuditEvent) => ({
    id: e.id,
    occurred_at: e.occurred_at,
    actor_type: e.actor_type,
    actor_id: e.actor_id || '',
    action: e.action,
    object_type: e.object_type,
    object_id: e.object_id,
    reason: e.reason || '',
    request_id: e.request_id || '',
  }));

  downloadCSV(rows, `audit_events_${new Date().toISOString().slice(0, 10)}.csv`);
}

