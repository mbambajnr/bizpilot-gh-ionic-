import type {
  ActivityLogEntry,
  BusinessProfile,
  Customer,
  CustomerLedgerEntry,
  Product,
  Quotation,
  Sale,
  StockMovement,
} from '../data/seedBusiness';

function normalizePrefix(prefix: string) {
  return prefix.trim() || 'DOC-';
}

function nextSequence(existingCodes: string[], prefix: string) {
  const normalizedPrefix = normalizePrefix(prefix);
  const values = existingCodes
    .filter((code) => code.startsWith(normalizedPrefix))
    .map((code) => Number(code.replace(normalizedPrefix, '')))
    .filter((value) => Number.isFinite(value));

  const max = values.length > 0 ? Math.max(...values) : 0;
  return `${normalizedPrefix}${String(max + 1).padStart(3, '0')}`;
}

export function nextInventoryId(products: Product[]) {
  return nextSequence(products.map((product) => product.inventoryId), 'INV-');
}

export function nextClientId(customers: Customer[]) {
  return nextSequence(customers.map((customer) => customer.clientId), 'CLT-');
}

export function nextReceiptId(sales: Sale[], prefix = 'RCP-') {
  return nextSequence(
    sales.map((sale) => sale.receiptId).filter(Boolean) as string[],
    prefix
  );
}

export function nextInvoiceNumber(sales: Sale[], prefix = 'INV-') {
  return nextSequence(
    sales.map((sale) => sale.invoiceNumber).filter(Boolean) as string[],
    prefix
  );
}

export function nextQuotationNumber(quotations: Quotation[]) {
  return nextSequence(
    quotations.map((quotation) => quotation.quotationNumber).filter(Boolean) as string[],
    'QTN-'
  );
}

export function nextStockMovementNumber(movements: StockMovement[]) {
  return nextSequence(movements.map((movement) => movement.movementNumber), 'SMV-');
}

export function nextLedgerEntryNumber(entries: CustomerLedgerEntry[]) {
  return nextSequence(entries.map((entry) => entry.entryNumber), 'LED-');
}

export function nextActivityNumber(entries: ActivityLogEntry[]) {
  return nextSequence(entries.map((entry) => entry.activityNumber), 'ACT-');
}

export function nextBusinessProfileId(profiles: BusinessProfile[]) {
  return nextSequence(profiles.map((profile) => profile.id), 'biz-');
}
