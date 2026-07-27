import { describe, expect, it } from 'vitest';

import { seedState, type BusinessState, type Purchase } from '../data/seedBusiness';
import { addPurchaseDocumentInState, removePurchaseDocumentInState, updatePurchaseDetailsInState } from './businessLogic';

function createState(): BusinessState {
  const purchase: Purchase = {
    id: 'purchase-terms-test',
    purchaseCode: 'PO-TEST-001',
    vendorId: 'vendor-1',
    vendorCode: 'VEN-001',
    items: [],
    totalAmount: 1250,
    status: 'approved',
    createdBy: 'buyer-1',
    documents: [],
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
  };
  return { ...structuredClone(seedState), purchases: [purchase], activityLogEntries: [] };
}

describe('procurement delivery controls and documents', () => {
  it('saves delivery commitments and creates an audit event', () => {
    const result = updatePurchaseDetailsInState(createState(), {
      purchaseId: 'purchase-terms-test',
      expectedDeliveryDate: '2026-07-30',
      paymentTerms: 'Net 30',
      internalNotes: 'Deliver to the central warehouse.',
      updatedBy: 'buyer-1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.data) throw new Error('Expected purchase details update to succeed.');
    expect(result.data.purchases[0]).toMatchObject({
      expectedDeliveryDate: '2026-07-30',
      paymentTerms: 'Net 30',
      internalNotes: 'Deliver to the central warehouse.',
    });
    expect(result.data.activityLogEntries[0].actionType).toBe('purchase_details_updated');
  });

  it('requires secure document links', () => {
    const result = addPurchaseDocumentInState(createState(), {
      purchaseId: 'purchase-terms-test',
      category: 'supplierQuote',
      name: 'Supplier quote',
      url: 'http://files.example.com/quote.pdf',
      uploadedBy: 'buyer-1',
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('HTTPS');
  });

  it('attaches a document once and records the action', () => {
    const input = {
      purchaseId: 'purchase-terms-test',
      category: 'supplierQuote' as const,
      name: 'Supplier quote',
      url: 'https://files.example.com/quote.pdf',
      uploadedBy: 'buyer-1',
    };
    const first = addPurchaseDocumentInState(createState(), input);
    expect(first.ok).toBe(true);
    if (!first.ok || !first.data) throw new Error('Expected document attachment to succeed.');
    expect(first.data.purchases[0].documents).toHaveLength(1);
    expect(first.data.activityLogEntries[0].actionType).toBe('purchase_document_added');

    const duplicate = addPurchaseDocumentInState(first.data, input);
    expect(duplicate.ok).toBe(false);
    expect(duplicate.message).toContain('already attached');
  });

  it('accepts private storage metadata without exposing a public URL', () => {
    const result = addPurchaseDocumentInState(createState(), {
      purchaseId: 'purchase-terms-test',
      category: 'deliveryNote',
      name: 'Delivery note.pdf',
      storagePath: 'business-1/purchase-terms-test/document.pdf',
      mimeType: 'application/pdf',
      size: 2048,
      uploadedBy: 'buyer-1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.data) throw new Error('Expected private document metadata to be accepted.');
    expect(result.data.purchases[0].documents?.[0]).toMatchObject({
      storagePath: 'business-1/purchase-terms-test/document.pdf',
      mimeType: 'application/pdf',
      size: 2048,
      url: undefined,
    });
  });

  it('removes document metadata without deleting the audit trail', () => {
    const attached = addPurchaseDocumentInState(createState(), {
      purchaseId: 'purchase-terms-test', category: 'supplierInvoice', name: 'Invoice.pdf',
      storagePath: 'business-1/purchase-terms-test/invoice.pdf', uploadedBy: 'accountant-1',
    });
    if (!attached.ok || !attached.data) throw new Error('Expected document setup to succeed.');
    const documentId = attached.data.purchases[0].documents?.[0].id;
    if (!documentId) throw new Error('Expected attached document id.');

    const removed = removePurchaseDocumentInState(attached.data, { purchaseId: 'purchase-terms-test', documentId, removedBy: 'accountant-1' });
    expect(removed.ok).toBe(true);
    if (!removed.ok || !removed.data) throw new Error('Expected document removal to succeed.');
    expect(removed.data.purchases[0].documents).toEqual([]);
    expect(removed.data.activityLogEntries.map((entry) => entry.actionType)).toEqual(['purchase_document_removed', 'purchase_document_added']);
  });
});
