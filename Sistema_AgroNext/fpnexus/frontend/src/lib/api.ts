'use client';

/**
 * Cliente da API. Frontend e API ficam na mesma origem (proxy reverso), então o cookie de sessão HttpOnly
 * segue automaticamente. Mutações enviam o token CSRF lido do cookie fpx_csrf (padrão double submit).
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: any,
  ) {
    super(message);
  }
}

function csrf(): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/(?:^|;\s*)fpx_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const method = init.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['x-csrf-token'] = csrf();
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
    cache: 'no-store',
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text };
  }
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/login')) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${next}`;
    }
    const issues = Array.isArray(body?.issues) ? ` ${body.issues.map((i: any) => `${i.path ? `${i.path}: ` : ''}${i.message}`).join(' · ')}` : '';
    throw new ApiError(res.status, `${body?.message ?? 'Falha na requisição.'}${issues}`, body);
  }
  return body as T;
}

export const post = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} });
export const patch = <T = any>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body });
export const put = <T = any>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body });
export const del = (path: string) => api(path, { method: 'DELETE' });
