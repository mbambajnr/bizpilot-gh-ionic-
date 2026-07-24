import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import type { BusinessState, Expense } from '../data/seedBusiness';
import { detectExpenseAnomalies, groupAnomaliesByExpense } from './anomalyDetection';

const BASE = Date.parse('2026-07-20T09:00:00.000Z');
const at = (offsetMs: number) => new Date(BASE + offsetMs).toISOString();

function expense(partial: Partial<Expense> & Pick<Expense, 'id' | 'amount'>): Expense {
  return {
    category: 'Rent',
    note: '',
    createdAt: at(0),
    recordedByUserId: 'u-clerk',
    recordedByName: 'Clerk',
    status: 'auto_approved',
    ...partial,
  };
}

function stateWith(expenses: Expense[], threshold?: number): BusinessState {
  return { ...seedState, expenses, businessProfile: { ...seedState.businessProfile, currency: 'GHS', expenseApprovalThreshold: threshold } };
}

// Four typical peers spread over prior days, plus whatever the test adds.
const peers = (category: string, amounts: number[]): Expense[] =>
  amounts.map((amount, index) => expense({ id: `${category}-${index}`, category, amount, createdAt: at(-(index + 2) * 24 * 60 * 60 * 1000) }));

describe('expense anomaly detection', () => {
  it('flags a category outlier without letting the outlier mask itself', () => {
    const state = stateWith([...peers('Rent', [100, 110, 90, 105]), expense({ id: 'big', category: 'Rent', amount: 1000 })]);
    const outliers = detectExpenseAnomalies(state).filter((flag) => flag.code === 'category_outlier');
    expect(outliers).toHaveLength(1);
    expect(outliers[0]).toMatchObject({ expenseId: 'big', severity: 'critical' });
    expect(outliers[0].reason).toContain('usual Rent spend');
  });

  it('does not flag amounts that sit within a tight category distribution', () => {
    const state = stateWith([...peers('Rent', [100, 110, 90, 105, 102]), expense({ id: 'normal', category: 'Rent', amount: 108 })]);
    expect(detectExpenseAnomalies(state).some((flag) => flag.code === 'category_outlier')).toBe(false);
  });

  it('requires enough peers before scoring category outliers', () => {
    const state = stateWith([...peers('Rent', [100, 110]), expense({ id: 'big', category: 'Rent', amount: 5000 })]);
    expect(detectExpenseAnomalies(state).some((flag) => flag.code === 'category_outlier')).toBe(false);
  });

  it('flags an expense that sits just under the approval threshold (structuring)', () => {
    const state = stateWith([expense({ id: 'sneaky', category: 'Misc', amount: 950 })], 1000);
    const flag = detectExpenseAnomalies(state).find((entry) => entry.code === 'threshold_proximity');
    expect(flag).toBeTruthy();
    expect(flag?.severity).toBe('warning');
  });

  it('does not raise a proximity flag when the amount is comfortably below the threshold', () => {
    const state = stateWith([expense({ id: 'fine', category: 'Misc', amount: 700 })], 1000);
    expect(detectExpenseAnomalies(state).some((flag) => flag.code === 'threshold_proximity')).toBe(false);
  });

  it('flags a probable duplicate — same category, amount, and recorder within 48h', () => {
    const state = stateWith([
      expense({ id: 'a', category: 'Fuel', amount: 300, createdAt: at(0) }),
      expense({ id: 'b', category: 'Fuel', amount: 300, createdAt: at(3 * 60 * 60 * 1000) }),
    ]);
    const dupes = detectExpenseAnomalies(state).filter((flag) => flag.code === 'possible_duplicate');
    expect(dupes.map((flag) => flag.expenseId).sort()).toEqual(['a', 'b']);
  });

  it('does not treat entries outside the 48h window as duplicates', () => {
    const state = stateWith([
      expense({ id: 'a', category: 'Fuel', amount: 300, createdAt: at(0) }),
      expense({ id: 'b', category: 'Fuel', amount: 300, createdAt: at(72 * 60 * 60 * 1000) }),
    ]);
    expect(detectExpenseAnomalies(state).some((flag) => flag.code === 'possible_duplicate')).toBe(false);
  });

  it('flags a velocity spike of rapid entries by one recorder', () => {
    const rapid = [0, 5, 10, 15, 20].map((minutes) => expense({ id: `v-${minutes}`, category: 'General', amount: 40 + minutes, createdAt: at(minutes * 60 * 1000) }));
    const flags = detectExpenseAnomalies(stateWith(rapid)).filter((flag) => flag.code === 'velocity_spike');
    expect(flags.length).toBe(5);
  });

  it('ignores rejected expenses entirely', () => {
    const state = stateWith([...peers('Rent', [100, 110, 90, 105]), expense({ id: 'big', category: 'Rent', amount: 1000, status: 'rejected' })]);
    expect(detectExpenseAnomalies(state).some((flag) => flag.expenseId === 'big')).toBe(false);
  });

  it('sorts critical flags ahead of warnings and groups by expense', () => {
    const state = stateWith([...peers('Rent', [100, 110, 90, 105]), expense({ id: 'big', category: 'Rent', amount: 1000 }), expense({ id: 'sneaky', category: 'Misc', amount: 950 })], 1000);
    const flags = detectExpenseAnomalies(state);
    expect(flags[0].severity).toBe('critical');
    const grouped = groupAnomaliesByExpense(flags);
    expect(grouped.get('big')?.[0].code).toBe('category_outlier');
  });
});
