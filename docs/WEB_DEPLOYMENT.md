# BisaPilot Web Version — Deployment Guide

BisaPilot runs in a normal browser (laptop/desktop clients) as well as the
Capacitor mobile app. The Node server in `server/` serves **both the built web
app and the `/api` routes from one port**, so a single small host runs
everything.

```
Browser (laptop) ──┐
                   ├──► BisaPilot server (Node, :8787) ──► Supabase (auth + data, RLS)
Capacitor app ─────┘          │
                              ├──► SMTP (business email)
                              └──► Magento (POS catalog + sales)
```

## Security model (read this first)

- **Every `/api` route except the two `health` probes requires a Supabase
  session token.** The app attaches it automatically (`src/lib/apiClient.ts`);
  the server verifies it against `SUPABASE_URL/auth/v1/user`.
- **Business-scoped routes** (`/api/email/send`, `/api/email/config*`) also
  verify the caller can see that business — checked with the **caller's own
  token**, so Supabase **RLS** is the single source of truth for tenancy.
- **CORS**: same-origin and the Capacitor/Ionic app shells are allowed by
  default; anything else needs `ALLOWED_ORIGINS`.
- **Fail-safe**: the server refuses to bind to a non-loopback address unless
  Supabase auth env is configured — you cannot accidentally expose the open
  dev mode to a network.

## Deploy (any small VPS — the same box can be modest)

```bash
# 1. Build the web app
npm ci && npm run build          # emits dist/

# 2. Configure the server
cp .env.server.example .env.server
#    - set SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY (same project as the app build)
#    - set EMAIL_CONFIG_SECRET to a long random value
#    - set MAGENTO_* if this client uses the POS integration
#    - set EMAIL_SERVER_HOST=0.0.0.0 (behind a reverse proxy)

# 3. Run it (systemd/pm2 in production)
npm run start                    # serves web app + API on :8787
```

Put TLS in front with Caddy (2 lines) or nginx:

```
app.yourdomain.com {
    reverse_proxy 127.0.0.1:8787
}
```

Laptop clients then simply browse to `https://app.yourdomain.com` — no
installation. Because the app and API share an origin, no CORS setup is
needed for the web version.

### Web app build-time env (`.env`)

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
# Leave VITE_API_BASE_URL unset for the web version (same origin).
```

## Mobile app builds

The packaged Capacitor app has no Vite proxy and no same origin, so its build
must point at the hosted server:

```dotenv
VITE_API_BASE_URL=https://app.yourdomain.com
```

Set it before `npm run build && npx cap sync ios`. The Capacitor origins
(`capacitor://localhost`, `ionic://localhost`) are already CORS-allowed.

## Local development (unchanged)

`npm run dev` works exactly as before: Vite on :5173 proxies `/api` to the
server on 127.0.0.1:8787. If Supabase env is not set in `.env.server`, the
server runs in OPEN DEV MODE (unauthenticated) — allowed only on loopback,
and it logs a warning.
