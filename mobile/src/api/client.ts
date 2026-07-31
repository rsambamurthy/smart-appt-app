/**
 * API client for SmartAppt Expo app.
 * Change API_BASE to point at your Railway backend.
 */
export const API_BASE = 'https://smart-appt-app-production.up.railway.app/api/v1';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = json?.message ?? json?.detail ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  return json as T;
}

export const api = {
  get:   <T>(path: string)                   => request<T>(path, { method: 'GET' }),
  post:  <T>(path: string, body: unknown)    => request<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown)    => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put:   <T>(path: string, body: unknown)    => request<T>(path, { method: 'PUT',   body: JSON.stringify(body) }),
  del:   <T>(path: string)                   => request<T>(path, { method: 'DELETE' }),
};
