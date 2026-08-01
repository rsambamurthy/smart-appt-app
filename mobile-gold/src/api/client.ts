// SmartAppt GOLD backend — verified by extracting the API URL baked into the
// deployed smartapptgold.integratatech.ai JS bundle (Vercel env VITE_API_URL).
//   GOLD  = smart-appt-app-development.up.railway.app  ← this one
//   LITE  = smart-appt-app-production.up.railway.app
//   UNUSED= smart-appt-app-production-04b6.up.railway.app (empty DB)
export const API_BASE = 'https://smart-appt-app-development.up.railway.app/api/v1';

const TIMEOUT_MS = 20000;

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === 'AbortError') {
      throw new ApiError(0, 'Request timed out. Check your internet connection and try again.');
    }
    throw new ApiError(0, e?.message ?? 'Network error. Check your internet connection.');
  }
  clearTimeout(timer);

  const json = await res.json().catch(() => ({} as any));

  if (!res.ok) {
    const msg = json?.message ?? json?.detail ?? `Server error (HTTP ${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return json as T;
}

export const api = {
  get:   <T>(path: string)                => request<T>(path, { method: 'GET' }),
  post:  <T>(path: string, body: unknown) => request<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put:   <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT',   body: JSON.stringify(body) }),
  del:   <T>(path: string)                => request<T>(path, { method: 'DELETE' }),
};
