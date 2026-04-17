import { describe, it, expect } from 'vitest';
import { 
  addRestockRequestToState, 
  reviewRestockRequestInState, 
  updateBrandingInState 
} from './businessLogic';
import { seedState } from '../data/seedBusiness';

describe('Phase 2 Business Logic', () => {
  const initialState = { ...seedState, restockRequests: [] };

  describe('Restock Requests', () => {
    it('should create a new restock request', () => {
      const result = addRestockRequestToState(initialState, {
        productId: 'p1',
        requestedByUserId: 'u-sales',
        requestedByName: 'Sales Manager',
        requestedQuantity: 50,
        urgency: 'High',
        note: 'Urgent need'
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.data) {
        expect(result.data.restockRequests.length).toBe(1);
        expect(result.data.restockRequests[0].productName).toBe('Sunlight Detergent');
        expect(result.data.restockRequests[0].status).toBe('Pending');
      }
    });

    it('should allow an admin to approve a restock request', () => {
      const stateWithRequest = addRestockRequestToState(initialState, {
        productId: 'p1',
        requestedByUserId: 'u-sales',
        requestedByName: 'Sales Manager',
        requestedQuantity: 50,
        urgency: 'High',
      });

      if (stateWithRequest.ok && stateWithRequest.data) {
        const requestId = stateWithRequest.data.restockRequests[0].id;
        const result = reviewRestockRequestInState(stateWithRequest.data, {
          requestId,
          status: 'Approved',
          reviewedByUserId: 'u-admin',
          reviewedByName: 'Manager',
          reviewNote: 'Approved for arrival'
        });

        expect(result.ok).toBe(true);
        if (result.ok && result.data) {
          expect(result.data.restockRequests[0].status).toBe('Approved');
        }
      }
    });

    it('should increase stock when a restock request is Fulfilled', () => {
      const stateWithRequest = addRestockRequestToState(initialState, {
        productId: 'p1',
        requestedByUserId: 'u-sales',
        requestedByName: 'Sales Manager',
        requestedQuantity: 50,
        urgency: 'High',
      });

      if (stateWithRequest.ok && stateWithRequest.data) {
        const requestId = stateWithRequest.data.restockRequests[0].id;
        const result = reviewRestockRequestInState(stateWithRequest.data, {
          requestId,
          status: 'Fulfilled',
          reviewedByUserId: 'u-admin',
          reviewedByName: 'Manager',
          reviewNote: 'Stock arrived'
        });

        expect(result.ok).toBe(true);
        if (result.ok && result.data) {
          expect(result.data.restockRequests[0].status).toBe('Fulfilled');
          
          // Verify stock movement
          const movement = result.data.stockMovements[0];
          expect(movement.type).toBe('restock');
          expect(movement.quantityDelta).toBe(50);
          
          // Verify activity log
          const activity = result.data.activityLogEntries[0];
          expect(activity.actionType).toBe('restock_fulfilled');
        }
      }
    });
  });

  describe('Branding', () => {
    it('should update company logo and signature', () => {
      const result = updateBrandingInState(initialState, {
        logoUrl: 'data:image/png;base64,logo',
        signatureUrl: 'data:image/png;base64,sig'
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.data) {
        expect(result.data.businessProfile.logoUrl).toBe('data:image/png;base64,logo');
        expect(result.data.businessProfile.signatureUrl).toBe('data:image/png;base64,sig');
      }
    });
  });
});
