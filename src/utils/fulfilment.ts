import type { BusinessState, Fulfilment, FulfilmentStatus, ProofOfDelivery } from '../data/seedBusiness';
import type { ActionResult } from './businessLogic';

/**
 * Fulfilment lifecycle for a completed sale: picking → packed → dispatched → delivered, with a
 * failed branch (and retry back to picking). Pure state-machine helpers — each transition is validated,
 * appends an event to the fulfilment's own audit trail, and stamps who moved it. A sale with no
 * fulfilment record is implicitly "unfulfilled".
 */

/** The forward pipeline. A transition may only advance one step along it (or branch to failed). */
const PIPELINE: FulfilmentStatus[] = ['picking', 'packed', 'dispatched', 'delivered'];

export const FULFILMENT_STATUS_LABELS: Record<FulfilmentStatus, string> = {
  picking: 'Picking',
  packed: 'Packed',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  failed: 'Failed delivery',
};

/** Whether `to` is a legal next state from `from`. */
export function canTransition(from: FulfilmentStatus, to: FulfilmentStatus): boolean {
  if (from === to) return false;
  if (to === 'failed') return from === 'picking' || from === 'packed' || from === 'dispatched';
  if (from === 'failed') return to === 'picking'; // retry restarts the pipeline
  const fromIndex = PIPELINE.indexOf(from);
  const toIndex = PIPELINE.indexOf(to);
  return fromIndex >= 0 && toIndex === fromIndex + 1;
}

export function selectFulfilmentForSale(state: BusinessState, saleId: string): Fulfilment | undefined {
  return (state.fulfilments ?? []).find((entry) => entry.saleId === saleId);
}

export type StartFulfilmentInput = {
  saleId: string;
  byUserId: string;
  byName: string;
  assignToUserId?: string;
  assignToName?: string;
};

/** Open a fulfilment for a completed sale, starting it at `picking`. */
export function startFulfilmentInState(current: BusinessState, input: StartFulfilmentInput): ActionResult<BusinessState> {
  const sale = current.sales.find((entry) => entry.id === input.saleId);
  if (!sale) return { ok: false, message: 'That invoice could not be found.' };
  if (sale.status === 'Reversed') return { ok: false, message: 'A reversed invoice cannot be fulfilled.' };
  if (selectFulfilmentForSale(current, input.saleId)) return { ok: false, message: 'This invoice is already being fulfilled.' };

  const now = new Date().toISOString();
  const fulfilment: Fulfilment = {
    id: `ful-${crypto.randomUUID()}`,
    saleId: input.saleId,
    status: 'picking',
    assignedToUserId: input.assignToUserId,
    assignedToName: input.assignToName,
    events: [{ status: 'picking', at: now, byUserId: input.byUserId, byName: input.byName }],
    createdAt: now,
    updatedAt: now,
  };
  return { ok: true, data: { ...current, fulfilments: [fulfilment, ...(current.fulfilments ?? [])] } };
}

export type AdvanceFulfilmentInput = {
  fulfilmentId: string;
  toStatus: FulfilmentStatus;
  byUserId: string;
  byName: string;
  note?: string;
  /** Required when advancing to `delivered`. */
  proofOfDelivery?: { recipientName: string; note?: string };
  /** Required when advancing to `failed`. */
  failureReason?: string;
};

/** Move a fulfilment to its next state, capturing proof of delivery or a failure reason as needed. */
export function advanceFulfilmentInState(current: BusinessState, input: AdvanceFulfilmentInput): ActionResult<BusinessState> {
  const fulfilment = (current.fulfilments ?? []).find((entry) => entry.id === input.fulfilmentId);
  if (!fulfilment) return { ok: false, message: 'That fulfilment could not be found.' };
  if (!canTransition(fulfilment.status, input.toStatus)) {
    return { ok: false, message: `Cannot move a ${FULFILMENT_STATUS_LABELS[fulfilment.status].toLowerCase()} delivery to ${FULFILMENT_STATUS_LABELS[input.toStatus].toLowerCase()}.` };
  }

  let proofOfDelivery: ProofOfDelivery | undefined = fulfilment.proofOfDelivery;
  if (input.toStatus === 'delivered') {
    if (!input.proofOfDelivery?.recipientName?.trim()) return { ok: false, message: 'Record who received the delivery before marking it delivered.' };
    proofOfDelivery = {
      recipientName: input.proofOfDelivery.recipientName.trim(),
      note: input.proofOfDelivery.note?.trim() || undefined,
      capturedAt: new Date().toISOString(),
      capturedByName: input.byName,
    };
  }
  if (input.toStatus === 'failed' && !input.failureReason?.trim()) {
    return { ok: false, message: 'A reason is required to report a failed delivery.' };
  }

  const now = new Date().toISOString();
  const updated: Fulfilment = {
    ...fulfilment,
    status: input.toStatus,
    proofOfDelivery,
    failureReason: input.toStatus === 'failed' ? input.failureReason?.trim() : input.toStatus === 'picking' ? undefined : fulfilment.failureReason,
    events: [...fulfilment.events, { status: input.toStatus, at: now, byUserId: input.byUserId, byName: input.byName, note: input.note?.trim() || undefined }],
    updatedAt: now,
  };
  return { ok: true, data: { ...current, fulfilments: current.fulfilments.map((entry) => (entry.id === fulfilment.id ? updated : entry)) } };
}

export type AssignFulfilmentInput = { fulfilmentId: string; assignToUserId: string; assignToName: string };

/** Set who owns moving a fulfilment forward. */
export function assignFulfilmentInState(current: BusinessState, input: AssignFulfilmentInput): ActionResult<BusinessState> {
  const fulfilment = (current.fulfilments ?? []).find((entry) => entry.id === input.fulfilmentId);
  if (!fulfilment) return { ok: false, message: 'That fulfilment could not be found.' };
  const updated: Fulfilment = {
    ...fulfilment,
    assignedToUserId: input.assignToUserId,
    assignedToName: input.assignToName,
    updatedAt: new Date().toISOString(),
  };
  return { ok: true, data: { ...current, fulfilments: current.fulfilments.map((entry) => (entry.id === fulfilment.id ? updated : entry)) } };
}
