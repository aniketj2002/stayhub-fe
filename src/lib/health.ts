import { request } from './api';

export interface Health {
  status: 'ok' | 'degraded';
  version_mode: string;
  timestamp: string;
  services: { postgres: string; redis: string };
}

// Health is outside /api/v1 and does not use the standard data envelope.
export function getHealth(signal?: AbortSignal) {
  return request<Health>('/healthz', { raw: true, signal });
}
