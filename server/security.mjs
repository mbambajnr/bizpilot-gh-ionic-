import crypto from 'node:crypto';

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 500;

function cacheKey(value) {
  // Never hold raw bearer tokens as map keys.
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getCached(map, key) {
  const hit = map.get(key);
  if (!hit) {
    return undefined;
  }
  if (hit.expiresAt < Date.now()) {
    map.delete(key);
    return undefined;
  }
  return hit.value;
}

function setCached(map, key, value) {
  if (map.size >= CACHE_MAX_ENTRIES) {
    const oldest = map.keys().next().value;
    map.delete(oldest);
  }
  map.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Supabase-backed request authentication for the BizPilot server.
 *
 * Tokens are the SAME Supabase session JWTs the app already holds — the
 * client attaches them as `Authorization: Bearer <token>` (see
 * src/lib/apiClient.ts). Verification calls Supabase's /auth/v1/user, and
 * business-level access is checked by querying the `businesses` row WITH THE
 * CALLER'S OWN TOKEN, so Supabase RLS — not this server — decides membership.
 * Results are cached for 60s to keep per-request overhead near zero.
 */
export function createSecurity(env = process.env) {
  const supabaseUrl = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const supabaseKey = String(
    env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
  ).trim();
  const configured = Boolean(supabaseUrl && supabaseKey);

  const userCache = new Map();
  const accessCache = new Map();

  function readBearerToken(request) {
    const header = request.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    return match ? match[1].trim() : '';
  }

  async function verifyToken(token) {
    if (!token) {
      return null;
    }
    const key = cacheKey(token);
    const cached = getCached(userCache, key);
    if (cached !== undefined) {
      return cached;
    }

    let user = null;
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload && typeof payload.id === 'string') {
          user = { id: payload.id, email: payload.email || '' };
        }
      }
    } catch {
      user = null;
    }

    setCached(userCache, key, user);
    return user;
  }

  /**
   * True when the caller's own token can see the business row — i.e. Supabase
   * RLS grants them membership. No schema assumptions beyond RLS being on.
   */
  async function canAccessBusiness(token, businessId) {
    if (!token || !businessId) {
      return false;
    }
    const key = cacheKey(`${token}:${businessId}`);
    const cached = getCached(accessCache, key);
    if (cached !== undefined) {
      return cached;
    }

    let allowed = false;
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/businesses?id=eq.${encodeURIComponent(businessId)}&select=id`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        const rows = await response.json().catch(() => []);
        allowed = Array.isArray(rows) && rows.length > 0;
      }
    } catch {
      allowed = false;
    }

    setCached(accessCache, key, allowed);
    return allowed;
  }

  return { configured, supabaseUrl, readBearerToken, verifyToken, canAccessBusiness };
}

const DEFAULT_DEV_ORIGINS = [
  // Capacitor / Ionic app shells
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  // Vite + Ionic dev servers
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8100',
  'http://127.0.0.1:8100',
];

/**
 * CORS allowlist. Same-origin requests (no Origin header, or Origin host
 * matching the request Host) always pass, so the hosted web version needs no
 * configuration. Cross-origin callers must be on the list: app-shell origins
 * are built in; add production web origins via ALLOWED_ORIGINS (comma-sep).
 */
export function createCorsPolicy(env = process.env) {
  const extra = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const allowed = new Set([...DEFAULT_DEV_ORIGINS, ...extra]);

  return function applyCors(request, response) {
    const origin = request.headers.origin;

    // No Origin header: curl, server-to-server, or same-origin GET.
    if (!origin) {
      return { proceed: true };
    }

    let ok = allowed.has(origin.replace(/\/+$/, ''));
    if (!ok) {
      try {
        ok = new URL(origin).host === request.headers.host;
      } catch {
        ok = false;
      }
    }

    if (ok) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.setHeader('Access-Control-Max-Age', '600');
    }

    if (request.method === 'OPTIONS') {
      response.writeHead(ok ? 204 : 403);
      response.end();
      return { proceed: false };
    }

    if (!ok) {
      response.writeHead(403, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ ok: false, message: 'Origin not allowed.' }));
      return { proceed: false };
    }

    return { proceed: true };
  };
}
