import { createProductImage } from '../utils/productArtwork';

export type PaymentMethod = 'Cash' | 'Mobile Money';
export type SaleStatus = 'Completed' | 'Reversed';

export type BusinessProfile = {
  id: string;
  businessName: string;
  currency: string;
  country: string;
  receiptPrefix: string;
  invoicePrefix: string;
  phone: string;
  email: string;
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
};

export type Customer = {
  id: string;
  clientId: string;
  name: string;
  channel: string;
};

export type Sale = {
  id: string;
  invoiceNumber: string;
  receiptId: string;
  customerId: string;
  productId: string;
  quantity: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  totalAmount: number;
  createdAt: string;
  status: SaleStatus;
  quotationId?: string;
  reversalReason?: string;
  reversedAt?: string;
  reversedBy?: string;
  correctionOfSaleId?: string;
  correctedBySaleId?: string;
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
  items: QuotationLine[];
  totalAmount: number;
  status: 'Draft' | 'Converted';
  convertedAt?: string;
  relatedSaleIds?: string[];
};

export type StockMovement = {
  id: string;
  movementNumber: string;
  productId: string;
  type: 'opening' | 'sale' | 'reversal';
  quantityDelta: number;
  quantityAfter: number;
  createdAt: string;
  relatedSaleId?: string;
  referenceNumber?: string;
  note: string;
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
    | 'quotation_created'
    | 'quotation_converted'
    | 'invoice_created'
    | 'receipt_issued'
    | 'invoice_reversed'
    | 'corrected_copy_created'
    | 'business_profile_updated';
  title: string;
  detail: string;
  status: 'info' | 'success' | 'warning';
  createdAt: string;
  referenceNumber?: string;
  relatedEntityId?: string;
  relatedSaleId?: string;
};

export type BusinessState = {
  businessProfile: BusinessProfile;
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  quotations: Quotation[];
  stockMovements: StockMovement[];
  customerLedgerEntries: CustomerLedgerEntry[];
  activityLogEntries: ActivityLogEntry[];
};

const now = new Date();
const isoDaysAgoAt = (days: number, hour: number, minute = 0) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, hour, minute, 0, 0).toISOString();

export const seedState: BusinessState = {
  businessProfile: {
    id: 'biz-001',
    businessName: 'BizPilot GH Demo Shop',
    currency: 'GHS',
    country: 'Ghana',
    receiptPrefix: 'RCP-',
    invoicePrefix: 'INV-',
    phone: '+233 24 000 0000',
    email: 'hello@bizpilotgh.app',
  },
  products: [
    { id: 'p1', inventoryId: 'INV-001', name: 'Sunlight Detergent', unit: 'packs', price: 35, cost: 27, reorderLevel: 10, image: createProductImage('Sunlight', '#f4c95d', '#1d4738') },
    { id: 'p2', inventoryId: 'INV-002', name: 'Paracetamol 500mg', unit: 'boxes', price: 42, cost: 34, reorderLevel: 12, image: createProductImage('Paracetamol', '#78d2b7', '#213b5b') },
    { id: 'p3', inventoryId: 'INV-003', name: 'Phone Chargers', unit: 'units', price: 55, cost: 40, reorderLevel: 8, image: createProductImage('Chargers', '#9bbcff', '#292d4f') },
    { id: 'p4', inventoryId: 'INV-004', name: 'Hair Food', unit: 'tins', price: 28, cost: 19, reorderLevel: 9, image: createProductImage('Hair Food', '#ff9f8f', '#4d2434') },
  ],
  customers: [
    { id: 'c1', clientId: 'CLT-001', name: 'Ama Beauty Supplies', channel: 'WhatsApp follow-up' },
    { id: 'c2', clientId: 'CLT-002', name: 'Kojo Mini Mart', channel: 'No action needed' },
    { id: 'c3', clientId: 'CLT-003', name: 'Nhyira Agro Shop', channel: 'Call owner' },
    { id: 'c4', clientId: 'CLT-004', name: 'Walk-in customer', channel: 'Counter sale' },
  ],
  sales: [
    {
      id: 's1',
      invoiceNumber: 'INV-001',
      receiptId: 'RCP-001',
      customerId: 'c1',
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
    { id: 'sm-001', movementNumber: 'SMV-001', productId: 'p1', type: 'opening', quantityDelta: 16, quantityAfter: 16, createdAt: isoDaysAgoAt(7, 9, 0), note: 'Opening stock loaded', referenceNumber: 'OPENING' },
    { id: 'sm-002', movementNumber: 'SMV-002', productId: 'p2', type: 'opening', quantityDelta: 8, quantityAfter: 8, createdAt: isoDaysAgoAt(7, 9, 5), note: 'Opening stock loaded', referenceNumber: 'OPENING' },
    { id: 'sm-003', movementNumber: 'SMV-003', productId: 'p3', type: 'opening', quantityDelta: 19, quantityAfter: 19, createdAt: isoDaysAgoAt(7, 9, 10), note: 'Opening stock loaded', referenceNumber: 'OPENING' },
    { id: 'sm-004', movementNumber: 'SMV-004', productId: 'p4', type: 'opening', quantityDelta: 22, quantityAfter: 22, createdAt: isoDaysAgoAt(7, 9, 15), note: 'Opening stock loaded', referenceNumber: 'OPENING' },
    { id: 'sm-005', movementNumber: 'SMV-005', productId: 'p1', type: 'sale', quantityDelta: -4, quantityAfter: 12, createdAt: isoDaysAgoAt(1, 14, 10), relatedSaleId: 's2', referenceNumber: 'RCP-002', note: 'Stock reduced by sale' },
    { id: 'sm-006', movementNumber: 'SMV-006', productId: 'p4', type: 'sale', quantityDelta: -6, quantityAfter: 16, createdAt: isoDaysAgoAt(0, 12, 15), relatedSaleId: 's1', referenceNumber: 'RCP-001', note: 'Stock reduced by sale' },
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
  { id: 'r3', title: 'Sales recording flow', detail: 'Teams can record a sale, pick cash or mobile money, and update stock plus customer balances instantly.', done: true },
  { id: 'r4', title: 'Backend integration', detail: 'Auth, sync, and reporting APIs can land after the local product flow is stable.', done: false },
];
