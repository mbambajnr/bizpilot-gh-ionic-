import { describe, expect, it } from 'vitest';

import { normalizeMagentoCatalog } from './magentoCatalog';

describe('normalizeMagentoCatalog', () => {
  it('maps Magento SKUs and active branches into BizPilot records', () => {
    const result = normalizeMagentoCatalog({
      generated_at: '2026-07-09T00:00:00Z',
      store_code: 'default',
      currency: 'GHS',
      products: [
        {
          id: 12,
          sku: 'CHAIR-01',
          name: 'Office Chair',
          price: 450,
          quantity: 8,
          is_salable: true,
          image_url: 'https://shop.test/media/chair.jpg',
        },
      ],
      branches: [
        {
          id: 2,
          name: 'Market Circle',
          city: 'Takoradi',
          address: 'Poppet Street',
          phone: '0200000000',
          is_active: true,
        },
        {
          id: 3,
          name: 'Closed Branch',
          city: 'Accra',
          address: '',
          phone: '',
          is_active: false,
        },
      ],
    });

    expect(result.products[0]).toMatchObject({
      id: 'magento-product-12',
      inventoryId: 'CHAIR-01',
      name: 'Office Chair',
      price: 450,
    });
    expect(result.locations).toEqual([
      expect.objectContaining({
        id: 'magento-branch-2',
        name: 'Market Circle',
        address: 'Poppet Street, Takoradi',
        isDefault: true,
      }),
    ]);
  });
});
