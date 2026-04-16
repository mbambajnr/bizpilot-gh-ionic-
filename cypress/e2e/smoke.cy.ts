describe('Smoke Test', () => {
  beforeEach(() => {
    // Clear state for determinism
    cy.clearLocalStorage();
    cy.visit('/');
  });

  it('loads the dashboard and shows the business name', () => {
    // Verify we bypass the AuthGate into the Dashboard
    cy.get('[data-testid="dashboard-page"]').should('exist');
    cy.get('ion-title').should('contain', 'BizPilot GH Demo Shop');
  });

  it('navigates through tabs', () => {
    // Check Sales tab
    cy.get('[data-testid="tab-sales"]').click({ force: true });
    cy.get('[data-testid="sales-page"]').should('exist');

    // Check Dashboard tab
    cy.get('[data-testid="tab-dashboard"]').click({ force: true });
    cy.get('[data-testid="dashboard-page"]').should('exist');
  });
});
