import { loadMagentoIntegrationStatus } from '../../lib/magentoClient';
import type { CommerceRuntime } from './types';

const standaloneRuntime: CommerceRuntime = {
  mode: 'standalone',
  provider: 'standalone',
  label: 'BizPilot Commerce',
  configured: true,
  capabilities: {
    catalog: true,
    inventory: true,
    orders: true,
    customers: true,
    multiLocation: true,
  },
};

export async function resolveCommerceRuntime(): Promise<CommerceRuntime> {
  const { integration } = await loadMagentoIntegrationStatus();
  if (!integration.configured) return standaloneRuntime;

  return {
    mode: 'connected',
    provider: 'magento',
    label: 'Magento Commerce',
    configured: true,
    capabilities: {
      catalog: true,
      inventory: true,
      orders: true,
      customers: true,
      multiLocation: true,
    },
  };
}

export function getStandaloneCommerceRuntime() {
  return standaloneRuntime;
}
