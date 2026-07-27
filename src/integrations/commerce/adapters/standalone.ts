import type { BusinessState } from '../../../data/seedBusiness';
import type { NewSaleInput } from '../../../utils/businessLogic';
import type { CommerceCapabilities } from '../types';
import type { CommerceOrderInput } from '../domain';
import type { CommerceAdapter } from '../adapter';
import { buildStandaloneCommerceCatalog, placeStandaloneCommerceOrder } from '../standaloneConnector';
import { commerceOrderInputToMagento, magentoCatalogToCommerce, magentoOrderToCommerce } from './magento';

type StandaloneSaleResult =
  | { ok: true; receipt: { id: string; receiptId: string; totalAmount: number } }
  | { ok: false; message: string };

const standaloneCapabilities: CommerceCapabilities = {
  catalog: true,
  inventory: true,
  orders: true,
  customers: true,
  multiLocation: true,
};

// BisaPilot's own data is the source of truth. We reuse the existing standalone
// catalog/order builders (which speak the Magento-shaped internal format) and
// map their output to the neutral domain, so this provider looks like any other.
export function createStandaloneAdapter(deps: {
  getState: () => BusinessState;
  addSale: (sale: NewSaleInput) => StandaloneSaleResult;
  /** Registered BisaPilot customer this sale is booked against (walk-in id when none). */
  getCustomerId: () => string;
  label?: string;
}): CommerceAdapter {
  return {
    id: 'standalone',
    label: deps.label ?? 'BisaPilot Commerce',
    capabilities: standaloneCapabilities,
    async loadCatalog() {
      return magentoCatalogToCommerce(buildStandaloneCommerceCatalog(deps.getState()));
    },
    async placeOrder(input: CommerceOrderInput) {
      const order = placeStandaloneCommerceOrder(
        deps.getState(),
        commerceOrderInputToMagento(input),
        deps.getCustomerId(),
        deps.addSale,
      );
      return magentoOrderToCommerce(order);
    },
  };
}
