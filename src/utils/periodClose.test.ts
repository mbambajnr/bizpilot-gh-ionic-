import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import {
  type ActionResult,
  addSaleToState,
  closeAccountingPeriodInState,
  isAccountingPeriodClosed,
  reopenAccountingPeriodInState,
  reverseSaleInState,
} from './businessLogic';
import type { BusinessState } from '../data/seedBusiness';

function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok || !result.data) throw new Error(result.ok ? 'expected data' : result.message);
  return result.data;
}

const closer = { period: '2026-05', closedByUserId: 'u-acc', closedByName: 'Ama' };
const base: BusinessState = { ...seedState, closedAccountingPeriods: [] };

describe('month-end close', () => {
  it('closes a period and reports it as locked', () => {
    const state = unwrap(closeAccountingPeriodInState(base, closer));
    expect(isAccountingPeriodClosed(state, '2026-05-14T10:00:00Z')).toBe(true);
    expect(isAccountingPeriodClosed(state, '2026-06-01T10:00:00Z')).toBe(false);
    expect(state.closedAccountingPeriods[0].closedByName).toBe('Ama');
  });

  it('rejects closing an already-closed, future, or malformed period', () => {
    const state = unwrap(closeAccountingPeriodInState(base, closer));
    expect(closeAccountingPeriodInState(state, closer).ok).toBe(false); // already closed
    expect(closeAccountingPeriodInState(base, { ...closer, period: '2099-01' }).ok).toBe(false); // future
    expect(closeAccountingPeriodInState(base, { ...closer, period: 'nope' }).ok).toBe(false); // malformed
  });

  it('reopens a closed period, unlocking it', () => {
    const closed = unwrap(closeAccountingPeriodInState(base, closer));
    const reopened = unwrap(reopenAccountingPeriodInState(closed, { period: '2026-05' }));
    expect(reopened.closedAccountingPeriods).toHaveLength(0);
    expect(isAccountingPeriodClosed(reopened, '2026-05-14T10:00:00Z')).toBe(false);
  });

  it('blocks reversing a sale that falls in a closed period', () => {
    const sale = { ...seedState.sales[0], id: 's-closed', status: 'Completed' as const, createdAt: '2026-05-20T09:00:00Z' };
    const state: BusinessState = { ...base, sales: [sale], closedAccountingPeriods: [{ ...closer, closedAt: new Date().toISOString() }] };
    const result = reverseSaleInState(state, { saleId: 's-closed', reason: 'error', actor: 'u-acc' });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/closed accounting period/i);
  });

  it('blocks recording a sale dated into a closed period', () => {
    const state: BusinessState = { ...base, closedAccountingPeriods: [{ ...closer, closedAt: new Date().toISOString() }] };
    const result = addSaleToState(state, { customerSnapshot: { name: 'Walk-in', source: 'prospect' }, items: [], paymentMethod: 'Cash', paidAmount: 0, createdAt: '2026-05-10T10:00:00Z' });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/closed accounting period/i);
  });
});
