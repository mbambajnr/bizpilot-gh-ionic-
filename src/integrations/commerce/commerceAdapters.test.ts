import { describe, expect, it, vi } from 'vitest';

import type { MagentoCatalog, MagentoPosOrder } from '../../lib/magentoClient';
import { commerceOrderInputToMagento, createMagentoAdapter, magentoCatalogToCommerce } from './adapters/magento';
import { createCustomAdapter, getByPath, mapCustomCatalog, type CustomProviderSettings } from './adapters/custom';
import { resolveCommerceAdapter } from './registry';
import type { CommerceOrderInput } from './domain';
import type { CommerceTransport } from './adapter';

const orderInput: CommerceOrderInput = {
  branchId: '2',
  clientRef: 'BISA-abc',
  customer: { name: 'Ama Owusu', phone: '024', email: '' },
  paymentMethod: 'Mobile Money',
  paymentReference: 'MOMO-1',
  items: [{ sku: 'INV-002', quantity: 3 }],
};

describe('magento adapter mapping', () => {
  const catalog: MagentoCatalog = {
    generated_at: '2026-07-21T00:00:00Z',
    store_code: 'default',
    currency: 'GHS',
    products: [{ id: 7, sku: 'INV-002', name: 'Paracetamol', price: 42, regular_price: 50, quantity: 12, is_salable: true, image_url: 'x', source_quantities: [{ source_code: 'store-a', quantity: 5, is_salable: true }] }],
    branches: [{ id: 2, name: 'Main Store', city: 'Accra', address: 'A St', phone: '030', is_active: true, source_code: 'store-a' }],
  };

  it('maps snake_case native catalog to the neutral domain', () => {
    const neutral = magentoCatalogToCommerce(catalog);
    expect(neutral.products[0]).toMatchObject({ id: '7', sku: 'INV-002', regularPrice: 50, isSalable: true, imageUrl: 'x' });
    expect(neutral.products[0].sourceQuantities?.[0]).toEqual({ sourceCode: 'store-a', quantity: 5, isSalable: true });
    expect(neutral.branches[0]).toMatchObject({ id: '2', isActive: true, sourceCode: 'store-a' });
  });

  it('maps a neutral order input to the Magento payload (branchId to number)', () => {
    const payload = commerceOrderInputToMagento(orderInput);
    expect(payload).toMatchObject({ branchId: 2, clientRef: 'BISA-abc', customer: { name: 'Ama Owusu', email: '', phone: '024' } });
    expect(payload.items).toEqual([{ sku: 'INV-002', quantity: 3 }]);
  });

  it('adapter loads and places through injected client fns, returning neutral shapes', async () => {
    const order: MagentoPosOrder = { orderId: 99, orderNumber: 'GH-99', total: 126, currency: 'GHS', branch: { id: 2, name: 'Main Store' }, itemCount: 3, duplicate: true, clientRef: 'BISA-abc' };
    const adapter = createMagentoAdapter({
      loadCatalog: vi.fn(async () => ({ ok: true as const, catalog })),
      createOrder: vi.fn(async () => ({ ok: true as const, order })),
    });
    expect((await adapter.loadCatalog()).currency).toBe('GHS');
    const placed = await adapter.placeOrder(orderInput);
    expect(placed).toMatchObject({ orderId: '99', orderNumber: 'GH-99', duplicate: true, branch: { id: '2' } });
  });
});

describe('custom REST adapter mapping', () => {
  const settings: CustomProviderSettings = {
    catalogPath: '/api/commerce/custom/catalog',
    orderPath: '/api/commerce/custom/order',
    currencyPath: 'meta.currency',
    products: { list: 'data.items', fields: { id: 'code', sku: 'code', name: 'title', price: 'pricing.sell', quantity: 'stock', imageUrl: 'photo' } },
    branches: { list: 'data.stores', fields: { id: 'ref', name: 'label', isActive: 'active' } },
  };
  const raw = {
    meta: { currency: 'NGN' },
    data: {
      items: [{ code: 'SKU-1', title: 'Widget', pricing: { sell: 19.5 }, stock: 4, photo: 'img' }],
      stores: [{ ref: 'lagos', label: 'Lagos', active: 'true' }],
    },
  };

  it('reads a dot path safely', () => {
    expect(getByPath(raw, 'data.items')).toHaveLength(1);
    expect(getByPath(raw, 'meta.missing.deep')).toBeUndefined();
  });

  it('maps an arbitrary client payload to the neutral catalog via the field map', () => {
    const catalog = mapCustomCatalog(raw, settings);
    expect(catalog.currency).toBe('NGN');
    expect(catalog.products[0]).toMatchObject({ id: 'SKU-1', sku: 'SKU-1', name: 'Widget', price: 19.5, quantity: 4, isSalable: true, imageUrl: 'img' });
    expect(catalog.branches[0]).toMatchObject({ id: 'lagos', name: 'Lagos', isActive: true, sourceCode: 'lagos' });
  });

  it('adapter posts the order and maps the confirmation back', async () => {
    const transport: CommerceTransport = {
      get: vi.fn(async () => raw),
      post: vi.fn(async () => ({ orderId: 555, total: 58.5, branch: { id: 'lagos', name: 'Lagos' } })),
    };
    const adapter = createCustomAdapter(settings, transport);
    const order = await adapter.placeOrder(orderInput);
    expect(transport.post).toHaveBeenCalledWith('/api/commerce/custom/order', orderInput);
    expect(order).toMatchObject({ orderId: '555', orderNumber: '555', total: 58.5, itemCount: 3, branch: { id: 'lagos' } });
  });
});

describe('registry resolution', () => {
  it('resolves the custom adapter from per-tenant config + transport', () => {
    const transport: CommerceTransport = { get: vi.fn(), post: vi.fn() };
    const adapter = resolveCommerceAdapter(
      { provider: 'custom', label: 'Client Store', settings: { catalogPath: '/c', orderPath: '/o', products: { list: '', fields: {} }, branches: { list: '', fields: {} } } },
      { transport },
    );
    expect(adapter.id).toBe('custom');
    expect(adapter.label).toBe('Client Store');
  });

  it('gives a clear error for a not-yet-implemented first-class provider', () => {
    expect(() => resolveCommerceAdapter({ provider: 'shopify' }, {})).toThrow(/not implemented yet/i);
  });

  it('rejects a custom provider missing its mapping settings', () => {
    const transport: CommerceTransport = { get: vi.fn(), post: vi.fn() };
    expect(() => resolveCommerceAdapter({ provider: 'custom', settings: { catalogPath: '/c' } as never }, { transport })).toThrow(/mapping settings/i);
  });
});
