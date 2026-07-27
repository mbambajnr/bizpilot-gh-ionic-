import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import {
  calculatePayableBalance,
  calculatePurchaseTotal,
  getQuotationLifecycleStatus,
  restoreBusinessState,
} from './businessLogic';
import {
  nextPayableCode,
  nextPaymentCode,
  nextPurchaseCode,
  nextStoreCode,
  nextTransferCode,
  nextVendorCode,
  nextWarehouseCode,
} from './businessIds';

describe('erp foundation helpers', () => {
  it('generates vendor, purchase, payable, location, transfer, and payment codes from existing state', () => {
    expect(nextVendorCode(seedState.vendors)).toBe('VEN-0003');
    expect(nextPurchaseCode(seedState.purchases)).toBe('PO-0002');
    expect(nextPayableCode(seedState.accountsPayable)).toBe('AP-0002');
    expect(nextWarehouseCode(seedState.locations)).toBe('WH-0002');
    expect(nextStoreCode(seedState.locations)).toBe('ST-0002');
    expect(nextTransferCode(seedState.stockTransfers)).toBe('TRF-0002');
    expect(nextPaymentCode(seedState.payments)).toBe('PAY-0002');
  });

  it('calculates purchase totals from item totals', () => {
    expect(calculatePurchaseTotal(seedState.purchases[0].items)).toBe(600);
  });

  it('calculates payable balance safely', () => {
    expect(calculatePayableBalance(600, 200)).toBe(400);
    expect(calculatePayableBalance(600, 800)).toBe(0);
  });

  it('marks an open quotation as expired when validUntil is in the past', () => {
    expect(
      getQuotationLifecycleStatus({
        status: 'open',
        validUntil: '2000-01-01T00:00:00.000Z',
      })
    ).toBe('expired');
  });

  it('restores stock movement traceability defaults for legacy state', () => {
    const restored = restoreBusinessState({
      ...seedState,
      stockMovements: [
        {
          id: 'sm-legacy',
          movementNumber: 'SMV-999',
          productId: 'p1',
          locationId: seedState.locations[0].id,
          type: 'sale',
          quantityDelta: -1,
          quantityAfter: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          note: 'Legacy movement',
        },
      ],
    });

    expect(restored.stockMovements[0].performedBy).toBe('system');
    expect(restored.stockMovements[0].sourceType).toBeUndefined();
  });
});
