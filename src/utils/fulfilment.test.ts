import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import type { BusinessState } from '../data/seedBusiness';
import {
  advanceFulfilmentInState,
  assignFulfilmentInState,
  canTransition,
  selectFulfilmentForSale,
  startFulfilmentInState,
} from './fulfilment';
import type { ActionResult } from './businessLogic';

function unwrap(result: ActionResult<BusinessState>): BusinessState {
  if (!result.ok || !result.data) throw new Error(result.ok ? 'expected data' : result.message);
  return result.data;
}

const sale = { ...seedState.sales[0], id: 's-ful', status: 'Completed' as const };
const base: BusinessState = { ...seedState, sales: [sale], fulfilments: [] };
const actor = { byUserId: 'u-store', byName: 'Store Clerk' };

function fulfilmentId(state: BusinessState): string {
  return selectFulfilmentForSale(state, 's-ful')!.id;
}

describe('fulfilment lifecycle', () => {
  it('allows only legal state transitions', () => {
    expect(canTransition('picking', 'packed')).toBe(true);
    expect(canTransition('picking', 'dispatched')).toBe(false); // no skipping
    expect(canTransition('dispatched', 'failed')).toBe(true);
    expect(canTransition('failed', 'picking')).toBe(true); // retry
    expect(canTransition('delivered', 'dispatched')).toBe(false); // terminal
    expect(canTransition('packed', 'packed')).toBe(false);
  });

  it('starts fulfilment at picking and blocks duplicates and reversed invoices', () => {
    const started = unwrap(startFulfilmentInState(base, { saleId: 's-ful', ...actor }));
    expect(selectFulfilmentForSale(started, 's-ful')?.status).toBe('picking');
    expect(startFulfilmentInState(started, { saleId: 's-ful', ...actor }).ok).toBe(false); // duplicate
    const reversed: BusinessState = { ...base, sales: [{ ...sale, status: 'Reversed' as const }] };
    expect(startFulfilmentInState(reversed, { saleId: 's-ful', ...actor }).ok).toBe(false);
  });

  it('walks the pipeline picking → packed → dispatched → delivered with proof of delivery', () => {
    let state = unwrap(startFulfilmentInState(base, { saleId: 's-ful', ...actor }));
    const id = fulfilmentId(state);
    state = unwrap(advanceFulfilmentInState(state, { fulfilmentId: id, toStatus: 'packed', ...actor }));
    state = unwrap(advanceFulfilmentInState(state, { fulfilmentId: id, toStatus: 'dispatched', ...actor }));
    // Delivery needs proof.
    expect(advanceFulfilmentInState(state, { fulfilmentId: id, toStatus: 'delivered', ...actor }).ok).toBe(false);
    state = unwrap(advanceFulfilmentInState(state, { fulfilmentId: id, toStatus: 'delivered', ...actor, proofOfDelivery: { recipientName: 'Ama' } }));
    const fulfilment = selectFulfilmentForSale(state, 's-ful')!;
    expect(fulfilment.status).toBe('delivered');
    expect(fulfilment.proofOfDelivery?.recipientName).toBe('Ama');
    expect(fulfilment.events.map((event) => event.status)).toEqual(['picking', 'packed', 'dispatched', 'delivered']);
  });

  it('rejects an illegal jump', () => {
    const state = unwrap(startFulfilmentInState(base, { saleId: 's-ful', ...actor }));
    expect(advanceFulfilmentInState(state, { fulfilmentId: fulfilmentId(state), toStatus: 'delivered', ...actor, proofOfDelivery: { recipientName: 'x' } }).ok).toBe(false);
  });

  it('reports a failed delivery with a reason and retries back to picking', () => {
    let state = unwrap(startFulfilmentInState(base, { saleId: 's-ful', ...actor }));
    const id = fulfilmentId(state);
    state = unwrap(advanceFulfilmentInState(state, { fulfilmentId: id, toStatus: 'packed', ...actor }));
    state = unwrap(advanceFulfilmentInState(state, { fulfilmentId: id, toStatus: 'dispatched', ...actor }));
    expect(advanceFulfilmentInState(state, { fulfilmentId: id, toStatus: 'failed', ...actor }).ok).toBe(false); // needs reason
    state = unwrap(advanceFulfilmentInState(state, { fulfilmentId: id, toStatus: 'failed', ...actor, failureReason: 'Customer not home' }));
    expect(selectFulfilmentForSale(state, 's-ful')?.failureReason).toBe('Customer not home');
    state = unwrap(advanceFulfilmentInState(state, { fulfilmentId: id, toStatus: 'picking', ...actor }));
    expect(selectFulfilmentForSale(state, 's-ful')?.status).toBe('picking');
    expect(selectFulfilmentForSale(state, 's-ful')?.failureReason).toBeUndefined(); // cleared on retry
  });

  it('assigns an owner', () => {
    let state = unwrap(startFulfilmentInState(base, { saleId: 's-ful', ...actor }));
    state = unwrap(assignFulfilmentInState(state, { fulfilmentId: fulfilmentId(state), assignToUserId: 'u-driver', assignToName: 'Kofi' }));
    expect(selectFulfilmentForSale(state, 's-ful')?.assignedToName).toBe('Kofi');
  });
});
