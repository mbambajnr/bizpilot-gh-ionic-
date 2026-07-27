/**
 * Offline-resilient drop-in replacement for src/data/supabaseSync.
 *
 * BusinessContext imports its sync functions from here instead of from
 * supabaseSync directly. Each wrapped function behaves identically when
 * online; when the device is offline (or the request dies on the network),
 * the operation is captured in a durable localStorage queue and replayed —
 * in order, last-write-wins per entity — when connectivity returns.
 *
 * Replay triggers: the browser 'online' event, a 30s heartbeat while work is
 * pending, and an explicit flush before the cloud load at sign-in (so stale
 * server data can never overwrite unsynced local work — see BusinessContext).
 *
 * Interactive operations (credential verification, password rotation) are
 * deliberately NOT queued — they must succeed or fail in front of the user.
 */

import * as base from '../data/supabaseSync';
import type { UserAccessProfile } from '../authz/types';
import { isOnline, onNetworkChange } from './networkStatus';
import { createSyncQueue, type OperationRunner, type QueueOutcome, type QueuedOperation } from './syncQueue';

export const OFFLINE_SYNC_STORAGE_KEY = 'bizpilot-offline-sync-queue-v1';

/** supabaseSync's wording when a request died before reaching the server. */
const NETWORK_FAILURE_MESSAGE = 'Supabase sync failed before the request could complete.';
type ReceivablePaymentCommandInput = Parameters<typeof base.syncReceivablePaymentCommand>[0];
type SalesReturnCommandInput = Parameters<typeof base.syncSalesReturnCommand>[0];
type InventoryImportBatchCommand = Parameters<typeof base.syncInventoryImportBatch>[0];
type QuotationForUserArgs = Parameters<typeof base.syncQuotationForUser>;
type LegacyQuotationArgs = Parameters<typeof base.syncQuotation>;
type CredentialCommandInput = ReceivablePaymentCommandInput | SalesReturnCommandInput | InventoryImportBatchCommand;
let activeSyncUser: UserAccessProfile | null = null;

type SyncFn = (...args: never[]) => Promise<boolean>;

function classifyFailure(): QueueOutcome {
  if (!isOnline()) {
    return 'retry';
  }
  return base.getLastSupabaseSyncErrorMessage() === NETWORK_FAILURE_MESSAGE ? 'retry' : 'reject';
}

function toRunner(fn: SyncFn): OperationRunner {
  return async (...args: never[]) => {
    if (!isOnline()) {
      return { outcome: 'retry', error: 'Device is offline.' };
    }
    const ok = await fn(...args);
    if (ok) {
      return { outcome: 'done' };
    }
    return { outcome: classifyFailure(), error: base.getLastSupabaseSyncErrorMessage() ?? 'Sync failed.' };
  };
}

/** Entity syncs all take the entity as their LAST argument. */
function lastArgId(args: unknown[]): string {
  const last = args[args.length - 1] as { id?: unknown } | undefined;
  const id = last && typeof last === 'object' ? last.id : undefined;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : JSON.stringify(args);
}

type WrappedEntry = {
  fn: SyncFn;
  key?: (args: unknown[]) => string;
};

const WRAPPED: Record<string, WrappedEntry> = {
  syncProduct: { fn: base.syncProduct as SyncFn },
  syncProductCategory: { fn: base.syncProductCategory as SyncFn },
  syncBusinessLocation: { fn: base.syncBusinessLocation as SyncFn },
  syncSupplyRoute: { fn: base.syncSupplyRoute as SyncFn },
  syncVendor: { fn: base.syncVendor as SyncFn },
  syncEmployeeVendor: { fn: base.syncEmployeeVendor as SyncFn },
  syncCustomer: { fn: base.syncCustomer as SyncFn },
  syncSale: { fn: base.syncSale as SyncFn },
  syncQuotation: { fn: base.syncQuotation as SyncFn },
  syncPurchase: { fn: base.syncPurchase as SyncFn },
  syncEmployeePurchase: { fn: base.syncEmployeePurchase as SyncFn },
  syncEmployeeCredential: { fn: base.syncEmployeeCredential as SyncFn },
  syncBusinessProfile: { fn: base.syncBusinessProfile as SyncFn },
  syncActivityLogEntry: { fn: base.syncActivityLogEntry as SyncFn },
  syncAppNotification: { fn: base.syncAppNotification as SyncFn },
  syncAppNotificationRead: {
    fn: base.syncAppNotificationRead as SyncFn,
    // (businessId, notificationId, readUserId, createdAt) — no entity object.
    key: (args) => `${String(args[1])}:${String(args[2])}`,
  },
  syncExpenseForUser: { fn: base.syncExpenseForUser as SyncFn },
  syncStockMovementForUser: { fn: base.syncStockMovementForUser as SyncFn },
  syncAccountsPayableForUser: { fn: base.syncAccountsPayableForUser as SyncFn },
  syncPaymentForUser: { fn: base.syncPaymentForUser as SyncFn },
  syncQuotationForUser: { fn: base.syncQuotationForUser as SyncFn },
  syncRestockRequestForUser: { fn: base.syncRestockRequestForUser as SyncFn },
  syncStockTransferForUser: { fn: base.syncStockTransferForUser as SyncFn },
};

const registry: Record<string, OperationRunner> = {};
for (const [op, entry] of Object.entries(WRAPPED)) {
  registry[op] = toRunner(entry.fn);
}

function withoutEmployeeSecret<T extends CredentialCommandInput>(input: T): T {
  return { ...input, user: { ...input.user, employeeSessionSecret: undefined } } as T;
}

function withActiveEmployeeSecret<T extends CredentialCommandInput>(input: T): T | null {
  if (!input.user.businessId) return input;
  if (input.user.employeeSessionSecret) return input;
  if (activeSyncUser?.userId !== input.user.userId || !activeSyncUser.employeeSessionSecret) return null;
  return { ...input, user: { ...input.user, employeeSessionSecret: activeSyncUser.employeeSessionSecret } } as T;
}

function withActiveQuotationUser(args: QuotationForUserArgs): QuotationForUserArgs | null {
  const [businessId, user, quotation] = args;
  if (!user.businessId) return args;
  if (user.employeeSessionSecret) return args;
  if (activeSyncUser?.userId !== user.userId || activeSyncUser.businessId !== businessId || !activeSyncUser.employeeSessionSecret) return null;
  return [businessId, { ...user, employeeSessionSecret: activeSyncUser.employeeSessionSecret }, quotation];
}

function safeQuotationArgs(args: QuotationForUserArgs): QuotationForUserArgs {
  const [businessId, user, quotation] = args;
  return [businessId, { ...user, employeeSessionSecret: undefined }, quotation];
}

function toQueuedArgs(args: unknown[]): never[] {
  return args as never[];
}

async function runQuotationForUser(args: QuotationForUserArgs): Promise<QueueOutcome> {
  const hydrated = withActiveQuotationUser(args);
  if (!hydrated) return 'retry';
  const ok = await base.syncQuotationForUser(...hydrated);
  if (ok) return 'done';
  return classifyFailure();
}

registry.syncReceivablePaymentCommand = async (rawInput: never) => {
  if (!isOnline()) return { outcome: 'retry', error: 'Device is offline.' };
  const input = withActiveEmployeeSecret(rawInput as ReceivablePaymentCommandInput);
  if (!input) return { outcome: 'retry', error: 'Sign in again to synchronize the queued customer payment.' };
  const ok = await base.syncReceivablePaymentCommand(input);
  if (ok) return { outcome: 'done' };
  return { outcome: classifyFailure(), error: base.getLastSupabaseSyncErrorMessage() ?? 'Sync failed.' };
};

registry.syncSalesReturnCommand = async (rawInput: never) => {
  if (!isOnline()) return { outcome: 'retry', error: 'Device is offline.' };
  const input = withActiveEmployeeSecret(rawInput as SalesReturnCommandInput);
  if (!input) return { outcome: 'retry', error: 'Sign in again to synchronize the queued customer return.' };
  const ok = await base.syncSalesReturnCommand(input);
  if (ok) return { outcome: 'done' };
  return { outcome: classifyFailure(), error: base.getLastSupabaseSyncErrorMessage() ?? 'Sync failed.' };
};

registry.syncInventoryImportBatch = async (rawInput: never) => {
  if (!isOnline()) return { outcome: 'retry', error: 'Device is offline.' };
  const input = withActiveEmployeeSecret(rawInput as InventoryImportBatchCommand);
  if (!input) return { outcome: 'retry', error: 'Sign in again to synchronize the queued inventory import.' };
  const ok = await base.syncInventoryImportBatch(input);
  if (ok) return { outcome: 'done' };
  return { outcome: classifyFailure(), error: base.getLastSupabaseSyncErrorMessage() ?? 'Sync failed.' };
};

registry.syncQuotationForUser = async (...rawArgs: never[]) => {
  if (!isOnline()) return { outcome: 'retry', error: 'Device is offline.' };
  const outcome = await runQuotationForUser(rawArgs as unknown as QuotationForUserArgs);
  if (outcome === 'done') return { outcome };
  return { outcome, error: outcome === 'retry' ? 'Sign in again to synchronize the queued quotation.' : base.getLastSupabaseSyncErrorMessage() ?? 'Sync failed.' };
};

registry.syncQuotation = async (...rawArgs: never[]) => {
  if (!isOnline()) return { outcome: 'retry', error: 'Device is offline.' };
  const [businessId, quotation] = rawArgs as unknown as LegacyQuotationArgs;
  if (activeSyncUser?.businessId === businessId) {
    if (!activeSyncUser.employeeSessionSecret) return { outcome: 'retry', error: 'Sign in again to synchronize the queued quotation.' };
    const outcome = await runQuotationForUser([businessId, activeSyncUser, quotation]);
    if (outcome === 'done') return { outcome };
    return { outcome, error: outcome === 'retry' ? 'Sign in again to synchronize the queued quotation.' : base.getLastSupabaseSyncErrorMessage() ?? 'Sync failed.' };
  }
  const ok = await base.syncQuotation(businessId, quotation);
  if (ok) return { outcome: 'done' };
  return { outcome: classifyFailure(), error: base.getLastSupabaseSyncErrorMessage() ?? 'Sync failed.' };
};

export const offlineSyncQueue = createSyncQueue({
  storageKey: OFFLINE_SYNC_STORAGE_KEY,
  registry,
});

/** Registers extra replayable operations (used by the POS module). */
export function registerOfflineOperation(op: string, runner: OperationRunner) {
  registry[op] = runner;
}

function wrap(op: string): SyncFn {
  const entry = WRAPPED[op];
  return (async (...args: never[]) => {
    const key = `${op}:${entry.key ? entry.key(args) : lastArgId(args)}`;

    if (!isOnline()) {
      offlineSyncQueue.enqueue(op, args, key);
      return true; // Captured — will reach the server on reconnect.
    }

    const ok = await entry.fn(...args);
    if (ok) {
      return true;
    }
    if (classifyFailure() === 'retry') {
      offlineSyncQueue.enqueue(op, args, key);
      return true;
    }
    return false; // Real server rejection — surface it like before.
  }) as SyncFn;
}

// ---- Public API: queue status + manual flush --------------------------------

export function getPendingOfflineSync(): QueuedOperation[] {
  return offlineSyncQueue.pending();
}

export function subscribeOfflineSync(listener: (pending: QueuedOperation[]) => void): () => void {
  return offlineSyncQueue.subscribe(listener);
}

export async function flushOfflineSync() {
  if (!isOnline()) {
    return { flushed: 0, remaining: offlineSyncQueue.pending().length, dropped: [], stoppedForNetwork: true };
  }
  return offlineSyncQueue.flush();
}

export function setOfflineSyncUser(user: UserAccessProfile | null) {
  activeSyncUser = user;
}

// ---- Automatic flush wiring --------------------------------------------------

if (typeof window !== 'undefined') {
  onNetworkChange((online) => {
    if (online) {
      void flushOfflineSync();
    }
  });
  window.setInterval(() => {
    if (isOnline() && offlineSyncQueue.pending().length > 0) {
      void flushOfflineSync();
    }
  }, 30_000);
}

// ---- Drop-in exports (same names BusinessContext already imports) ------------

export const syncProduct = wrap('syncProduct') as typeof base.syncProduct;
export const syncProductCategory = wrap('syncProductCategory') as typeof base.syncProductCategory;
export const syncBusinessLocation = wrap('syncBusinessLocation') as typeof base.syncBusinessLocation;
export const syncSupplyRoute = wrap('syncSupplyRoute') as typeof base.syncSupplyRoute;
export const syncVendor = wrap('syncVendor') as typeof base.syncVendor;
export const syncEmployeeVendor = wrap('syncEmployeeVendor') as typeof base.syncEmployeeVendor;
export const syncCustomer = wrap('syncCustomer') as typeof base.syncCustomer;
export const syncSale = wrap('syncSale') as typeof base.syncSale;
export const syncQuotation = wrap('syncQuotation') as typeof base.syncQuotation;
export const syncPurchase = wrap('syncPurchase') as typeof base.syncPurchase;
export const syncEmployeePurchase = wrap('syncEmployeePurchase') as typeof base.syncEmployeePurchase;
export const syncEmployeeCredential = wrap('syncEmployeeCredential') as typeof base.syncEmployeeCredential;
export const syncBusinessProfile = wrap('syncBusinessProfile') as typeof base.syncBusinessProfile;
export const syncActivityLogEntry = wrap('syncActivityLogEntry') as typeof base.syncActivityLogEntry;
export const syncAppNotification = wrap('syncAppNotification') as typeof base.syncAppNotification;
export const syncAppNotificationRead = wrap('syncAppNotificationRead') as typeof base.syncAppNotificationRead;
export const syncExpenseForUser = wrap('syncExpenseForUser') as typeof base.syncExpenseForUser;
export const syncStockMovementForUser = wrap('syncStockMovementForUser') as typeof base.syncStockMovementForUser;
export const syncAccountsPayableForUser = wrap('syncAccountsPayableForUser') as typeof base.syncAccountsPayableForUser;
export const syncPaymentForUser = wrap('syncPaymentForUser') as typeof base.syncPaymentForUser;
export const syncQuotationForUser = (async (...args: QuotationForUserArgs) => {
  const key = `syncQuotationForUser:${lastArgId(args)}`;

  if (!isOnline()) {
    offlineSyncQueue.enqueue('syncQuotationForUser', toQueuedArgs(safeQuotationArgs(args)), key);
    return true;
  }

  const outcome = await runQuotationForUser(args);
  if (outcome === 'done') return true;
  if (outcome === 'retry') {
    offlineSyncQueue.enqueue('syncQuotationForUser', toQueuedArgs(safeQuotationArgs(args)), key);
    return true;
  }
  return false;
}) as typeof base.syncQuotationForUser;
export async function syncInventoryImportBatch(input: InventoryImportBatchCommand) {
  const safeInput = withoutEmployeeSecret(input);
  const batchId = input.products[0]?.id ?? crypto.randomUUID();
  const key = `syncInventoryImportBatch:${input.businessId}:${batchId}`;
  if (!isOnline()) {
    offlineSyncQueue.enqueue('syncInventoryImportBatch', [safeInput], key);
    return true;
  }
  const ok = await base.syncInventoryImportBatch(input);
  if (ok) return true;
  if (classifyFailure() === 'retry') {
    offlineSyncQueue.enqueue('syncInventoryImportBatch', [safeInput], key);
    return true;
  }
  return false;
}
export async function syncReceivablePaymentCommand(input: ReceivablePaymentCommandInput) {
  const safeInput = withoutEmployeeSecret(input);
  const key = `syncReceivablePaymentCommand:${input.payment.id}`;
  if (!isOnline()) {
    offlineSyncQueue.enqueue('syncReceivablePaymentCommand', [safeInput], key);
    return true;
  }
  const ok = await base.syncReceivablePaymentCommand(input);
  if (ok) return true;
  if (classifyFailure() === 'retry') {
    offlineSyncQueue.enqueue('syncReceivablePaymentCommand', [safeInput], key);
    return true;
  }
  return false;
}
export async function syncSalesReturnCommand(input: SalesReturnCommandInput) {
  const safeInput = withoutEmployeeSecret(input);
  const key = `syncSalesReturnCommand:${input.creditNote.id}`;
  if (!isOnline()) {
    offlineSyncQueue.enqueue('syncSalesReturnCommand', [safeInput], key);
    return true;
  }
  const ok = await base.syncSalesReturnCommand(input);
  if (ok) return true;
  if (classifyFailure() === 'retry') {
    offlineSyncQueue.enqueue('syncSalesReturnCommand', [safeInput], key);
    return true;
  }
  return false;
}
export const syncRestockRequestForUser = wrap('syncRestockRequestForUser') as typeof base.syncRestockRequestForUser;
export const syncStockTransferForUser = wrap('syncStockTransferForUser') as typeof base.syncStockTransferForUser;

// Interactive / read operations: pass through untouched.
export const getLastSupabaseSyncErrorMessage = base.getLastSupabaseSyncErrorMessage;
export const verifyEmployeeCredential = base.verifyEmployeeCredential;
export const rotateEmployeePassword = base.rotateEmployeePassword;
