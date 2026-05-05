const seededState = {
  businessProfile: {
    id: 'biz-001',
    businessName: 'Deltech',
    businessType: 'General Retail',
    currency: 'GHS',
    country: 'Ghana',
    receiptPrefix: 'RCP-',
    invoicePrefix: 'INV-',
    phone: '+233539590469',
    email: 'hello@deltech.com',
    logoUrl: '',
    signatureUrl: '',
    address: '92/93 Poppet 12',
    website: 'www.delteh.com',
    waybillPrefix: 'WAY-',
  },
  products: [
    {
      id: 'p1',
      inventoryId: 'INV-002',
      name: 'Airconditioner',
      unit: 'units',
      price: 89000,
      cost: 70000,
      reorderLevel: 2,
      image: '',
    },
    {
      id: 'p2',
      inventoryId: 'INV-003',
      name: 'Cable Roll',
      unit: 'rolls',
      price: 1200,
      cost: 800,
      reorderLevel: 5,
      image: '',
    },
  ],
  customers: [
    {
      id: 'c1',
      clientId: 'CLT-001',
      name: 'GHACEM',
      phone: '+233500000001',
      whatsapp: '+233500000001',
      email: 'accounts@ghacem.test',
      channel: 'WhatsApp follow-up',
    },
    {
      id: 'c2',
      clientId: 'CLT-002',
      name: 'Walk-in customer',
      phone: '',
      whatsapp: '',
      email: '',
      channel: 'Counter sale',
    },
  ],
  sales: [
    {
      id: 's1',
      invoiceNumber: 'INV-001',
      receiptId: 'RCP-001',
      customerId: 'c1',
      items: [
        {
          productId: 'p1',
          productName: 'Airconditioner',
          inventoryId: 'INV-002',
          quantity: 1,
          unitPrice: 89000,
          total: 89000,
        },
      ],
      productId: 'p1',
      quantity: 1,
      paymentMethod: 'Bank Account',
      paidAmount: 890,
      totalAmount: 89000,
      createdAt: '2026-04-18T00:00:00.000Z',
      status: 'Completed',
      paymentReference: 'BANK-001',
    },
  ],
  quotations: [
    {
      id: 'q1',
      quotationNumber: 'QTN-001',
      customerId: 'c1',
      customerName: 'GHACEM',
      clientId: 'CLT-001',
      createdAt: '2026-04-18T00:00:00.000Z',
      items: [
        {
          productId: 'p2',
          productName: 'Cable Roll',
          inventoryId: 'INV-003',
          quantity: 3,
          unitPrice: 1200,
          total: 3600,
        },
      ],
      totalAmount: 3600,
      status: 'Draft',
    },
  ],
  stockMovements: [
    {
      id: 'm1',
      movementNumber: 'MOV-001',
      productId: 'p1',
      type: 'opening',
      quantityDelta: 6,
      quantityAfter: 6,
      createdAt: '2026-04-17T10:00:00.000Z',
      referenceNumber: 'OPENING',
      note: 'Opening stock loaded for new item',
    },
    {
      id: 'm2',
      movementNumber: 'MOV-002',
      productId: 'p2',
      type: 'opening',
      quantityDelta: 12,
      quantityAfter: 12,
      createdAt: '2026-04-17T10:30:00.000Z',
      referenceNumber: 'OPENING',
      note: 'Opening stock loaded for new item',
    },
    {
      id: 'm3',
      movementNumber: 'MOV-003',
      productId: 'p1',
      type: 'sale',
      quantityDelta: -1,
      quantityAfter: 5,
      createdAt: '2026-04-18T00:00:00.000Z',
      relatedSaleId: 's1',
      referenceNumber: 'INV-001',
      note: 'Sold to customer',
    },
  ],
  customerLedgerEntries: [
    {
      id: 'led-1',
      entryNumber: 'LED-001',
      customerId: 'c1',
      type: 'sale_charge',
      amountDelta: 89000,
      createdAt: '2026-04-18T00:00:00.000Z',
      relatedSaleId: 's1',
      referenceNumber: 'INV-001',
      note: 'Sale posted to customer ledger',
    },
    {
      id: 'led-2',
      entryNumber: 'LED-002',
      customerId: 'c1',
      type: 'payment_received',
      amountDelta: -890,
      createdAt: '2026-04-18T00:00:00.000Z',
      relatedSaleId: 's1',
      referenceNumber: 'BANK-001',
      paymentMethod: 'Bank Account',
      note: 'Partial bank payment received',
    },
  ],
  activityLogEntries: [],
  users: [
    {
      userId: 'test-user',
      name: 'Test User',
      email: 'test@example.com',
      role: 'Admin',
      grantedPermissions: [],
      revokedPermissions: [],
    },
  ],
  currentUserId: 'test-user',
  restockRequests: [],
  expenses: [],
  themePreference: 'system',
};

function seedAppState(win: Window) {
  (win as Window & {
    __BIZAPILOT_TEST_SESSION__?: {
      user: { id: string; email: string; user_metadata: { business_name: string } };
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };
  }).__BIZAPILOT_TEST_SESSION__ = {
    user: {
      id: 'test-user',
      email: 'test@example.com',
      user_metadata: { business_name: 'Deltech' },
    },
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
  };
  win.localStorage.setItem('bizpilot-gh-state-v1', JSON.stringify(seededState));
}

describe('Mobile QA snapshots', () => {
  beforeEach(() => {
    cy.viewport(390, 844);
    cy.clearLocalStorage();
  });

  it('captures priority mobile screens', () => {
    cy.visit('/sales', { onBeforeLoad: seedAppState });
    cy.get('[data-testid="sales-page"]').should('exist');
    cy.screenshot('mobile-sales-top');
    cy.contains('Recent invoices').scrollIntoView();
    cy.screenshot('mobile-sales-bottom');

    cy.visit('/inventory', { onBeforeLoad: seedAppState });
    cy.contains('Inventory').should('exist');
    cy.screenshot('mobile-inventory-status');

    cy.visit('/customers', { onBeforeLoad: seedAppState });
    cy.contains('Customer Directory').should('exist');
    cy.screenshot('mobile-customers-list');
    cy.get('[aria-label*="Edit"]').first().click({ force: true });
    cy.screenshot('mobile-customers-edit-modal');

    cy.visit('/sales/s1', { onBeforeLoad: seedAppState });
    cy.contains('Invoice Actions').should('exist');
    cy.screenshot('mobile-invoice-detail');

    cy.visit('/quotations/q1', { onBeforeLoad: seedAppState });
    cy.contains('Quotation').should('exist');
    cy.screenshot('mobile-quotation-detail');

    cy.visit('/sales/s1/waybill', { onBeforeLoad: seedAppState });
    cy.contains('Waybill').should('exist');
    cy.screenshot('mobile-waybill-detail');

    cy.visit('/export/batch', { onBeforeLoad: seedAppState });
    cy.contains('Document Pack Builder').should('exist');
    cy.screenshot('mobile-batch-export');
    cy.get('ion-checkbox').first().click({ force: true });
    cy.screenshot('mobile-batch-export-selected');

    cy.visit('/settings', { onBeforeLoad: seedAppState });
    cy.contains('Business Setup').should('exist');
    cy.screenshot('mobile-settings-top');
  });
});
