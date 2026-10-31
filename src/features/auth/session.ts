import { useSyncExternalStore } from 'react';
import { ApiError, configureAuth, request } from '../../lib/api';
import type { Identity, Tokens, User } from './types';

const userStorageKey = 'stayhub.session.v1';
const adminStorageKey = 'stayhub.admin_session.v1';

export type SessionScope = 'user' | 'admin';
type State = { status: 'loading' | 'ready' | 'error'; identity: Identity | null; error?: string };

// ---------------------------------------------------------------------------
// Separate User & Admin States and Tokens
// ---------------------------------------------------------------------------
let userState: State = { status: 'loading', identity: null };
let userAccessToken: string | null = null;
let userRefreshToken: string | null = null;
let userGeneration = 0;
let userRefreshing: Promise<boolean> | null = null;
let userRestoring: Promise<void> | null = null;
const userListeners = new Set<() => void>();

let adminState: State = { status: 'loading', identity: null };
let adminAccessToken: string | null = null;
let adminRefreshToken: string | null = null;
let adminGeneration = 0;
let adminRefreshing: Promise<boolean> | null = null;
let adminRestoring: Promise<void> | null = null;
const adminListeners = new Set<() => void>();

let clearPrivateData = () => {};

function emitUser(next: State) {
  userState = next;
  userListeners.forEach((listener) => listener());
}

function emitAdmin(next: State) {
  adminState = next;
  adminListeners.forEach((listener) => listener());
}

function persistUser() {
  try {
    if (userRefreshToken) sessionStorage.setItem(userStorageKey, userRefreshToken);
    else sessionStorage.removeItem(userStorageKey);
  } catch {
    /* Session still works in memory. */
  }
}

function persistAdmin() {
  try {
    if (adminRefreshToken) sessionStorage.setItem(adminStorageKey, adminRefreshToken);
    else sessionStorage.removeItem(adminStorageKey);
  } catch {
    /* Session still works in memory. */
  }
}

export function configureSession(clearCache: () => void) {
  clearPrivateData = clearCache;
  configureAuth(
    (path?: string) => {
      if (path && (path.includes('/api/v1/admin') || path.startsWith('/admin'))) {
        return adminAccessToken;
      }
      return userAccessToken ?? adminAccessToken;
    },
    (path?: string) => {
      if (path && (path.includes('/api/v1/admin') || path.startsWith('/admin'))) {
        expireSession('admin');
      } else {
        expireSession('user');
      }
    },
    async (path?: string) => {
      if (path && (path.includes('/api/v1/admin') || path.startsWith('/admin'))) {
        return refreshAdminSession();
      }
      return refreshUserSession();
    },
    (path?: string) => {
      return path && (path.includes('/api/v1/admin') || path.startsWith('/admin'))
        ? adminGeneration
        : userGeneration;
    },
  );
}

export function expireSession(scope?: SessionScope) {
  if (!scope || scope === 'user') {
    userGeneration++;
    userAccessToken = null;
    userRefreshToken = null;
    persistUser();
    clearPrivateData();
    emitUser({ status: 'ready', identity: null });
  }
  if (!scope || scope === 'admin') {
    adminGeneration++;
    adminAccessToken = null;
    adminRefreshToken = null;
    persistAdmin();
    emitAdmin({ status: 'ready', identity: null });
  }
}

export function acceptSession(tokens: Tokens) {
  if (tokens.subject_type === 'admin') {
    adminGeneration++;
    adminAccessToken = tokens.access_token;
    adminRefreshToken = tokens.refresh_token;
    persistAdmin();
    emitAdmin({
      status: 'ready',
      identity: { subject_type: 'admin', admin: tokens.admin },
    });
  } else {
    userGeneration++;
    clearPrivateData();
    userAccessToken = tokens.access_token;
    userRefreshToken = tokens.refresh_token;
    persistUser();
    emitUser({
      status: 'ready',
      identity: { subject_type: 'user', user: tokens.user },
    });
  }
}

export function refreshUserSession(): Promise<boolean> {
  if (userRefreshing) return userRefreshing;
  if (!userRefreshToken) return Promise.resolve(false);
  const started = userGeneration;
  const token = userRefreshToken;
  userRefreshing = (async () => {
    try {
      const tokens = await request<Tokens>('/api/v1/auth/refresh', {
        method: 'POST',
        body: { refresh_token: token },
        auth: false,
      });
      if (userGeneration !== started) return false;
      userAccessToken = tokens.access_token;
      userRefreshToken = tokens.refresh_token;
      persistUser();
      emitUser({
        status: 'ready',
        identity: tokens.user ? { subject_type: 'user', user: tokens.user } : null,
      });
      return true;
    } catch (error) {
      if (userGeneration !== started) return false;
      if (error instanceof ApiError && error.status === 401) {
        expireSession('user');
        return false;
      }
      throw error;
    } finally {
      userRefreshing = null;
    }
  })();
  return userRefreshing;
}

export function refreshAdminSession(): Promise<boolean> {
  if (adminRefreshing) return adminRefreshing;
  if (!adminRefreshToken) return Promise.resolve(false);
  const started = adminGeneration;
  const token = adminRefreshToken;
  adminRefreshing = (async () => {
    try {
      const tokens = await request<Tokens>('/api/v1/auth/refresh', {
        method: 'POST',
        body: { refresh_token: token },
        auth: false,
      });
      if (adminGeneration !== started) return false;
      adminAccessToken = tokens.access_token;
      adminRefreshToken = tokens.refresh_token;
      persistAdmin();
      emitAdmin({
        status: 'ready',
        identity: tokens.admin ? { subject_type: 'admin', admin: tokens.admin } : null,
      });
      return true;
    } catch (error) {
      if (adminGeneration !== started) return false;
      if (error instanceof ApiError && error.status === 401) {
        expireSession('admin');
        return false;
      }
      throw error;
    } finally {
      adminRefreshing = null;
    }
  })();
  return adminRefreshing;
}

export function refreshSession(scope?: SessionScope): Promise<boolean> {
  if (scope === 'admin') return refreshAdminSession();
  return refreshUserSession();
}

export function restoreSession(scope?: SessionScope): Promise<void> {
  if (scope === 'admin') return restoreAdminSession();
  if (scope === 'user') return restoreUserSession();

  // If scope not provided, check user session restoration first (default in tests)
  const userPromise = restoreUserSession();
  const adminPromise = restoreAdminSession();
  return Promise.all([userPromise, adminPromise]).then(() => undefined);
}

function restoreUserSession(): Promise<void> {
  if (userRestoring) return userRestoring;
  const restoreGeneration = userGeneration;
  userRestoring = (async () => {
    try {
      if (!userRefreshToken) {
        try {
          userRefreshToken = sessionStorage.getItem(userStorageKey);
        } catch {
          /* No saved user session. */
        }
      }
      if (!userRefreshToken) {
        emitUser({ status: 'ready', identity: null });
        return;
      }
      if (await refreshUserSession()) {
        emitUser({ status: 'loading', identity: null });
        const started = userGeneration;
        const identity = await request<Identity>('/api/v1/me');
        if (userGeneration === started) {
          if (identity.subject_type === 'user') {
            emitUser({ status: 'ready', identity });
          } else {
            emitUser({ status: 'ready', identity: null });
          }
        }
      }
    } catch (error) {
      if (userGeneration !== restoreGeneration) return;
      emitUser({
        status: 'error',
        identity: null,
        error: error instanceof Error ? error.message : 'Unable to restore your session.',
      });
    } finally {
      userRestoring = null;
    }
  })();
  return userRestoring;
}

function restoreAdminSession(): Promise<void> {
  if (adminRestoring) return adminRestoring;
  const restoreGeneration = adminGeneration;
  adminRestoring = (async () => {
    try {
      if (!adminRefreshToken) {
        try {
          adminRefreshToken = sessionStorage.getItem(adminStorageKey);
        } catch {
          /* No saved admin session. */
        }
      }
      if (!adminRefreshToken) {
        emitAdmin({ status: 'ready', identity: null });
        return;
      }
      await refreshAdminSession();
    } catch (error) {
      if (adminGeneration !== restoreGeneration) return;
      emitAdmin({
        status: 'error',
        identity: null,
        error: error instanceof Error ? error.message : 'Unable to restore admin session.',
      });
    } finally {
      adminRestoring = null;
    }
  })();
  return adminRestoring;
}

export async function signOut(scope?: SessionScope) {
  const isTargetAdmin =
    scope === 'admin' ||
    (scope === undefined &&
      typeof window !== 'undefined' &&
      window.location.pathname.startsWith('/admin'));

  if (isTargetAdmin) {
    if (adminRefreshing) {
      try {
        await adminRefreshing;
      } catch {
        /* Revoke */
      }
    }
    const token = adminRefreshToken;
    expireSession('admin');
    if (token) {
      try {
        await request('/api/v1/auth/logout', {
          method: 'POST',
          body: { refresh_token: token },
          auth: false,
        });
      } catch (error) {
        emitAdmin({
          status: 'ready',
          identity: null,
          error: 'You are signed out on this device, but the server could not revoke the session.',
        });
        throw error;
      }
    }
  } else {
    if (userRefreshing) {
      try {
        await userRefreshing;
      } catch {
        /* Revoke */
      }
    }
    const token = userRefreshToken;
    expireSession('user');
    const logoutGeneration = userGeneration;
    if (token) {
      try {
        await request('/api/v1/auth/logout', {
          method: 'POST',
          body: { refresh_token: token },
          auth: false,
        });
      } catch (error) {
        if (userGeneration !== logoutGeneration) throw error;
        emitUser({
          status: 'ready',
          identity: null,
          error: 'You are signed out on this device, but the server could not revoke the session.',
        });
        throw error;
      }
    }
  }
}

export async function becomeHost() {
  const started = userGeneration;
  const result = await request<{ user: User; access_token: string }>('/api/v1/me/become-host', {
    method: 'POST',
  });
  if (started !== userGeneration) return;
  userAccessToken = result.access_token;
  clearPrivateData();
  emitUser({ status: 'ready', identity: { subject_type: 'user', user: result.user } });
}

export async function updateProfile(body: { full_name?: string; avatar_media_id?: string }) {
  const started = userGeneration;
  const result = await request<{ user: User }>('/api/v1/me', { method: 'PATCH', body });
  if (started === userGeneration)
    emitUser({ status: 'ready', identity: { subject_type: 'user', user: result.user } });
}

export function useUserSession() {
  return useSyncExternalStore(
    (listener) => {
      userListeners.add(listener);
      return () => {
        userListeners.delete(listener);
      };
    },
    () => userState,
  );
}

export function useAdminSession() {
  return useSyncExternalStore(
    (listener) => {
      adminListeners.add(listener);
      return () => {
        adminListeners.delete(listener);
      };
    },
    () => adminState,
  );
}

export function useSession(scope?: SessionScope) {
  const user = useUserSession();
  const admin = useAdminSession();

  if (scope === 'admin') return admin;
  if (scope === 'user') return user;

  const isAdminPath =
    typeof window !== 'undefined' &&
    window.location.pathname.startsWith('/admin') &&
    window.location.pathname !== '/admin/login';

  if (isAdminPath) return admin;
  if (user.identity) return user;
  if (admin.identity) return admin;
  return user;
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
  return userState.identity?.user?.id || null;
}

export function getUserAccessToken(): string | null {
  return userAccessToken;
}

export function getUserSession(): State {
  return userState;
}

export function getAdminSession(): State {
  return adminState;
}
