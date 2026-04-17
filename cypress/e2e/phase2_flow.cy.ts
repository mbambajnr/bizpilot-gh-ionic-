describe('BizPilot Phase 2 Flow', () => {
  beforeEach(() => {
    cy.visit('/');
    // Sign in as Admin by default (seed state)
    cy.visit('/settings');
  });

  it('Admin can manage branding assets', () => {
    cy.get('strong').contains('Admin User').should('exist');
    cy.get('h2').contains('Brand identity').should('exist');
    
    // Test labels exist
    cy.contains('Company logo').should('exist');
    cy.contains('Owner signature').should('exist');
  });

  it('Sales Manager can request restock', () => {
    // Switch to Sales Manager
    cy.get('ion-chip').contains('Sales Manager').click({ force: true });
    cy.get('strong').contains('Sales Manager').should('exist');

    // Go to Inventory
    cy.visit('/inventory');
    
    // Select first product
    cy.get('.list-row', { timeout: 10000 }).first().click({ force: true });
    
    // Check Request Restock form exists
    cy.contains('Request Restock').should('exist');
    cy.get('input[type="number"]').last().type('100');
    cy.get('ion-button').contains('Submit Request').click({ force: true });
    
    // Check for success toast
    cy.contains('Restock request submitted').should('be.visible');
    
    // Check request appears in history
    cy.contains('Awaiting review').should('exist');
  });

  it('Admin can review restock requests', () => {
    // Ensure we have a request (can reuse flow from above or assume state)
    // For local-only test, we need to create it first in the session
    cy.get('ion-chip').contains('Sales Manager').click({ force: true });
    cy.visit('/inventory');
    cy.get('.list-row').first().click({ force: true });
    cy.get('input[type="number"]').last().type('50');
    cy.get('ion-button').contains('Submit Request').click({ force: true });

    // Switch to Admin
    cy.visit('/settings');
    cy.get('ion-chip').contains('Admin User').click({ force: true });

    // Check restock queue
    cy.get('h2').contains('Restock requests queue').should('exist');
    cy.contains('Pending').should('exist');
    
    // Approve it
    cy.get('ion-button').contains('Approve').click({ force: true });
    cy.contains('Approved').should('exist');
    
    // Fulfill it
    cy.get('ion-button').contains('Mark Fulfilled').click({ force: true });
    cy.contains('Fulfilled').should('exist');
  });

  it('Document headers show Print/PDF gated buttons', () => {
    // Visit an invoice (s1 is in seed)
    cy.visit('/sales/s1');
    
    // Admin sees them
    cy.contains('Invoice Detail').should('exist');
    cy.contains('Print Invoice').should('exist');
    cy.contains('Export PDF').should('exist');

    // Switch to Accountant (who should NOT see them by default)
    cy.visit('/settings');
    cy.get('ion-chip').contains('Accountant User').click({ force: true });
    
    // Accountant cannot see the sales page at all
    cy.visit('/sales/s1');
    cy.contains('Not Authorized').should('exist');
  });
});
