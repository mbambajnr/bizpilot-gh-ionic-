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
    { id: 'p1', inventoryId: 'INV-002', name: 'Airconditioner', unit: 'units', price: 89000, cost: 70000, reorderLevel: 2, image: '' },
    { id: 'p2', inventoryId: 'INV-003', name: 'Cable Roll', unit: 'rolls', price: 1200, cost: 800, reorderLevel: 5, image: '' },
  ],
  customers: [
    { id: 'c1', clientId: 'CLT-001', name: 'GHACEM', phone: '+233500000001', whatsapp: '+233500000001', email: 'accounts@ghacem.test', channel: 'WhatsApp follow-up' },
  ],
  sales: [
    {
      id: 's1',
      invoiceNumber: 'INV-001',
      receiptId: 'RCP-001',
      customerId: 'c1',
      items: [{ productId: 'p1', productName: 'Airconditioner', inventoryId: 'INV-002', quantity: 1, unitPrice: 89000, total: 89000 }],
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
      items: [{ productId: 'p2', productName: 'Cable Roll', inventoryId: 'INV-003', quantity: 3, unitPrice: 1200, total: 3600 }],
      totalAmount: 3600,
      status: 'Draft',
    },
  ],
  stockMovements: [],
  customerLedgerEntries: [],
  activityLogEntries: [],
  users: [{ userId: 'test-user', name: 'Test User', email: 'test@example.com', role: 'Admin', grantedPermissions: [], revokedPermissions: [] }],
  currentUserId: 'test-user',
  restockRequests: [],
  expenses: [],
  themePreference: 'system',
};

function seedAppState(win: Window) {
  win.localStorage.setItem('bizpilot-gh-state-v1', JSON.stringify(seededState));
}

describe('Mobile QA document screens', () => {
  beforeEach(() => {
    cy.viewport(390, 844);
    cy.clearLocalStorage();
  });

  it('captures document-heavy mobile screens', () => {
    cy.visit('/quotations/q1', { onBeforeLoad: seedAppState });
    cy.contains('Quotation').should('exist');
    cy.screenshot('mobile-quotation-detail-after');

    cy.visit('/sales/s1/waybill', { onBeforeLoad: seedAppState });
    cy.contains('Waybill').should('exist');
    cy.screenshot('mobile-waybill-detail-after');

    cy.visit('/export/batch', { onBeforeLoad: seedAppState });
    cy.contains('Document Pack').should('exist');
    cy.screenshot('mobile-batch-export-after');
    cy.get('ion-checkbox').first().click({ force: true });
    cy.screenshot('mobile-batch-export-selected-after');
  });
});
