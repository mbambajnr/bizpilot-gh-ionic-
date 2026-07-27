import { randomUUID } from 'node:crypto';

const DEFAULT_TIMEOUT_MS = 15000;

function normalizeCatalogPayload(payload) {
  if (Array.isArray(payload) && payload.length === 5) {
    const [generated_at, store_code, currency, branches, products] = payload;
    return { generated_at, store_code, currency, branches, products };
  }

  return payload;
}

function getConfig() {
  return {
    baseUrl: String(process.env.MAGENTO_BASE_URL || '').trim().replace(/\/+$/, ''),
    accessToken: String(process.env.MAGENTO_ACCESS_TOKEN || '').trim(),
    storeCode: String(process.env.MAGENTO_STORE_CODE || 'default').trim(),
  };
}

async function magentoRequest(path, options = {}) {
  const config = getConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${config.baseUrl}/rest/${encodeURIComponent(config.storeCode)}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Magento did not respond within 15 seconds.');
    }
    throw new Error(`Magento service is not reachable at ${config.baseUrl}. Check that the Magento server is running and the base URL is correct.`);
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload && typeof payload.message === 'string'
      ? payload.message
      : `Magento returned HTTP ${response.status}.`;
    throw new Error(message);
  }

  return payload;
}

export function getMagentoIntegrationStatus() {
  const config = getConfig();
  return {
    configured: Boolean(config.baseUrl && config.accessToken),
    baseUrl: config.baseUrl,
    storeCode: config.storeCode,
  };
}

export async function fetchMagentoCatalog() {
  const config = getConfig();
  if (!config.baseUrl || !config.accessToken) {
    throw new Error('Magento integration is not configured on the BisaPilot server.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const endpoint = `${config.baseUrl}/rest/${encodeURIComponent(config.storeCode)}/V1/custom-storefront/pos/catalog`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      signal: controller.signal,
    });
    const responsePayload = await response.json().catch(() => null);

    if (!response.ok) {
      const remoteMessage =
        responsePayload && typeof responsePayload.message === 'string'
          ? responsePayload.message
          : `Magento returned HTTP ${response.status}.`;
      throw new Error(remoteMessage);
    }
    const payload = normalizeCatalogPayload(responsePayload);
    if (!payload || !Array.isArray(payload.products) || !Array.isArray(payload.branches)) {
      throw new Error('Magento returned an invalid POS catalog payload.');
    }

    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Magento did not respond within 15 seconds.');
    }
    throw new Error(`Magento service is not reachable at ${config.baseUrl}. Check that the Magento server is running and the base URL is correct.`);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Lightweight per-branch stock snapshot — polled by the POS register so
 * sales from other channels (website, other branches) show up within ~30s.
 */
export async function fetchMagentoStock() {
  const config = getConfig();
  if (!config.baseUrl || !config.accessToken) {
    throw new Error('Magento integration is not configured on the BisaPilot server.');
  }
  const payload = await magentoRequest('/V1/custom-storefront/pos/stock');
  if (!payload || !Array.isArray(payload.items)) {
    throw new Error('Magento returned an invalid POS stock payload.');
  }
  return payload;
}

/**
 * Start a Mobile Money counter sale — pushes a Paystack charge to the
 * customer's phone. Returns { status: 'pending' | 'success' | ... }.
 */
export async function initiateMagentoMomo(input) {
  const config = getConfig();
  if (!config.baseUrl || !config.accessToken) {
    throw new Error('Magento integration is not configured on the BisaPilot server.');
  }
  return magentoRequest('/V1/custom-storefront/pos/sale/momo/initiate', {
    method: 'POST',
    body: JSON.stringify({
      branchId: input.branchId,
      clientRef: input.clientRef,
      items: input.items.map((item) => ({ sku: item.sku, qty: item.quantity })),
      momoNumber: input.momoNumber,
      momoProvider: input.momoProvider,
      customerName: input.customer?.name || '',
      customerEmail: input.customer?.email || '',
    }),
  });
}

/**
 * Demand + reorder intelligence per SKU per branch (velocity, days of cover,
 * suggested reorder). Feeds procurement/transfer decisions.
 */
export async function fetchMagentoReorder(days) {
  const config = getConfig();
  if (!config.baseUrl || !config.accessToken) {
    throw new Error('Magento integration is not configured on the BisaPilot server.');
  }
  const query = Number.isFinite(days) && days > 0 ? `?days=${Math.floor(days)}` : '';
  const payload = await magentoRequest('/V1/custom-storefront/pos/reorder' + query);
  if (!payload || !Array.isArray(payload.items)) {
    throw new Error('Magento returned an invalid reorder payload.');
  }
  return payload;
}

/**
 * Recent Magento orders for the enterprise activity feed. Keep the response
 * deliberately narrow so payment details and raw Magento extension data never
 * cross the BisaPilot server boundary.
 */
export async function fetchMagentoActivity(limit = 8) {
  const config = getConfig();
  if (!config.baseUrl || !config.accessToken) {
    throw new Error('Magento integration is not configured on the BisaPilot server.');
  }

  const pageSize = Math.min(Math.max(Number(limit) || 8, 1), 20);
  const query = new URLSearchParams({
    'searchCriteria[pageSize]': String(pageSize),
    'searchCriteria[currentPage]': '1',
    'searchCriteria[sortOrders][0][field]': 'created_at',
    'searchCriteria[sortOrders][0][direction]': 'DESC',
  });
  const payload = await magentoRequest(`/V1/orders?${query.toString()}`);

  if (!payload || !Array.isArray(payload.items)) {
    throw new Error('Magento returned an invalid order activity payload.');
  }

  return {
    generated_at: new Date().toISOString(),
    total_count: Number(payload.total_count) || payload.items.length,
    orders: payload.items.map((order) => ({
      id: Number(order.entity_id) || 0,
      order_number: String(order.increment_id || ''),
      status: String(order.status || 'unknown'),
      created_at: String(order.created_at || ''),
      total: Number(order.grand_total) || 0,
      currency: String(order.order_currency_code || 'GHS'),
      item_count: Number(order.total_item_count) || 0,
      customer_name: [order.customer_firstname, order.customer_lastname].filter(Boolean).join(' ') || 'Guest customer',
    })),
  };
}

/** Poll a Mobile Money sale's payment status (register polls until settled). */
export async function getMagentoMomoStatus(clientRef) {
  const config = getConfig();
  if (!config.baseUrl || !config.accessToken) {
    throw new Error('Magento integration is not configured on the BisaPilot server.');
  }
  return magentoRequest('/V1/custom-storefront/pos/sale/momo/status/' + encodeURIComponent(clientRef));
}

export async function createMagentoPosOrder(input) {
  const config = getConfig();
  if (!config.baseUrl || !config.accessToken) {
    throw new Error('Magento integration is not configured on the BisaPilot server.');
  }

  // One idempotent call: Magento validates the branch, SKUs and quantities,
  // prices the sale (incl. Ghana VAT/levies), reserves stock, attributes the
  // branch, and records the tender. Retrying with the same clientRef returns
  // the original order (duplicate: true) instead of creating a second one —
  // safe on flaky networks. The app supplies clientRef so it survives
  // retries; the fallback UUID only covers callers that omit it.
  const clientRef = String(input.clientRef || '').trim() || `BISA-${randomUUID()}`;

  const order = await magentoRequest('/V1/custom-storefront/pos/sale', {
    method: 'POST',
    body: JSON.stringify({
      branchId: input.branchId,
      clientRef,
      items: input.items.map((item) => ({ sku: item.sku, qty: item.quantity })),
      customerName: input.customer.name,
      customerPhone: input.customer.phone || '',
      customerEmail: input.customer.email || '',
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference || '',
    }),
  });

  return {
    orderId: order.order_id,
    orderNumber: order.increment_id,
    total: Number(order.grand_total) || 0,
    currency: order.currency || 'GHS',
    branch: {
      id: input.branchId,
      name: order.branch_name || '',
    },
    itemCount: input.items.reduce((sum, item) => sum + item.quantity, 0),
    duplicate: Boolean(order.duplicate),
    clientRef,
  };
}
