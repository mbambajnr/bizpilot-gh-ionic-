import {
  createMagentoPosOrder,
  loadMagentoCatalog,
  type MagentoCatalog,
  type MagentoPosOrder,
  type MagentoPosOrderInput,
} from '../../../lib/magentoClient';
import type { CommerceCapabilities } from '../types';
import type { CommerceCatalog, CommerceOrder, CommerceOrderInput } from '../domain';
import type { CommerceAdapter } from '../adapter';

const magentoCapabilities: CommerceCapabilities = {
  catalog: true,
  inventory: true,
  orders: true,
  customers: true,
  multiLocation: true,
};

// --- Pure mappers (Magento snake_case native <-> neutral domain) ---

export function magentoCatalogToCommerce(catalog: MagentoCatalog): CommerceCatalog {
  return {
    generatedAt: catalog.generated_at,
    currency: catalog.currency,
    products: catalog.products.map((product) => ({
      id: String(product.id),
      sku: product.sku,
      name: product.name,
      price: product.price,
      regularPrice: product.regular_price,
      quantity: product.quantity,
      isSalable: product.is_salable,
      imageUrl: product.image_url,
      sourceQuantities: product.source_quantities?.map((source) => ({
        sourceCode: source.source_code,
        quantity: source.quantity,
        isSalable: source.is_salable,
      })),
    })),
    branches: catalog.branches.map((branch) => ({
      id: String(branch.id),
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      isActive: branch.is_active,
      sourceCode: branch.source_code,
    })),
  };
}

export function commerceOrderInputToMagento(input: CommerceOrderInput): MagentoPosOrderInput {
  return {
    branchId: Number(input.branchId),
    clientRef: input.clientRef,
    customer: {
      name: input.customer.name,
      email: input.customer.email ?? '',
      phone: input.customer.phone ?? '',
    },
    paymentMethod: input.paymentMethod,
    paymentReference: input.paymentReference,
    items: input.items.map((item) => ({ sku: item.sku, quantity: item.quantity })),
  };
}

export function magentoOrderToCommerce(order: MagentoPosOrder): CommerceOrder {
  return {
    orderId: String(order.orderId),
    orderNumber: order.orderNumber,
    total: order.total,
    currency: order.currency,
    branch: { id: String(order.branch.id), name: order.branch.name },
    itemCount: order.itemCount,
    duplicate: order.duplicate,
    clientRef: order.clientRef,
  };
}

// --- Adapter (I/O via the BizPilot server proxy) ---

export function createMagentoAdapter(deps: {
  loadCatalog?: typeof loadMagentoCatalog;
  createOrder?: typeof createMagentoPosOrder;
  label?: string;
} = {}): CommerceAdapter {
  const load = deps.loadCatalog ?? loadMagentoCatalog;
  const create = deps.createOrder ?? createMagentoPosOrder;
  return {
    id: 'magento',
    label: deps.label ?? 'Magento Commerce',
    capabilities: magentoCapabilities,
    async loadCatalog() {
      const { catalog } = await load();
      return magentoCatalogToCommerce(catalog);
    },
    async placeOrder(input: CommerceOrderInput) {
      const { order } = await create(commerceOrderInputToMagento(input));
      return magentoOrderToCommerce(order);
    },
  };
}
