import type { BusinessLocation, Product } from '../data/seedBusiness';
import type { MagentoCatalog } from '../lib/magentoClient';

export type NormalizedMagentoCatalog = {
  products: Product[];
  locations: BusinessLocation[];
};

export function normalizeMagentoCatalog(catalog: MagentoCatalog): NormalizedMagentoCatalog {
  return {
    products: catalog.products.map((product) => ({
      id: `magento-product-${product.id}`,
      inventoryId: product.sku,
      name: product.name,
      unit: 'units',
      price: Number(product.price) || 0,
      cost: 0,
      reorderLevel: 0,
      image: product.image_url || '',
    })),
    locations: catalog.branches
      .filter((branch) => branch.is_active)
      .map((branch, index) => ({
        id: `magento-branch-${branch.id}`,
        locationCode: `MAGENTO-${branch.id}`,
        name: branch.name,
        type: 'store',
        address: [branch.address, branch.city].filter(Boolean).join(', '),
        isDefault: index === 0,
        isActive: true,
      })),
  };
}
