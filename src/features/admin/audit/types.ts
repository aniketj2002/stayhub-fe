export interface AuditEvent {
  id: number;
  occurred_at: string;
  actor_type: string;
  actor_id?: string;
  action: string;
  object_type: string;
  object_id: string;
  reason?: string;
  before_state?: unknown;
  after_state?: unknown;
  metadata?: Record<string, unknown>;
  request_id?: string;
}

export interface AuditListResponse {
  events: AuditEvent[];
  count: number;
}

export interface AuditFilters {
  object_type?: string;
  object_id?: string;
  actor_type?: string;
  actor_id?: string;
  action?: string;
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

