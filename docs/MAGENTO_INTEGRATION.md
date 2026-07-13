# Magento POS Integration

BizPilot connects to Magento through the local BizPilot server. The Magento access token must never be added to a `VITE_` variable or bundled into the Ionic application.

## Magento setup

1. In Magento Admin, open **System > Extensions > Integrations**.
2. Create an integration named **BizPilot POS**.
3. Grant exactly these resources (least privilege — never "All"):
   - **Catalog > Products** (`Magento_Catalog::products`) — catalog feed
   - **Sales** (`Magento_Sales::sales`) and **Sales > Create** (`Magento_Sales::create`) — recording sales
   - **Cart > Manage** (`Magento_Cart::manage`) — legacy cart flow only; can be dropped once fully on `/pos/sale`
4. Activate the integration and copy its access token.

## Magento endpoints used

```text
GET  /rest/{storeCode}/V1/custom-storefront/pos/catalog
POST /rest/{storeCode}/V1/custom-storefront/pos/sale
```

**Catalog** returns keyed JSON: `{generated_at, store_code, currency, total_count, branches[], products[]}`.
Products include `price` (the charge price — special prices and catalog rules already applied) and
`regular_price` (undiscounted; differs from `price` when the item is on promo). Optional query params:
`updatedSince` (ISO-8601 delta sync; changed-but-disabled products come back with `is_salable:false`),
`page` + `pageSize` (max 500). Deltas cannot express deletions — do a periodic full resync.

**Sale** records a counter sale in one call:

```json
{"branchId": 1, "clientRef": "BISA-<uuid>",
 "items": [{"sku": "FUR-001", "qty": 2}],
 "customerName": "Kwame Mensah", "customerPhone": "", "customerEmail": "",
 "paymentMethod": "Mobile Money", "paymentReference": "MOMO-778899"}
```

→ `{order_id, increment_id, status, grand_total, currency, branch_name, duplicate}`.

- **Idempotent on `clientRef`** (max 64 chars): retrying with the same value returns the original
  order with `duplicate: true` instead of creating a second one. BizPilot generates the ref on the
  first submit attempt of a sale and reuses it for retries of that sale.
- Magento owns pricing (incl. Ghana VAT/levies), stock reservation, branch attribution and the
  tender record (`paymentMethod`/`paymentReference` appear in the admin payment block and the
  order's audit comment).
- Invalid branch / SKU / qty → HTTP 400 with a readable message.

## BizPilot server setup

Add these values to `.env.server`:

```dotenv
MAGENTO_BASE_URL=http://127.0.0.1:8080
MAGENTO_STORE_CODE=default
MAGENTO_ACCESS_TOKEN=your_magento_integration_access_token
```

Restart `npm run dev`, then open **Settings > Magento POS connection** and select **Test Magento Connection**.

The Ionic application calls only:

```text
GET  /api/magento/health
GET  /api/magento/catalog
POST /api/magento/orders
```

The BizPilot server adds the Magento authorization header and does not expose the token to the browser.
