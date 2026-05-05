import { createProductImage } from '../utils/productArtwork';
import { UserAccessProfile } from '../authz/types';

export type PaymentMethod = 'Cash' | 'Mobile Money' | 'Bank Account';
export type PaymentChannel = 'cash' | 'bank' | 'mobileMoney' | 'creditCard';
export type SaleStatus = 'Completed' | 'Reversed';
export type CustomerType = 'B2C' | 'B2B';
export type QuotationCustomerType = 'registered' | 'walkIn';
export type TaxPreset = 'ghana-standard';
export type TaxMode = 'exclusive' | 'inclusive';

export type TaxComponent = {
  key: string;
  label: string;
  rate: number;
  enabled?: boolean;
};

export type TaxSnapshot = {
  enabled: true;
  preset: TaxPreset;
  mode: TaxMode;
  totalRate: number;
  components?: TaxComponent[];
  exempt?: boolean;
  exemptionReason?: string;
};

export type WithholdingTaxBasis = 'subtotal' | 'taxInclusiveTotal' | 'taxExclusiveSubtotal';

export type WithholdingTaxSnapshot = {
  enabled: true;
  rate: number;
  label: string;
  basis: WithholdingTaxBasis;
  amount: number;
};

export type BusinessProfile = {
  id: string;
  businessName: string;
  businessType: string;
  currency: string;
  country: string;
  receiptPrefix: string;
  invoicePrefix: string;
  phone: string;
  email: string;
  logoUrl?: string;
  signatureUrl?: string;
  address: string;
  website?: string;
  waybillPrefix: string;
  inventoryCategoriesEnabled: boolean;
  customerClassificationEnabled: boolean;
  taxEnabled: boolean;
  taxPreset: TaxPreset;
  taxMode: TaxMode;
  applyTaxByDefault: boolean;
  taxComponents: TaxComponent[];
  withholdingTaxEnabled: boolean;
  defaultWithholdingTaxRate: number;
  defaultWithholdingTaxLabel: string;
  defaultWithholdingTaxBasis: WithholdingTaxBasis;
  launchedAt?: string;
};

export type Product = {
  id: string;
  inventoryId: string;
  name: string;
  unit: string;
  price: number;
  cost: number;
  reorderLevel: number;
  image: string;
  categoryId?: string;
};

export type ProductCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentCategoryId?: string;
  sortOrder: number;
  isActive: boolean;
};

export type BusinessLocationType = 'store' | 'warehouse';

export type BusinessLocation = {
  id: string;
  locationCode?: string;
  name: string;
  type: BusinessLocationType;
  address?: string;
  managerName?: string;
  linkedWarehouseId?: string;
  isDefault: boolean;
  isActive: boolean;
};

export type LocationSupplyRoute = {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  isActive: boolean;
};

export type RestockRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Fulfilled';

export type RestockRequest = {
  id: string;
  productId: string;
  productName: string;
  requestedByUserId: string;
  requestedByName: string;
  currentQuantity: number;
  requestedQuantity: number;
  urgency: 'Low' | 'Medium' | 'High';
  note?: string;
  status: RestockRequestStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewNote?: string;
};

export type CustomerStatus = 'active' | 'terminated';

export type Customer = {
  id: string;
  clientId: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  channel: string;
  status: CustomerStatus;
  customerType?: CustomerType;
  taxExempt?: boolean;
  taxExemptionReason?: string;
  terminatedAt?: string;
  terminationReason?: string;
};

export type SaleLineItem = {
  productId: string;
  productName: string;
  inventoryId: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type Sale = {
  id: string;
  invoiceNumber: string;
  receiptId: string;
  customerId: string;
  items: SaleLineItem[];
  productId: string; // Legacy: first item
  quantity: number; // Legacy: sum of quantities
  paymentMethod: PaymentMethod;
  paidAmount: number;
  subtotalAmount?: number;
  taxAmount?: number;
  withholdingTaxAmount?: number;
  netReceivableAmount?: number;
  totalAmount: number;
  createdAt: string;
  status: SaleStatus;
  quotationId?: string;
  reversalReason?: string;
  reversedAt?: string;
  reversedBy?: string;
  correctionOfSaleId?: string;
  correctedBySaleId?: string;
  paymentReference?: string;
  customerTypeSnapshot?: CustomerType;
  taxSnapshot?: TaxSnapshot;
  withholdingTaxSnapshot?: WithholdingTaxSnapshot;
};

export type SaleAuditEvent = {
  id: string;
  saleId: string;
  invoiceNumber: string;
  actionType: 'created' | 'receipt_issued' | 'reversed' | 'corrected_copy_created';
  reason: string;
  timestamp: string;
  actor?: string;
  relatedSaleId?: string;
};

export type QuotationLine = {
  productId: string;
  productName: string;
  inventoryId: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type Quotation = {
  id: string;
  quotationNumber: string;
  customerId: string;
  customerName: string;
  clientId: string;
  createdAt: string;
  validUntil?: string;
  items: QuotationLine[];
  subtotalAmount?: number;
  taxAmount?: number;
  withholdingTaxAmount?: number;
  netReceivableAmount?: number;
  totalAmount: number;
  status: 'Draft' | 'Converted' | 'draft' | 'open' | 'approved' | 'converted' | 'rejected' | 'expired' | 'cancelled';
  rejectionReason?: string;
  convertedAt?: string;
  convertedInvoiceId?: string;
  relatedSaleIds?: string[];
  customerType?: QuotationCustomerType;
  customerTypeSnapshot?: CustomerType;
  taxSnapshot?: TaxSnapshot;
  withholdingTaxSnapshot?: WithholdingTaxSnapshot;
};

export type StockMovement = {
  id: string;
  movementNumber: string;
  productId: string;
  locationId?: string;
  type: 'opening' | 'sale' | 'reversal' | 'restock' | 'transfer' | 'purchase' | 'adjustment';
  quantityDelta: number;
  quantityAfter: number;
  createdAt: string;
  transferId?: string;
  fromLocationId?: string;
  toLocationId?: string;
  relatedSaleId?: string;
  referenceNumber?: string;
  sourceType?: 'purchase' | 'transfer' | 'sale' | 'adjustment';
  sourceId?: string;
  vendorId?: string;
  vendorCode?: string;
  fromWarehouseId?: string;
  toStoreId?: string;
  performedBy?: string;
  note: string;
};

export type VendorStatus = 'active' | 'inactive';

export type Vendor = {
  id: string;
  vendorCode: string;
  name: string;
  contactEmail?: string;
  location: string;
  status: VendorStatus;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  vendorCode: string;
};

export type PurchaseStatus =
  | 'draft'
  | 'submitted'
  | 'adminReviewed'
  | 'approved'
  | 'receivedToWarehouse'
  | 'cancelled';

export type Purchase = {
  id: string;
  purchaseCode: string;
  vendorId: string;
  vendorCode: string;
  items: PurchaseItem[];
  totalAmount: number;
  status: PurchaseStatus;
  createdBy: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  receivedWarehouseId?: string;
  createdAt: string;
  updatedAt: string;
};

export type AccountsPayableStatus =
  | 'pendingReview'
  | 'approved'
  | 'partiallyPaid'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export type AccountsPayable = {
  id: string;
  payableCode: string;
  vendorId: string;
  vendorCode: string;
  purchaseId: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  dueDate?: string;
  status: AccountsPayableStatus;
  paymentMethod?: PaymentChannel;
  paymentReference?: string;
  createdBy?: string;
  approvedBy?: string;
  paidBy?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
};

export type StockTransferItem = {
  productId: string;
  productName: string;
  quantity: number;
};

export type StockTransferStatus = 'pending' | 'approved' | 'dispatched' | 'received' | 'cancelled';

export type StockTransfer = {
  id: string;
  transferCode: string;
  fromWarehouseId: string;
  toStoreId: string;
  items: StockTransferItem[];
  status: StockTransferStatus;
  initiatedBy: string;
  approvedBy?: string;
  dispatchedBy?: string;
  receivedBy?: string;
  createdAt: string;
  approvedAt?: string;
  dispatchedAt?: string;
  receivedAt?: string;
  cancelledAt?: string;
};

export type Payment = {
  id: string;
  paymentCode: string;
  sourceType: 'sale' | 'invoice' | 'payable' | 'expense';
  sourceId: string;
  amount: number;
  method: PaymentChannel;
  reference?: string;
  recordedBy: string;
  createdAt: string;
};

export type CustomerLedgerEntry = {
  id: string;
  entryNumber: string;
  customerId: string;
  type: 'opening_balance' | 'sale_charge' | 'payment_received' | 'reversal';
  amountDelta: number;
  createdAt: string;
  relatedSaleId?: string;
  referenceNumber?: string;
  paymentMethod?: PaymentMethod;
  note: string;
};

export type ActivityLogEntry = {
  id: string;
  activityNumber: string;
  entityType: 'sale' | 'quotation' | 'product' | 'customer' | 'business';
  entityId: string;
  actionType:
    | 'product_created'
    | 'customer_created'
    | 'customer_updated'
    | 'customer_terminated'
    | 'customer_reactivated'
    | 'quotation_created'
    | 'quotation_converted'
    | 'invoice_created'
    | 'receipt_issued'
    | 'invoice_reversed'
    | 'corrected_copy_created'
    | 'business_profile_updated'
    | 'vendor_created'
    | 'vendor_updated'
    | 'vendor_deactivated'
    | 'purchase_created'
    | 'purchase_submitted'
    | 'purchase_approved'
    | 'purchase_cancelled'
    | 'purchase_received'
    | 'payable_created'
    | 'payable_approved'
    | 'payable_paid'
    | 'restock_fulfilled'
    | 'stock_transferred'
    | 'transfer_created'
    | 'transfer_approved'
    | 'transfer_dispatched'
    | 'transfer_received'
    | 'transfer_cancelled'
    | 'expense_logged';
  title: string;
  detail: string;
  status: 'info' | 'success' | 'warning';
  createdAt: string;
  referenceNumber?: string;
  relatedEntityId?: string;
  relatedSaleId?: string;
};

export type Expense = {
  id: string;
  category: string;
  amount: number;
  note: string;
  createdAt: string;
  recordedByUserId: string;
  recordedByName: string;
};

export type BusinessState = {
  businessProfile: BusinessProfile;
  locations: BusinessLocation[];
  locationSupplyRoutes: LocationSupplyRoute[];
  products: Product[];
  productCategories: ProductCategory[];
  customers: Customer[];
  vendors: Vendor[];
  purchases: Purchase[];
  accountsPayable: AccountsPayable[];
  stockTransfers: StockTransfer[];
  payments: Payment[];
  sales: Sale[];
  quotations: Quotation[];
  stockMovements: StockMovement[];
  customerLedgerEntries: CustomerLedgerEntry[];
  activityLogEntries: ActivityLogEntry[];
  users: UserAccessProfile[];
  currentUserId: string;
  restockRequests: RestockRequest[];
  expenses: Expense[];
  themePreference: 'system' | 'light' | 'dark';
};

const now = new Date();
const isoDaysAgoAt = (days: number, hour: number, minute = 0) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, hour, minute, 0, 0).toISOString();

export const seedState: BusinessState = {
  businessProfile: {
    id: 'biz-001',
    businessName: '',
    businessType: 'General Retail',
    currency: 'GHS',
    country: 'Ghana',
    receiptPrefix: 'RCP-',
    invoicePrefix: 'INV-',
    waybillPrefix: 'WAY-',
    phone: '',
    email: '',
    address: '',
    website: '',
    inventoryCategoriesEnabled: false,
    customerClassificationEnabled: false,
    taxEnabled: false,
    taxPreset: 'ghana-standard',
    taxMode: 'exclusive',
    applyTaxByDefault: true,
    taxComponents: [
      { key: 'vat', label: 'VAT', rate: 12.5, enabled: true },
      { key: 'nhil', label: 'NHIL', rate: 2.5, enabled: true },
      { key: 'getfund', label: 'GETFund', rate: 2.5, enabled: true },
    ],
    withholdingTaxEnabled: false,
    defaultWithholdingTaxRate: 0,
    defaultWithholdingTaxLabel: 'Withholding Tax',
    defaultWithholdingTaxBasis: 'taxInclusiveTotal',
    launchedAt: undefined,
  },
  locations: [
    { id: '00000000-0000-4000-8000-000000000001', locationCode: 'ST-0001', name: 'Main Store', type: 'store', address: 'Osu, Accra', managerName: 'Esi Mensah', linkedWarehouseId: '00000000-0000-4000-8000-000000000002', isDefault: true, isActive: true },
    { id: '00000000-0000-4000-8000-000000000002', locationCode: 'WH-0001', name: 'Central Warehouse', type: 'warehouse', address: 'North Industrial Area, Accra', managerName: 'Kojo Asare', isDefault: false, isActive: true },
  ],
  locationSupplyRoutes: [
    { id: 'route-001', fromLocationId: '00000000-0000-4000-8000-000000000002', toLocationId: '00000000-0000-4000-8000-000000000001', isActive: true },
  ],
  products: [
    { id: 'p1', inventoryId: 'INV-001', name: 'Sunlight Detergent', unit: 'packs', price: 35, cost: 27, reorderLevel: 10, image: createProductImage('Sunlight', '#f4c95d', '#1d4738') },
    { id: 'p2', inventoryId: 'INV-002', name: 'Paracetamol 500mg', unit: 'boxes', price: 42, cost: 34, reorderLevel: 12, image: createProductImage('Paracetamol', '#78d2b7', '#213b5b') },
    { id: 'p3', inventoryId: 'INV-003', name: 'Phone Chargers', unit: 'units', price: 55, cost: 40, reorderLevel: 8, image: createProductImage('Chargers', '#9bbcff', '#292d4f') },
    { id: 'p4', inventoryId: 'INV-004', name: 'Hair Food', unit: 'tins', price: 28, cost: 19, reorderLevel: 9, image: createProductImage('Hair Food', '#ff9f8f', '#4d2434') },
  ],
  productCategories: [],
  vendors: [
    {
      id: 'v1',
      vendorCode: 'VEN-0001',
      name: 'Accra Wholesale Supply',
      contactEmail: 'orders@accrawholesale.example',
      location: 'Accra',
      status: 'active',
      createdAt: isoDaysAgoAt(9, 9, 0),
      updatedAt: isoDaysAgoAt(2, 10, 30),
    },
    {
      id: 'v2',
      vendorCode: 'VEN-0002',
      name: 'Kumasi Distribution Hub',
      contactEmail: 'sales@kumasihub.example',
      location: 'Kumasi',
      status: 'active',
      createdAt: isoDaysAgoAt(8, 11, 0),
      updatedAt: isoDaysAgoAt(1, 15, 0),
    },
  ],
  purchases: [
    {
      id: 'po-1',
      purchaseCode: 'PO-0001',
      vendorId: 'v1',
      vendorCode: 'VEN-0001',
      items: [
        {
          productId: 'p1',
          productName: 'Sunlight Detergent',
          quantity: 24,
          unitCost: 25,
          totalCost: 600,
          vendorCode: 'VEN-0001',
        },
      ],
      totalAmount: 600,
      status: 'approved',
      createdBy: 'u-admin',
      submittedAt: isoDaysAgoAt(3, 9, 30),
      approvedBy: 'u-admin',
      approvedAt: isoDaysAgoAt(3, 11, 0),
      receivedWarehouseId: '00000000-0000-4000-8000-000000000002',
      createdAt: isoDaysAgoAt(4, 14, 15),
      updatedAt: isoDaysAgoAt(3, 11, 0),
    },
  ],
  accountsPayable: [
    {
      id: 'ap-1',
      payableCode: 'AP-0001',
      vendorId: 'v1',
      vendorCode: 'VEN-0001',
      purchaseId: 'po-1',
      amountDue: 600,
      amountPaid: 200,
      balance: 400,
      dueDate: isoDaysAgoAt(-7, 17, 0),
      status: 'partiallyPaid',
      paymentMethod: 'bank',
      paymentReference: 'GTB-PO-0001',
      createdBy: 'u-admin',
      approvedBy: 'u-admin',
      paidBy: 'u-accountant',
      createdAt: isoDaysAgoAt(3, 11, 5),
      updatedAt: isoDaysAgoAt(1, 16, 0),
    },
  ],
  stockTransfers: [
    {
      id: 'trf-1',
      transferCode: 'TRF-0001',
      fromWarehouseId: '00000000-0000-4000-8000-000000000002',
      toStoreId: '00000000-0000-4000-8000-000000000001',
      items: [
        {
          productId: 'p1',
          productName: 'Sunlight Detergent',
          quantity: 6,
        },
      ],
      status: 'received',
      initiatedBy: 'u-admin',
      approvedBy: 'u-admin',
      dispatchedBy: 'u-admin',
      receivedBy: 'u-sales',
      createdAt: isoDaysAgoAt(2, 9, 15),
      approvedAt: isoDaysAgoAt(2, 9, 45),
      dispatchedAt: isoDaysAgoAt(2, 10, 0),
      receivedAt: isoDaysAgoAt(2, 13, 0),
    },
  ],
  payments: [
    {
      id: 'pay-1',
      paymentCode: 'PAY-0001',
      sourceType: 'payable',
      sourceId: 'ap-1',
      amount: 200,
      method: 'bank',
      reference: 'GTB-PO-0001',
      recordedBy: 'u-accountant',
      createdAt: isoDaysAgoAt(1, 16, 0),
    },
  ],
  customers: [
    { id: 'c1', clientId: 'CLT-001', name: 'Ama Beauty Supplies', phone: '', channel: 'WhatsApp follow-up', status: 'active' },
    { id: 'c2', clientId: 'CLT-002', name: 'Kojo Mini Mart', phone: '', channel: 'No action needed', status: 'active' },
    { id: 'c3', clientId: 'CLT-003', name: 'Nhyira Agro Shop', phone: '', channel: 'Call owner', status: 'active' },
    { id: 'c4', clientId: 'CLT-004', name: 'Walk-in customer', phone: '', channel: 'Counter sale', status: 'active' },
  ],
  sales: [
    {
      id: 's1',
      invoiceNumber: 'INV-001',
      receiptId: 'RCP-001',
      customerId: 'c1',
      items: [
        { productId: 'p4', productName: 'Hair Food', inventoryId: 'INV-004', quantity: 6, unitPrice: 28, total: 168 }
      ],
      productId: 'p4',
      quantity: 6,
      paymentMethod: 'Mobile Money',
      paidAmount: 168,
      totalAmount: 168,
      createdAt: isoDaysAgoAt(0, 12, 15),
      status: 'Completed',
    },
    {
      id: 's2',
      invoiceNumber: 'INV-002',
      receiptId: 'RCP-002',
      customerId: 'c2',
      items: [
        { productId: 'p1', productName: 'Sunlight Detergent', inventoryId: 'INV-001', quantity: 4, unitPrice: 35, total: 140 }
      ],
      productId: 'p1',
      quantity: 4,
      paymentMethod: 'Cash',
      paidAmount: 140,
      totalAmount: 140,
      createdAt: isoDaysAgoAt(1, 14, 10),
      status: 'Completed',
    },
  ],
  quotations: [],
  stockMovements: [
    { id: 'sm-001', movementNumber: 'SMV-001', productId: 'p1', locationId: '00000000-0000-4000-8000-000000000001', type: 'opening', quantityDelta: 16, quantityAfter: 16, createdAt: isoDaysAgoAt(7, 9, 0), sourceType: 'adjustment', sourceId: 'opening-stock', performedBy: 'u-admin', note: 'Opening stock loaded', referenceNumber: 'OPENING' },
    { id: 'sm-002', movementNumber: 'SMV-002', productId: 'p2', locationId: '00000000-0000-4000-8000-000000000001', type: 'opening', quantityDelta: 8, quantityAfter: 8, createdAt: isoDaysAgoAt(7, 9, 5), sourceType: 'adjustment', sourceId: 'opening-stock', performedBy: 'u-admin', note: 'Opening stock loaded', referenceNumber: 'OPENING' },
    { id: 'sm-003', movementNumber: 'SMV-003', productId: 'p3', locationId: '00000000-0000-4000-8000-000000000001', type: 'opening', quantityDelta: 19, quantityAfter: 19, createdAt: isoDaysAgoAt(7, 9, 10), sourceType: 'adjustment', sourceId: 'opening-stock', performedBy: 'u-admin', note: 'Opening stock loaded', referenceNumber: 'OPENING' },
    { id: 'sm-004', movementNumber: 'SMV-004', productId: 'p4', locationId: '00000000-0000-4000-8000-000000000001', type: 'opening', quantityDelta: 22, quantityAfter: 22, createdAt: isoDaysAgoAt(7, 9, 15), sourceType: 'adjustment', sourceId: 'opening-stock', performedBy: 'u-admin', note: 'Opening stock loaded', referenceNumber: 'OPENING' },
    { id: 'sm-005', movementNumber: 'SMV-005', productId: 'p1', locationId: '00000000-0000-4000-8000-000000000001', type: 'sale', quantityDelta: -4, quantityAfter: 12, createdAt: isoDaysAgoAt(1, 14, 10), relatedSaleId: 's2', referenceNumber: 'RCP-002', sourceType: 'sale', sourceId: 's2', toStoreId: '00000000-0000-4000-8000-000000000001', performedBy: 'u-admin', note: 'Stock reduced by sale' },
    { id: 'sm-006', movementNumber: 'SMV-006', productId: 'p4', locationId: '00000000-0000-4000-8000-000000000001', type: 'sale', quantityDelta: -6, quantityAfter: 16, createdAt: isoDaysAgoAt(0, 12, 15), relatedSaleId: 's1', referenceNumber: 'RCP-001', sourceType: 'sale', sourceId: 's1', toStoreId: '00000000-0000-4000-8000-000000000001', performedBy: 'u-admin', note: 'Stock reduced by sale' },
    { id: 'sm-007', movementNumber: 'SMV-007', productId: 'p1', locationId: '00000000-0000-4000-8000-000000000002', type: 'purchase', quantityDelta: 24, quantityAfter: 24, createdAt: isoDaysAgoAt(3, 13, 30), referenceNumber: 'PO-0001', sourceType: 'purchase', sourceId: 'po-1', vendorId: 'v1', vendorCode: 'VEN-0001', fromWarehouseId: '00000000-0000-4000-8000-000000000002', performedBy: 'u-admin', note: 'Purchase stock received into warehouse' },
    { id: 'sm-008', movementNumber: 'SMV-008', productId: 'p1', locationId: '00000000-0000-4000-8000-000000000002', type: 'transfer', quantityDelta: -6, quantityAfter: 18, createdAt: isoDaysAgoAt(2, 9, 15), transferId: 'trf-1', fromLocationId: '00000000-0000-4000-8000-000000000002', toLocationId: '00000000-0000-4000-8000-000000000001', referenceNumber: 'TRF-0001', sourceType: 'transfer', sourceId: 'trf-1', fromWarehouseId: '00000000-0000-4000-8000-000000000002', toStoreId: '00000000-0000-4000-8000-000000000001', performedBy: 'u-admin', note: 'Warehouse stock dispatched to store' },
    { id: 'sm-009', movementNumber: 'SMV-009', productId: 'p1', locationId: '00000000-0000-4000-8000-000000000001', type: 'transfer', quantityDelta: 6, quantityAfter: 18, createdAt: isoDaysAgoAt(2, 13, 0), transferId: 'trf-1', fromLocationId: '00000000-0000-4000-8000-000000000002', toLocationId: '00000000-0000-4000-8000-000000000001', referenceNumber: 'TRF-0001', sourceType: 'transfer', sourceId: 'trf-1', fromWarehouseId: '00000000-0000-4000-8000-000000000002', toStoreId: '00000000-0000-4000-8000-000000000001', performedBy: 'u-sales', note: 'Store stock received from warehouse' },
  ],
  customerLedgerEntries: [
    { id: 'led-001', entryNumber: 'LED-001', customerId: 'c1', type: 'opening_balance', amountDelta: 380, createdAt: isoDaysAgoAt(10, 10, 0), referenceNumber: 'OPENING', note: 'Opening customer balance' },
    { id: 'led-002', entryNumber: 'LED-002', customerId: 'c3', type: 'opening_balance', amountDelta: 1320, createdAt: isoDaysAgoAt(10, 10, 5), referenceNumber: 'OPENING', note: 'Opening customer balance' },
    { id: 'led-003', entryNumber: 'LED-003', customerId: 'c3', type: 'payment_received', amountDelta: -280, createdAt: isoDaysAgoAt(3, 11, 0), referenceNumber: 'MOMO-PRIOR', paymentMethod: 'Mobile Money', note: 'Prior mobile money payment received' },
    { id: 'led-004', entryNumber: 'LED-004', customerId: 'c1', type: 'sale_charge', amountDelta: 168, createdAt: isoDaysAgoAt(0, 12, 15), relatedSaleId: 's1', referenceNumber: 'INV-001', note: 'Invoice recorded' },
    { id: 'led-005', entryNumber: 'LED-005', customerId: 'c1', type: 'payment_received', amountDelta: -168, createdAt: isoDaysAgoAt(0, 12, 15), relatedSaleId: 's1', referenceNumber: 'RCP-001', paymentMethod: 'Mobile Money', note: 'Payment received for invoice' },
    { id: 'led-006', entryNumber: 'LED-006', customerId: 'c2', type: 'sale_charge', amountDelta: 140, createdAt: isoDaysAgoAt(1, 14, 10), relatedSaleId: 's2', referenceNumber: 'INV-002', note: 'Invoice recorded' },
    { id: 'led-007', entryNumber: 'LED-007', customerId: 'c2', type: 'payment_received', amountDelta: -140, createdAt: isoDaysAgoAt(1, 14, 10), relatedSaleId: 's2', referenceNumber: 'RCP-002', paymentMethod: 'Cash', note: 'Payment received for invoice' },
  ],
  activityLogEntries: [
    { id: 'act-001', activityNumber: 'ACT-001', entityType: 'sale', entityId: 's1', actionType: 'receipt_issued', title: 'Receipt issued', detail: 'Receipt generated for completed invoice', status: 'success', createdAt: isoDaysAgoAt(0, 12, 15), referenceNumber: 'RCP-001', relatedSaleId: 's1' },
    { id: 'act-002', activityNumber: 'ACT-002', entityType: 'sale', entityId: 's1', actionType: 'invoice_created', title: 'Invoice created', detail: 'Invoice recorded for Ama Beauty Supplies', status: 'success', createdAt: isoDaysAgoAt(0, 12, 15), referenceNumber: 'INV-001', relatedSaleId: 's1' },
    { id: 'act-003', activityNumber: 'ACT-003', entityType: 'sale', entityId: 's2', actionType: 'receipt_issued', title: 'Receipt issued', detail: 'Receipt generated for completed invoice', status: 'success', createdAt: isoDaysAgoAt(1, 14, 10), referenceNumber: 'RCP-002', relatedSaleId: 's2' },
    { id: 'act-004', activityNumber: 'ACT-004', entityType: 'sale', entityId: 's2', actionType: 'invoice_created', title: 'Invoice created', detail: 'Invoice recorded for Kojo Mini Mart', status: 'success', createdAt: isoDaysAgoAt(1, 14, 10), referenceNumber: 'INV-002', relatedSaleId: 's2' },
  ],
  users: [
    {
      userId: 'u-admin',
      name: 'Admin User',
      email: 'admin@bisapilot.gh',
      accountStatus: 'active',
      role: 'Admin',
      grantedPermissions: [],
      revokedPermissions: [],
    },
    {
      userId: 'u-sales',
      name: 'Sales Manager',
      email: 'sales@bisapilot.gh',
      accountStatus: 'active',
      role: 'SalesManager',
      grantedPermissions: [],
      revokedPermissions: [],
    },
    {
      userId: 'u-accountant',
      name: 'Accountant User',
      email: 'accountant@bisapilot.gh',
      accountStatus: 'active',
      role: 'Accountant',
      grantedPermissions: [],
      revokedPermissions: [],
    },
  ],
  currentUserId: 'u-admin',
  restockRequests: [],
  expenses: [
    { id: 'exp-2', category: 'Utility', amount: 85, note: 'Electricity bill', createdAt: isoDaysAgoAt(2, 16, 30), recordedByUserId: 'u-admin', recordedByName: 'Admin User' },
  ],
  themePreference: 'system',
};

export const priorityQuestions = [
  'What was sold today across cash and mobile money?',
  'Which customers still owe and need follow-up?',
  'Which products are close to stock-out?',
  'How much cash came in and went out today?',
];

export const roadmapSteps = [
  { id: 'r1', title: 'Ionic React shell scaffolded', detail: 'Core web and mobile-friendly shell is ready for product iteration.', done: true },
  { id: 'r2', title: 'Transaction-derived business state', detail: 'Stock, receivables, and dashboard totals now derive from explicit movements and ledger entries.', done: true },
  { id: 'r3', title: 'Sales-to-invoice flow', detail: 'Teams can record a sale, create an invoice, pick cash or mobile money, and update stock plus customer balances instantly.', done: true },
  { id: 'r4', title: 'Backend integration', detail: 'Auth, sync, and reporting APIs can land after the local product flow is stable.', done: false },
];
