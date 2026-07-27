import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import type { BusinessState } from '../data/seedBusiness';
import {
  selectActiveOrderTypes,
  selectDefaultOrderType,
  selectOrderTypeByCode,
  setDefaultOrderTypeInState,
  updateOrderTypeInState,
  type OrderTypePatch,
} from './orderTypes';
import type { ActionResult } from './businessLogic';

function unwrap(result: ActionResult<BusinessState>): BusinessState {
  if (!result.ok || !result.data) throw new Error(result.ok ? 'expected data' : result.message);
  return result.data;
}

describe('configurable order types', () => {
  it('seeds the predefined set with SO as the default', () => {
    expect(selectActiveOrderTypes(seedState).map((type) => type.code)).toEqual(['SO', 'SA', 'IN', 'CS', 'QT']);
    expect(selectDefaultOrderType(seedState)?.code).toBe('SO');
    expect(selectOrderTypeByCode(seedState, 'SA')?.autoReserve).toBe(true); // SA auto-reserves out of the box
  });

  it('toggles behaviour flags without touching code/name', () => {
    const patch: OrderTypePatch = { autoReserve: true, holdOnEntry: true };
    const state = unwrap(updateOrderTypeInState(seedState, { id: 'ot-so', patch }));
    const so = selectOrderTypeByCode(state, 'SO')!;
    expect(so.autoReserve).toBe(true);
    expect(so.holdOnEntry).toBe(true);
    expect(so.name).toBe('Sales Order'); // unchanged
  });

  it('moves the default to another active type, clearing the old one', () => {
    const state = unwrap(setDefaultOrderTypeInState(seedState, { id: 'ot-in' }));
    expect(selectDefaultOrderType(state)?.code).toBe('IN');
    expect(selectOrderTypeByCode(state, 'SO')?.isDefault).toBe(false);
  });

  it('refuses to deactivate the default or default an inactive type', () => {
    expect(updateOrderTypeInState(seedState, { id: 'ot-so', patch: { active: false } }).ok).toBe(false);
    const withInactive = unwrap(updateOrderTypeInState(seedState, { id: 'ot-qt', patch: { active: false } }));
    expect(setDefaultOrderTypeInState(withInactive, { id: 'ot-qt' }).ok).toBe(false);
  });

  it('rejects unknown order type ids', () => {
    expect(updateOrderTypeInState(seedState, { id: 'nope', patch: { autoReserve: true } }).ok).toBe(false);
    expect(setDefaultOrderTypeInState(seedState, { id: 'nope' }).ok).toBe(false);
  });
});
