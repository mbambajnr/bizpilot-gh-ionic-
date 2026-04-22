import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import {
  selectCustomerBalance,
  selectDashboardMetrics,
  selectProductQuantityOnHand,
  selectSaleBalanceRemaining,
  selectSalePaymentStatus,
} from '../selectors/businessSelectors';
import {
  addCustomerToState,
  addProductToState,
  addQuotationToState,
  addSaleToState,
  convertQuotationToSalesState,
  restoreBusinessState,
  reverseSaleInState,
  updateCustomerStatusInState,
  updateCustomerInState,
} from './businessLogic';

describe('businessLogic', () => {
  it('rejects invalid product numbers', () => {
    const result = addProductToState(seedState, {
      name: 'Rice Bag',
      unit: 'bags',
      price: Number.NaN,
      cost: 50,
      reorderLevel: 4,
      quantity: 10,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Selling price');
    }
  });

  it('adds a product with the next inventory id', () => {
    const result = addProductToState(seedState, {
      name: 'Rice Bag',
      unit: 'bags',
      price: 80,
      cost: 60,
      reorderLevel: 4,
      quantity: 10,
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.products[0].inventoryId).toBe('INV-005');
      expect(selectProductQuantityOnHand(result.data, result.data.products[0].id)).toBe(10);
    }
  });

  it('uses a custom inventory id when provided', () => {
    const result = addProductToState(seedState, {
      name: 'Rice Bag',
      inventoryId: 'INV-CUSTOM-01',
      unit: 'bags',
      price: 80,
      cost: 60,
      reorderLevel: 4,
      quantity: 10,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.products[0].inventoryId).toBe('INV-CUSTOM-01');
    }
  });

  it('rejects a duplicate custom inventory id after trimming', () => {
    const result = addProductToState(seedState, {
      name: 'Rice Bag',
      inventoryId: '  INV-001  ',
      unit: 'bags',
      price: 80,
      cost: 60,
      reorderLevel: 4,
      quantity: 10,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Inventory ID already exists');
    }
  });

  it('rejects sale input with invalid paid amount', () => {
    const result = addSaleToState(seedState, {
      customerId: 'c1',
      items: [{ productId: 'p1', quantity: 1 }],
      paymentMethod: 'Cash',
      paidAmount: Number.NaN,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('valid number');
    }
  });

  it('sale creates correct stock movements and customer ledger entries', () => {
    const result = addSaleToState(seedState, {
      customerId: 'c1',
      items: [{ productId: 'p2', quantity: 1 }],
      paymentMethod: 'Cash',
      paidAmount: 40,
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      const recordedSale = result.data.sales[0];
      const latestMovement = result.data.stockMovements[0];
      const latestLedgerEntries = result.data.customerLedgerEntries.slice(0, 2);

      expect(recordedSale.receiptId).toBe('RCP-003');
      expect(recordedSale.invoiceNumber).toBe('INV-003');
      expect(selectProductQuantityOnHand(result.data, 'p2')).toBe(7);
      expect(latestMovement.relatedSaleId).toBe(recordedSale.id);
      expect(latestMovement.quantityDelta).toBe(-1);
      expect(latestLedgerEntries.some((entry) => entry.type === 'sale_charge' && entry.amountDelta === 42)).toBe(true);
      expect(latestLedgerEntries.some((entry) => entry.type === 'payment_received' && entry.amountDelta === -40)).toBe(true);
      expect(selectCustomerBalance(result.data, 'c1')).toBe(382);
    }
  });

  it('partial payment status is correct', () => {
    const result = addSaleToState(seedState, {
      customerId: 'c1',
      items: [{ productId: 'p2', quantity: 1 }],
      paymentMethod: 'Cash',
      paidAmount: 40,
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      const recordedSale = result.data.sales[0];
      expect(selectSalePaymentStatus(recordedSale)).toBe('Partial');
      expect(selectSaleBalanceRemaining(recordedSale)).toBe(2);
    }
  });

  it('restores missing business ids and migrates legacy local state', () => {
    const restored = restoreBusinessState({
      ...seedState,
      products: seedState.products.map((product, index) => ({
        ...product,
        inventoryId: undefined,
        quantity: [12, 8, 19, 16][index],
      })),
      customers: seedState.customers.map((customer, index) => ({
        ...customer,
        clientId: undefined,
        balance: [380, 0, 1040, 0][index],
      })),
      stockMovements: [],
      customerLedgerEntries: [],
      activityLogEntries: [],
    } as unknown as typeof seedState);

    expect(restored.products[0].inventoryId).toBe('INV-001');
    expect(restored.customers[0].clientId).toBe('CLT-001');
    expect(restored.stockMovements.length).toBeGreaterThan(0);
    expect(restored.customerLedgerEntries.length).toBeGreaterThan(0);
  });

  it('restores legacy customers while preserving phone, whatsapp, and email when present', () => {
    const restored = restoreBusinessState({
      ...seedState,
      customers: [
        {
          ...seedState.customers[0],
          phone: '+233555000111',
          whatsapp: '+233555000222',
          email: 'legacy@example.com',
        },
        {
          ...seedState.customers[1],
          phone: '+233555000333',
        },
      ],
    } as unknown as typeof seedState);

    expect(restored.customers[0].phone).toBe('+233555000111');
    expect(restored.customers[0].whatsapp).toBe('+233555000222');
    expect(restored.customers[0].email).toBe('legacy@example.com');
    expect(restored.customers[1].phone).toBe('+233555000333');
    expect(restored.customers[1].whatsapp).toBe('');
    expect(restored.customers[1].email).toBe('');
  });

  it('restores legacy customers with active status by default', () => {
    const restored = restoreBusinessState({
      ...seedState,
      customers: [
        {
          ...seedState.customers[0],
          status: undefined,
          terminatedAt: undefined,
          terminationReason: undefined,
        },
      ],
    } as unknown as typeof seedState);

    expect(restored.customers[0].status).toBe('active');
    expect(restored.customers[0].terminatedAt).toBeUndefined();
  });

  it('rejects a sale when requested quantity exceeds stock on hand', () => {
    const result = addSaleToState(seedState, {
      customerId: 'c1',
      items: [{ productId: 'p2', quantity: 99 }],
      paymentMethod: 'Cash',
      paidAmount: 0,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Not enough stock');
    }
  });

  it('rejects a product with a blank trimmed name', () => {
    const result = addProductToState(seedState, {
      name: '   ',
      unit: 'boxes',
      price: 80,
      cost: 60,
      reorderLevel: 4,
      quantity: 10,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Item name');
    }
  });

  it('adds a customer with the next client id when blank', () => {
    const result = addCustomerToState(seedState, {
      name: 'New Buyer',
      clientId: '   ',
      phone: '+233555000111',
      whatsapp: '+233555000222',
      email: 'buyer@example.com',
      channel: 'WhatsApp follow-up',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.customers[0].clientId).toBe('CLT-005');
      expect(result.data?.customers[0].phone).toBe('+233555000111');
      expect(result.data?.customers[0].whatsapp).toBe('+233555000222');
      expect(result.data?.customers[0].email).toBe('buyer@example.com');
    }
  });

  it('updates a customer without changing the customer id or client id', () => {
    const existingCustomer = seedState.customers[0];
    const result = updateCustomerInState(seedState, {
      customerId: existingCustomer.id,
      name: 'Updated Buyer',
      phone: '+233555000333',
      whatsapp: '+233555000444',
      email: 'updated@example.com',
      channel: 'Email follow-up',
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      const updatedCustomer = result.data.customers.find((customer) => customer.id === existingCustomer.id);
      expect(updatedCustomer?.id).toBe(existingCustomer.id);
      expect(updatedCustomer?.clientId).toBe(existingCustomer.clientId);
      expect(updatedCustomer?.name).toBe('Updated Buyer');
      expect(updatedCustomer?.phone).toBe('+233555000333');
      expect(updatedCustomer?.whatsapp).toBe('+233555000444');
      expect(updatedCustomer?.email).toBe('updated@example.com');
    }
  });

  it('terminates a customer without deleting their record', () => {
    const existingCustomer = seedState.customers[0];
    const result = updateCustomerStatusInState(seedState, {
      customerId: existingCustomer.id,
      status: 'terminated',
      terminationReason: 'Account closed',
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      const terminatedCustomer = result.data.customers.find((customer) => customer.id === existingCustomer.id);
      expect(terminatedCustomer?.id).toBe(existingCustomer.id);
      expect(terminatedCustomer?.status).toBe('terminated');
      expect(terminatedCustomer?.terminationReason).toBe('Account closed');
      expect(result.data.sales.some((sale) => sale.customerId === existingCustomer.id)).toBe(true);
    }
  });

  it('blocks new sales for terminated customers', () => {
    const terminatedStateResult = updateCustomerStatusInState(seedState, {
      customerId: 'c1',
      status: 'terminated',
      terminationReason: 'Inactive account',
    });

    expect(terminatedStateResult.ok).toBe(true);
    if (!terminatedStateResult.ok || !terminatedStateResult.data) {
      return;
    }

    const result = addSaleToState(terminatedStateResult.data, {
      customerId: 'c1',
      items: [{ productId: 'p1', quantity: 1 }],
      paymentMethod: 'Cash',
      paidAmount: 35,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('terminated');
    }
  });

  it('blocks new quotations for terminated customers', () => {
    const terminatedStateResult = updateCustomerStatusInState(seedState, {
      customerId: 'c1',
      status: 'terminated',
      terminationReason: 'Inactive account',
    });

    expect(terminatedStateResult.ok).toBe(true);
    if (!terminatedStateResult.ok || !terminatedStateResult.data) {
      return;
    }

    const result = addQuotationToState(terminatedStateResult.data, {
      customerId: 'c1',
      items: [{ productId: 'p1', quantity: 1 }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('terminated');
    }
  });

  it('rejects a duplicate custom client id after trimming', () => {
    const result = addCustomerToState(seedState, {
      name: 'New Buyer',
      clientId: '  CLT-001 ',
      channel: 'WhatsApp follow-up',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Client ID already exists');
    }
  });

  it('creates a quotation with a generated quotation number and totals', () => {
    const result = addQuotationToState(seedState, {
      customerId: 'c1',
      items: [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.quotations[0].quotationNumber).toBe('QTN-001');
      expect(result.data?.quotations[0].totalAmount).toBe(112);
      expect(result.data?.quotations[0].items).toHaveLength(2);
    }
  });

  it('rejects a quotation with no line items', () => {
    const result = addQuotationToState(seedState, {
      customerId: 'c1',
      items: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Add at least one item');
    }
  });

  it('quotation conversion links correctly', () => {
    const withQuotation = addQuotationToState(seedState, {
      customerId: 'c1',
      items: [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ],
    });

    expect(withQuotation.ok).toBe(true);
    if (!withQuotation.ok || !withQuotation.data) {
      return;
    }

    const quotationId = withQuotation.data.quotations[0].id;
    const converted = convertQuotationToSalesState(withQuotation.data, {
      quotationId,
      paymentMethod: 'Cash',
      amountPaid: 100,
    });

    expect(converted.ok).toBe(true);
    if (converted.ok && converted.data) {
      expect(converted.data.receipts).toHaveLength(1);
      expect(converted.data.data.sales).toHaveLength(3);
      expect(converted.data.data.quotations[0].status).toBe('Converted');
      expect(converted.data.data.quotations[0].relatedSaleIds).toHaveLength(1);
      expect(converted.data.data.sales[0].quotationId).toBe(quotationId);
    }
  });

  it('blocks quotation conversion when stock is not sufficient for any line', () => {
    const quotationState = {
      ...seedState,
      quotations: [
        {
          id: 'q1',
          quotationNumber: 'QTN-001',
          customerId: 'c1',
          customerName: 'Ama Beauty Supplies',
          clientId: 'CLT-001',
          createdAt: new Date().toISOString(),
          items: [
            {
              productId: 'p2',
              productName: 'Paracetamol 500mg',
              inventoryId: 'INV-002',
              quantity: 99,
              unitPrice: 42,
              total: 4158,
            },
          ],
          totalAmount: 4158,
          status: 'Draft' as const,
        },
      ],
    };

    const result = convertQuotationToSalesState(quotationState, {
      quotationId: 'q1',
      paymentMethod: 'Cash',
      amountPaid: 0,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Not enough stock');
    }
  });

  it('reversal restores stock correctly', () => {
    const result = reverseSaleInState(seedState, {
      saleId: 's1',
      reason: 'Duplicate invoice',
      actor: 'Owner',
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      const reversedSale = result.data.data.sales.find((sale) => sale.id === 's1');
      expect(reversedSale?.status).toBe('Reversed');
      expect(reversedSale?.reversalReason).toBe('Duplicate invoice');
      expect(selectProductQuantityOnHand(result.data.data, 'p4')).toBe(22);
      expect(result.data.data.customerLedgerEntries[0].type).toBe('reversal');
    }
  });

  it('prevents reversing the same invoice twice', () => {
    const firstPass = reverseSaleInState(seedState, {
      saleId: 's1',
      reason: 'Duplicate invoice',
    });

    expect(firstPass.ok).toBe(true);
    if (!firstPass.ok || !firstPass.data) {
      return;
    }

    const secondPass = reverseSaleInState(firstPass.data.data, {
      saleId: 's1',
      reason: 'Duplicate invoice again',
    });

    expect(secondPass.ok).toBe(false);
    if (!secondPass.ok) {
      expect(secondPass.message).toContain('already been reversed');
    }
  });

  it('creates a correction invoice only from a reversed invoice and links both records', () => {
    const reversed = reverseSaleInState(seedState, {
      saleId: 's2',
      reason: 'Wrong quantity entered',
    });

    expect(reversed.ok).toBe(true);
    if (!reversed.ok || !reversed.data) {
      return;
    }

    const corrected = addSaleToState(reversed.data.data, {
      customerId: 'c2',
      items: [{ productId: 'p1', quantity: 3 }],
      paymentMethod: 'Cash',
      paidAmount: 105,
      correctionOfSaleId: 's2',
    });

    expect(corrected.ok).toBe(true);
    if (corrected.ok && corrected.data) {
      const replacementSale = corrected.data.sales[0];
      const originalSale = corrected.data.sales.find((sale) => sale.id === 's2');

      expect(replacementSale.correctionOfSaleId).toBe('s2');
      expect(originalSale?.correctedBySaleId).toBe(replacementSale.id);
      expect(corrected.data.activityLogEntries[0].actionType).toBe('corrected_copy_created');
    }
  });

  it('blocks creating a correction invoice from an invoice that was not reversed', () => {
    const result = addSaleToState(seedState, {
      customerId: 'c2',
      items: [{ productId: 'p1', quantity: 3 }],
      paymentMethod: 'Cash',
      paidAmount: 105,
      correctionOfSaleId: 's2',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Only reversed invoices');
    }
  });

  it('dashboard derivations are correct', () => {
    const metrics = selectDashboardMetrics(seedState);

    expect(metrics.salesToday).toBe(168);
    expect(metrics.cashInHand).toBe(0);
    expect(metrics.mobileMoneyReceived).toBe(168);
    expect(metrics.receivables).toBe(1420);
    expect(metrics.lowStockCount).toBe(1);
  });
});
