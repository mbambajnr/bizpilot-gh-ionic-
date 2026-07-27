import type { BusinessState, Quotation } from '../data/seedBusiness';
import { isQuotationDraftLike } from './businessLogic';
import { selectDefaultOrderType } from './orderTypes';

/**
 * Batch order processing (Acumatica recommendation #5): a worklist of open orders so warehouse/sales
 * staff can hold or release stock in bulk, and apply the default order type's auto-reserve behaviour in
 * one action. Pure selectors; the batch mutations run the existing per-quote reserve/release commands.
 */

export type ProcessableQuote = {
  quotation: Quotation;
  totalUnits: number;
  heldUnits: number;
  held: boolean;
  /** Has stock lines and isn't already holding — eligible to have stock held. */
  canHold: boolean;
};

/** Open quotations (draft-like and not expired) that can be acted on in bulk, newest first. */
export function selectProcessableQuotes(state: BusinessState, now: number): ProcessableQuote[] {
  return (state.quotations ?? [])
    .filter((quotation) => isQuotationDraftLike(quotation.status) && !(quotation.validUntil && Date.parse(quotation.validUntil) < now))
    .map((quotation) => {
      const heldUnits = (state.stockReservations ?? [])
        .filter((reservation) => reservation.referenceId === quotation.id && reservation.status === 'active')
        .reduce((sum, reservation) => sum + reservation.quantity, 0);
      const totalUnits = quotation.items.reduce((sum, line) => sum + line.quantity, 0);
      return { quotation, totalUnits, heldUnits, held: heldUnits > 0, canHold: totalUnits > 0 && heldUnits === 0 };
    })
    .sort((left, right) => Date.parse(right.quotation.createdAt) - Date.parse(left.quotation.createdAt));
}

/** Whether the business's default order type auto-reserves stock (drives the batch auto-reserve action). */
export function defaultOrderTypeAutoReserves(state: BusinessState): boolean {
  return Boolean(selectDefaultOrderType(state)?.autoReserve);
}

/** Open, not-yet-held quotes that should be held when the default order type auto-reserves. */
export function selectQuotesForAutoReserve(state: BusinessState, now: number): Quotation[] {
  if (!defaultOrderTypeAutoReserves(state)) return [];
  return selectProcessableQuotes(state, now).filter((entry) => entry.canHold).map((entry) => entry.quotation);
}
