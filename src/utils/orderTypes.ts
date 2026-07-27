import type { BusinessState, OrderType } from '../data/seedBusiness';
import type { ActionResult } from './businessLogic';

/**
 * Configurable order types (Acumatica recommendation #2): order behaviour lives in data, not code, so a
 * business can change how a document type reserves stock or holds on entry without a release. Pure helpers
 * plus toggle/default mutations.
 */

export function selectOrderTypes(state: BusinessState): OrderType[] {
  return state.orderTypes ?? [];
}

export function selectActiveOrderTypes(state: BusinessState): OrderType[] {
  return selectOrderTypes(state).filter((type) => type.active);
}

/** The default order type used when none is specified — falls back to the first active type. */
export function selectDefaultOrderType(state: BusinessState): OrderType | undefined {
  const types = selectOrderTypes(state);
  return types.find((type) => type.isDefault && type.active) ?? types.find((type) => type.active);
}

export function selectOrderTypeByCode(state: BusinessState, code?: string): OrderType | undefined {
  if (!code) return selectDefaultOrderType(state);
  return selectOrderTypes(state).find((type) => type.code === code);
}

/** Editable behaviour flags on an order type (code/name stay fixed for the predefined set). */
export type OrderTypePatch = Partial<Pick<OrderType, 'autoReserve' | 'holdOnEntry' | 'requireAllocation' | 'active'>>;

export function updateOrderTypeInState(current: BusinessState, input: { id: string; patch: OrderTypePatch }): ActionResult<BusinessState> {
  const orderType = (current.orderTypes ?? []).find((type) => type.id === input.id);
  if (!orderType) return { ok: false, message: 'That order type could not be found.' };
  if (input.patch.active === false && orderType.isDefault) {
    return { ok: false, message: 'The default order type cannot be deactivated. Set another type as default first.' };
  }
  return {
    ok: true,
    data: {
      ...current,
      orderTypes: current.orderTypes.map((type) => (type.id === input.id ? { ...type, ...input.patch } : type)),
    },
  };
}

/** Make one order type the default (and clear the flag on the rest). Must be an active type. */
export function setDefaultOrderTypeInState(current: BusinessState, input: { id: string }): ActionResult<BusinessState> {
  const orderType = (current.orderTypes ?? []).find((type) => type.id === input.id);
  if (!orderType) return { ok: false, message: 'That order type could not be found.' };
  if (!orderType.active) return { ok: false, message: 'Activate the order type before making it the default.' };
  return {
    ok: true,
    data: {
      ...current,
      orderTypes: current.orderTypes.map((type) => ({ ...type, isDefault: type.id === input.id })),
    },
  };
}
