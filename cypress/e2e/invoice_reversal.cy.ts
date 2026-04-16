describe('Invoice Reversal Flow', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    // Start at sales page to have a sale to open
    cy.visit('/sales');
    
    // Create a sale first and wait for it
    cy.get('[data-testid="record-sale-button"]').click({ force: true });
    cy.contains('Latest receipt', { timeout: 10000 }).should('exist');
  });

  it('navigates to invoice detail and performs reversal', () => {
    // Open the first invoice in the list
    cy.get('[data-testid="recent-invoices-list"]').find('.list-row').first().contains('Open').click({ force: true });

    // Verify detail page loaded
    cy.get('[data-testid="invoice-detail-page"]', { timeout: 8000 }).should('exist');

    // Trigger reversal
    cy.get('[data-testid="reverse-invoice-button"]').click({ force: true });

    // Fill reversal reason in modal
    cy.get('[data-testid="reversal-reason-input"]').find('textarea').type('Test reversal reason', { force: true });
    cy.get('[data-testid="confirm-reversal-button"]').click({ force: true });

    // Verify reversal reflected on page
    cy.contains('Void', { timeout: 8000 }).should('exist');
    cy.contains('Adjustment details').should('exist');
  });
});
