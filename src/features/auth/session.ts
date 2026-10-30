import { useSyncExternalStore } from 'react';
import { ApiError, configureAuth, request } from '../../lib/api';
import type { Identity, Tokens, User } from './types';

const storageKey = 'stayhub.session.v1';
type State = { status: 'loading' | 'ready' | 'error'; identity: Identity | null; error?: string };
let state: State = { status: 'loading', identity: null };
let accessToken: string | null = null;
let refreshToken: string | null = null;
let generation = 0;
let refreshing: Promise<boolean> | null = null;
let restoring: Promise<void> | null = null;
const listeners = new Set<() => void>();
let clearPrivateData = () => {};

function emit(next: State) {
  state = next;
  listeners.forEach((listener) => listener());
}
function persist() {
  // Storage may be unavailable in private/restricted browser contexts.
  try {
    if (refreshToken) sessionStorage.setItem(storageKey, refreshToken);
    else sessionStorage.removeItem(storageKey);
  } catch {
    /* Session still works in memory. */
  }
}
export function configureSession(clearCache: () => void) {
  clearPrivateData = clearCache;
  configureAuth(
    () => accessToken,
    expireSession,
    refreshSession,
    () => generation,
  );
}
export function expireSession() {
  generation++;
  accessToken = null;
  refreshToken = null;
  persist();
  clearPrivateData();
  emit({ status: 'ready', identity: null });
}
export function acceptSession(tokens: Tokens) {
  generation++;
  clearPrivateData();
  accessToken = tokens.access_token;
  refreshToken = tokens.refresh_token;
  persist();
  emit({
    status: 'ready',
    identity:
      tokens.subject_type === 'user'
        ? { subject_type: 'user', user: tokens.user }
        : { subject_type: 'admin', admin: tokens.admin },
  });
}
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  if (!refreshToken) return Promise.resolve(false);
  const started = generation;
  const token = refreshToken;
  refreshing = (async () => {
    try {
      const tokens = await request<Tokens>('/api/v1/auth/refresh', {
        method: 'POST',
        body: { refresh_token: token },
        auth: false,
      });
      if (generation !== started) return false;
      accessToken = tokens.access_token;
      refreshToken = tokens.refresh_token;
      persist();
      emit({
        status: 'ready',
        identity:
          tokens.subject_type === 'user'
            ? { subject_type: 'user', user: tokens.user }
            : { subject_type: 'admin', admin: tokens.admin },
      });
      return true;
    } catch (error) {
      if (generation !== started) return false;
      if (error instanceof ApiError && error.status === 401) {
        expireSession();
        return false;
      }
      throw error;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}
export function restoreSession(): Promise<void> {
  if (restoring) return restoring;
  const restoreGeneration = generation;
  restoring = (async () => {
    try {
      if (!refreshToken) {
        try {
          refreshToken = sessionStorage.getItem(storageKey);
        } catch {
          /* No saved session. */
        }
      }
      if (!refreshToken) {
        emit({ status: 'ready', identity: null });
        return;
      }
      if (await refreshSession()) {
        emit({ status: 'loading', identity: null });
        const started = generation;
        const identity = await request<Identity>('/api/v1/me');
        if (generation === started) emit({ status: 'ready', identity });
      }
    } catch (error) {
      if (generation !== restoreGeneration) return;
      emit({
        status: 'error',
        identity: null,
        error: error instanceof Error ? error.message : 'Unable to restore your session.',
      });
    } finally {
      restoring = null;
    }
  })();
  return restoring;
}
export async function signOut() {
  // Wait for rotation before revoking, so logout cannot leave a newly issued refresh token active.
  if (refreshing) {
    try {
      await refreshing;
    } catch {
      /* Revoke the last known token. */
    }
  }
  const token = refreshToken;
  expireSession();
  const logoutGeneration = generation;
  if (token) {
    try {
      await request('/api/v1/auth/logout', {
        method: 'POST',
        body: { refresh_token: token },
        auth: false,
      });
    } catch (error) {
      if (generation !== logoutGeneration) throw error;
      emit({
        status: 'ready',
        identity: null,
        error: 'You are signed out on this device, but the server could not revoke the session.',
      });
      throw error;
    }
  }
}
export async function becomeHost() {
  const started = generation;
  const result = await request<{ user: User; access_token: string }>('/api/v1/me/become-host', {
    method: 'POST',
  });
  if (started !== generation) return;
  accessToken = result.access_token;
  clearPrivateData();
  emit({ status: 'ready', identity: { subject_type: 'user', user: result.user } });
}
export async function updateProfile(body: { full_name?: string; avatar_media_id?: string }) {
  const started = generation;
  const result = await request<{ user: User }>('/api/v1/me', { method: 'PATCH', body });
  if (started === generation)
    emit({ status: 'ready', identity: { subject_type: 'user', user: result.user } });
}
export function useSession() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
  );
}

export function safeReturnTo(value: string | null, fallback = '/account') {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    Array.from(value).some((character) => character.charCodeAt(0) <= 32)
  )
    return fallback;
  return value;
}

export function getCurrentUserId() {
  return state.identity?.user?.id || null;
}
