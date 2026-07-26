import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import type { AppPermission } from '../authz/types';
import type { BusinessState, Expense } from '../data/seedBusiness';
import { answerAssistant, availableAssistantIntents, buildAssistantRoutingPrompt, matchAssistantIntent, resolveRoutedIntent } from './assistant';

const NOW = Date.parse('2026-07-15T12:00:00.000Z');
const hp = (perms: AppPermission[]) => (permission: AppPermission) => perms.includes(permission);

function expense(partial: Partial<Expense> & Pick<Expense, 'id' | 'category' | 'amount'>): Expense {
  return { note: '', createdAt: '2026-07-10T09:00:00.000Z', recordedByUserId: 'u', recordedByName: 'U', status: 'auto_approved', ...partial };
}

function stateWith(expenses: Expense[]): BusinessState {
  return { ...seedState, expenses, businessProfile: { ...seedState.businessProfile, currency: 'GHS' } };
}

describe('role-scoped assistant', () => {
  it('only offers intents the role is authorized for', () => {
    const expenseOnly = availableAssistantIntents(hp(['expenses.view'])).map((intent) => intent.id);
    expect(expenseOnly).toContain('top_expenses');
    expect(expenseOnly).toContain('expense_anomalies');
    expect(expenseOnly).not.toContain('stockout_risk');
    expect(expenseOnly).not.toContain('receivables');

    const inventoryOnly = availableAssistantIntents(hp(['inventory.view'])).map((intent) => intent.id);
    expect(inventoryOnly).toEqual(['stockout_risk']);
  });

  it('answers an authorized intent with a titled, row-bearing answer', () => {
    const result = answerAssistant(seedState, 'cash_position', hp(['reports.dashboard.view']), NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.answer.title).toBe('Cash position today');
      expect(result.answer.rows.length).toBeGreaterThan(0);
    }
  });

  it('refuses an intent the role cannot access', () => {
    const result = answerAssistant(seedState, 'expense_anomalies', hp(['inventory.view']), NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('does not have access');
  });

  it('rejects an unknown intent id', () => {
    expect(answerAssistant(seedState, 'launch_rockets', hp(['expenses.view']), NOW).ok).toBe(false);
  });

  it('ranks the top expense categories for the month', () => {
    const state = stateWith([
      expense({ id: 'e1', category: 'Rent', amount: 800 }),
      expense({ id: 'e2', category: 'Fuel', amount: 300 }),
      expense({ id: 'e3', category: 'Fuel', amount: 200 }),
      expense({ id: 'e4', category: 'Old', amount: 999, createdAt: '2026-05-01T09:00:00.000Z' }), // different month
    ]);
    const result = answerAssistant(state, 'top_expenses', hp(['expenses.view']), NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.answer.rows[0].label).toBe('Rent'); // 800 highest
      expect(result.answer.rows.map((row) => row.label)).not.toContain('Old'); // excluded: different month
    }
  });

  it('routes a free-text question to the best authorized intent', () => {
    expect(matchAssistantIntent('who owes me money?', hp(['sales.view']))?.id).toBe('receivables');
    expect(matchAssistantIntent('what needs reordering', hp(['inventory.view']))?.id).toBe('stockout_risk');
  });

  it('never routes to an intent the role cannot use', () => {
    // Asking about expenses while only holding inventory access must not leak an expense intent.
    expect(matchAssistantIntent('any unusual expenses?', hp(['inventory.view']))).toBeNull();
  });

  it('builds a routing prompt listing only the available intents', () => {
    const intents = availableAssistantIntents(hp(['expenses.view']));
    const { system, prompt } = buildAssistantRoutingPrompt('what did I spend?', intents);
    expect(system).toContain('one available report id');
    expect(prompt).toContain('top_expenses:');
    expect(prompt).toContain('Question: what did I spend?');
    expect(prompt).not.toContain('stockout_risk'); // not available to this role
  });

  it('resolves a model reply back to an available intent and rejects NONE / unknowns', () => {
    const intents = availableAssistantIntents(hp(['expenses.view']));
    expect(resolveRoutedIntent('top_expenses', intents)?.id).toBe('top_expenses');
    expect(resolveRoutedIntent('  The best is: expense_anomalies.', intents)?.id).toBe('expense_anomalies');
    expect(resolveRoutedIntent('NONE', intents)).toBeNull();
    expect(resolveRoutedIntent('stockout_risk', intents)).toBeNull(); // not in this role's set
    expect(resolveRoutedIntent(null, intents)).toBeNull();
  });
});
