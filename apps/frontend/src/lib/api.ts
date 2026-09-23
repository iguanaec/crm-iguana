const TOKEN_KEY = 'crm-iguana-token';

/**
 * En desarrollo basta la ruta relativa: el proxy de Vite la reenvía al backend.
 * Desplegados por separado no hay proxy, así que la dirección de la API llega
 * por VITE_API_URL al construir.
 */
const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Modo privado o almacenamiento bloqueado: la sesion dura lo que la pestaña.
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Se dispara en un 401 para que la app vuelva al login sin recargar. */
export const onUnauthorized = { handler: null as null | (() => void) };

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();

  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (response.status === 401) {
    setToken(null);
    onUnauthorized.handler?.();
    throw new ApiError(401, 'Tu sesión expiró. Vuelve a entrar.');
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (payload as { error?: string } | null)?.error ?? 'Algo falló en el servidor';
    const details = (payload as { details?: Array<{ field: string; message: string }> } | null)?.details;
    throw new ApiError(response.status, message, Array.isArray(details) ? details : undefined);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
