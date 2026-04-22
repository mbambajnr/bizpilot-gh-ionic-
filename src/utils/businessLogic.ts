import type {
  ActivityLogEntry,
  BusinessProfile,
  BusinessState,
  Customer,
  CustomerLedgerEntry,
  PaymentMethod,
  Product,
  Quotation,
  QuotationLine,
  RestockRequest,
  RestockRequestStatus,
  Sale,
  SaleLineItem,
  SaleAuditEvent,
  Expense,
  StockMovement,
} from '../data/seedBusiness';
import { seedState } from '../data/seedBusiness';
import {
  nextActivityNumber,
  nextClientId,
  nextInvoiceNumber,
  nextInventoryId,
  nextLedgerEntryNumber,
  nextQuotationNumber,
  nextReceiptId,
  nextStockMovementNumber,
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
};

export type UpdateCustomerStatusInput = {
  customerId: string;
  status: Customer['status'];
  terminationReason?: string;
};

export type UpdateBusinessProfileInput = Omit<BusinessProfile, 'id'>;

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
};

export type NewQuotationLineInput = NewSaleLineItemInput;

export type NewQuotationInput = {
  customerId: string;
  items: NewQuotationLineInput[];
  status?: 'Draft' | 'Converted';
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

export type ReverseSaleInput = {
  saleId: string;
  reason: string;
  actor?: string;
};

export type ReverseSaleResult = {
  data: BusinessState;
  reversedSale: Sale;
};

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; message: string };

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
  };
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
  };
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
      type: 'opening',
      quantityDelta: currentQuantity + activeQuantitySold,
      quantityAfter: currentQuantity + activeQuantitySold,
      createdAt: new Date(0).toISOString(),
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
      type: 'sale',
      quantityDelta: -sale.quantity,
      quantityAfter: afterSale,
      createdAt: sale.createdAt,
      relatedSaleId: sale.id,
      referenceNumber: sale.receiptId,
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
        type: 'reversal',
        quantityDelta: sale.quantity,
        quantityAfter: restored,
        createdAt: sale.reversedAt ?? sale.createdAt,
        relatedSaleId: sale.id,
        referenceNumber: sale.receiptId,
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
      .reduce((sum, sale) => sum + Math.max(0, sale.totalAmount - sale.paidAmount), 0);
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
          amountDelta: -Math.max(0, sale.totalAmount - sale.paidAmount),
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
  };

  const businessProfile = ensureBusinessProfile(raw.businessProfile);
  const products = (raw.products ?? []).map((product, index) => ({
    ...product,
    inventoryId: product.inventoryId ?? `INV-${String(index + 1).padStart(3, '0')}`,
    image: product.image ?? createProductImage(product.name ?? `Item ${index + 1}`),
  }));
  const customers = (raw.customers ?? []).map((customer, index) => ({
    id: customer.id ?? `c${index + 1}`,
    clientId: customer.clientId ?? `CLT-${String(index + 1).padStart(3, '0')}`,
    name: customer.name,
    phone: customer.phone ?? '',
    whatsapp: customer.whatsapp ?? '',
    email: customer.email ?? '',
    channel: customer.channel ?? 'No action needed',
    status: customer.status ?? 'active',
    terminatedAt: customer.terminatedAt ?? undefined,
    terminationReason: customer.terminationReason ?? undefined,
  }));
  const sales = (raw.sales ?? []).map((sale, index) => ({
    ...sale,
    receiptId: sale.receiptId ?? nextReceiptId((raw.sales ?? []).slice(0, index) as Sale[], businessProfile.receiptPrefix),
    invoiceNumber:
      sale.invoiceNumber ?? nextInvoiceNumber((raw.sales ?? []).slice(0, index) as Sale[], businessProfile.invoicePrefix),
    status: sale.status ?? 'Completed',
  }));
  const quotations = (raw.quotations ?? []).map((quotation, index) => ({
    ...quotation,
    quotationNumber: quotation.quotationNumber ?? `QTN-${String(index + 1).padStart(3, '0')}`,
    status: quotation.status ?? 'Draft',
  }));
  const stockMovements =
    raw.stockMovements && raw.stockMovements.length > 0
      ? raw.stockMovements
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

  return {
    businessProfile,
    products,
    customers,
    sales,
    quotations,
    stockMovements,
    customerLedgerEntries,
    activityLogEntries,
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

  const product: Product = {
    id: `p${crypto.randomUUID()}`,
    name,
    unit,
    price: input.price,
    cost: input.cost,
    reorderLevel: input.reorderLevel,
    inventoryId,
    image: input.image || createProductImage(name),
  };
  const createdAt = new Date().toISOString();
  const stockMovements =
    input.quantity > 0
      ? [
          createStockMovement(current, {
            productId: product.id,
            type: 'opening',
            quantityDelta: input.quantity,
            quantityAfter: input.quantity,
            createdAt,
            referenceNumber: 'OPENING',
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

  if (!name) {
    return { ok: false, message: 'Customer name is required.' };
  }

  if (!channel) {
    return { ok: false, message: 'Follow-up channel is required.' };
  }

  if (current.customers.some((customer) => customer.clientId.trim() === clientId)) {
    return { ok: false, message: 'Client ID already exists. Please choose another one.' };
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

  if (!name) {
    return { ok: false, message: 'Customer name is required.' };
  }

  if (!channel) {
    return { ok: false, message: 'Follow-up channel is required.' };
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

  const quotation: Quotation = {
    id: `q${crypto.randomUUID()}`,
    quotationNumber: nextQuotationNumber(current.quotations ?? []),
    customerId: customer.id,
    customerName: customer.name,
    clientId: customer.clientId,
    createdAt: new Date().toISOString(),
    items,
    totalAmount: items.reduce((sum, item) => sum + item.total, 0),
    status: input.status ?? 'Draft',
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

  if (quotation.status === 'Converted') {
    return { ok: false, message: 'This quotation has already been converted to a sale.' };
  }

  const customer = current.customers.find((item) => item.id === quotation.customerId);

  if (!customer) {
    return { ok: false, message: 'The customer for this quotation could not be found.' };
  }

  if (customer.status === 'terminated') {
    return { ok: false, message: 'This customer account has been terminated. Reactivate the customer before converting this quotation.' };
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

  // Validate all items & stock first
  for (const itemInput of input.items) {
    const product = current.products.find((p) => p.id === itemInput.productId);
    if (!product) return { ok: false, message: `Product not found for ID: ${itemInput.productId}` };
    
    if (itemInput.quantity <= 0) return { ok: false, message: `Quantity for ${product.name} must be at least 1.` };

    const qoh = selectProductQuantityOnHand(current, product.id);
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

  if (!Number.isFinite(input.paidAmount) || input.paidAmount < 0 || input.paidAmount > totalAmount) {
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
    totalAmount,
    createdAt,
    status: 'Completed',
    correctionOfSaleId: input.correctionOfSaleId,
    quotationId: input.quotationId,
    paymentReference: input.paymentReference,
  };

  // Generate movements for each item
  saleItems.forEach((item, idx) => {
    const qoh = selectProductQuantityOnHand(current, item.productId);
    stockMovements.push(createStockMovement(current, {
      productId: item.productId,
      type: 'sale',
      quantityDelta: -item.quantity,
      quantityAfter: qoh - item.quantity,
      createdAt,
      relatedSaleId: sale.id,
      referenceNumber: sale.receiptId,
      note: `Stock reduced by multi-item sale ${invoiceNumber}`,
    }));
  });

  const ledgerEntries: CustomerLedgerEntry[] = [
    createLedgerEntry(current, {
      customerId: customer.id,
      type: 'sale_charge',
      amountDelta: totalAmount,
      createdAt,
      relatedSaleId: sale.id,
      referenceNumber: sale.invoiceNumber,
      note: `Invoice ${invoiceNumber} recorded`,
    }),
  ];

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
    const quantityOnHand = selectProductQuantityOnHand(current, item.productId);
    return createStockMovement(current, {
      productId: item.productId,
      type: 'reversal',
      quantityDelta: item.quantity,
      quantityAfter: quantityOnHand + item.quantity,
      createdAt: reversedAt,
      relatedSaleId: sale.id,
      referenceNumber: sale.receiptId,
      note: `Stock restored by invoice reversal: ${item.productName}`,
    });
  });

  // Fallback for legacy items without .items array
  if (reversalMovements.length === 0 && sale.productId) {
    const quantityOnHand = selectProductQuantityOnHand(current, sale.productId);
    reversalMovements.push(createStockMovement(current, {
      productId: sale.productId,
      type: 'reversal',
      quantityDelta: sale.quantity,
      quantityAfter: quantityOnHand + sale.quantity,
      createdAt: reversedAt,
      relatedSaleId: sale.id,
      referenceNumber: sale.receiptId,
      note: 'Stock restored by legacy invoice reversal',
    }));
  }

  const reversalLedgerEntry = createLedgerEntry(current, {
    customerId: customer.id,
    type: 'reversal',
    amountDelta: -Math.max(0, sale.totalAmount - sale.paidAmount),
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

  const qoh = selectProductQuantityOnHand(current, product.id);
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

    const qoh = selectProductQuantityOnHand(current, product.id);
    const movement = createStockMovement(current, {
      productId: product.id,
      type: 'restock',
      quantityDelta: request.requestedQuantity,
      quantityAfter: qoh + request.requestedQuantity,
      createdAt: updated.reviewedAt!,
      referenceNumber: `REQ-${request.id.slice(0, 8).toUpperCase()}`,
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
