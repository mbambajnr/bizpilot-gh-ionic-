import { createProductImage } from '../utils/productArtwork';

export type PaymentMethod = 'Cash' | 'Mobile Money';

export type Product = {
  id: string;
  inventoryId: string;
  name: string;
  unit: string;
  price: number;
  cost: number;
  reorderLevel: number;
  quantity: number;
  image: string;
};

export type Customer = {
  id: string;
  clientId: string;
  name: string;
  channel: string;
  lastPayment: string;
  balance: number;
};

export type Sale = {
  id: string;
  customerId: string;
  productId: string;
  quantity: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  totalAmount: number;
  createdAt: string;
};

export type BusinessState = {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
};

export const seedState: BusinessState = {
  products: [
    { id: 'p1', inventoryId: 'INV-001', name: 'Sunlight Detergent', unit: 'packs', price: 35, cost: 27, reorderLevel: 10, quantity: 12, image: createProductImage('Sunlight', '#f4c95d', '#1d4738') },
    { id: 'p2', inventoryId: 'INV-002', name: 'Paracetamol 500mg', unit: 'boxes', price: 42, cost: 34, reorderLevel: 12, quantity: 8, image: createProductImage('Paracetamol', '#78d2b7', '#213b5b') },
    { id: 'p3', inventoryId: 'INV-003', name: 'Phone Chargers', unit: 'units', price: 55, cost: 40, reorderLevel: 8, quantity: 19, image: createProductImage('Chargers', '#9bbcff', '#292d4f') },
    { id: 'p4', inventoryId: 'INV-004', name: 'Hair Food', unit: 'tins', price: 28, cost: 19, reorderLevel: 9, quantity: 16, image: createProductImage('Hair Food', '#ff9f8f', '#4d2434') },
  ],
  customers: [
    { id: 'c1', clientId: 'CLT-001', name: 'Ama Beauty Supplies', channel: 'WhatsApp follow-up', lastPayment: 'Today, MoMo', balance: 380 },
    { id: 'c2', clientId: 'CLT-002', name: 'Kojo Mini Mart', channel: 'No action needed', lastPayment: 'Yesterday, Cash', balance: 0 },
    { id: 'c3', clientId: 'CLT-003', name: 'Nhyira Agro Shop', channel: 'Call owner', lastPayment: '3 days ago, MoMo', balance: 1040 },
    { id: 'c4', clientId: 'CLT-004', name: 'Walk-in customer', channel: 'Counter sale', lastPayment: 'Today, Cash', balance: 0 },
  ],
  sales: [
    {
      id: 's1',
      customerId: 'c1',
      productId: 'p4',
      quantity: 6,
      paymentMethod: 'Mobile Money',
      paidAmount: 168,
      totalAmount: 168,
      createdAt: new Date().toISOString(),
    },
    {
      id: 's2',
      customerId: 'c2',
      productId: 'p1',
      quantity: 4,
      paymentMethod: 'Cash',
      paidAmount: 140,
      totalAmount: 140,
      createdAt: new Date(Date.now() - 1000 * 60 * 46).toISOString(),
    },
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
  { id: 'r2', title: 'Real local-first state', detail: 'Sales, stock, and customer balances are now stored in the app and persisted locally.', done: true },
  { id: 'r3', title: 'Sales recording flow', detail: 'Teams can record a sale, pick cash or mobile money, and update balances instantly.', done: true },
  { id: 'r4', title: 'Backend integration', detail: 'Auth, sync, and reporting APIs can land after the local product flow is stable.', done: false },
];
