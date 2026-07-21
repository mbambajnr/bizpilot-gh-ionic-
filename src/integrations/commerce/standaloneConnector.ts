import type { BusinessState } from '../../data/seedBusiness';
import type { MagentoCatalog, MagentoPosOrder, MagentoPosOrderInput } from '../../lib/magentoClient';
import { selectActiveLocations, selectProductQuantityOnHand } from '../../selectors/businessSelectors';
import { buildTaxSnapshot, calculateTaxTotals, type NewSaleInput } from '../../utils/businessLogic';

type StandaloneSaleResult =
  | { ok: true; receipt: { id: string; receiptId: string; totalAmount: number } }
  | { ok: false; message: string };

export function buildStandaloneCommerceCatalog(state: BusinessState): MagentoCatalog {
  const activeLocations = selectActiveLocations(state);
  const stores = activeLocations.filter((location) => location.type === 'store');
  const locations = stores.length ? stores : activeLocations;
  return {
    generated_at: new Date().toISOString(),
    store_code: 'bizpilot',
    currency: state.businessProfile.currency,
    branches: locations.map((location, index) => ({
      id: index + 1,
      name: location.name,
      city: '',
      address: location.address ?? '',
      phone: '',
      is_active: location.isActive,
      source_code: location.id,
    })),
    products: state.products.map((product, index) => ({
      id: index + 1,
      sku: product.inventoryId,
      name: product.name,
      price: product.price,
      regular_price: product.price,
      quantity: selectProductQuantityOnHand(state, product.id),
      is_salable: selectProductQuantityOnHand(state, product.id) > 0,
      image_url: product.image,
      source_quantities: locations.map((location) => {
        const quantity = selectProductQuantityOnHand(state, product.id, location.id);
        return { source_code: location.id, quantity, is_salable: quantity > 0 };
      }),
    })),
  };
}

export function placeStandaloneCommerceOrder(
  state: BusinessState,
  input: MagentoPosOrderInput,
  customerId: string,
  addSale: (sale: NewSaleInput) => StandaloneSaleResult
): MagentoPosOrder {
  const activeLocations = selectActiveLocations(state);
  const stores = activeLocations.filter((location) => location.type === 'store');
  const locations = stores.length ? stores : activeLocations;
  const location = locations[input.branchId - 1];
  if (!location) throw new Error('Choose a valid BizPilot location.');

  const items = input.items.map((item) => {
    const product = state.products.find((entry) => entry.inventoryId.toLowerCase() === item.sku.toLowerCase());
    if (!product) throw new Error(`BizPilot product not found for SKU ${item.sku}.`);
    return { productId: product.id, quantity: item.quantity };
  });
  const subtotal = items.reduce((sum, item) => {
    const product = state.products.find((entry) => entry.id === item.productId)!;
    return sum + product.price * item.quantity;
  }, 0);
  const customer = state.customers.find((entry) => entry.id === customerId);
  const paidAmount = calculateTaxTotals(subtotal, buildTaxSnapshot(state.businessProfile, {
    exempt: customer?.taxExempt,
    exemptionReason: customer?.taxExemptionReason,
  })).totalAmount;
  const result = addSale({
    customerId,
    items,
    locationId: location.id,
    paymentMethod: input.paymentMethod,
    paymentReference: input.paymentReference,
    paidAmount,
    createdAt: new Date().toISOString(),
  });
  if (!result.ok) throw new Error(result.message);

  return {
    orderId: Date.now(),
    orderNumber: result.receipt.receiptId,
    total: result.receipt.totalAmount,
    currency: state.businessProfile.currency,
    branch: { id: input.branchId, name: location.name },
    itemCount: input.items.reduce((sum, item) => sum + item.quantity, 0),
    clientRef: input.clientRef,
  };
}
