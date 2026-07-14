# Offline Support

BizPilot keeps working when the network doesn't. The app was already
local-first for reads (full business state persists to localStorage); this
layer makes **writes** survive offline too.

## How it works

```
UI action ──► BusinessContext ──► offlineSync wrapper
                                     │ online?  ──► Supabase (unchanged)
                                     │ offline / request died
                                     ▼
                          durable queue (localStorage)
                                     │  replay on: reconnect ('online' event),
                                     │  30s heartbeat, sign-in (before cloud load)
                                     ▼
                                 Supabase
```

- **Every entity write** (products, sales, customers, purchases, expenses,
  payments, transfers, notifications, …) goes through
  `src/offline/offlineSync.ts` — a drop-in wrapper around `supabaseSync` that
  captures network failures into a persistent queue and replays them in
  order. Same entity queued twice = newest payload wins (last-write-wins),
  original queue position kept so dependency order holds.
- **Real server rejections are NOT queued** — an RLS denial or validation
  error surfaces to the UI exactly as before. Only connectivity failures
  queue. On replay, a rejected op moves to the back (can't block others) and
  is dropped after 8 attempts with its error preserved.
- **Sign-in ordering**: queued writes are flushed BEFORE
  `loadFullBusinessDataFromSupabase`, so a reconnecting device pushes its
  local work up before pulling cloud state down.
- **Interactive auth operations** (credential verification, password
  rotation) are never queued — they must succeed or fail in front of the user.

## POS sales offline

The register keeps selling without a connection:

- The **catalog is cached** on every good load — offline, the register opens
  with the last known products, prices, and branches (banner shows the cache
  time).
- An offline **sale is captured with its `clientRef`** and replayed against
  `POST /api/magento/orders` on reconnect. Magento is **idempotent on
  clientRef**, so however many times a queued sale replays (flaky reconnects,
  app restarts), it is recorded exactly once. Stock and Ghana VAT are
  computed by Magento at replay time.
- The cashier sees "sale saved on this device and will sync automatically" —
  and the cart clears, because the sale IS recorded (durably, locally).

## UI

`<OfflineSyncStatus />` (mounted in the POS header, mountable anywhere) shows
an "Offline — N saved" badge while disconnected and a "Sync N pending" button
when back online with a backlog. Auto-flush runs regardless — the button is
reassurance, not a requirement.

## Limits (deliberate)

- Multi-device conflicts resolve last-write-wins per entity. For a
  single-business team this is the predictable choice; per-field merge is out
  of scope.
- Deletions are not queued (the app's sync layer is upsert-based).
- The queue lives in localStorage (same durability class as the app's
  existing state persistence). Clearing site data clears unsynced work.

## Tests

`src/offline/*.test.ts` — 23 tests covering queue persistence across
restarts, LWW de-dupe, ordered replay, network-vs-rejection classification,
per-flush attempt budgeting, drop-after-max-attempts, POS clientRef
preservation, and catalog cache fallback.
