import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../../lib/api';
import * as session from './session';
import type { Tokens } from './types';

const user = {
  id: 'user-1',
  email: 'guest@example.test',
  full_name: 'Test Guest',
  is_guest: true,
  is_host: false,
};
const tokens: Tokens = {
  subject_type: 'user',
  user,
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  expires_in: 3600,
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(status === 200 ? { data } : { error: data }), { status });
let saved: Map<string, string>;
let clearCache: ReturnType<typeof vi.fn<() => void>>;
beforeEach(() => {
  saved = new Map();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => saved.get(key) || null,
    setItem: (key: string, value: string) => saved.set(key, value),
    removeItem: (key: string) => saved.delete(key),
  });
  clearCache = vi.fn();
  session.configureSession(clearCache);
  session.expireSession();
});
afterEach(() => {
  session.expireSession();
  vi.unstubAllGlobals();
});

describe('session lifecycle', () => {
  it('shares one refresh and replays concurrent expired-access requests with the rotated token', async () => {
    session.acceptSession(tokens);
    let resolveRefresh!: (value: Response) => void;
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      if (url.endsWith('/refresh'))
        return new Promise<Response>((resolve) => {
          resolveRefresh = resolve;
        });
      if (new Headers(options.headers).get('Authorization') === 'Bearer access-1')
        return json({ code: 'UNAUTHORIZED', message: 'Expired' }, 401);
      return json({ ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);
    const first = request('/api/v1/me');
    const second = request('/api/v1/me');
    await vi.waitFor(() => expect(resolveRefresh).toBeTypeOf('function'));
    resolveRefresh(json({ ...tokens, access_token: 'access-2', refresh_token: 'refresh-2' }));
    await expect(Promise.all([first, second])).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/refresh'))).toHaveLength(1);
    expect(saved.get('stayhub.session.v1')).toBe('refresh-2');
  });

  it('restores through refresh and /me while keeping access tokens out of storage', async () => {
    saved.set('stayhub.session.v1', 'saved-refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(tokens))
      .mockResolvedValueOnce(json({ subject_type: 'user', user }));
    vi.stubGlobal('fetch', fetchMock);
    await session.restoreSession();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/auth/refresh',
      '/api/v1/me',
    ]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refresh_token: 'saved-refresh' });
    expect([...saved.values()]).toEqual(['refresh-1']);
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('Authorization')).toBe(
      'Bearer access-1',
    );
  });

  it('clears revoked sessions and cached private data', async () => {
    session.acceptSession(tokens);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ code: 'UNAUTHORIZED', message: 'Revoked' }, 401)),
    );
    await expect(session.refreshSession()).resolves.toBe(false);
    expect(saved.size).toBe(0);
    expect(clearCache).toHaveBeenCalled();
  });

  it('keeps refresh credentials on a temporary connection failure so restoration can be retried', async () => {
    session.acceptSession(tokens);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(session.refreshSession()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(saved.get('stayhub.session.v1')).toBe('refresh-1');
  });

  it('logs out with the rotated refresh token, clears storage, and removes bearer headers', async () => {
    session.acceptSession(tokens);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ ...tokens, refresh_token: 'refresh-2' }))
      .mockResolvedValueOnce(json({ revoked: true }))
      .mockResolvedValueOnce(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const refreshing = session.refreshSession();
    await session.signOut();
    await refreshing;
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ refresh_token: 'refresh-2' });
    expect(saved.size).toBe(0);
    await request('/api/v1/catalog/amenities');
    expect(new Headers(fetchMock.mock.calls[2][1].headers).has('Authorization')).toBe(false);
  });

  it('uses the new access token after enabling hosting', async () => {
    session.acceptSession(tokens);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json({ user: { ...user, is_host: true }, access_token: 'host-access', expires_in: 3600 }),
      )
      .mockResolvedValueOnce(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await session.becomeHost();
    await request('/api/v1/me');
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('Authorization')).toBe(
      'Bearer host-access',
    );
  });

  it('keeps admin authentication distinct from guest/host identity', async () => {
    session.acceptSession({
      subject_type: 'admin',
      admin: { id: 'admin-1', email: 'admin@example.test', full_name: 'Admin' },
      access_token: 'admin-access',
      refresh_token: 'admin-refresh',
      expires_in: 3600,
    });
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await request('/api/v1/me');
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Authorization')).toBe(
      'Bearer admin-access',
    );
    expect(saved.get('stayhub.admin_session.v1')).toBe('admin-refresh');
    expect(saved.get('stayhub.session.v1')).toBeUndefined();
  });
});

describe('return destination', () => {
  it('preserves local destinations and rejects external redirects', () => {
    expect(session.safeReturnTo('/checkout/home-1?guests=2')).toBe('/checkout/home-1?guests=2');
    for (const path of ['https://evil.test', '//evil.test', '/\\evil.test', '/\nevil.test', null])
      expect(session.safeReturnTo(path)).toBe('/account');
  });
});
