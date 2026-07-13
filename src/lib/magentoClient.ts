export type MagentoCatalogProduct = {
  id: number;
  sku: string;
  name: string;
  /** Charge price — special prices and catalog rules already applied. */
  price: number;
  /** Undiscounted price; when it differs from price, the item is on promo. */
  regular_price?: number;
  quantity: number;
  is_salable: boolean;
  image_url: string;
};

export type MagentoCatalogBranch = {
  id: number;
  name: string;
  city: string;
  address: string;
  phone: string;
  is_active: boolean;
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
  const response = await fetch('/api/magento/health');
  return parseResponse<{ ok: true; integration: MagentoIntegrationStatus }>(
    response,
    'Magento integration status is unavailable.'
  );
}

export async function loadMagentoCatalog() {
  const response = await fetch('/api/magento/catalog');
  return parseResponse<{ ok: true; catalog: MagentoCatalog }>(
    response,
    'Magento catalog synchronization failed.'
  );
}

export async function createMagentoPosOrder(input: MagentoPosOrderInput) {
  const response = await fetch('/api/magento/orders', {
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
