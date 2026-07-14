import { supabase } from './supabase';

/**
 * Where the BizPilot server lives.
 *
 * - Web version: served BY the BizPilot server itself → same origin → leave
 *   VITE_API_BASE_URL unset and relative /api paths just work.
 * - Local dev: Vite proxies /api to 127.0.0.1:8787 → also leave it unset.
 * - Packaged mobile app (Capacitor): there is no proxy and no same origin —
 *   set VITE_API_BASE_URL to the hosted server URL (https) at build time.
 */
const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

export function apiUrl(path: string): string {
  return `${apiBase}${path}`;
}

/**
 * fetch() for BizPilot server routes: resolves the base URL and attaches the
 * caller's Supabase session token so the server can authenticate the request.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);

  if (supabase && !headers.has('Authorization')) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  return fetch(apiUrl(path), { ...init, headers });
}
