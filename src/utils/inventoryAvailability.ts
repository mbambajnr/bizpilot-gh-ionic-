import type { BusinessState, StockReservation } from '../data/seedBusiness';
import { selectProductQuantityOnHand } from '../selectors/businessSelectors';
import type { ActionResult } from './businessLogic';

/**
 * Inventory availability with soft reservations — the foundation for order-type hold/release behaviour.
 *
 *   Available(product, location) = On-hand − Active reservations
 *
 * A reservation holds stock for an order or quote WITHOUT moving on-hand inventory, so the same unit
 * can't be promised twice. Reservations are released (freeing the stock) when the order is cancelled, or
 * marked fulfilled when the goods physically ship and a real stock movement is recorded. Pure and
 * read-only except through the explicit reserve/release helpers.
 */

/** Active reserved quantity for a product, optionally scoped to a location. */
export function selectReservedQuantity(state: BusinessState, productId: string, locationId?: string): number {
  return (state.stockReservations ?? [])
    .filter((reservation) =>
      reservation.status === 'active' &&
      reservation.productId === productId &&
      (!locationId || reservation.locationId === locationId))
    .reduce((sum, reservation) => sum + reservation.quantity, 0);
}

/** On-hand minus active reservations — what can still be promised to a new order. */
export function selectAvailableQuantity(state: BusinessState, productId: string, locationId?: string): number {
  return selectProductQuantityOnHand(state, productId, locationId) - selectReservedQuantity(state, productId, locationId);
}

export type ReserveStockInput = {
  productId: string;
  locationId: string;
  quantity: number;
  reason?: StockReservation['reason'];
  referenceId?: string;
  referenceLabel?: string;
  createdByName?: string;
};

/** Hold stock for an order. Blocks reserving more than is available — this is what prevents overselling. */
export function reserveStockInState(current: BusinessState, input: ReserveStockInput): ActionResult<BusinessState> {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return { ok: false, message: 'Reservation quantity must be a positive number.' };
  }
  const product = current.products.find((entry) => entry.id === input.productId);
  if (!product) return { ok: false, message: 'That product could not be found.' };
  const available = selectAvailableQuantity(current, input.productId, input.locationId);
  if (input.quantity > available) {
    return { ok: false, message: `Only ${available} ${product.unit} of ${product.name} available to reserve at this location.` };
  }

  const reservation: StockReservation = {
    id: `res-${crypto.randomUUID()}`,
    productId: input.productId,
    locationId: input.locationId,
    quantity: input.quantity,
    status: 'active',
    reason: input.reason ?? 'manual',
    referenceId: input.referenceId,
    referenceLabel: input.referenceLabel,
    createdAt: new Date().toISOString(),
    createdByName: input.createdByName,
  };
  return { ok: true, data: { ...current, stockReservations: [reservation, ...(current.stockReservations ?? [])] } };
}

function setReservationStatus(current: BusinessState, reservationId: string, status: StockReservation['status']): ActionResult<BusinessState> {
  const reservation = (current.stockReservations ?? []).find((entry) => entry.id === reservationId);
  if (!reservation) return { ok: false, message: 'That reservation could not be found.' };
  if (reservation.status !== 'active') return { ok: false, message: 'Only an active reservation can be updated.' };
  return {
    ok: true,
    data: {
      ...current,
      stockReservations: current.stockReservations.map((entry) => (entry.id === reservationId ? { ...entry, status } : entry)),
    },
  };
}

/** Free a reservation, returning its quantity to available stock. */
export function releaseReservationInState(current: BusinessState, input: { reservationId: string }): ActionResult<BusinessState> {
  return setReservationStatus(current, input.reservationId, 'released');
}

/** Mark a reservation fulfilled — the goods shipped and a real stock movement now covers it. */
export function fulfilReservationInState(current: BusinessState, input: { reservationId: string }): ActionResult<BusinessState> {
  return setReservationStatus(current, input.reservationId, 'fulfilled');
}

/**
 * Book a quotation against stock: reserve every line at `locationId` in one atomic step. Fails without
 * reserving anything if the quote is already holding stock or any line exceeds availability (aggregated per
 * product so repeated lines don't oversell). This is the SME "sales order booked → reserves inventory".
 */
export function reserveQuotationStockInState(
  current: BusinessState,
  input: { quotationId: string; locationId: string; createdByName?: string },
): ActionResult<BusinessState> {
  const quotation = current.quotations.find((entry) => entry.id === input.quotationId);
  if (!quotation) return { ok: false, message: 'That quotation could not be found.' };
  if ((current.stockReservations ?? []).some((entry) => entry.referenceId === quotation.id && entry.status === 'active')) {
    return { ok: false, message: 'This quotation is already holding stock. Release the hold first to re-book it.' };
  }

  const requestedByProduct = new Map<string, number>();
  for (const line of quotation.items) {
    if (line.quantity > 0) requestedByProduct.set(line.productId, (requestedByProduct.get(line.productId) ?? 0) + line.quantity);
  }
  if (!requestedByProduct.size) return { ok: false, message: 'This quotation has no stock lines to hold.' };

  for (const [productId, quantity] of requestedByProduct) {
    const product = current.products.find((entry) => entry.id === productId);
    if (!product) return { ok: false, message: 'A product on this quotation no longer exists.' };
    const available = selectAvailableQuantity(current, productId, input.locationId);
    if (quantity > available) {
      return { ok: false, message: `Not enough ${product.name} to hold — need ${quantity}, only ${available} available at this location.` };
    }
  }

  const now = new Date().toISOString();
  const reservations: StockReservation[] = [...requestedByProduct.entries()].map(([productId, quantity]) => ({
    id: `res-${crypto.randomUUID()}`,
    productId,
    locationId: input.locationId,
    quantity,
    status: 'active',
    reason: 'quotation',
    referenceId: quotation.id,
    referenceLabel: quotation.quotationNumber,
    createdAt: now,
    createdByName: input.createdByName,
  }));
  return { ok: true, data: { ...current, stockReservations: [...reservations, ...(current.stockReservations ?? [])] } };
}

/** Release every active reservation tied to an order/quote (e.g. on cancellation). */
export function releaseReservationsForReferenceInState(current: BusinessState, referenceId: string): ActionResult<BusinessState> {
  const affected = (current.stockReservations ?? []).some((entry) => entry.referenceId === referenceId && entry.status === 'active');
  if (!affected) return { ok: true, data: current };
  return {
    ok: true,
    data: {
      ...current,
      stockReservations: current.stockReservations.map((entry) =>
        entry.referenceId === referenceId && entry.status === 'active' ? { ...entry, status: 'released' } : entry),
    },
  };
}
