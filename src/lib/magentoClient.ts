import { apiFetch } from './apiClient';

export type MagentoSourceQuantity = {
  /** MSI inventory source (= one branch's shelf), e.g. "market_circle". */
  source_code: string;
  quantity: number;
  is_salable: boolean;
};

export type MagentoCatalogProduct = {
  id: number;
  sku: string;
  name: string;
  /** Charge price — special prices and catalog rules already applied. */
  price: number;
  /** Undiscounted price; when it differs from price, the item is on promo. */
  regular_price?: number;
  /** Network-wide total across all branch sources. */
  quantity: number;
  is_salable: boolean;
  image_url: string;
  /** Per-branch stock; match entries to a branch via its source_code. */
  source_quantities?: MagentoSourceQuantity[];
};

export type MagentoCatalogBranch = {
  id: number;
  name: string;
  city: string;
  address: string;
  phone: string;
  is_active: boolean;
  /** MSI source this branch sells from ('' when unmapped). */
  source_code?: string;
};

export type MagentoCatalog = {
  generated_at: string;
  store_code: string;
  currency: string;
  products: MagentoCatalogProduct[];
  branches: MagentoCatalogBranch[];
};

export type MagentoIntegrationStatus = {
  configured: boolean;
  baseUrl: string;
  storeCode: string;
};

export type MagentoStockSnapshot = {
  generated_at: string;
  items: Array<{
    sku: string;
    source_code: string;
    quantity: number;
    is_salable: boolean;
  }>;
};

export type MagentoPosOrderInput = {
  branchId: number;
  /**
   * Unique reference for this sale attempt (idempotency key). Reuse the SAME
   * value when retrying a failed submission — Magento then returns the
   * original order instead of creating a duplicate.
   */
  clientRef: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  paymentMethod: 'Cash' | 'Mobile Money' | 'Bank Account';
  paymentReference?: string;
  items: Array<{
    sku: string;
    quantity: number;
  }>;
};

export type MagentoPosOrder = {
  orderId: number;
  orderNumber: string;
  total: number;
  currency: string;
  branch: {
    id: number;
    name: string;
  };
  itemCount: number;
  /** True when this was an idempotent replay of an already-recorded sale. */
  duplicate?: boolean;
  clientRef?: string;
};

async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || fallback);
  }
  return payload as T;
}

export async function loadMagentoIntegrationStatus() {
  const response = await apiFetch('/api/magento/health');
  return parseResponse<{ ok: true; integration: MagentoIntegrationStatus }>(
    response,
    'Magento integration status is unavailable.'
  );
}

export async function loadMagentoCatalog() {
  const response = await apiFetch('/api/magento/catalog');
  return parseResponse<{ ok: true; catalog: MagentoCatalog }>(
    response,
    'Magento catalog synchronization failed.'
  );
}

/** Cheap per-branch quantities snapshot — polled to keep the register live. */
export async function loadMagentoStock() {
  const response = await apiFetch('/api/magento/stock');
  return parseResponse<{ ok: true; stock: MagentoStockSnapshot }>(
    response,
    'Magento stock refresh failed.'
  );
}

export type MomoProvider = 'mtn' | 'vod' | 'atl';

export type MomoSaleInput = {
  branchId: number;
  /** Unique reference (also the Paystack reference). Reuse across polls. */
  clientRef: string;
  momoNumber: string;
  momoProvider: MomoProvider;
  customer: { name: string; email?: string };
  items: Array<{ sku: string; quantity: number }>;
};

export type MomoResult = {
  /** 'pending' = awaiting phone approval; 'success' = paid + fulfilled; 'failed' = canceled. */
  status: 'pending' | 'success' | 'failed';
  order_id: number;
  increment_id: string;
  grand_total: number;
  currency: string;
  paystack_ref: string;
  /** Instruction to show while pending (e.g. "Approve the prompt on your phone"). */
  display_text: string;
  message: string;
  duplicate: boolean;
};

/** Start a Mobile Money charge (customer approves on their phone). */
export async function initiateMomoSale(input: MomoSaleInput) {
  const response = await apiFetch('/api/magento/momo/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseResponse<{ ok: true; result: MomoResult }>(response, 'Mobile Money charge could not be started.');
}

/** Poll a Mobile Money sale until it settles ('success' or 'failed'). */
export async function pollMomoStatus(clientRef: string) {
  const response = await apiFetch(`/api/magento/momo/status/${encodeURIComponent(clientRef)}`);
  return parseResponse<{ ok: true; result: MomoResult }>(response, 'Could not check Mobile Money status.');
}

export async function createMagentoPosOrder(input: MagentoPosOrderInput) {
  const response = await apiFetch('/api/magento/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return parseResponse<{ ok: true; order: MagentoPosOrder }>(
    response,
    'Magento POS checkout failed.'
  );
}
