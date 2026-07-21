import type { MagentoCatalog, MagentoPosOrder, MagentoPosOrderInput } from '../../lib/magentoClient';

export type CommerceProviderId = 'standalone' | 'magento' | 'shopify' | 'woocommerce' | 'custom';
export type CommerceRuntimeMode = 'standalone' | 'connected';

export type CommerceCapabilities = {
  catalog: boolean;
  inventory: boolean;
  orders: boolean;
  customers: boolean;
  multiLocation: boolean;
};

export type CommerceRuntime = {
  mode: CommerceRuntimeMode;
  provider: CommerceProviderId;
  label: string;
  configured: boolean;
  capabilities: CommerceCapabilities;
};

export interface CommerceConnector {
  readonly runtime: CommerceRuntime;
  loadCatalog(): Promise<MagentoCatalog>;
  placeOrder(input: MagentoPosOrderInput): Promise<MagentoPosOrder>;
}
