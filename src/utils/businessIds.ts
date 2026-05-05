import type {
  AccountsPayable,
  ActivityLogEntry,
  BusinessProfile,
  BusinessLocation,
  Customer,
  CustomerLedgerEntry,
  Payment,
  Product,
  Purchase,
  Quotation,
  Sale,
  StockMovement,
  StockTransfer,
  Vendor,
} from '../data/seedBusiness';

function normalizePrefix(prefix: string) {
  return prefix.trim() || 'DOC-';
}

function nextSequence(existingCodes: string[], prefix: string, width = 3) {
  const normalizedPrefix = normalizePrefix(prefix);
  const values = existingCodes
    .filter((code) => code.startsWith(normalizedPrefix))
    .map((code) => Number(code.replace(normalizedPrefix, '')))
    .filter((value) => Number.isFinite(value));

  const max = values.length > 0 ? Math.max(...values) : 0;
  return `${normalizedPrefix}${String(max + 1).padStart(width, '0')}`;
}

export function nextInventoryId(products: Product[]) {
  return nextSequence(products.map((product) => product.inventoryId), 'INV-');
}

export function nextClientId(customers: Customer[]) {
  return nextSequence(customers.map((customer) => customer.clientId), 'CLT-');
}

export function nextVendorCode(vendors: Vendor[]) {
  return nextSequence(vendors.map((vendor) => vendor.vendorCode), 'VEN-', 4);
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

export function nextPurchaseCode(purchases: Purchase[]) {
  return nextSequence(purchases.map((purchase) => purchase.purchaseCode), 'PO-', 4);
}

export function nextPayableCode(entries: AccountsPayable[]) {
  return nextSequence(entries.map((entry) => entry.payableCode), 'AP-', 4);
}

export function nextWarehouseCode(locations: BusinessLocation[]) {
  return nextSequence(
    locations
      .filter((location) => location.type === 'warehouse')
      .map((location) => location.locationCode)
      .filter(Boolean) as string[],
    'WH-',
    4
  );
}

export function nextStoreCode(locations: BusinessLocation[]) {
  return nextSequence(
    locations
      .filter((location) => location.type === 'store')
      .map((location) => location.locationCode)
      .filter(Boolean) as string[],
    'ST-',
    4
  );
}

export function nextTransferCode(transfers: StockTransfer[]) {
  return nextSequence(transfers.map((transfer) => transfer.transferCode), 'TRF-', 4);
}

export function nextPaymentCode(payments: Payment[]) {
  return nextSequence(payments.map((payment) => payment.paymentCode), 'PAY-', 4);
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
