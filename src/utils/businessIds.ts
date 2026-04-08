import type { Customer, Product } from '../data/seedBusiness';

function nextSequence(existingCodes: string[], prefix: string) {
  const values = existingCodes
    .filter((code) => code.startsWith(prefix))
    .map((code) => Number(code.replace(prefix, '')))
    .filter((value) => Number.isFinite(value));

  const max = values.length > 0 ? Math.max(...values) : 0;
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export function nextInventoryId(products: Product[]) {
  return nextSequence(products.map((product) => product.inventoryId), 'INV-');
}

export function nextClientId(customers: Customer[]) {
  return nextSequence(customers.map((customer) => customer.clientId), 'CLT-');
}
