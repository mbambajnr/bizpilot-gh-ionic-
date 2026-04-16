describe('Sales Flow', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/sales');
  });

  it('records a new sale successfully', () => {
    // Basic presence check
    cy.get('[data-testid="sales-page"]').should('exist');
    
    // Record sale using defaults
    cy.get('[data-testid="record-sale-button"]').click({ force: true });

    // Verify success by checking if the latest receipt appeared
    cy.contains('Latest receipt', { timeout: 10000 }).should('exist');
    
    // Verify it appears in recent invoices
    cy.contains('Recent invoices').scrollIntoView();
    cy.get('.list-row').should('have.length.at.least', 1);
  });
});
