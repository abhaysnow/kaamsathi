const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Mode is read at call time so the demo/real switch applies immediately. */
function mode(): string {
  try {
    return localStorage.getItem('ks_mode') === 'real' ? 'real' : 'demo';
  } catch {
    return 'demo';
  }
}

async function send(path: string, init: { method?: string; body?: unknown }): Promise<Response> {
  try {
    return await fetch(`${BASE}${path}`, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'kaamsaathi',
        'X-KS-Mode': mode(),
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
  if (!res.ok)
    throw new ApiError(
      res.status,
      data.error?.code ?? 'ERROR',
      data.error?.message ?? 'Request failed',
    );
  return data as T;
}

/**
 * Plain-text download through fetch (not an <a href>) so the request carries the demo/real mode
 * header; a bare link would always hit the "real" bucket.
 */
export async function apiText(path: string): Promise<string> {
  const res = await send(path, {});
  if (!res.ok) throw new ApiError(res.status, 'ERROR', 'Request failed');
  return res.text();
}
