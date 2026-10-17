export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
const BASE = API_BASE;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Fired when the server says the session is gone; the auth provider sends the user to login. */
export const UNAUTHORIZED_EVENT = 'ks:unauthorized';

async function send(path: string, init: { method?: string; body?: unknown }): Promise<Response> {
  try {
    return await fetch(`${BASE}${path}`, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'kaamsaathi',
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'offline');
  }
}

export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await send(path, init);
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string };
  };
  if (res.status === 401 && data.error?.code === 'AUTH_REQUIRED' && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  if (!res.ok)
    throw new ApiError(
      res.status,
      data.error?.code ?? 'ERROR',
      data.error?.message ?? 'Request failed',
    );
  return data as T;
}

/** Plain-text download through fetch so errors surface in the UI like every other request. */
export async function apiText(path: string): Promise<string> {
  const res = await send(path, {});
  if (!res.ok) throw new ApiError(res.status, 'ERROR', 'Request failed');
  return res.text();
}
