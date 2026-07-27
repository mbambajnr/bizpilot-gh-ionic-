import type { BusinessState } from '../../data/seedBusiness';
import type { NewSaleInput } from '../../utils/businessLogic';
import type { CommerceAdapter, CommerceProviderConfig, CommerceTransport } from './adapter';
import { createMagentoAdapter } from './adapters/magento';
import { createStandaloneAdapter } from './adapters/standalone';
import { createCustomAdapter, type CustomProviderSettings } from './adapters/custom';

type StandaloneSaleResult =
  | { ok: true; receipt: { id: string; receiptId: string; totalAmount: number } }
  | { ok: false; message: string };

// Dependencies the app injects for whichever provider ends up selected. Only
// the one matching the resolved provider is required at call time.
export type CommerceAdapterDeps = {
  standalone?: {
    getState: () => BusinessState;
    addSale: (sale: NewSaleInput) => StandaloneSaleResult;
    getCustomerId: () => string;
  };
  /** HTTP transport (server proxy) for adapters that call out — currently the custom adapter. */
  transport?: CommerceTransport;
};

// Resolve a per-tenant CommerceProviderConfig to a concrete adapter. Adding a
// new first-class platform = add a case here + its adapter; the POS/inventory
// consumers never change because they only speak the neutral contract.
export function resolveCommerceAdapter(config: CommerceProviderConfig, deps: CommerceAdapterDeps): CommerceAdapter {
  switch (config.provider) {
    case 'standalone': {
      if (!deps.standalone) throw new Error('Standalone commerce requires business state to be provided.');
      return createStandaloneAdapter({ ...deps.standalone, label: config.label });
    }
    case 'magento':
      return createMagentoAdapter({ label: config.label });
    case 'custom': {
      if (!deps.transport) throw new Error('The custom commerce adapter requires an HTTP transport.');
      const settings = config.settings as CustomProviderSettings | undefined;
      if (!settings?.catalogPath || !settings?.orderPath || !settings?.products || !settings?.branches) {
        throw new Error('The custom commerce provider is missing its catalog/order mapping settings.');
      }
      return createCustomAdapter(settings, deps.transport, config.label ?? 'Custom Commerce');
    }
    case 'shopify':
    case 'woocommerce':
      throw new Error(`The ${config.provider} adapter is not implemented yet — configure this tenant with the custom REST adapter for now.`);
    default:
      throw new Error(`Unknown commerce provider: ${String(config.provider)}`);
  }
}
