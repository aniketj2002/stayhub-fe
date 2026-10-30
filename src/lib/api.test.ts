import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, configureAuth, request } from './api';
import { getHealth } from './health';

afterEach(() => {
  vi.unstubAllGlobals();
  configureAuth(
    () => null,
    () => {},
  );
});

describe('backend HTTP contract', () => {
  it('unwraps domain responses and forwards cancellation, tokens, and idempotency', async () => {
    configureAuth(
      () => 'access-token',
      () => {},
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: { id: 'reservation-1' } })));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    await expect(
      request('/api/v1/reservations', {
        method: 'POST',
        body: { guests: 2 },
        signal: controller.signal,
        idempotencyKey: 'attempt-1',
      }),
    ).resolves.toEqual({ id: 'reservation-1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/reservations');
    expect(init.signal).toBe(controller.signal);
    expect(init.headers.get('Authorization')).toBe('Bearer access-token');
    expect(init.headers.get('Idempotency-Key')).toBe('attempt-1');
    expect(init.headers.get('X-Request-ID')).toBeTruthy();
    expect(JSON.parse(init.body)).toEqual({ guests: 2 });
  });

  it('preserves server validation and conflict information', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'DATES_UNAVAILABLE',
              message: 'Choose other dates.',
              details: { check_in: 'unavailable' },
            },
          }),
          { status: 409, headers: { 'X-Request-ID': 'server-id' } },
        ),
      ),
    );
    await expect(request('/api/v1/reservations')).rejects.toMatchObject({
      status: 409,
      code: 'DATES_UNAVAILABLE',
      details: { check_in: 'unavailable' },
      requestId: 'server-id',
    });
  });

  it('notifies session handling on an unauthorized response', async () => {
    const unauthorized = vi.fn();
    configureAuth(() => null, unauthorized);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{"error":{"code":"UNAUTHORIZED","message":"Sign in again."}}', {
          status: 401,
        }),
      ),
    );
    await expect(request('/api/v1/me')).rejects.toBeInstanceOf(ApiError);
    expect(unauthorized).toHaveBeenCalledOnce();
  });

  it('reads the raw health response outside the API envelope', async () => {
    const health = {
      status: 'ok',
      version_mode: 'v1',
      timestamp: '2026-10-30T08:00:00Z',
      services: { postgres: 'ok', redis: 'ok' },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(health))));
    await expect(getHealth()).resolves.toEqual(health);
  });

  it('accepts no-content responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(request('/api/v1/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('does not turn aborted requests into connection errors', async () => {
    const controller = new AbortController();
    controller.abort();
    const abort = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));
    await expect(request('/api/v1/listings/search', { signal: controller.signal })).rejects.toBe(
      abort,
    );
  });

  it('provides a useful connection error and rejects malformed responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(getHealth()).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Proxy failed</html>', { status: 502 })),
    );
    await expect(getHealth()).rejects.toMatchObject({ status: 502, code: 'INVALID_RESPONSE' });
  });
});
