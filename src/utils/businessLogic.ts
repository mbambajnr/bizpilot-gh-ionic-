import type {
  AccountsPayable,
  AppNotification,
  AccountsPayableStatus,
  ActivityLogEntry,
  BusinessProfile,
  BusinessLocation,
  BusinessLocationType,
  BusinessState,
  Customer,
  CustomerLedgerEntry,
  PaymentMethod,
  Product,
  ProductCategory,
  LocationSupplyRoute,
  Quotation,
  QuotationLine,
  RestockRequest,
  RestockRequestStatus,
  Sale,
  SaleLineItem,
  SaleAuditEvent,
  Expense,
  Payment,
  Purchase,
  PurchaseItem,
  StockMovement,
  StockTransfer,
  TaxComponent,
  TaxMode,
  TaxPreset,
  TaxSnapshot,
  Vendor,
  WithholdingTaxBasis,
  WithholdingTaxSnapshot,
} from '../data/seedBusiness';
import { seedState } from '../data/seedBusiness';
import {
  nextActivityNumber,
  nextClientId,
  nextInvoiceNumber,
  nextInventoryId,
  nextLedgerEntryNumber,
  nextPayableCode,
  nextPaymentCode,
  nextPurchaseCode,
  nextQuotationNumber,
  nextReceiptId,
  nextStoreCode,
  nextStockMovementNumber,
  nextTransferCode,
  nextVendorCode,
  nextWarehouseCode,
} from './businessIds';
import { createProductImage } from './productArtwork';
import {
  selectProductQuantityOnHand,
  selectSaleBalanceRemaining,
} from '../selectors/businessSelectors';

export type NewProductInput = Omit<Product, 'id' | 'inventoryId' | 'image'> & {
  inventoryId?: string;
  quantity: number;
  image?: string;
  locationId?: string;
};

export type NewCustomerInput = Omit<Customer, 'id' | 'clientId' | 'status' | 'terminatedAt' | 'terminationReason'> & {
  clientId?: string;
  phone?: string;
};

export type UpdateCustomerInput = {
  customerId: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  channel: string;
  customerType?: Customer['customerType'];
  taxExempt?: boolean;
  taxExemptionReason?: string;
};

export type UpdateCustomerStatusInput = {
  customerId: string;
  status: Customer['status'];
  terminationReason?: string;
};

export type UpdateBusinessProfileInput = Omit<
  BusinessProfile,
  'id' | 'inventoryCategoriesEnabled' | 'customerClassificationEnabled' | 'taxEnabled' | 'taxPreset' | 'taxMode' | 'applyTaxByDefault' | 'taxComponents' | 'withholdingTaxEnabled' | 'defaultWithholdingTaxRate' | 'defaultWithholdingTaxLabel' | 'defaultWithholdingTaxBasis'
> & {
  inventoryCategoriesEnabled?: boolean;
  customerClassificationEnabled?: boolean;
  taxEnabled?: boolean;
  taxPreset?: TaxPreset;
  taxMode?: TaxMode;
  applyTaxByDefault?: boolean;
  taxComponents?: TaxComponent[];
  withholdingTaxEnabled?: boolean;
  defaultWithholdingTaxRate?: number;
  defaultWithholdingTaxLabel?: string;
  defaultWithholdingTaxBasis?: WithholdingTaxBasis;
};

export type NewSaleLineItemInput = {
  productId: string;
  quantity: number;
};

export type NewSaleInput = {
  customerId: string;
  items: NewSaleLineItemInput[];
  paymentMethod: PaymentMethod;
  paidAmount: number;
  paymentReference?: string;
  correctionOfSaleId?: string;
  quotationId?: string;
  createdAt?: string;
  taxExempt?: boolean;
  taxExemptionReason?: string;
  applyWithholdingTax?: boolean;
  taxSnapshotOverride?: TaxSnapshot;
  withholdingTaxSnapshotOverride?: WithholdingTaxSnapshot;
};

export type NewQuotationLineInput = NewSaleLineItemInput;

export type NewQuotationInput = {
  customerId: string;
  items: NewQuotationLineInput[];
  status?: Quotation['status'];
  taxExempt?: boolean;
  taxExemptionReason?: string;
  applyWithholdingTax?: boolean;
  validUntil?: string;
  customerType?: Quotation['customerType'];
};

export type ConvertQuotationInput = {
  quotationId: string;
  paymentMethod: PaymentMethod;
  amountPaid: number;
};

export type ConvertedSaleReceipt = {
  id: string;
  receiptId: string;
  createdAt: string;
  customerName: string;
  clientId: string;
  productName: string;
  inventoryId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  amountPaid: number;
  balanceRemaining: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
};

export type ConvertQuotationResult = {
  data: BusinessState;
  receipts: ConvertedSaleReceipt[];
  quotationNumber: string;
};

export type NewRestockRequestInput = {
  productId: string;
  requestedByUserId: string;
  requestedByName: string;
  requestedQuantity: number;
  urgency: 'Low' | 'Medium' | 'High';
  note?: string;
};

export type ReviewRestockRequestInput = {
  requestId: string;
  status: RestockRequestStatus;
  reviewedByUserId: string;
  reviewedByName: string;
  reviewNote?: string;
};

export type CreateProductCategoryInput = {
  name: string;
  description?: string;
  parentCategoryId?: string;
};

export type UpdateProductCategoryInput = {
  categoryId: string;
  name: string;
  description?: string;
  parentCategoryId?: string;
};

export type SetProductCategoryActiveInput = {
  categoryId: string;
  isActive: boolean;
};

export type SetInventoryCategoriesEnabledInput = {
  enabled: boolean;
};

export type CreateBusinessLocationInput = {
  name: string;
  type: BusinessLocationType;
  isDefault?: boolean;
};

export type UpdateBusinessLocationInput = {
  locationId: string;
  name: string;
  type: BusinessLocationType;
  isDefault?: boolean;
  isActive?: boolean;
};

export type CreateSupplyRouteInput = {
  fromLocationId: string;
  toLocationId: string;
};

export type SetSupplyRouteActiveInput = {
  routeId: string;
  isActive: boolean;
};

export type TransferStockInput = {
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  note?: string;
};

export type CreateStockTransferInput = {
  fromWarehouseId: string;
  toStoreId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  initiatedBy: string;
  note?: string;
};

export type StockTransferActionInput = {
  transferId: string;
  performedBy: string;
};

export type CreateVendorInput = {
  vendorCode?: string;
  name: string;
  contactEmail?: string;
  location: string;
};

export type UpdateVendorInput = {
  vendorId: string;
  vendorCode: string;
  name: string;
  contactEmail?: string;
  location: string;
};

export type SetVendorStatusInput = {
  vendorId: string;
  status: Vendor['status'];
};

export type CreatePurchaseDraftInput = {
  vendorId: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitCost: number;
  }>;
  createdBy: string;
};

export type PurchaseActionInput = {
  purchaseId: string;
  performedBy: string;
  note?: string;
};

export type ReceivePurchaseInput = {
  purchaseId: string;
  warehouseId: string;
  performedBy: string;
  receivedItems?: Array<{
    productId: string;
    quantity: number;
  }>;
};

export type CreatePayableInput = {
  purchaseId: string;
  createdBy: string;
  dueDate?: string;
};

export type ApprovePayableInput = {
  payableId: string;
  approvedBy: string;
};

export type RecordPayablePaymentInput = {
  payableId: string;
  amount: number;
  method: Payment['method'];
  paidBy: string;
  reference?: string;
};

export type SetCustomerClassificationEnabledInput = {
  enabled: boolean;
};

export type SetBusinessTaxSettingsInput = {
  enabled: boolean;
  preset?: TaxPreset;
  mode?: TaxMode;
  applyTaxByDefault?: boolean;
  withholdingTaxEnabled?: boolean;
  withholdingTaxRate?: number;
  withholdingTaxLabel?: string;
  withholdingTaxBasis?: WithholdingTaxBasis;
  taxComponents?: TaxComponent[];
};

export type LaunchBusinessWorkspaceInput = {
  launchedAt?: string;
};

export type ReverseSaleInput = {
  saleId: string;
  reason: string;
  actor?: string;
};

export type ReverseSaleResult = {
  data: BusinessState;
  reversedSale: Sale;
};

export type ActionResult<T = void> = { ok: true; data?: T; message?: string } | { ok: false; message: string };
export const DEFAULT_LOCATION_ID = '00000000-0000-4000-8000-000000000001';
export const DEFAULT_LOCATION_NAME = 'Main Store';
export const DEFAULT_LOCATION_CODE = 'ST-0001';

export const GHANA_STANDARD_TAX_COMPONENTS = [
  { key: 'vat', label: 'VAT', rate: 12.5, enabled: true },
  { key: 'nhil', label: 'NHIL', rate: 2.5, enabled: true },
  { key: 'getfund', label: 'GETFund', rate: 2.5, enabled: true },
] satisfies TaxComponent[];

export const GHANA_STANDARD_TAX_RATE = GHANA_STANDARD_TAX_COMPONENTS.reduce((sum, component) => sum + component.rate, 0);

export type BusinessLaunchState = 'setupIncomplete' | 'readyToLaunch' | 'live';

export function isBusinessProfileCoreComplete(profile: BusinessProfile) {
  return Boolean(
    profile.businessName.trim() &&
      profile.businessType.trim() &&
      profile.country.trim() &&
      profile.currency.trim() &&
      profile.phone.trim() &&
      profile.email.trim() &&
      profile.address.trim() &&
      profile.receiptPrefix.trim() &&
      profile.invoicePrefix.trim()
  );
}

export function isBusinessSetupComplete(profile: BusinessProfile) {
  return Boolean(isBusinessProfileCoreComplete(profile));
}

export function isBusinessWorkspaceLive(profile: BusinessProfile) {
  return Boolean(isBusinessSetupComplete(profile) && profile.launchedAt);
}

export function getBusinessLaunchState(profile: BusinessProfile): BusinessLaunchState {
  if (!isBusinessSetupComplete(profile)) {
    return 'setupIncomplete';
  }

  if (!profile.launchedAt) {
    return 'readyToLaunch';
  }

  return 'live';
}

function normalizeWorkflowStatus<T extends string>(status: T) {
  return status.trim().toLowerCase();
}

export function isQuotationConverted(status: Quotation['status']) {
  return normalizeWorkflowStatus(status) === 'converted';
}

export function isQuotationDraftLike(status: Quotation['status']) {
  const normalized = normalizeWorkflowStatus(status);
  return normalized === 'draft' || normalized === 'open' || normalized === 'approved';
}

export function getQuotationLifecycleStatus(
  quotation: Pick<Quotation, 'status' | 'validUntil'>
): Exclude<Quotation['status'], 'Draft' | 'Converted'> {
  if (normalizeWorkflowStatus(quotation.status) === 'draft' && quotation.status === 'Draft') {
    return 'draft';
  }

  if (normalizeWorkflowStatus(quotation.status) === 'converted') {
    return 'converted';
  }

  if (quotation.validUntil) {
    const validUntilTime = new Date(quotation.validUntil).getTime();
    if (Number.isFinite(validUntilTime) && validUntilTime < Date.now() && isQuotationDraftLike(quotation.status)) {
      return 'expired';
    }
  }

  return normalizeWorkflowStatus(quotation.status) as Exclude<Quotation['status'], 'Draft' | 'Converted'>;
}

export function calculatePurchaseTotal(items: PurchaseItem[]) {
  return Number(items.reduce((sum, item) => sum + item.totalCost, 0).toFixed(2));
}

export function calculatePayableBalance(amountDue: number, amountPaid: number) {
  return Number(Math.max(0, amountDue - amountPaid).toFixed(2));
}

export function resolveAccountsPayableStatus(payable: Pick<AccountsPayable, 'status' | 'amountDue' | 'amountPaid' | 'balance' | 'dueDate'>): AccountsPayableStatus {
  const normalizedStatus = payable.status;

  if (normalizedStatus === 'cancelled') {
    return normalizedStatus;
  }

  const balance = calculatePayableBalance(payable.amountDue, payable.amountPaid);
  if (balance === 0 && payable.amountDue > 0) {
    return 'paid';
  }

  if (payable.amountPaid > 0 && balance > 0) {
    return 'partiallyPaid';
  }

  if (payable.dueDate && new Date(payable.dueDate).getTime() < Date.now() && balance > 0 && normalizedStatus !== 'pendingReview') {
    return 'overdue';
  }

  return normalizedStatus;
}

function normalizeVendorName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

function normalizeEmail(value?: string) {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized || undefined;
}

function findActiveVendor(current: BusinessState, vendorId: string) {
  const vendor = current.vendors.find((item) => item.id === vendorId);
  if (!vendor) {
    return { ok: false as const, message: 'Select a valid vendor.' };
  }
  if (vendor.status !== 'active') {
    return { ok: false as const, message: 'Inactive vendors cannot be used for new purchases.' };
  }
  return { ok: true as const, vendor };
}

export function normalizeTaxComponents(components?: TaxComponent[]): TaxComponent[] {
  const source = components && components.length > 0 ? components : GHANA_STANDARD_TAX_COMPONENTS;
  const seen = new Set<string>();

  return source.map((component, index) => {
    const rawKey = component.key?.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || `component-${index + 1}`;
    const key = seen.has(rawKey) ? `${rawKey}-${index + 1}` : rawKey;
    seen.add(key);

    return {
      key,
      label: component.label?.trim() || `Tax component ${index + 1}`,
      rate: Number.isFinite(component.rate) ? Number(component.rate) : 0,
      enabled: component.enabled ?? true,
    };
  });
}

export function calculateTaxComponentTotalRate(components?: TaxComponent[]) {
  return Number(normalizeTaxComponents(components)
    .filter((component) => component.enabled !== false)
    .reduce((sum, component) => sum + component.rate, 0)
    .toFixed(4));
}

export function buildTaxSnapshot(
  profile: BusinessProfile,
  options?: { exempt?: boolean; exemptionReason?: string }
): TaxSnapshot | undefined {
  if (!profile.taxEnabled || !profile.applyTaxByDefault) {
    return undefined;
  }

  const exemptionReason = options?.exemptionReason?.trim();
  const components = normalizeTaxComponents(profile.taxComponents);
  const enabledComponents = components.filter((component) => component.enabled !== false);
  return {
    enabled: true,
    preset: profile.taxPreset || 'ghana-standard',
    mode: profile.taxMode || 'exclusive',
    totalRate: calculateTaxComponentTotalRate(components),
    components: enabledComponents.map((component) => ({ ...component })),
    exempt: options?.exempt || undefined,
    exemptionReason: options?.exempt && exemptionReason ? exemptionReason : undefined,
  };
}

export function calculateTaxTotals(lineSubtotal: number, taxSnapshot?: TaxSnapshot) {
  if (!taxSnapshot?.enabled || taxSnapshot.exempt) {
    return {
      subtotalAmount: Number(lineSubtotal.toFixed(2)),
      taxAmount: 0,
      totalAmount: Number(lineSubtotal.toFixed(2)),
      hasTax: Boolean(taxSnapshot?.enabled),
    };
  }

  const rateFactor = taxSnapshot.totalRate / 100;
  if (taxSnapshot.mode === 'inclusive') {
    const subtotalAmount = lineSubtotal / (1 + rateFactor);
    const taxAmount = lineSubtotal - subtotalAmount;

    return {
      subtotalAmount: Number(subtotalAmount.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      totalAmount: Number(lineSubtotal.toFixed(2)),
      hasTax: true,
    };
  }

  const taxAmount = lineSubtotal * rateFactor;
  return {
    subtotalAmount: Number(lineSubtotal.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    totalAmount: Number((lineSubtotal + taxAmount).toFixed(2)),
    hasTax: true,
  };
}

export function buildWithholdingTaxSnapshot(
  profile: BusinessProfile,
  taxTotals: { subtotalAmount: number; totalAmount: number },
  applyWithholdingTax?: boolean
): WithholdingTaxSnapshot | undefined {
  if (!profile.withholdingTaxEnabled || applyWithholdingTax === false) {
    return undefined;
  }

  const rate = profile.defaultWithholdingTaxRate ?? 0;
  if (!Number.isFinite(rate) || rate <= 0) {
    return undefined;
  }

  const basis = profile.defaultWithholdingTaxBasis ?? 'taxInclusiveTotal';
  const basisAmount = basis === 'subtotal' || basis === 'taxExclusiveSubtotal'
    ? taxTotals.subtotalAmount
    : taxTotals.totalAmount;
  const amount = Number((basisAmount * (rate / 100)).toFixed(2));

  return {
    enabled: true,
    rate,
    label: profile.defaultWithholdingTaxLabel?.trim() || 'Withholding Tax',
    basis,
    amount,
  };
}

export function isActiveSale(sale: Sale) {
  return sale.status !== 'Reversed';
}

function createStockMovement(
  current: BusinessState,
  partial: Omit<StockMovement, 'id' | 'movementNumber'>
): StockMovement {
  return {
    id: `sm-${crypto.randomUUID()}`,
    movementNumber: nextStockMovementNumber(current.stockMovements),
    ...partial,
    sourceType: partial.sourceType ?? undefined,
    sourceId: partial.sourceId ?? undefined,
    vendorId: partial.vendorId ?? undefined,
    vendorCode: partial.vendorCode ?? undefined,
    fromWarehouseId: partial.fromWarehouseId ?? undefined,
    toStoreId: partial.toStoreId ?? undefined,
    performedBy: partial.performedBy ?? 'system',
  };
}

function normalizeLocationType(type: BusinessLocationType): BusinessLocationType | null {
  return type === 'store' || type === 'warehouse' ? type : null;
}

function createDefaultLocation(): BusinessLocation {
  return {
    id: DEFAULT_LOCATION_ID,
    locationCode: DEFAULT_LOCATION_CODE,
    name: DEFAULT_LOCATION_NAME,
    type: 'store',
    address: undefined,
    managerName: undefined,
    linkedWarehouseId: undefined,
    isDefault: true,
    isActive: true,
  };
}

export function ensureDefaultLocation(locations?: BusinessLocation[]): BusinessLocation[] {
  const source = locations && locations.length > 0 ? locations : [createDefaultLocation()];
  const firstUsableDefault = source.find((location) => location.isDefault && location.isActive) ?? source.find((location) => location.isActive) ?? source[0];

  let nextStoreSequence = 1;
  let nextWarehouseSequence = 1;

  return source.map((location) => {
    const normalizedType = normalizeLocationType(location.type) ?? 'store';
    const fallbackCode =
      normalizedType === 'warehouse'
        ? `WH-${String(nextWarehouseSequence++).padStart(4, '0')}`
        : `ST-${String(nextStoreSequence++).padStart(4, '0')}`;

    return {
      ...location,
      locationCode: location.locationCode?.trim() || fallbackCode,
      address: location.address?.trim() || undefined,
      managerName: location.managerName?.trim() || undefined,
      linkedWarehouseId: location.linkedWarehouseId?.trim() || undefined,
      type: normalizedType,
      isActive: location.isActive ?? true,
      isDefault: location.id === firstUsableDefault.id,
    };
  });
}

function buildTransferActivityEntry(
  current: BusinessState,
  transfer: StockTransfer,
  actionType: 'transfer_created' | 'transfer_approved' | 'transfer_dispatched' | 'transfer_received' | 'transfer_cancelled',
  detail: string,
  createdAt: string
) {
  return createActivityLogEntry(current, {
    entityType: 'business',
    entityId: transfer.id,
    actionType,
    title: `Transfer ${actionType.replace('transfer_', '')}`,
    detail,
    status: actionType === 'transfer_cancelled' ? 'warning' : 'success',
    createdAt,
    referenceNumber: transfer.transferCode,
    relatedEntityId: transfer.id,
  });
}

export function resolveDefaultLocationId(state: BusinessState) {
  return ensureDefaultLocation(state.locations).find((location) => location.isDefault)?.id ?? DEFAULT_LOCATION_ID;
}

function findUsableLocation(current: BusinessState, locationId?: string) {
  const resolvedLocationId = locationId?.trim() || resolveDefaultLocationId(current);
  const location = ensureDefaultLocation(current.locations).find((item) => item.id === resolvedLocationId);

  if (!location) {
    return { ok: false as const, message: 'Selected location could not be found.' };
  }

  if (!location.isActive) {
    return { ok: false as const, message: 'Selected location is inactive.' };
  }

  return { ok: true as const, location };
}

function validateSupplyRouteLocations(current: BusinessState, fromLocationId: string, toLocationId: string) {
  const from = findUsableLocation(current, fromLocationId);
  if (!from.ok) {
    return { ok: false as const, message: `Source ${from.message.toLowerCase()}` };
  }

  const to = findUsableLocation(current, toLocationId);
  if (!to.ok) {
    return { ok: false as const, message: `Destination ${to.message.toLowerCase()}` };
  }

  if (from.location.id === to.location.id) {
    return { ok: false as const, message: 'Source and destination must be different locations.' };
  }

  if (from.location.type !== 'warehouse') {
    return { ok: false as const, message: 'Supply routes must start from a warehouse.' };
  }

  if (to.location.type !== 'store') {
    return { ok: false as const, message: 'Supply routes must deliver to a store.' };
  }

  return { ok: true as const, from: from.location, to: to.location };
}

function createLedgerEntry(
  current: BusinessState,
  partial: Omit<CustomerLedgerEntry, 'id' | 'entryNumber'>
): CustomerLedgerEntry {
  return {
    id: `led-${crypto.randomUUID()}`,
    entryNumber: nextLedgerEntryNumber(current.customerLedgerEntries),
    ...partial,
  };
}

function createActivityLogEntry(
  current: BusinessState,
  partial: Omit<ActivityLogEntry, 'id' | 'activityNumber'>
): ActivityLogEntry {
  return {
    id: `act-${crypto.randomUUID()}`,
    activityNumber: nextActivityNumber(current.activityLogEntries),
    ...partial,
  };
}

function createAppNotification(input: Omit<AppNotification, 'id' | 'readByUserIds'>): AppNotification {
  return {
    id: crypto.randomUUID(),
    readByUserIds: [],
    ...input,
  };
}

function toSaleAuditEvents(activityEntries: ActivityLogEntry[]): SaleAuditEvent[] {
  return activityEntries
    .filter((entry) =>
      ['invoice_created', 'receipt_issued', 'invoice_reversed', 'corrected_copy_created'].includes(entry.actionType)
    )
    .map((entry) => ({
      id: entry.id,
      saleId: entry.relatedSaleId ?? entry.entityId,
      invoiceNumber: entry.referenceNumber ?? '',
      actionType:
        entry.actionType === 'invoice_created'
          ? 'created'
          : entry.actionType === 'receipt_issued'
            ? 'receipt_issued'
            : entry.actionType === 'invoice_reversed'
              ? 'reversed'
              : 'corrected_copy_created',
      reason: entry.detail,
      timestamp: entry.createdAt,
      relatedSaleId: entry.relatedEntityId,
    }));
}

function ensureBusinessProfile(profile?: Partial<BusinessProfile>): BusinessProfile {
  return {
    id: profile?.id ?? 'biz-001',
    businessName: profile?.businessName?.trim() || '',
    businessType: profile?.businessType?.trim() || 'General Retail',
    currency: profile?.currency?.trim() || 'GHS',
    country: profile?.country?.trim() || 'Ghana',
    receiptPrefix: profile?.receiptPrefix?.trim() || 'RCP-',
    invoicePrefix: profile?.invoicePrefix?.trim() || 'INV-',
    phone: profile?.phone?.trim() || '',
    email: profile?.email?.trim() || '',
    logoUrl: profile?.logoUrl ?? undefined,
    signatureUrl: profile?.signatureUrl ?? undefined,
    address: profile?.address?.trim() || '',
    website: profile?.website?.trim() || '',
    waybillPrefix: profile?.waybillPrefix?.trim() || 'WAY-',
    inventoryCategoriesEnabled: profile?.inventoryCategoriesEnabled ?? false,
    customerClassificationEnabled: profile?.customerClassificationEnabled ?? false,
    taxEnabled: profile?.taxEnabled ?? false,
    taxPreset: profile?.taxPreset ?? 'ghana-standard',
    taxMode: profile?.taxMode ?? 'exclusive',
    applyTaxByDefault: profile?.applyTaxByDefault ?? true,
    taxComponents: normalizeTaxComponents(profile?.taxComponents),
    withholdingTaxEnabled: profile?.withholdingTaxEnabled ?? false,
    defaultWithholdingTaxRate: profile?.defaultWithholdingTaxRate ?? 0,
    defaultWithholdingTaxLabel: profile?.defaultWithholdingTaxLabel?.trim() || 'Withholding Tax',
    defaultWithholdingTaxBasis: profile?.defaultWithholdingTaxBasis ?? 'taxInclusiveTotal',
    launchedAt: profile?.launchedAt?.trim() || undefined,
  };
}

function normalizeCategoryName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

function normalizeCategoryDescription(description?: string) {
  const value = description?.trim() ?? '';
  return value || undefined;
}

function normalizeCustomerType(
  enabled: boolean,
  customerType?: Customer['customerType']
): ActionResult<Customer['customerType'] | undefined> {
  const value = customerType?.trim();

  if (!enabled || !value) {
    return { ok: true, data: undefined };
  }

  if (value === 'B2B' || value === 'B2C') {
    return { ok: true, data: value };
  }

  return { ok: false, message: 'Customer type must be either B2B or B2C.' };
}

function buildCategorySlug(name: string) {
  return normalizeCategoryName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'category';
}

function categoryNameExists(categories: ProductCategory[], name: string, excludeCategoryId?: string) {
  const normalized = normalizeCategoryName(name).toLowerCase();
  return categories.some(
    (category) =>
      category.id !== excludeCategoryId && normalizeCategoryName(category.name).toLowerCase() === normalized
  );
}

function buildUniqueCategorySlug(categories: ProductCategory[], name: string, excludeCategoryId?: string) {
  const baseSlug = buildCategorySlug(name);
  let slug = baseSlug;
  let suffix = 2;

  while (categories.some((category) => category.id !== excludeCategoryId && category.slug === slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

function findUsableProductCategory(current: BusinessState, categoryId?: string) {
  if (!categoryId) {
    return { ok: true as const, category: undefined };
  }

  if (!current.businessProfile.inventoryCategoriesEnabled) {
    return { ok: false as const, message: 'Enable inventory categories before assigning a category to a product.' };
  }

  const category = current.productCategories.find((item) => item.id === categoryId);
  if (!category) {
    return { ok: false as const, message: 'Selected product category could not be found in this business.' };
  }

  if (!category.isActive) {
    return { ok: false as const, message: 'Selected product category is inactive. Reactivate it or choose another category.' };
  }

  return { ok: true as const, category };
}

function normalizeParentCategoryId(current: BusinessState, parentCategoryId?: string, categoryId?: string) {
  const normalizedParentId = parentCategoryId?.trim() || undefined;
  if (!normalizedParentId) {
    return { ok: true as const, parentCategoryId: undefined };
  }

  if (normalizedParentId === categoryId) {
    return { ok: false as const, message: 'A category cannot be its own parent.' };
  }

  const parentCategory = current.productCategories.find((category) => category.id === normalizedParentId);
  if (!parentCategory) {
    return { ok: false as const, message: 'Parent category could not be found in this business.' };
  }

  if (parentCategory.parentCategoryId && parentCategory.parentCategoryId === categoryId) {
    return { ok: false as const, message: 'Nested category loops are not allowed.' };
  }

  return { ok: true as const, parentCategoryId: normalizedParentId };
}

function migrateStockMovements(products: Array<Product & { quantity?: number }>, sales: Sale[]): StockMovement[] {
  const activeSales = sales.filter(isActiveSale);
  const movements: StockMovement[] = [];

  products.forEach((product, index) => {
    const currentQuantity = product.quantity ?? 0;
    const activeQuantitySold = activeSales
      .filter((sale) => sale.productId === product.id)
      .reduce((sum, sale) => sum + sale.quantity, 0);

    movements.push({
      id: `sm-migrated-opening-${index + 1}`,
      movementNumber: `SMV-${String(index + 1).padStart(3, '0')}`,
      productId: product.id,
      locationId: DEFAULT_LOCATION_ID,
      type: 'opening',
      quantityDelta: currentQuantity + activeQuantitySold,
      quantityAfter: currentQuantity + activeQuantitySold,
      createdAt: new Date(0).toISOString(),
      sourceType: 'adjustment',
      sourceId: product.id,
      performedBy: 'system',
      note: 'Opening stock migrated from legacy local state',
      referenceNumber: 'OPENING',
    });
  });

  let sequence = movements.length;

  const chronologicalSales = [...sales].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  const runningQuantities = new Map<string, number>();

  movements.forEach((movement) => {
    runningQuantities.set(movement.productId, movement.quantityAfter);
  });

  chronologicalSales.forEach((sale) => {
    const currentQuantity = runningQuantities.get(sale.productId) ?? 0;
    const afterSale = currentQuantity - sale.quantity;
    sequence += 1;
    movements.push({
      id: `sm-migrated-sale-${sequence}`,
      movementNumber: `SMV-${String(sequence).padStart(3, '0')}`,
      productId: sale.productId,
      locationId: DEFAULT_LOCATION_ID,
      type: 'sale',
      quantityDelta: -sale.quantity,
      quantityAfter: afterSale,
      createdAt: sale.createdAt,
      relatedSaleId: sale.id,
      referenceNumber: sale.receiptId,
      sourceType: 'sale',
      sourceId: sale.id,
      toStoreId: DEFAULT_LOCATION_ID,
      performedBy: 'system',
      note: 'Migrated sale stock movement',
    });
    runningQuantities.set(sale.productId, afterSale);

    if (sale.status === 'Reversed') {
      const restored = afterSale + sale.quantity;
      sequence += 1;
      movements.push({
        id: `sm-migrated-reversal-${sequence}`,
        movementNumber: `SMV-${String(sequence).padStart(3, '0')}`,
        productId: sale.productId,
        locationId: DEFAULT_LOCATION_ID,
        type: 'reversal',
        quantityDelta: sale.quantity,
        quantityAfter: restored,
        createdAt: sale.reversedAt ?? sale.createdAt,
        relatedSaleId: sale.id,
        referenceNumber: sale.receiptId,
        sourceType: 'sale',
        sourceId: sale.id,
        toStoreId: DEFAULT_LOCATION_ID,
        performedBy: 'system',
        note: 'Migrated sale reversal stock movement',
      });
      runningQuantities.set(sale.productId, restored);
    }
  });

  return movements;
}

function migrateLedgerEntries(
  customers: Array<Customer & { balance?: number; lastPayment?: string }>,
  sales: Sale[]
): CustomerLedgerEntry[] {
  const entries: CustomerLedgerEntry[] = [];
  let sequence = 0;

  const pushEntry = (entry: Omit<CustomerLedgerEntry, 'id' | 'entryNumber'>) => {
    sequence += 1;
    entries.push({
      id: `led-migrated-${sequence}`,
      entryNumber: `LED-${String(sequence).padStart(3, '0')}`,
      ...entry,
    });
  };

  const activeSales = sales.filter(isActiveSale);

  customers.forEach((customer) => {
    const derivedOutstanding = activeSales
      .filter((sale) => sale.customerId === customer.id)
      .reduce((sum, sale) => sum + Math.max(0, (sale.netReceivableAmount ?? sale.totalAmount) - sale.paidAmount), 0);
    const targetBalance = customer.balance ?? derivedOutstanding;
    const difference = targetBalance - derivedOutstanding;

    if (difference !== 0) {
      pushEntry({
        customerId: customer.id,
        type: 'opening_balance',
        amountDelta: difference,
        createdAt: new Date(0).toISOString(),
        referenceNumber: 'OPENING',
        note: 'Opening balance migrated from legacy local state',
      });
    }
  });

  [...sales]
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    .forEach((sale) => {
      pushEntry({
        customerId: sale.customerId,
        type: 'sale_charge',
        amountDelta: sale.totalAmount,
        createdAt: sale.createdAt,
        relatedSaleId: sale.id,
        referenceNumber: sale.invoiceNumber,
        note: 'Migrated invoice charge',
      });

      if (sale.paidAmount > 0) {
        pushEntry({
          customerId: sale.customerId,
          type: 'payment_received',
          amountDelta: -sale.paidAmount,
          createdAt: sale.createdAt,
          relatedSaleId: sale.id,
          referenceNumber: sale.receiptId,
          paymentMethod: sale.paymentMethod,
          note: 'Migrated payment received',
        });
      }

      if (sale.status === 'Reversed') {
        pushEntry({
          customerId: sale.customerId,
          type: 'reversal',
          amountDelta: -Math.max(0, (sale.netReceivableAmount ?? sale.totalAmount) - sale.paidAmount),
          createdAt: sale.reversedAt ?? sale.createdAt,
          relatedSaleId: sale.id,
          referenceNumber: sale.invoiceNumber,
          note: sale.reversalReason || 'Migrated invoice reversal',
        });
      }
    });

  return entries;
}

function migrateActivityEntries(sales: Sale[], legacyAuditEvents?: SaleAuditEvent[]): ActivityLogEntry[] {
  if (legacyAuditEvents && legacyAuditEvents.length > 0) {
    return legacyAuditEvents.map((event, index) => ({
      id: event.id ?? `act-migrated-${index + 1}`,
      activityNumber: `ACT-${String(index + 1).padStart(3, '0')}`,
      entityType: 'sale',
      entityId: event.saleId,
      actionType:
        event.actionType === 'created'
          ? 'invoice_created'
          : event.actionType === 'receipt_issued'
            ? 'receipt_issued'
            : event.actionType === 'reversed'
              ? 'invoice_reversed'
              : 'corrected_copy_created',
      title:
        event.actionType === 'created'
          ? 'Invoice created'
          : event.actionType === 'receipt_issued'
            ? 'Receipt issued'
            : event.actionType === 'reversed'
              ? 'Invoice reversed'
              : 'Correction invoice created',
      detail: event.reason,
      status: event.actionType === 'reversed' ? 'warning' : 'success',
      createdAt: event.timestamp,
      referenceNumber: event.invoiceNumber,
      relatedEntityId: event.relatedSaleId,
      relatedSaleId: event.saleId,
    }));
  }

  const activities: ActivityLogEntry[] = [];
  let sequence = 0;

  [...sales]
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    .forEach((sale) => {
      sequence += 1;
      activities.push({
        id: `act-migrated-${sequence}`,
        activityNumber: `ACT-${String(sequence).padStart(3, '0')}`,
        entityType: 'sale',
        entityId: sale.id,
        actionType: 'invoice_created',
        title: 'Invoice created',
        detail: 'Migrated invoice entry',
        status: 'success',
        createdAt: sale.createdAt,
        referenceNumber: sale.invoiceNumber,
        relatedSaleId: sale.id,
      });
      sequence += 1;
      activities.push({
        id: `act-migrated-${sequence}`,
        activityNumber: `ACT-${String(sequence).padStart(3, '0')}`,
        entityType: 'sale',
        entityId: sale.id,
        actionType: 'receipt_issued',
        title: 'Receipt issued',
        detail: 'Migrated receipt event',
        status: 'success',
        createdAt: sale.createdAt,
        referenceNumber: sale.receiptId,
        relatedSaleId: sale.id,
      });
    });

  return activities;
}

export function restoreBusinessState(state: BusinessState | Record<string, unknown>): BusinessState {
  const raw = state as BusinessState & {
    products?: Array<Product & { quantity?: number }>;
    customers?: Array<Customer & { balance?: number; lastPayment?: string }>;
    saleAuditEvents?: SaleAuditEvent[];
    notifications?: AppNotification[];
  };

  const businessProfile = ensureBusinessProfile(raw.businessProfile);
  const products = (raw.products ?? []).map((product, index) => ({
    ...product,
    inventoryId: product.inventoryId ?? `INV-${String(index + 1).padStart(3, '0')}`,
    image: product.image ?? createProductImage(product.name ?? `Item ${index + 1}`),
  }));
  const productCategories = (raw.productCategories ?? []).map((category, index) => {
    const typedCategory = category as ProductCategory;

    return {
      id: typedCategory.id ?? `pc-${index + 1}`,
      name: typedCategory.name,
      slug: typedCategory.slug,
      description: typedCategory.description ?? undefined,
      parentCategoryId: typedCategory.parentCategoryId ?? undefined,
      sortOrder: typedCategory.sortOrder ?? index,
      isActive: typedCategory.isActive ?? true,
    };
  });
  const customers = (raw.customers ?? []).map((customer, index) => ({
    id: customer.id ?? `c${index + 1}`,
    clientId: customer.clientId ?? `CLT-${String(index + 1).padStart(3, '0')}`,
    name: customer.name,
    phone: customer.phone ?? '',
    whatsapp: customer.whatsapp ?? '',
    email: customer.email ?? '',
    channel: customer.channel ?? 'No action needed',
    status: customer.status ?? 'active',
    customerType: customer.customerType ?? undefined,
    taxExempt: customer.taxExempt ?? false,
    taxExemptionReason: customer.taxExemptionReason ?? undefined,
    terminatedAt: customer.terminatedAt ?? undefined,
    terminationReason: customer.terminationReason ?? undefined,
  }));
  const sales = (raw.sales ?? []).map((sale, index) => ({
    ...sale,
    receiptId: sale.receiptId ?? nextReceiptId((raw.sales ?? []).slice(0, index) as Sale[], businessProfile.receiptPrefix),
    invoiceNumber:
      sale.invoiceNumber ?? nextInvoiceNumber((raw.sales ?? []).slice(0, index) as Sale[], businessProfile.invoicePrefix),
    status: sale.status ?? 'Completed',
    customerTypeSnapshot: sale.customerTypeSnapshot ?? undefined,
    subtotalAmount: sale.subtotalAmount ?? undefined,
    taxAmount: sale.taxAmount ?? undefined,
    taxSnapshot: sale.taxSnapshot ?? undefined,
    withholdingTaxAmount: sale.withholdingTaxAmount ?? undefined,
    netReceivableAmount: sale.netReceivableAmount ?? undefined,
    withholdingTaxSnapshot: sale.withholdingTaxSnapshot ?? undefined,
  }));
  const quotations = (raw.quotations ?? []).map((quotation, index) => ({
    ...quotation,
    quotationNumber: quotation.quotationNumber ?? `QTN-${String(index + 1).padStart(3, '0')}`,
    status: quotation.status ?? 'Draft',
    validUntil: quotation.validUntil ?? undefined,
    rejectionReason: quotation.rejectionReason ?? undefined,
    convertedInvoiceId: quotation.convertedInvoiceId ?? undefined,
    customerType: quotation.customerType ?? undefined,
    customerTypeSnapshot: quotation.customerTypeSnapshot ?? undefined,
    subtotalAmount: quotation.subtotalAmount ?? undefined,
    taxAmount: quotation.taxAmount ?? undefined,
    taxSnapshot: quotation.taxSnapshot ?? undefined,
    withholdingTaxAmount: quotation.withholdingTaxAmount ?? undefined,
    netReceivableAmount: quotation.netReceivableAmount ?? undefined,
    withholdingTaxSnapshot: quotation.withholdingTaxSnapshot ?? undefined,
  }));
  const locations = ensureDefaultLocation(raw.locations);
  const locationSupplyRoutes = (raw.locationSupplyRoutes ?? []).map((route) => ({
    id: route.id,
    fromLocationId: route.fromLocationId,
    toLocationId: route.toLocationId,
    isActive: route.isActive ?? true,
  }));
  const stockMovements =
    raw.stockMovements && raw.stockMovements.length > 0
      ? raw.stockMovements.map((movement) => ({
          ...movement,
          locationId: movement.locationId ?? locations.find((location) => location.isDefault)?.id ?? DEFAULT_LOCATION_ID,
          transferId: movement.transferId ?? undefined,
          fromLocationId: movement.fromLocationId ?? undefined,
          toLocationId: movement.toLocationId ?? undefined,
          sourceType: movement.sourceType ?? undefined,
          sourceId: movement.sourceId ?? undefined,
          vendorId: movement.vendorId ?? undefined,
          vendorCode: movement.vendorCode ?? undefined,
          fromWarehouseId: movement.fromWarehouseId ?? undefined,
          toStoreId: movement.toStoreId ?? undefined,
          performedBy: movement.performedBy ?? 'system',
        }))
      : migrateStockMovements(products as Array<Product & { quantity?: number }>, sales);
  const customerLedgerEntries =
    raw.customerLedgerEntries && raw.customerLedgerEntries.length > 0
      ? raw.customerLedgerEntries
      : migrateLedgerEntries(raw.customers ?? [], sales);
  const activityLogEntries =
    raw.activityLogEntries && raw.activityLogEntries.length > 0
      ? raw.activityLogEntries
      : migrateActivityEntries(sales, raw.saleAuditEvents);
  const users = (raw.users ?? seedState.users).map((user) => ({
    ...user,
    accountStatus: user.accountStatus ?? 'active',
    deactivatedAt: user.deactivatedAt ?? undefined,
    roleLabel: user.roleLabel?.trim() || undefined,
    grantedPermissions: user.grantedPermissions ?? [],
    revokedPermissions: user.revokedPermissions ?? [],
  }));
  const vendors = (raw.vendors ?? []).map((vendor, index) => ({
    id: vendor.id ?? `v${index + 1}`,
    vendorCode: vendor.vendorCode ?? nextVendorCode((raw.vendors ?? []).slice(0, index) as Vendor[]),
    name: vendor.name,
    contactEmail: vendor.contactEmail?.trim() || undefined,
    location: vendor.location?.trim() || '',
    status: vendor.status ?? 'active',
    createdAt: vendor.createdAt ?? new Date(0).toISOString(),
    updatedAt: vendor.updatedAt ?? vendor.createdAt ?? new Date(0).toISOString(),
  }));
  const purchases = (raw.purchases ?? []).map((purchase, index) => ({
    ...purchase,
    purchaseCode: purchase.purchaseCode ?? nextPurchaseCode((raw.purchases ?? []).slice(0, index) as Purchase[]),
    items: (purchase.items ?? []).map((item) => ({
      ...item,
      totalCost: Number((item.totalCost ?? item.quantity * item.unitCost).toFixed(2)),
    })),
    totalAmount: Number((purchase.totalAmount ?? calculatePurchaseTotal(purchase.items ?? [])).toFixed(2)),
    declinedBy: purchase.declinedBy ?? undefined,
    declinedAt: purchase.declinedAt ?? undefined,
    declineNote: purchase.declineNote ?? undefined,
    createdAt: purchase.createdAt ?? new Date(0).toISOString(),
    updatedAt: purchase.updatedAt ?? purchase.createdAt ?? new Date(0).toISOString(),
  }));
  const accountsPayable = (raw.accountsPayable ?? []).map((payable, index) => {
    const normalized = {
      ...payable,
      payableCode: payable.payableCode ?? nextPayableCode((raw.accountsPayable ?? []).slice(0, index) as AccountsPayable[]),
      amountDue: Number(payable.amountDue ?? 0),
      amountPaid: Number(payable.amountPaid ?? 0),
      createdAt: payable.createdAt ?? new Date(0).toISOString(),
      updatedAt: payable.updatedAt ?? payable.createdAt ?? new Date(0).toISOString(),
    };

    const balance = payable.balance ?? calculatePayableBalance(normalized.amountDue, normalized.amountPaid);
    return {
      ...normalized,
      balance,
      status: resolveAccountsPayableStatus({ ...normalized, balance }),
    };
  });
  const stockTransfers = (raw.stockTransfers ?? []).map((transfer, index) => ({
    ...transfer,
    transferCode: transfer.transferCode ?? nextTransferCode((raw.stockTransfers ?? []).slice(0, index) as StockTransfer[]),
    items: transfer.items ?? [],
    status: transfer.status ?? 'pending',
    initiatedBy: transfer.initiatedBy ?? 'system',
    approvedBy: transfer.approvedBy ?? undefined,
    dispatchedBy: transfer.dispatchedBy ?? undefined,
    receivedBy: transfer.receivedBy ?? undefined,
    createdAt: transfer.createdAt ?? new Date(0).toISOString(),
    approvedAt: transfer.approvedAt ?? undefined,
    dispatchedAt: transfer.dispatchedAt ?? undefined,
    receivedAt: transfer.receivedAt ?? undefined,
    cancelledAt: transfer.cancelledAt ?? undefined,
  }));
  const payments = (raw.payments ?? []).map((payment, index) => ({
    ...payment,
    paymentCode: payment.paymentCode ?? nextPaymentCode((raw.payments ?? []).slice(0, index) as Payment[]),
    reference: payment.reference ?? undefined,
    recordedBy: payment.recordedBy ?? 'system',
    createdAt: payment.createdAt ?? new Date(0).toISOString(),
  }));

  return {
    businessProfile,
    locations,
    locationSupplyRoutes,
    products,
    productCategories,
    customers,
    vendors,
    purchases,
    accountsPayable,
    stockTransfers,
    payments,
    sales,
    quotations,
    stockMovements,
    customerLedgerEntries,
    activityLogEntries,
    notifications: (raw.notifications ?? []).map((notification) => ({
      ...notification,
      recipientUserIds: notification.recipientUserIds ?? undefined,
      recipientRoles: notification.recipientRoles ?? undefined,
      readByUserIds: notification.readByUserIds ?? [],
      actionUrl: notification.actionUrl ?? undefined,
      referenceNumber: notification.referenceNumber ?? undefined,
    })),
    users,
    currentUserId: raw.currentUserId ?? seedState.currentUserId,
    restockRequests: raw.restockRequests ?? [],
    expenses: raw.expenses ?? [],
    themePreference: raw.themePreference ?? 'system',
  };
}

export function addProductToState(current: BusinessState, input: NewProductInput): ActionResult<BusinessState> {
  const name = input.name.trim();
  const unit = input.unit.trim();
  const manualInventoryId = input.inventoryId?.trim() ?? '';
  const inventoryId = manualInventoryId || nextInventoryId(current.products);
  const categoryId = input.categoryId?.trim() || undefined;
  const locationCheck = findUsableLocation(current, input.locationId);

  if (!name) {
    return { ok: false, message: 'Item name is required.' };
  }

  if (!unit) {
    return { ok: false, message: 'Unit is required.' };
  }

  if (!Number.isFinite(input.price) || input.price < 0) {
    return { ok: false, message: 'Selling price must be a valid number.' };
  }

  if (!Number.isFinite(input.cost) || input.cost < 0) {
    return { ok: false, message: 'Cost must be a valid number.' };
  }

  if (!Number.isFinite(input.reorderLevel) || input.reorderLevel < 0) {
    return { ok: false, message: 'Reorder level must be a valid number.' };
  }

  if (!Number.isFinite(input.quantity) || input.quantity < 0) {
    return { ok: false, message: 'Opening quantity must be a valid number.' };
  }

  if (current.products.some((product) => product.inventoryId.trim() === inventoryId)) {
    return { ok: false, message: 'Inventory ID already exists. Please choose another one.' };
  }

  const categoryCheck = findUsableProductCategory(current, categoryId);
  if (!categoryCheck.ok) {
    return { ok: false, message: categoryCheck.message };
  }
  if (!locationCheck.ok) {
    return { ok: false, message: locationCheck.message };
  }

  const product: Product = {
    id: `p${crypto.randomUUID()}`,
    name,
    unit,
    price: input.price,
    cost: input.cost,
    reorderLevel: input.reorderLevel,
    inventoryId,
    image: input.image || createProductImage(name),
    categoryId,
  };
  const createdAt = new Date().toISOString();
  const stockMovements =
    input.quantity > 0
      ? [
          createStockMovement(current, {
            productId: product.id,
            locationId: locationCheck.location.id,
            type: 'opening',
            quantityDelta: input.quantity,
            quantityAfter: input.quantity,
            createdAt,
            referenceNumber: 'OPENING',
            sourceType: 'adjustment',
            sourceId: product.id,
            toStoreId: locationCheck.location.type === 'store' ? locationCheck.location.id : undefined,
            fromWarehouseId: locationCheck.location.type === 'warehouse' ? locationCheck.location.id : undefined,
            performedBy: 'system',
            note: 'Opening stock loaded for new item',
          }),
          ...current.stockMovements,
        ]
      : current.stockMovements;
  const activityLogEntries = [
    createActivityLogEntry(current, {
      entityType: 'product',
      entityId: product.id,
      actionType: 'product_created',
      title: 'Product created',
      detail: `${product.name} was added to inventory.`,
      status: 'success',
      createdAt,
      referenceNumber: product.inventoryId,
    }),
    ...current.activityLogEntries,
  ];

  return {
    ok: true,
    data: {
      ...current,
      products: [product, ...current.products],
      stockMovements,
      activityLogEntries,
    },
  };
}

export function addCustomerToState(current: BusinessState, input: NewCustomerInput): ActionResult<BusinessState> {
  const name = input.name.trim();
  const channel = input.channel.trim();
  const manualClientId = input.clientId?.trim() ?? '';
  const clientId = manualClientId || nextClientId(current.customers);
  const customerTypeResult = normalizeCustomerType(current.businessProfile.customerClassificationEnabled, input.customerType);

  if (!name) {
    return { ok: false, message: 'Customer name is required.' };
  }

  if (!channel) {
    return { ok: false, message: 'Follow-up channel is required.' };
  }

  if (current.customers.some((customer) => customer.clientId.trim() === clientId)) {
    return { ok: false, message: 'Client ID already exists. Please choose another one.' };
  }

  if (!customerTypeResult.ok) {
    return customerTypeResult;
  }

  const customer: Customer = {
    id: `c${crypto.randomUUID()}`,
    name,
    phone: input.phone?.trim() || '',
    whatsapp: input.whatsapp?.trim() || '',
    email: input.email?.trim() || '',
    channel,
    clientId,
    status: 'active',
    customerType: customerTypeResult.data,
    taxExempt: current.businessProfile.taxEnabled ? input.taxExempt ?? false : undefined,
    taxExemptionReason: current.businessProfile.taxEnabled && input.taxExempt ? input.taxExemptionReason?.trim() || undefined : undefined,
  };
  const createdAt = new Date().toISOString();

  return {
    ok: true,
    data: {
      ...current,
      customers: [customer, ...current.customers],
      activityLogEntries: [
        createActivityLogEntry(current, {
          entityType: 'customer',
          entityId: customer.id,
          actionType: 'customer_created',
          title: 'Customer created',
          detail: `${customer.name} was added to the customer list.`,
          status: 'success',
          createdAt,
          referenceNumber: customer.clientId,
        }),
        ...current.activityLogEntries,
      ],
    },
  };
}

export function updateCustomerInState(current: BusinessState, input: UpdateCustomerInput): ActionResult<BusinessState> {
  const name = input.name.trim();
  const channel = input.channel.trim();
  const customerTypeResult = normalizeCustomerType(current.businessProfile.customerClassificationEnabled, input.customerType);

  if (!name) {
    return { ok: false, message: 'Customer name is required.' };
  }

  if (!channel) {
    return { ok: false, message: 'Follow-up channel is required.' };
  }

  if (!customerTypeResult.ok) {
    return customerTypeResult;
  }

  const existingCustomer = current.customers.find((customer) => customer.id === input.customerId);

  if (!existingCustomer) {
    return { ok: false, message: 'The selected customer could not be found.' };
  }

  const updatedCustomer: Customer = {
    ...existingCustomer,
    name,
    phone: input.phone?.trim() || '',
    whatsapp: input.whatsapp?.trim() || '',
    email: input.email?.trim() || '',
    channel,
    customerType: current.businessProfile.customerClassificationEnabled
      ? customerTypeResult.data
      : existingCustomer.customerType,
    taxExempt: current.businessProfile.taxEnabled
      ? input.taxExempt ?? false
      : existingCustomer.taxExempt,
    taxExemptionReason: current.businessProfile.taxEnabled && input.taxExempt
      ? input.taxExemptionReason?.trim() || undefined
      : current.businessProfile.taxEnabled
        ? undefined
        : existingCustomer.taxExemptionReason,
  };
  const createdAt = new Date().toISOString();

  return {
    ok: true,
    data: {
      ...current,
      customers: current.customers.map((customer) => (customer.id === input.customerId ? updatedCustomer : customer)),
      activityLogEntries: [
        createActivityLogEntry(current, {
          entityType: 'customer',
          entityId: updatedCustomer.id,
          actionType: 'customer_updated',
          title: 'Customer details updated',
          detail: `${updatedCustomer.name}'s contact details were updated.`,
          status: 'info',
          createdAt,
          referenceNumber: updatedCustomer.clientId,
        }),
        ...current.activityLogEntries,
      ],
    },
  };
}

export function updateCustomerStatusInState(current: BusinessState, input: UpdateCustomerStatusInput): ActionResult<BusinessState> {
  const existingCustomer = current.customers.find((customer) => customer.id === input.customerId);

  if (!existingCustomer) {
    return { ok: false, message: 'The selected customer could not be found.' };
  }

  if (existingCustomer.status === input.status) {
    return {
      ok: false,
      message: input.status === 'terminated' ? 'This customer account is already terminated.' : 'This customer account is already active.',
    };
  }

  const now = new Date().toISOString();
  const terminationReason = input.terminationReason?.trim() || '';

  if (input.status === 'terminated' && !terminationReason) {
    return { ok: false, message: 'Please provide a short reason before terminating this customer account.' };
  }

  const updatedCustomer: Customer = {
    ...existingCustomer,
    status: input.status,
    terminatedAt: input.status === 'terminated' ? now : undefined,
    terminationReason: input.status === 'terminated' ? terminationReason : undefined,
  };

  return {
    ok: true,
    data: {
      ...current,
      customers: current.customers.map((customer) => (customer.id === input.customerId ? updatedCustomer : customer)),
      activityLogEntries: [
        createActivityLogEntry(current, {
          entityType: 'customer',
          entityId: updatedCustomer.id,
          actionType: input.status === 'terminated' ? 'customer_terminated' : 'customer_reactivated',
          title: input.status === 'terminated' ? 'Customer account terminated' : 'Customer account reactivated',
          detail:
            input.status === 'terminated'
              ? `${updatedCustomer.name} was marked as terminated. Historical records remain preserved.`
              : `${updatedCustomer.name} was restored to the active customer list.`,
          status: input.status === 'terminated' ? 'warning' : 'success',
          createdAt: now,
          referenceNumber: updatedCustomer.clientId,
        }),
        ...current.activityLogEntries,
      ],
    },
  };
}

export function updateBusinessProfileInState(current: BusinessState, input: UpdateBusinessProfileInput): ActionResult<BusinessState> {
  const businessName = input.businessName.trim();
  const businessType = input.businessType?.trim() || '';
  const currency = input.currency.trim();
  const country = input.country.trim();
  const receiptPrefix = input.receiptPrefix.trim();
  const invoicePrefix = input.invoicePrefix.trim();
  const waybillPrefix = input.waybillPrefix?.trim() || 'WAY-';

  if (!businessName || !currency || !country || !receiptPrefix || !invoicePrefix) {
    return { ok: false, message: 'Business name, country, currency, and document prefixes are required.' };
  }

  const updatedProfile: BusinessProfile = {
    ...current.businessProfile,
    ...input,
    businessName,
    businessType,
    currency,
    country,
    receiptPrefix,
    invoicePrefix,
    waybillPrefix,
    phone: input.phone.trim(),
    email: input.email.trim(),
    address: input.address.trim(),
    inventoryCategoriesEnabled: input.inventoryCategoriesEnabled ?? current.businessProfile.inventoryCategoriesEnabled,
    customerClassificationEnabled:
      input.customerClassificationEnabled ?? current.businessProfile.customerClassificationEnabled,
    taxEnabled: input.taxEnabled ?? current.businessProfile.taxEnabled,
    taxPreset: input.taxPreset ?? current.businessProfile.taxPreset,
    taxMode: input.taxMode ?? current.businessProfile.taxMode,
    applyTaxByDefault: input.applyTaxByDefault ?? current.businessProfile.applyTaxByDefault,
    taxComponents: normalizeTaxComponents(input.taxComponents ?? current.businessProfile.taxComponents),
    withholdingTaxEnabled: input.withholdingTaxEnabled ?? current.businessProfile.withholdingTaxEnabled,
    defaultWithholdingTaxRate: input.defaultWithholdingTaxRate ?? current.businessProfile.defaultWithholdingTaxRate,
    defaultWithholdingTaxLabel: input.defaultWithholdingTaxLabel ?? current.businessProfile.defaultWithholdingTaxLabel,
    defaultWithholdingTaxBasis: input.defaultWithholdingTaxBasis ?? current.businessProfile.defaultWithholdingTaxBasis,
  };
  const createdAt = new Date().toISOString();

  return {
    ok: true,
    data: {
      ...current,
      businessProfile: updatedProfile,
      activityLogEntries: [
        createActivityLogEntry(current, {
          entityType: 'business',
          entityId: current.businessProfile.id,
          actionType: 'business_profile_updated',
          title: 'Business settings updated',
          detail: 'Business profile details were updated locally.',
          status: 'info',
          createdAt,
          referenceNumber: updatedProfile.businessName,
        }),
        ...current.activityLogEntries,
      ],
    },
  };
}

export function launchBusinessWorkspaceInState(
  current: BusinessState,
  input: LaunchBusinessWorkspaceInput = {}
): ActionResult<BusinessState> {
  if (!isBusinessSetupComplete(current.businessProfile)) {
    return {
      ok: false,
      message: 'Complete the business setup and upload the company logo before launching the workspace.',
    };
  }

  if (current.businessProfile.launchedAt) {
    return { ok: false, message: 'This business has already been launched.' };
  }

  const launchedAt = input.launchedAt ?? new Date().toISOString();

  return {
    ok: true,
    data: {
      ...current,
      businessProfile: {
        ...current.businessProfile,
        launchedAt,
      },
      activityLogEntries: [
        createActivityLogEntry(current, {
          entityType: 'business',
          entityId: current.businessProfile.id,
          actionType: 'business_profile_updated',
          title: 'Business launched',
          detail: 'The workspace was officially opened for assigned staff and role-based dashboards.',
          status: 'success',
          createdAt: launchedAt,
          referenceNumber: current.businessProfile.businessName,
        }),
        ...current.activityLogEntries,
      ],
    },
  };
}

export function createProductCategoryInState(current: BusinessState, input: CreateProductCategoryInput): ActionResult<BusinessState> {
  const name = normalizeCategoryName(input.name);
  const description = normalizeCategoryDescription(input.description);
  const parentCategoryResult = normalizeParentCategoryId(current, input.parentCategoryId);

  if (!name) {
    return { ok: false, message: 'Category name is required.' };
  }

  if (categoryNameExists(current.productCategories, name)) {
    return { ok: false, message: 'A category with that name already exists in this business.' };
  }

  if (!parentCategoryResult.ok) {
    return { ok: false, message: parentCategoryResult.message };
  }

  const sortOrder =
    current.productCategories.reduce((highest, category) => Math.max(highest, category.sortOrder), -1) + 1;
  const category: ProductCategory = {
    id: `pc-${crypto.randomUUID()}`,
    name,
    slug: buildUniqueCategorySlug(current.productCategories, name),
    description,
    parentCategoryId: parentCategoryResult.parentCategoryId,
    sortOrder,
    isActive: true,
  };

  return {
    ok: true,
    data: {
      ...current,
      productCategories: [...current.productCategories, category],
    },
  };
}

export function updateProductCategoryInState(current: BusinessState, input: UpdateProductCategoryInput): ActionResult<BusinessState> {
  const existingCategory = current.productCategories.find((category) => category.id === input.categoryId);
  if (!existingCategory) {
    return { ok: false, message: 'Product category not found.' };
  }

  const name = normalizeCategoryName(input.name);
  const description = normalizeCategoryDescription(input.description);
  const parentCategoryResult = normalizeParentCategoryId(current, input.parentCategoryId, existingCategory.id);

  if (!name) {
    return { ok: false, message: 'Category name is required.' };
  }

  if (categoryNameExists(current.productCategories, name, existingCategory.id)) {
    return { ok: false, message: 'A category with that name already exists in this business.' };
  }

  if (!parentCategoryResult.ok) {
    return { ok: false, message: parentCategoryResult.message };
  }

  const updatedCategory: ProductCategory = {
    ...existingCategory,
    name,
    slug: buildUniqueCategorySlug(current.productCategories, name, existingCategory.id),
    description,
    parentCategoryId: parentCategoryResult.parentCategoryId,
  };

  return {
    ok: true,
    data: {
      ...current,
      productCategories: current.productCategories.map((category) =>
        category.id === existingCategory.id ? updatedCategory : category
      ),
    },
  };
}

export function setProductCategoryActiveInState(current: BusinessState, input: SetProductCategoryActiveInput): ActionResult<BusinessState> {
  const existingCategory = current.productCategories.find((category) => category.id === input.categoryId);
  if (!existingCategory) {
    return { ok: false, message: 'Product category not found.' };
  }

  if (existingCategory.isActive === input.isActive) {
    return {
      ok: false,
      message: input.isActive ? 'This category is already active.' : 'This category is already inactive.',
    };
  }

  return {
    ok: true,
    data: {
      ...current,
      productCategories: current.productCategories.map((category) =>
        category.id === existingCategory.id ? { ...category, isActive: input.isActive } : category
      ),
    },
  };
}

export function setInventoryCategoriesEnabledInState(
  current: BusinessState,
  input: SetInventoryCategoriesEnabledInput
): ActionResult<BusinessState> {
  if (current.businessProfile.inventoryCategoriesEnabled === input.enabled) {
    return {
      ok: false,
      message: input.enabled
        ? 'Inventory categories are already enabled.'
        : 'Inventory categories are already disabled.',
    };
  }

  return {
    ok: true,
    data: {
      ...current,
      businessProfile: {
        ...current.businessProfile,
        inventoryCategoriesEnabled: input.enabled,
      },
    },
  };
}

export function createBusinessLocationInState(current: BusinessState, input: CreateBusinessLocationInput): ActionResult<BusinessState> {
  const name = input.name.trim().replace(/\s+/g, ' ');
  const type = normalizeLocationType(input.type);

  if (!name) {
    return { ok: false, message: 'Location name is required.' };
  }

  if (!type) {
    return { ok: false, message: 'Choose a valid location type.' };
  }

  if (current.locations.some((location) => location.name.trim().toLowerCase() === name.toLowerCase())) {
    return { ok: false, message: 'A location with that name already exists.' };
  }

  const locationCode = type === 'warehouse' ? nextWarehouseCode(current.locations) : nextStoreCode(current.locations);
  const location: BusinessLocation = {
    id: crypto.randomUUID(),
    locationCode,
    name,
    type,
    isDefault: Boolean(input.isDefault),
    isActive: true,
  };

  const nextLocations = ensureDefaultLocation([
    ...current.locations.map((item) => input.isDefault ? { ...item, isDefault: false } : item),
    location,
  ]);

  return {
    ok: true,
    data: {
      ...current,
      locations: nextLocations,
    },
  };
}

export function updateBusinessLocationInState(current: BusinessState, input: UpdateBusinessLocationInput): ActionResult<BusinessState> {
  const existing = current.locations.find((location) => location.id === input.locationId);
  const name = input.name.trim().replace(/\s+/g, ' ');
  const type = normalizeLocationType(input.type);

  if (!existing) {
    return { ok: false, message: 'Location not found.' };
  }

  if (!name) {
    return { ok: false, message: 'Location name is required.' };
  }

  if (!type) {
    return { ok: false, message: 'Choose a valid location type.' };
  }

  if (current.locations.some((location) => location.id !== existing.id && location.name.trim().toLowerCase() === name.toLowerCase())) {
    return { ok: false, message: 'A location with that name already exists.' };
  }

  const nextLocations = current.locations.map((location) => {
    if (location.id !== existing.id) {
      return input.isDefault ? { ...location, isDefault: false } : location;
    }

    return {
      ...location,
      name,
      type,
      locationCode:
        type === location.type && location.locationCode
          ? location.locationCode
          : type === 'warehouse'
            ? nextWarehouseCode(current.locations.filter((item) => item.id !== location.id))
            : nextStoreCode(current.locations.filter((item) => item.id !== location.id)),
      isDefault: input.isDefault ?? location.isDefault,
      isActive: input.isActive ?? location.isActive,
    };
  });

  return {
    ok: true,
    data: {
      ...current,
      locations: ensureDefaultLocation(nextLocations),
    },
  };
}

export function createSupplyRouteInState(current: BusinessState, input: CreateSupplyRouteInput): ActionResult<BusinessState> {
  const validation = validateSupplyRouteLocations(current, input.fromLocationId, input.toLocationId);
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  const existing = current.locationSupplyRoutes.find((route) =>
    route.fromLocationId === validation.from.id && route.toLocationId === validation.to.id
  );

  if (existing) {
    return { ok: false, message: 'That supply route already exists.' };
  }

  const route: LocationSupplyRoute = {
    id: crypto.randomUUID(),
    fromLocationId: validation.from.id,
    toLocationId: validation.to.id,
    isActive: true,
  };

  return {
    ok: true,
    data: {
      ...current,
      locationSupplyRoutes: [route, ...current.locationSupplyRoutes],
    },
  };
}

export function setSupplyRouteActiveInState(current: BusinessState, input: SetSupplyRouteActiveInput): ActionResult<BusinessState> {
  const route = current.locationSupplyRoutes.find((item) => item.id === input.routeId);
  if (!route) {
    return { ok: false, message: 'Supply route not found.' };
  }

  return {
    ok: true,
    data: {
      ...current,
      locationSupplyRoutes: current.locationSupplyRoutes.map((item) =>
        item.id === input.routeId ? { ...item, isActive: input.isActive } : item
      ),
    },
  };
}

export function createVendorInState(current: BusinessState, input: CreateVendorInput): ActionResult<BusinessState> {
  const name = normalizeVendorName(input.name);
  const location = input.location.trim();
  const contactEmail = normalizeEmail(input.contactEmail);
  const vendorCode = input.vendorCode?.trim() || nextVendorCode(current.vendors);

  if (!name) return { ok: false, message: 'Vendor name is required.' };
  if (!location) return { ok: false, message: 'Vendor location is required.' };
  if (current.vendors.some((vendor) => vendor.vendorCode.toLowerCase() === vendorCode.toLowerCase())) {
    return { ok: false, message: 'Vendor code already exists.' };
  }

  const createdAt = new Date().toISOString();
  const vendor: Vendor = {
    id: crypto.randomUUID(),
    vendorCode,
    name,
    contactEmail,
    location,
    status: 'active',
    createdAt,
    updatedAt: createdAt,
  };

  return {
    ok: true,
    data: {
      ...current,
      vendors: [vendor, ...current.vendors],
      activityLogEntries: [
        createActivityLogEntry(current, {
          entityType: 'business',
          entityId: vendor.id,
          actionType: 'vendor_created',
          title: 'Vendor created',
          detail: `${vendor.name} was added as a supplier.`,
          status: 'success',
          createdAt,
          referenceNumber: vendor.vendorCode,
        }),
        ...current.activityLogEntries,
      ],
    },
  };
}

export function updateVendorInState(current: BusinessState, input: UpdateVendorInput): ActionResult<BusinessState> {
  const existing = current.vendors.find((vendor) => vendor.id === input.vendorId);
  if (!existing) return { ok: false, message: 'Vendor not found.' };

  const name = normalizeVendorName(input.name);
  const location = input.location.trim();
  const vendorCode = input.vendorCode.trim();
  const contactEmail = normalizeEmail(input.contactEmail);

  if (!name || !location || !vendorCode) {
    return { ok: false, message: 'Vendor code, name, and location are required.' };
  }
  if (current.vendors.some((vendor) => vendor.id !== input.vendorId && vendor.vendorCode.toLowerCase() === vendorCode.toLowerCase())) {
    return { ok: false, message: 'Vendor code already exists.' };
  }

  const updatedAt = new Date().toISOString();
  const updatedVendor: Vendor = { ...existing, vendorCode, name, contactEmail, location, updatedAt };

  return {
    ok: true,
    data: {
      ...current,
      vendors: current.vendors.map((vendor) => (vendor.id === existing.id ? updatedVendor : vendor)),
      activityLogEntries: [
        createActivityLogEntry(current, {
          entityType: 'business',
          entityId: existing.id,
          actionType: 'vendor_updated',
          title: 'Vendor updated',
          detail: `${updatedVendor.name} supplier details were updated.`,
          status: 'info',
          createdAt: updatedAt,
          referenceNumber: updatedVendor.vendorCode,
        }),
        ...current.activityLogEntries,
      ],
    },
  };
}

export function setVendorStatusInState(current: BusinessState, input: SetVendorStatusInput): ActionResult<BusinessState> {
  const existing = current.vendors.find((vendor) => vendor.id === input.vendorId);
  if (!existing) return { ok: false, message: 'Vendor not found.' };

  const updatedAt = new Date().toISOString();
  const updatedVendor: Vendor = { ...existing, status: input.status, updatedAt };

  return {
    ok: true,
    data: {
      ...current,
      vendors: current.vendors.map((vendor) => (vendor.id === existing.id ? updatedVendor : vendor)),
      activityLogEntries: [
        createActivityLogEntry(current, {
          entityType: 'business',
          entityId: existing.id,
          actionType: input.status === 'inactive' ? 'vendor_deactivated' : 'vendor_updated',
          title: input.status === 'inactive' ? 'Vendor deactivated' : 'Vendor activated',
          detail: `${updatedVendor.name} is now ${input.status}.`,
          status: input.status === 'inactive' ? 'warning' : 'success',
          createdAt: updatedAt,
          referenceNumber: updatedVendor.vendorCode,
        }),
        ...current.activityLogEntries,
      ],
    },
  };
}

export function createPurchaseDraftInState(current: BusinessState, input: CreatePurchaseDraftInput): ActionResult<BusinessState> {
  const vendorCheck = findActiveVendor(current, input.vendorId);
  if (!vendorCheck.ok) return vendorCheck;
  if (!input.items.length) return { ok: false, message: 'Add at least one line item to the purchase.' };

  const items: PurchaseItem[] = [];
  for (const item of input.items) {
    const product = current.products.find((candidate) => candidate.id === item.productId);
    if (!product) return { ok: false, message: 'Choose a valid product for each purchase line.' };
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) return { ok: false, message: `Quantity for ${product.name} must be greater than zero.` };
    if (!Number.isFinite(item.unitCost) || item.unitCost < 0) return { ok: false, message: `Unit cost for ${product.name} must be a valid number.` };

    items.push({
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: Number((item.quantity * item.unitCost).toFixed(2)),
      vendorCode: vendorCheck.vendor.vendorCode,
    });
  }

  const createdAt = new Date().toISOString();
  const purchase: Purchase = {
    id: crypto.randomUUID(),
    purchaseCode: nextPurchaseCode(current.purchases),
    vendorId: vendorCheck.vendor.id,
    vendorCode: vendorCheck.vendor.vendorCode,
    items,
    totalAmount: calculatePurchaseTotal(items),
    status: 'draft',
    createdBy: input.createdBy,
    createdAt,
    updatedAt: createdAt,
  };

  return {
    ok: true,
    data: {
      ...current,
      purchases: [purchase, ...current.purchases],
      activityLogEntries: [
        createActivityLogEntry(current, {
          entityType: 'business',
          entityId: purchase.id,
          actionType: 'purchase_created',
          title: 'Purchase draft created',
          detail: `${purchase.purchaseCode} was created for ${vendorCheck.vendor.name}.`,
          status: 'info',
          createdAt,
          referenceNumber: purchase.purchaseCode,
        }),
        ...current.activityLogEntries,
      ],
    },
  };
}

export function submitPurchaseInState(current: BusinessState, input: PurchaseActionInput): ActionResult<BusinessState> {
  const purchase = current.purchases.find((item) => item.id === input.purchaseId);
  if (!purchase) return { ok: false, message: 'Purchase not found.' };
  if (purchase.status !== 'draft') return { ok: false, message: 'Only draft purchases can be submitted.' };

  const submittedAt = new Date().toISOString();
  const updatedPurchase: Purchase = { ...purchase, status: 'submitted', submittedAt, updatedAt: submittedAt };

  return {
    ok: true,
    data: {
      ...current,
      purchases: current.purchases.map((item) => (item.id === purchase.id ? updatedPurchase : item)),
      activityLogEntries: [
        createActivityLogEntry(current, {
          entityType: 'business',
          entityId: purchase.id,
          actionType: 'purchase_submitted',
          title: 'Purchase submitted',
          detail: `${purchase.purchaseCode} was submitted for review.`,
          status: 'success',
          createdAt: submittedAt,
          referenceNumber: purchase.purchaseCode,
        }),
        ...current.activityLogEntries,
      ],
    },
  };
}

export function createPayableFromPurchaseInState(current: BusinessState, input: CreatePayableInput): ActionResult<BusinessState> {
  const purchase = current.purchases.find((item) => item.id === input.purchaseId);
  if (!purchase) return { ok: false, message: 'Purchase not found.' };
  if (current.accountsPayable.some((entry) => entry.purchaseId === purchase.id && entry.status !== 'cancelled')) {
    return { ok: false, message: 'A payable already exists for this purchase.' };
  }

  const createdAt = new Date().toISOString();
  const payable: AccountsPayable = {
    id: crypto.randomUUID(),
    payableCode: nextPayableCode(current.accountsPayable),
    vendorId: purchase.vendorId,
    vendorCode: purchase.vendorCode,
    purchaseId: purchase.id,
    amountDue: purchase.totalAmount,
    amountPaid: 0,
    balance: purchase.totalAmount,
    dueDate: input.dueDate?.trim() || undefined,
    status: 'pendingReview',
    createdBy: input.createdBy,
    createdAt,
    updatedAt: createdAt,
  };

  return {
    ok: true,
    data: {
      ...current,
      accountsPayable: [payable, ...current.accountsPayable],
      activityLogEntries: [
        createActivityLogEntry(current, {
          entityType: 'business',
          entityId: payable.id,
          actionType: 'payable_created',
          title: 'Payable created',
          detail: `${payable.payableCode} was created from ${purchase.purchaseCode}.`,
          status: 'success',
          createdAt,
          referenceNumber: payable.payableCode,
        }),
        ...current.activityLogEntries,
      ],
    },
  };
}

export function approvePurchaseInState(current: BusinessState, input: PurchaseActionInput): ActionResult<BusinessState> {
  const purchase = current.purchases.find((item) => item.id === input.purchaseId);
  if (!purchase) return { ok: false, message: 'Purchase not found.' };
  if (purchase.status !== 'submitted' && purchase.status !== 'adminReviewed') {
    return { ok: false, message: 'Only submitted purchases can be approved.' };
  }

  const approvedAt = new Date().toISOString();
  const updatedPurchase: Purchase = {
    ...purchase,
    status: 'approved',
    approvedBy: input.performedBy,
    approvedAt,
    updatedAt: approvedAt,
  };

  let nextState: BusinessState = {
    ...current,
    purchases: current.purchases.map((item) => (item.id === purchase.id ? updatedPurchase : item)),
    activityLogEntries: [
      createActivityLogEntry(current, {
        entityType: 'business',
        entityId: purchase.id,
        actionType: 'purchase_approved',
        title: 'Purchase approved',
        detail: `${purchase.purchaseCode} was approved for warehouse receipt.`,
        status: 'success',
        createdAt: approvedAt,
        referenceNumber: purchase.purchaseCode,
      }),
      ...current.activityLogEntries,
    ],
  };

  if (!nextState.accountsPayable.some((entry) => entry.purchaseId === purchase.id && entry.status !== 'cancelled')) {
    const payableResult = createPayableFromPurchaseInState(nextState, {
      purchaseId: purchase.id,
      createdBy: input.performedBy,
    });
    if (payableResult.ok && payableResult.data) {
      nextState = payableResult.data;
    }
  }

  const payable = nextState.accountsPayable.find((entry) => entry.purchaseId === purchase.id && entry.status !== 'cancelled');
  nextState = {
    ...nextState,
    notifications: [
      createAppNotification({
        title: 'Purchase order approved',
        message: `${purchase.purchaseCode} was approved. Accounting can now continue with ${payable?.payableCode ?? 'the supplier payable'}.`,
        createdAt: approvedAt,
        recipientUserIds: [purchase.createdBy],
        entityType: 'purchase',
        entityId: purchase.id,
        referenceNumber: purchase.purchaseCode,
        actionUrl: '/inventory?section=procurement',
      }),
      createAppNotification({
        title: 'Approved purchase ready for accounting',
        message: `${purchase.purchaseCode} was approved and ${payable?.payableCode ?? 'a supplier payable'} is ready for accounting work.`,
        createdAt: approvedAt,
        recipientRoles: ['Accountant'],
        entityType: 'payable',
        entityId: payable?.id ?? purchase.id,
        referenceNumber: payable?.payableCode ?? purchase.purchaseCode,
        actionUrl: '/accounting?segment=payables',
      }),
      ...nextState.notifications,
    ],
  };

  return { ok: true, data: nextState };
}

export function cancelPurchaseInState(current: BusinessState, input: PurchaseActionInput): ActionResult<BusinessState> {
  const purchase = current.purchases.find((item) => item.id === input.purchaseId);
  if (!purchase) return { ok: false, message: 'Purchase not found.' };
  if (purchase.status === 'receivedToWarehouse') return { ok: false, message: 'Received purchases cannot be cancelled.' };
  if (purchase.status === 'cancelled' || purchase.status === 'declined') return { ok: false, message: 'This purchase is already closed.' };

  const updatedAt = new Date().toISOString();
  const declineNote = input.note?.trim();
  const updatedPurchase: Purchase = {
    ...purchase,
    status: 'declined',
    declinedBy: input.performedBy,
    declinedAt: updatedAt,
    declineNote,
    updatedAt,
  };

  return {
    ok: true,
    data: {
      ...current,
      purchases: current.purchases.map((item) => (item.id === purchase.id ? updatedPurchase : item)),
      notifications: [
        createAppNotification({
          title: 'Purchase order declined',
          message: `${purchase.purchaseCode} was declined.${declineNote ? ` Note: ${declineNote}` : ''}`,
          createdAt: updatedAt,
          recipientUserIds: [purchase.createdBy],
          entityType: 'purchase',
          entityId: purchase.id,
          referenceNumber: purchase.purchaseCode,
          actionUrl: '/inventory?section=procurement',
        }),
        ...current.notifications,
      ],
      activityLogEntries: [
        createActivityLogEntry(current, {
          entityType: 'business',
          entityId: purchase.id,
          actionType: 'purchase_declined',
          title: 'Purchase declined',
          detail: `${purchase.purchaseCode} was declined before receipt.${declineNote ? ` Note: ${declineNote}` : ''}`,
          status: 'warning',
          createdAt: updatedAt,
          referenceNumber: purchase.purchaseCode,
        }),
        ...current.activityLogEntries,
      ],
    },
  };
}

export function receivePurchaseInWarehouseInState(current: BusinessState, input: ReceivePurchaseInput): ActionResult<BusinessState> {
  const purchase = current.purchases.find((item) => item.id === input.purchaseId);
  if (!purchase) return { ok: false, message: 'Purchase not found.' };
  if (purchase.status === 'cancelled' || purchase.status === 'declined') return { ok: false, message: 'Closed purchases cannot be received.' };
  if (purchase.status === 'receivedToWarehouse') return { ok: false, message: 'This purchase has already been received.' };
  if (purchase.status !== 'approved') return { ok: false, message: 'Only approved purchases can be received into warehouse.' };

  const warehouseCheck = findUsableLocation(current, input.warehouseId);
  if (!warehouseCheck.ok) return { ok: false, message: warehouseCheck.message };
  if (warehouseCheck.location.type !== 'warehouse') return { ok: false, message: 'Choose a warehouse location for receipt.' };

  const receivedAt = new Date().toISOString();
  const requestedQuantities = new Map((input.receivedItems ?? []).map((item) => [item.productId, item.quantity]));
  let workingState = current;

  for (const item of purchase.items) {
    const quantity = requestedQuantities.get(item.productId) ?? item.quantity;
    if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, message: `Received quantity for ${item.productName} must be greater than zero.` };
    if (quantity > item.quantity) return { ok: false, message: `Received quantity for ${item.productName} cannot exceed ordered quantity.` };

    const quantityOnHand = selectProductQuantityOnHand(workingState, item.productId, warehouseCheck.location.id);
    const movement = createStockMovement(workingState, {
      productId: item.productId,
      locationId: warehouseCheck.location.id,
      type: 'purchase',
      quantityDelta: quantity,
      quantityAfter: quantityOnHand + quantity,
      createdAt: receivedAt,
      referenceNumber: purchase.purchaseCode,
      sourceType: 'purchase',
      sourceId: purchase.id,
      vendorId: purchase.vendorId,
      vendorCode: purchase.vendorCode,
      fromWarehouseId: warehouseCheck.location.id,
      performedBy: input.performedBy,
      note: `Purchase receipt for ${purchase.purchaseCode}`,
    });
    workingState = { ...workingState, stockMovements: [movement, ...workingState.stockMovements] };
  }

  const updatedPurchase: Purchase = {
    ...purchase,
    status: 'receivedToWarehouse',
    receivedWarehouseId: warehouseCheck.location.id,
    updatedAt: receivedAt,
  };

  return {
    ok: true,
    data: {
      ...workingState,
      purchases: current.purchases.map((item) => (item.id === purchase.id ? updatedPurchase : item)),
      activityLogEntries: [
        createActivityLogEntry(current, {
          entityType: 'business',
          entityId: purchase.id,
          actionType: 'purchase_received',
          title: 'Purchase received',
          detail: `${purchase.purchaseCode} was received into ${warehouseCheck.location.name}.`,
          status: 'success',
          createdAt: receivedAt,
          referenceNumber: purchase.purchaseCode,
        }),
        ...current.activityLogEntries,
      ],
    },
  };
}

export function approvePayableInState(current: BusinessState, input: ApprovePayableInput): ActionResult<BusinessState> {
  const payable = current.accountsPayable.find((item) => item.id === input.payableId);
  if (!payable) return { ok: false, message: 'Payable not found.' };
  if (payable.status !== 'pendingReview') return { ok: false, message: 'Only pending payables can be approved.' };

  const updatedAt = new Date().toISOString();
  const updatedPayable: AccountsPayable = { ...payable, status: 'approved', approvedBy: input.approvedBy, updatedAt };

  return {
    ok: true,
    data: {
      ...current,
      accountsPayable: current.accountsPayable.map((item) => (item.id === payable.id ? updatedPayable : item)),
      activityLogEntries: [
        createActivityLogEntry(current, {
          entityType: 'business',
          entityId: payable.id,
          actionType: 'payable_approved',
          title: 'Payable approved',
          detail: `${payable.payableCode} is ready for settlement.`,
          status: 'success',
          createdAt: updatedAt,
          referenceNumber: payable.payableCode,
        }),
        ...current.activityLogEntries,
      ],
    },
  };
}

export function recordPayablePaymentInState(current: BusinessState, input: RecordPayablePaymentInput): ActionResult<BusinessState> {
  const payable = current.accountsPayable.find((item) => item.id === input.payableId);
  if (!payable) return { ok: false, message: 'Payable not found.' };
  if (!['approved', 'partiallyPaid', 'overdue'].includes(payable.status)) {
    return { ok: false, message: 'Approve the payable before recording a payment.' };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { ok: false, message: 'Payment amount must be greater than zero.' };
  if (input.amount > payable.balance) return { ok: false, message: 'Payment cannot exceed the remaining payable balance.' };

  const createdAt = new Date().toISOString();
  const amountPaid = Number((payable.amountPaid + input.amount).toFixed(2));
  const balance = calculatePayableBalance(payable.amountDue, amountPaid);
  const updatedPayable: AccountsPayable = {
    ...payable,
    amountPaid,
    balance,
    status: resolveAccountsPayableStatus({
      ...payable,
      amountDue: payable.amountDue,
      amountPaid,
      balance,
      status: balance === 0 ? 'paid' : 'partiallyPaid',
    }),
    paymentMethod: input.method,
    paymentReference: input.reference?.trim() || undefined,
    paidBy: input.paidBy,
    paidAt: createdAt,
    updatedAt: createdAt,
  };

  const payment: Payment = {
    id: crypto.randomUUID(),
    paymentCode: nextPaymentCode(current.payments),
    sourceType: 'payable',
    sourceId: payable.id,
    amount: input.amount,
    method: input.method,
    reference: input.reference?.trim() || undefined,
    recordedBy: input.paidBy,
    createdAt,
  };

  return {
    ok: true,
    data: {
      ...current,
      accountsPayable: current.accountsPayable.map((item) => (item.id === payable.id ? updatedPayable : item)),
      payments: [payment, ...current.payments],
      activityLogEntries: [
        createActivityLogEntry(current, {
          entityType: 'business',
          entityId: payable.id,
          actionType: 'payable_paid',
          title: balance === 0 ? 'Payable settled' : 'Payable partly paid',
          detail: `${input.amount} was recorded against ${payable.payableCode}.`,
          status: 'success',
          createdAt,
          referenceNumber: payable.payableCode,
        }),
        ...current.activityLogEntries,
      ],
    },
  };
}

function validateTransferDraft(current: BusinessState, input: CreateStockTransferInput) {
  const routeValidation = validateSupplyRouteLocations(current, input.fromWarehouseId, input.toStoreId);
  if (!routeValidation.ok) {
    return { ok: false as const, message: routeValidation.message };
  }

  if (!input.items.length) {
    return { ok: false as const, message: 'Add at least one item before creating a transfer.' };
  }

  const normalizedItems: StockTransfer['items'] = [];

  for (const item of input.items) {
    const product = current.products.find((candidate) => candidate.id === item.productId);
    if (!product) {
      return { ok: false as const, message: 'Choose a valid product for every transfer line.' };
    }

    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false as const, message: `Transfer quantity for ${product.name} must be greater than zero.` };
    }

    const availableQuantity = selectProductQuantityOnHand(current, product.id, routeValidation.from.id);
    if (quantity > availableQuantity) {
      return { ok: false as const, message: `${product.name} only has ${availableQuantity} available in ${routeValidation.from.name}.` };
    }

    normalizedItems.push({
      productId: product.id,
      productName: product.name,
      quantity,
    });
  }

  return {
    ok: true as const,
    from: routeValidation.from,
    to: routeValidation.to,
    items: normalizedItems,
  };
}

function findTransferOrError(current: BusinessState, transferId: string) {
  const transfer = (current.stockTransfers ?? []).find((item) => item.id === transferId);
  if (!transfer) {
    return { ok: false as const, message: 'Transfer not found.' };
  }

  return { ok: true as const, transfer };
}

export function createStockTransferInState(current: BusinessState, input: CreateStockTransferInput): ActionResult<BusinessState> {
  const validation = validateTransferDraft(current, input);
  if (!validation.ok) {
    return validation;
  }

  const createdAt = new Date().toISOString();
  const transfer: StockTransfer = {
    id: crypto.randomUUID(),
    transferCode: nextTransferCode(current.stockTransfers ?? []),
    fromWarehouseId: validation.from.id,
    toStoreId: validation.to.id,
    items: validation.items,
    status: 'pending',
    initiatedBy: input.initiatedBy,
    createdAt,
  };

  return {
    ok: true,
    data: {
      ...current,
      stockTransfers: [transfer, ...(current.stockTransfers ?? [])],
      activityLogEntries: [
        buildTransferActivityEntry(
          current,
          transfer,
          'transfer_created',
          `${transfer.transferCode} created for ${validation.from.name} to ${validation.to.name}.`,
          createdAt
        ),
        ...current.activityLogEntries,
      ],
    },
  };
}

export function approveStockTransferInState(current: BusinessState, input: StockTransferActionInput): ActionResult<BusinessState> {
  const transferResult = findTransferOrError(current, input.transferId);
  if (!transferResult.ok) {
    return transferResult;
  }

  const { transfer } = transferResult;
  if (transfer.status !== 'pending') {
    return { ok: false, message: 'Only pending transfers can be approved.' };
  }

  const approvedAt = new Date().toISOString();
  const updatedTransfer: StockTransfer = {
    ...transfer,
    status: 'approved',
    approvedBy: input.performedBy,
    approvedAt,
  };

  return {
    ok: true,
    data: {
      ...current,
      stockTransfers: current.stockTransfers.map((item) => item.id === transfer.id ? updatedTransfer : item),
      activityLogEntries: [
        buildTransferActivityEntry(current, updatedTransfer, 'transfer_approved', `${transfer.transferCode} was approved.`, approvedAt),
        ...current.activityLogEntries,
      ],
    },
  };
}

export function dispatchStockTransferInState(current: BusinessState, input: StockTransferActionInput): ActionResult<BusinessState> {
  const transferResult = findTransferOrError(current, input.transferId);
  if (!transferResult.ok) {
    return transferResult;
  }

  const { transfer } = transferResult;
  if (transfer.status !== 'approved') {
    return { ok: false, message: 'Only approved transfers can be dispatched.' };
  }

  const dispatchedAt = new Date().toISOString();
  const updatedTransfer: StockTransfer = {
    ...transfer,
    status: 'dispatched',
    dispatchedBy: input.performedBy,
    dispatchedAt,
  };

  return {
    ok: true,
    data: {
      ...current,
      stockTransfers: current.stockTransfers.map((item) => item.id === transfer.id ? updatedTransfer : item),
      activityLogEntries: [
        buildTransferActivityEntry(current, updatedTransfer, 'transfer_dispatched', `${transfer.transferCode} was dispatched from warehouse.`, dispatchedAt),
        ...current.activityLogEntries,
      ],
    },
  };
}

export function receiveStockTransferInState(current: BusinessState, input: StockTransferActionInput): ActionResult<BusinessState> {
  const transferResult = findTransferOrError(current, input.transferId);
  if (!transferResult.ok) {
    return transferResult;
  }

  const { transfer } = transferResult;
  if (transfer.status === 'received') {
    return { ok: false, message: 'This transfer has already been received.' };
  }
  if (transfer.status === 'cancelled') {
    return { ok: false, message: 'Cancelled transfers cannot be received.' };
  }
  if (transfer.status !== 'approved' && transfer.status !== 'dispatched') {
    return { ok: false, message: 'Only approved or dispatched transfers can be received.' };
  }

  const routeValidation = validateSupplyRouteLocations(current, transfer.fromWarehouseId, transfer.toStoreId);
  if (!routeValidation.ok) {
    return { ok: false, message: routeValidation.message };
  }

  for (const item of transfer.items) {
    const availableQuantity = selectProductQuantityOnHand(current, item.productId, transfer.fromWarehouseId);
    if (item.quantity > availableQuantity) {
      return { ok: false, message: `${item.productName} no longer has enough warehouse stock for receipt.` };
    }
  }

  const createdAt = new Date().toISOString();
  const baseState = current;
  const newMovements: StockMovement[] = [];
  let workingState = current;

  transfer.items.forEach((item) => {
    const warehouseQuantity = selectProductQuantityOnHand(workingState, item.productId, transfer.fromWarehouseId);
    const outbound = createStockMovement(workingState, {
      productId: item.productId,
      locationId: transfer.fromWarehouseId,
      type: 'transfer',
      quantityDelta: -item.quantity,
      quantityAfter: warehouseQuantity - item.quantity,
      createdAt,
      transferId: transfer.id,
      fromLocationId: transfer.fromWarehouseId,
      toLocationId: transfer.toStoreId,
      referenceNumber: transfer.transferCode,
      sourceType: 'transfer',
      sourceId: transfer.id,
      fromWarehouseId: transfer.fromWarehouseId,
      toStoreId: transfer.toStoreId,
      performedBy: input.performedBy,
      note: `Warehouse dispatch for ${transfer.transferCode}`,
    });
    workingState = { ...workingState, stockMovements: [outbound, ...workingState.stockMovements] };

    const storeQuantity = selectProductQuantityOnHand(workingState, item.productId, transfer.toStoreId);
    const inbound = createStockMovement(workingState, {
      productId: item.productId,
      locationId: transfer.toStoreId,
      type: 'transfer',
      quantityDelta: item.quantity,
      quantityAfter: storeQuantity + item.quantity,
      createdAt,
      transferId: transfer.id,
      fromLocationId: transfer.fromWarehouseId,
      toLocationId: transfer.toStoreId,
      referenceNumber: transfer.transferCode,
      sourceType: 'transfer',
      sourceId: transfer.id,
      fromWarehouseId: transfer.fromWarehouseId,
      toStoreId: transfer.toStoreId,
      performedBy: input.performedBy,
      note: `Store receipt for ${transfer.transferCode}`,
    });
    workingState = { ...workingState, stockMovements: [inbound, ...workingState.stockMovements] };
    newMovements.push(outbound, inbound);
  });

  const updatedTransfer: StockTransfer = {
    ...transfer,
    status: 'received',
    receivedBy: input.performedBy,
    receivedAt: createdAt,
  };

  return {
    ok: true,
    data: {
      ...workingState,
      stockTransfers: baseState.stockTransfers.map((item) => item.id === transfer.id ? updatedTransfer : item),
      activityLogEntries: [
        buildTransferActivityEntry(baseState, updatedTransfer, 'transfer_received', `${transfer.transferCode} was received into store stock.`, createdAt),
        ...baseState.activityLogEntries,
      ],
    },
  };
}

export function cancelStockTransferInState(current: BusinessState, input: StockTransferActionInput): ActionResult<BusinessState> {
  const transferResult = findTransferOrError(current, input.transferId);
  if (!transferResult.ok) {
    return transferResult;
  }

  const { transfer } = transferResult;
  if (transfer.status === 'received') {
    return { ok: false, message: 'Received transfers cannot be cancelled.' };
  }
  if (transfer.status === 'cancelled') {
    return { ok: false, message: 'This transfer is already cancelled.' };
  }

  const cancelledAt = new Date().toISOString();
  const updatedTransfer: StockTransfer = {
    ...transfer,
    status: 'cancelled',
    cancelledAt,
  };

  return {
    ok: true,
    data: {
      ...current,
      stockTransfers: current.stockTransfers.map((item) => item.id === transfer.id ? updatedTransfer : item),
      activityLogEntries: [
        buildTransferActivityEntry(current, updatedTransfer, 'transfer_cancelled', `${transfer.transferCode} was cancelled.`, cancelledAt),
        ...current.activityLogEntries,
      ],
    },
  };
}

export function transferStockInState(current: BusinessState, input: TransferStockInput): ActionResult<BusinessState> {
  return createStockTransferInState(current, {
    fromWarehouseId: input.fromLocationId,
    toStoreId: input.toLocationId,
    items: [
      {
        productId: input.productId,
        quantity: input.quantity,
      },
    ],
    initiatedBy: 'system',
    note: input.note,
  });
}

export function setCustomerClassificationEnabledInState(
  current: BusinessState,
  input: SetCustomerClassificationEnabledInput
): ActionResult<BusinessState> {
  if (current.businessProfile.customerClassificationEnabled === input.enabled) {
    return {
      ok: false,
      message: input.enabled
        ? 'Customer classification is already enabled.'
        : 'Customer classification is already disabled.',
    };
  }

  return {
    ok: true,
    data: {
      ...current,
      businessProfile: {
        ...current.businessProfile,
        customerClassificationEnabled: input.enabled,
      },
    },
  };
}

export function setBusinessTaxSettingsInState(
  current: BusinessState,
  input: SetBusinessTaxSettingsInput
): ActionResult<BusinessState> {
  const taxPreset = input.preset ?? current.businessProfile.taxPreset ?? 'ghana-standard';
  const taxMode = input.mode ?? current.businessProfile.taxMode ?? 'exclusive';

  if (taxPreset !== 'ghana-standard') {
    return { ok: false, message: 'Choose a supported tax preset.' };
  }

  if (taxMode !== 'exclusive' && taxMode !== 'inclusive') {
    return { ok: false, message: 'Choose whether tax is exclusive or inclusive.' };
  }

  const withholdingTaxRate = input.withholdingTaxRate ?? current.businessProfile.defaultWithholdingTaxRate ?? 0;
  if (!Number.isFinite(withholdingTaxRate) || withholdingTaxRate < 0 || withholdingTaxRate > 100) {
    return { ok: false, message: 'Withholding tax rate must be between 0 and 100.' };
  }

  const withholdingTaxBasis = input.withholdingTaxBasis ?? current.businessProfile.defaultWithholdingTaxBasis ?? 'taxInclusiveTotal';
  if (!['subtotal', 'taxInclusiveTotal', 'taxExclusiveSubtotal'].includes(withholdingTaxBasis)) {
    return { ok: false, message: 'Choose a valid withholding tax basis.' };
  }
  const taxComponents = normalizeTaxComponents(input.taxComponents ?? current.businessProfile.taxComponents);
  if (taxComponents.some((component) => !Number.isFinite(component.rate) || component.rate < 0 || component.rate > 100)) {
    return { ok: false, message: 'Tax component rates must be between 0 and 100.' };
  }

  return {
    ok: true,
    data: {
      ...current,
      businessProfile: {
        ...current.businessProfile,
        taxEnabled: input.enabled,
        taxPreset,
        taxMode,
        applyTaxByDefault: input.applyTaxByDefault ?? current.businessProfile.applyTaxByDefault ?? true,
        taxComponents,
        withholdingTaxEnabled: input.withholdingTaxEnabled ?? current.businessProfile.withholdingTaxEnabled ?? false,
        defaultWithholdingTaxRate: withholdingTaxRate,
        defaultWithholdingTaxLabel: input.withholdingTaxLabel?.trim() || current.businessProfile.defaultWithholdingTaxLabel || 'Withholding Tax',
        defaultWithholdingTaxBasis: withholdingTaxBasis,
      },
    },
  };
}

export function addQuotationToState(current: BusinessState, input: NewQuotationInput): ActionResult<BusinessState> {
  const customer = current.customers.find((item) => item.id === input.customerId);

  if (!customer) {
    return { ok: false, message: 'Choose a valid customer for the quotation.' };
  }

  if (customer.status === 'terminated') {
    return { ok: false, message: 'This customer account has been terminated. Reactivate the customer before creating a new quotation.' };
  }

  if (!input.items.length) {
    return { ok: false, message: 'Add at least one item to the quotation.' };
  }

  const items: QuotationLine[] = [];

  for (const line of input.items) {
    const product = current.products.find((item) => item.id === line.productId);

    if (!product) {
      return { ok: false, message: 'Choose a valid product for each quotation line.' };
    }

    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      return { ok: false, message: 'Each quotation line must have a quantity of at least 1.' };
    }

    items.push({
      productId: product.id,
      productName: product.name,
      inventoryId: product.inventoryId,
      quantity: line.quantity,
      unitPrice: product.price,
      total: product.price * line.quantity,
    });
  }

  const lineSubtotal = items.reduce((sum, item) => sum + item.total, 0);
  const isTaxExempt = input.taxExempt ?? customer.taxExempt ?? false;
  const exemptionReason = input.taxExemptionReason?.trim() || customer.taxExemptionReason;
  const taxSnapshot = buildTaxSnapshot(current.businessProfile, {
    exempt: isTaxExempt,
    exemptionReason,
  });
  const taxTotals = calculateTaxTotals(lineSubtotal, taxSnapshot);
  const withholdingTaxSnapshot = buildWithholdingTaxSnapshot(current.businessProfile, taxTotals, input.applyWithholdingTax);
  const withholdingTaxAmount = withholdingTaxSnapshot?.amount ?? 0;
  const netReceivableAmount = Number((taxTotals.totalAmount - withholdingTaxAmount).toFixed(2));

  const quotation: Quotation = {
    id: `q${crypto.randomUUID()}`,
    quotationNumber: nextQuotationNumber(current.quotations ?? []),
    customerId: customer.id,
    customerName: customer.name,
    clientId: customer.clientId,
    createdAt: new Date().toISOString(),
    validUntil: input.validUntil?.trim() || undefined,
    items,
    subtotalAmount: taxSnapshot ? taxTotals.subtotalAmount : undefined,
    taxAmount: taxSnapshot ? taxTotals.taxAmount : undefined,
    withholdingTaxAmount: withholdingTaxSnapshot ? withholdingTaxAmount : undefined,
    netReceivableAmount: withholdingTaxSnapshot ? netReceivableAmount : undefined,
    totalAmount: taxTotals.totalAmount,
    status: input.status ?? 'Draft',
    customerType: input.customerType ?? (customer.name.trim().toLowerCase() === 'walk-in customer' ? 'walkIn' : 'registered'),
    customerTypeSnapshot: current.businessProfile.customerClassificationEnabled ? customer.customerType : undefined,
    taxSnapshot,
    withholdingTaxSnapshot,
  };

  return {
    ok: true,
    data: {
      ...current,
      quotations: [quotation, ...(current.quotations ?? [])],
      activityLogEntries: [
        createActivityLogEntry(current, {
          entityType: 'quotation',
          entityId: quotation.id,
          actionType: 'quotation_created',
          title: 'Quotation created',
          detail: `${quotation.quotationNumber} was prepared for ${quotation.customerName}.`,
          status: 'success',
          createdAt: quotation.createdAt,
          referenceNumber: quotation.quotationNumber,
        }),
        ...current.activityLogEntries,
      ],
    },
  };
}

export function convertQuotationToSalesState(
  current: BusinessState,
  input: ConvertQuotationInput
): ActionResult<ConvertQuotationResult> {
  const quotation = current.quotations.find((item) => item.id === input.quotationId);

  if (!quotation) {
    return { ok: false, message: 'Choose a valid quotation to convert.' };
  }

  if (isQuotationConverted(quotation.status)) {
    return { ok: false, message: 'This quotation has already been converted to a sale.' };
  }

  const customer = current.customers.find((item) => item.id === quotation.customerId);

  if (!customer) {
    return { ok: false, message: 'The customer for this quotation could not be found.' };
  }

  if (customer.status === 'terminated') {
    return { ok: false, message: 'This customer account has been terminated. Reactivate the customer before converting this quotation.' };
  }

  const lifecycleStatus = getQuotationLifecycleStatus(quotation);
  if (lifecycleStatus === 'converted') {
    return { ok: false, message: 'This quotation has already been converted to a sale.' };
  }
  if (lifecycleStatus === 'expired') {
    return { ok: false, message: 'This quotation has expired. Reopen it or create a new quotation before converting it.' };
  }
  if (lifecycleStatus === 'rejected' || lifecycleStatus === 'cancelled') {
    return { ok: false, message: 'Only active quotations can be converted to sales.' };
  }

  if (!Number.isFinite(input.amountPaid) || input.amountPaid < 0 || input.amountPaid > quotation.totalAmount) {
    return { ok: false, message: 'Amount paid must be between 0 and the quotation total.' };
  }

  // Convert quotation items to sale item inputs
  const saleItemInputs: NewSaleLineItemInput[] = quotation.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
  }));

  const saleResult = addSaleToState(current, {
    customerId: quotation.customerId,
    items: saleItemInputs,
    paymentMethod: input.paymentMethod,
    paidAmount: input.amountPaid,
    quotationId: quotation.id,
    taxExempt: quotation.taxSnapshot?.exempt,
    taxExemptionReason: quotation.taxSnapshot?.exemptionReason,
    applyWithholdingTax: Boolean(quotation.withholdingTaxSnapshot),
    taxSnapshotOverride: quotation.taxSnapshot,
    withholdingTaxSnapshotOverride: quotation.withholdingTaxSnapshot,
  });

  if (!saleResult.ok) {
    return { ok: false, message: saleResult.message || 'Could not create an invoice from this quotation.' };
  }

  if (!saleResult.data) {
    return { ok: false, message: 'Could not create an invoice from this quotation.' };
  }

  const nextState = saleResult.data;
  const createdSale = nextState.sales[0];

  const receipts: ConvertedSaleReceipt[] = [{
    id: createdSale.id,
    receiptId: createdSale.receiptId,
    createdAt: createdSale.createdAt,
    customerName: customer.name,
    clientId: customer.clientId,
    productName: "Combined Quotation Items", // generic for multi-item
    inventoryId: quotation.quotationNumber,
    quantity: createdSale.quantity,
    unitPrice: 0, 
    totalAmount: createdSale.totalAmount,
    amountPaid: createdSale.paidAmount,
    balanceRemaining: selectSaleBalanceRemaining(createdSale),
    paymentMethod: createdSale.paymentMethod,
  }];

  const convertedAt = new Date().toISOString();

  return {
    ok: true,
    data: {
      data: {
        ...nextState,
        quotations: nextState.quotations.map((item) =>
          item.id === quotation.id
            ? {
                ...item,
                status: 'Converted',
                convertedAt,
                convertedInvoiceId: createdSale.id,
                relatedSaleIds: [createdSale.id],
              }
            : item
        ),
        activityLogEntries: [
          createActivityLogEntry(nextState, {
            entityType: 'quotation',
            entityId: quotation.id,
            actionType: 'quotation_converted',
            title: 'Quotation converted',
            detail: `${quotation.quotationNumber} was converted into a multi-item invoice.`,
            status: 'success',
            createdAt: convertedAt,
            referenceNumber: quotation.quotationNumber,
            relatedEntityId: createdSale.id,
          }),
          ...nextState.activityLogEntries,
        ],
      },
      receipts,
      quotationNumber: quotation.quotationNumber,
    },
  };
}

export function addSaleToState(current: BusinessState, input: NewSaleInput): ActionResult<BusinessState> {
  const customer = current.customers.find((item) => item.id === input.customerId);
  if (!customer) {
    return { ok: false, message: 'Choose a valid customer.' };
  }

  if (customer.status === 'terminated') {
    return { ok: false, message: 'This customer account has been terminated. Reactivate the customer before recording a new sale.' };
  }

  if (!input.items || input.items.length === 0) {
    return { ok: false, message: 'Add at least one item to the sale.' };
  }

  if (input.correctionOfSaleId) {
    const originalSale = current.sales.find((item) => item.id === input.correctionOfSaleId);
    if (!originalSale) return { ok: false, message: 'Original invoice not found.' };
    if (originalSale.status !== 'Reversed') return { ok: false, message: 'Only reversed invoices can be corrected.' };
    if (originalSale.correctedBySaleId) return { ok: false, message: 'Already corrected.' };
  }

  let totalAmount = 0;
  const saleItems: SaleLineItem[] = [];
  const stockMovements: StockMovement[] = [];
  const saleId = `s${crypto.randomUUID()}`;
  const createdAt = input.createdAt || new Date().toISOString();
  const saleLocation = findUsableLocation(current);
  if (!saleLocation.ok) {
    return { ok: false, message: saleLocation.message };
  }

  // Validate all items & stock first
  for (const itemInput of input.items) {
    const product = current.products.find((p) => p.id === itemInput.productId);
    if (!product) return { ok: false, message: `Product not found for ID: ${itemInput.productId}` };
    
    if (itemInput.quantity <= 0) return { ok: false, message: `Quantity for ${product.name} must be at least 1.` };

    const qoh = selectProductQuantityOnHand(current, product.id, saleLocation.location.id);
    if (itemInput.quantity > qoh) return { ok: false, message: `Not enough stock for ${product.name}.` };

    const lineTotal = product.price * itemInput.quantity;
    totalAmount += lineTotal;

    saleItems.push({
      productId: product.id,
      productName: product.name,
      inventoryId: product.inventoryId,
      quantity: itemInput.quantity,
      unitPrice: product.price,
      total: lineTotal,
    });
  }

  const isTaxExempt = input.taxExempt ?? customer.taxExempt ?? false;
  const exemptionReason = input.taxExemptionReason?.trim() || customer.taxExemptionReason;
  const taxSnapshot = input.taxSnapshotOverride ?? buildTaxSnapshot(current.businessProfile, {
    exempt: isTaxExempt,
    exemptionReason,
  });
  const taxTotals = calculateTaxTotals(totalAmount, taxSnapshot);
  const withholdingTaxSnapshot = input.withholdingTaxSnapshotOverride ?? buildWithholdingTaxSnapshot(current.businessProfile, taxTotals, input.applyWithholdingTax);
  const withholdingTaxAmount = withholdingTaxSnapshot?.amount ?? 0;
  const netReceivableAmount = Number((taxTotals.totalAmount - withholdingTaxAmount).toFixed(2));

  if (!Number.isFinite(input.paidAmount) || input.paidAmount < 0 || input.paidAmount > netReceivableAmount) {
    return { ok: false, message: 'Paid amount must be a valid number between 0 and total.' };
  }

  const invoiceNumber = nextInvoiceNumber(current.sales, current.businessProfile.invoicePrefix);
  const receiptId = nextReceiptId(current.sales, current.businessProfile.receiptPrefix);

  const sale: Sale = {
    id: saleId,
    invoiceNumber,
    receiptId,
    customerId: input.customerId,
    items: saleItems,
    productId: saleItems[0].productId, // Legacy compat
    quantity: saleItems.reduce((s, i) => s + i.quantity, 0), // Legacy compat
    paymentMethod: input.paymentMethod,
    paidAmount: input.paidAmount,
    subtotalAmount: taxSnapshot ? taxTotals.subtotalAmount : undefined,
    taxAmount: taxSnapshot ? taxTotals.taxAmount : undefined,
    withholdingTaxAmount: withholdingTaxSnapshot ? withholdingTaxAmount : undefined,
    netReceivableAmount: withholdingTaxSnapshot ? netReceivableAmount : undefined,
    totalAmount: taxTotals.totalAmount,
    createdAt,
    status: 'Completed',
    correctionOfSaleId: input.correctionOfSaleId,
    quotationId: input.quotationId,
    paymentReference: input.paymentReference,
    customerTypeSnapshot: current.businessProfile.customerClassificationEnabled ? customer.customerType : undefined,
    taxSnapshot,
    withholdingTaxSnapshot,
  };

  // Generate movements for each item
  saleItems.forEach((item) => {
    const qoh = selectProductQuantityOnHand(current, item.productId, saleLocation.location.id);
    stockMovements.push(createStockMovement(current, {
      productId: item.productId,
      locationId: saleLocation.location.id,
      type: 'sale',
      quantityDelta: -item.quantity,
      quantityAfter: qoh - item.quantity,
      createdAt,
      relatedSaleId: sale.id,
      referenceNumber: sale.receiptId,
      sourceType: 'sale',
      sourceId: sale.id,
      toStoreId: saleLocation.location.type === 'store' ? saleLocation.location.id : undefined,
      fromWarehouseId: saleLocation.location.type === 'warehouse' ? saleLocation.location.id : undefined,
      performedBy: 'system',
      note: `Stock reduced by multi-item sale ${invoiceNumber}`,
    }));
  });

  const ledgerEntries: CustomerLedgerEntry[] = [
    createLedgerEntry(current, {
      customerId: customer.id,
      type: 'sale_charge',
      amountDelta: taxTotals.totalAmount,
      createdAt,
      relatedSaleId: sale.id,
      referenceNumber: sale.invoiceNumber,
      note: `Invoice ${invoiceNumber} recorded`,
    }),
  ];

  if (withholdingTaxAmount > 0) {
    ledgerEntries.push(createLedgerEntry(
      { ...current, customerLedgerEntries: [...ledgerEntries, ...current.customerLedgerEntries] },
      {
        customerId: customer.id,
        type: 'payment_received',
        amountDelta: -withholdingTaxAmount,
        createdAt,
        relatedSaleId: sale.id,
        referenceNumber: sale.invoiceNumber,
        note: `${withholdingTaxSnapshot?.label ?? 'Withholding Tax'} deducted from ${invoiceNumber}`,
      }
    ));
  }

  if (input.paidAmount > 0) {
    ledgerEntries.push(createLedgerEntry(
      { ...current, customerLedgerEntries: [...ledgerEntries, ...current.customerLedgerEntries] },
      {
        customerId: customer.id,
        type: 'payment_received',
        amountDelta: -input.paidAmount,
        createdAt,
        relatedSaleId: sale.id,
        referenceNumber: sale.receiptId,
        paymentMethod: input.paymentMethod,
        note: `Payment for ${invoiceNumber}`,
      }
    ));
  }

  const nextSales = current.sales.map((s) => 
    s.id === input.correctionOfSaleId ? { ...s, correctedBySaleId: sale.id } : s
  );

  const activityLogEntries: ActivityLogEntry[] = [
    createActivityLogEntry(current, {
      entityType: 'sale',
      entityId: sale.id,
      actionType: 'invoice_created',
      title: input.correctionOfSaleId ? 'Correction invoice created' : 'Invoice created',
      detail: input.correctionOfSaleId
        ? `Correction invoice ${invoiceNumber} recorded`
        : `Recorded sale ${invoiceNumber} with ${saleItems.length} items`,
      status: input.correctionOfSaleId ? 'warning' : 'success',
      createdAt,
      referenceNumber: sale.invoiceNumber,
      relatedSaleId: sale.id,
    }),
    createActivityLogEntry(current, {
      entityType: 'sale',
      entityId: sale.id,
      actionType: 'receipt_issued',
      title: 'Receipt issued',
      detail: `Receipt ${receiptId} issued for ${invoiceNumber}`,
      status: 'success',
      createdAt,
      referenceNumber: sale.receiptId,
      relatedEntityId: sale.id,
      relatedSaleId: sale.id,
    }),
    ...current.activityLogEntries,
  ];

  if (input.correctionOfSaleId) {
    const originalSale = current.sales.find((item) => item.id === input.correctionOfSaleId);
    if (originalSale) {
      activityLogEntries.unshift(
        createActivityLogEntry(current, {
          entityType: 'sale',
          entityId: originalSale.id,
          actionType: 'corrected_copy_created',
          title: 'Correction invoice created',
          detail: 'Correction invoice created from reversed invoice',
          status: 'info',
          createdAt,
          referenceNumber: originalSale.invoiceNumber,
          relatedEntityId: sale.id,
          relatedSaleId: originalSale.id,
        })
      );
    }
  }

  return {
    ok: true,
    data: {
      ...current,
      sales: [sale, ...nextSales],
      stockMovements: [...stockMovements, ...current.stockMovements],
      customerLedgerEntries: [...ledgerEntries.reverse(), ...current.customerLedgerEntries],
      activityLogEntries,
    },
  };
}

export function reverseSaleInState(current: BusinessState, input: ReverseSaleInput): ActionResult<ReverseSaleResult> {
  const sale = current.sales.find((item) => item.id === input.saleId);

  if (!sale) {
    return { ok: false, message: 'Choose a valid invoice to reverse.' };
  }

  if (sale.status === 'Reversed') {
    return { ok: false, message: 'This invoice has already been reversed.' };
  }

  const reason = input.reason.trim();
  if (!reason) {
    return { ok: false, message: 'A reason is required before reversing an invoice.' };
  }

  const customer = current.customers.find((item) => item.id === sale.customerId);
  if (!customer) {
    return { ok: false, message: 'The customer for this invoice could not be found.' };
  }

  const reversedAt = new Date().toISOString();
  const updatedSale: Sale = {
    ...sale,
    status: 'Reversed',
    reversalReason: reason,
    reversedAt,
    reversedBy: input.actor,
  };

  const nextSales = current.sales.map((item) => (item.id === sale.id ? updatedSale : item));
  
  // Restore stock for ALL items in the sale
  const reversalMovements: StockMovement[] = (sale.items || []).map(item => {
    const originalMovement = current.stockMovements.find(
      (movement) => movement.relatedSaleId === sale.id && movement.productId === item.productId && movement.type === 'sale'
    );
    const locationId = originalMovement?.locationId ?? resolveDefaultLocationId(current);
    const quantityOnHand = selectProductQuantityOnHand(current, item.productId, locationId);
    return createStockMovement(current, {
      productId: item.productId,
      locationId,
      type: 'reversal',
      quantityDelta: item.quantity,
      quantityAfter: quantityOnHand + item.quantity,
      createdAt: reversedAt,
      relatedSaleId: sale.id,
      referenceNumber: sale.receiptId,
      sourceType: 'sale',
      sourceId: sale.id,
      toStoreId: locationId,
      performedBy: input.actor ?? 'system',
      note: `Stock restored by invoice reversal: ${item.productName}`,
    });
  });

  // Fallback for legacy items without .items array
  if (reversalMovements.length === 0 && sale.productId) {
    const originalMovement = current.stockMovements.find(
      (movement) => movement.relatedSaleId === sale.id && movement.productId === sale.productId && movement.type === 'sale'
    );
    const locationId = originalMovement?.locationId ?? resolveDefaultLocationId(current);
    const quantityOnHand = selectProductQuantityOnHand(current, sale.productId, locationId);
    reversalMovements.push(createStockMovement(current, {
      productId: sale.productId,
      locationId,
      type: 'reversal',
      quantityDelta: sale.quantity,
      quantityAfter: quantityOnHand + sale.quantity,
      createdAt: reversedAt,
      relatedSaleId: sale.id,
      referenceNumber: sale.receiptId,
      sourceType: 'sale',
      sourceId: sale.id,
      toStoreId: locationId,
      performedBy: input.actor ?? 'system',
      note: 'Stock restored by legacy invoice reversal',
    }));
  }

  const reversalLedgerEntry = createLedgerEntry(current, {
    customerId: customer.id,
    type: 'reversal',
    amountDelta: -Math.max(0, (sale.netReceivableAmount ?? sale.totalAmount) - sale.paidAmount),
    createdAt: reversedAt,
    relatedSaleId: sale.id,
    referenceNumber: sale.invoiceNumber,
    note: reason,
  });

  const activityEntry = createActivityLogEntry(current, {
    entityType: 'sale',
    entityId: sale.id,
    actionType: 'invoice_reversed',
    title: 'Invoice reversed',
    detail: reason,
    status: 'warning',
    createdAt: reversedAt,
    referenceNumber: sale.invoiceNumber,
    relatedSaleId: sale.id,
  });

  const nextState: BusinessState = {
    ...current,
    sales: nextSales,
    stockMovements: [...reversalMovements, ...current.stockMovements],
    customerLedgerEntries: [reversalLedgerEntry, ...current.customerLedgerEntries],
    activityLogEntries: [activityEntry, ...current.activityLogEntries],
  };

  return {
    ok: true,
    data: {
      data: nextState,
      reversedSale: updatedSale,
    },
  };
}

export function selectLegacySaleAuditEvents(state: BusinessState) {
  return toSaleAuditEvents(state.activityLogEntries);
}

export function addRestockRequestToState(
  current: BusinessState,
  input: NewRestockRequestInput
): ActionResult<BusinessState> {
  const product = current.products.find((p) => p.id === input.productId);
  if (!product) return { ok: false, message: 'Product not found.' };

  const qoh = selectProductQuantityOnHand(current, product.id, resolveDefaultLocationId(current));
  const request: RestockRequest = {
    id: `req-${crypto.randomUUID()}`,
    productId: product.id,
    productName: product.name,
    requestedByUserId: input.requestedByUserId,
    requestedByName: input.requestedByName,
    currentQuantity: qoh,
    requestedQuantity: input.requestedQuantity,
    urgency: input.urgency,
    note: input.note,
    status: 'Pending',
    createdAt: new Date().toISOString(),
  };

  return {
    ok: true,
    data: {
      ...current,
      restockRequests: [request, ...(current.restockRequests ?? [])],
    },
  };
}

export function reviewRestockRequestInState(
  current: BusinessState,
  input: ReviewRestockRequestInput
): ActionResult<BusinessState> {
  const restockRequests = current.restockRequests ?? [];
  const request = restockRequests.find((r) => r.id === input.requestId);
  if (!request) return { ok: false, message: 'Restock request not found.' };

  if (request.status === 'Fulfilled') {
    return { ok: false, message: 'This request has already been fulfilled.' };
  }

  const updated: RestockRequest = {
    ...request,
    status: input.status,
    reviewedAt: new Date().toISOString(),
    reviewedByUserId: input.reviewedByUserId,
    reviewedByName: input.reviewedByName,
    reviewNote: input.reviewNote,
  };

  let nextState: BusinessState = {
    ...current,
    restockRequests: restockRequests.map((r) => (r.id === input.requestId ? updated : r)),
  };

  if (input.status === 'Fulfilled') {
    const product = current.products.find((p) => p.id === request.productId);
    if (!product) return { ok: false, message: 'Product linked to request not found.' };

    const locationId = resolveDefaultLocationId(current);
    const qoh = selectProductQuantityOnHand(current, product.id, locationId);
    const movement = createStockMovement(current, {
      productId: product.id,
      locationId,
      type: 'restock',
      quantityDelta: request.requestedQuantity,
      quantityAfter: qoh + request.requestedQuantity,
      createdAt: updated.reviewedAt!,
      referenceNumber: `REQ-${request.id.slice(0, 8).toUpperCase()}`,
      sourceType: 'adjustment',
      sourceId: request.id,
      toStoreId: locationId,
      performedBy: input.reviewedByUserId,
      note: `Fulfilled restock request by ${input.reviewedByName}`,
    });

    const activity = createActivityLogEntry(current, {
      entityType: 'product',
      entityId: product.id,
      actionType: 'restock_fulfilled',
      title: 'Stock replenished',
      detail: `${request.requestedQuantity} ${product.unit} of ${product.name} added to stock via restock request.`,
      status: 'success',
      createdAt: updated.reviewedAt!,
      referenceNumber: movement.movementNumber,
    });

    nextState = {
      ...nextState,
      stockMovements: [movement, ...current.stockMovements],
      activityLogEntries: [activity, ...current.activityLogEntries],
    };
  }

  return {
    ok: true,
    data: nextState,
  };
}

export function updateBrandingInState(
  current: BusinessState,
  input: { logoUrl?: string; signatureUrl?: string }
): ActionResult<BusinessState> {
  return {
    ok: true,
    data: {
      ...current,
      businessProfile: {
        ...current.businessProfile,
        ...input,
      },
    },
  };
}

export type NewExpenseInput = {
  category: string;
  amount: number;
  note?: string;
  recordedByUserId: string;
  recordedByName: string;
};

export function addExpenseToState(
  current: BusinessState,
  input: NewExpenseInput
): ActionResult<BusinessState> {
  if (!input.category.trim()) return { ok: false, message: 'Category is required.' };
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, message: 'Amount must be a positive number.' };
  }

  const createdAt = new Date().toISOString();
  const expense: Expense = {
    id: `exp-${crypto.randomUUID()}`,
    category: input.category.trim(),
    amount: input.amount,
    note: input.note?.trim() || '',
    createdAt,
    recordedByUserId: input.recordedByUserId,
    recordedByName: input.recordedByName,
  };

  const activity = createActivityLogEntry(current, {
    entityType: 'business',
    entityId: 'expenses',
    actionType: 'expense_logged',
    title: 'Expense recorded',
    detail: `${expense.category}: ${expense.amount} was logged.`,
    status: 'info',
    createdAt,
    referenceNumber: `EXP-${expense.id.slice(0, 8).toUpperCase()}`,
  });

  return {
    ok: true,
    data: {
      ...current,
      expenses: [expense, ...(current.expenses ?? [])],
      activityLogEntries: [activity, ...current.activityLogEntries],
    },
  };
}
