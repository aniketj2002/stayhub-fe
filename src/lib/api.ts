export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
    public requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  idempotencyKey?: string;
  raw?: boolean;
  auth?: boolean;
  retried?: boolean;
};

// Session infrastructure owns refresh and token storage.
let getAccessToken: (path?: string) => string | null = () => null;
let onUnauthorized: (path?: string) => void = () => {};
let refreshAccess: (path?: string) => Promise<boolean> = async () => false;
let getSessionVersion: (path?: string) => number = () => 0;
export function configureAuth(
  token: (path?: string) => string | null,
  unauthorized: (path?: string) => void,
  refresh: (path?: string) => Promise<boolean> = async () => false,
  version: (path?: string) => number = () => 0,
) {
  getAccessToken = token;
  onUnauthorized = unauthorized;
  refreshAccess = refresh;
  getSessionVersion = version;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, idempotencyKey, raw = false, auth = true, retried = false, ...init } = options;
  const sessionVersion = getSessionVersion(path);
  const headers = new Headers(init.headers);
  const requestId = headers.get('X-Request-ID') || crypto.randomUUID();
  headers.set('X-Request-ID', requestId);
  headers.set('Accept', 'application/json');
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const token = auth ? getAccessToken(path) : null;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);

  let response: Response;
  try {
    response = await fetch(
      `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}${path}`,
      {
        ...init,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot reach StayHub. Check your connection and try again.',
      undefined,
      requestId,
    );
  }
  const responseRequestId = response.headers.get('X-Request-ID') || requestId;
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'The server returned an unexpected response.',
      undefined,
      responseRequestId,
    );
  }
  if (!response.ok) {
    if (response.status === 401 && auth) {
      if (sessionVersion !== getSessionVersion(path))
        throw new ApiError(
          401,
          'SESSION_CHANGED',
          'Your account session has changed. Please try again.',
        );
      if (!retried && ((token && token !== getAccessToken(path)) || (await refreshAccess(path)))) {
        if (sessionVersion !== getSessionVersion(path))
          throw new ApiError(
            401,
            'SESSION_CHANGED',
            'Your account session has changed. Please try again.',
          );
        return request<T>(path, { ...options, retried: true });
      }
      if (sessionVersion === getSessionVersion(path)) onUnauthorized(path);
    }
    const error: ApiErrorBody | undefined = payload?.error;
    throw new ApiError(
      response.status,
      error?.code || `HTTP_${response.status}`,
      error?.message || 'The request could not be completed.',
      error?.details,
      responseRequestId,
    );
  }
  if (response.status === 204) return undefined as T;
  if (raw) return payload as T;
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload as T;
  }
  return payload.data as T;
}
