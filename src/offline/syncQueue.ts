/**
 * Durable, ordered replay queue for offline writes.
 *
 * Design:
 * - Persisted to localStorage on every change, so queued work survives app
 *   restarts (the same guarantee the app already gives its business state).
 * - FIFO with last-write-wins de-dupe: re-queueing the same key replaces the
 *   payload IN PLACE, preserving the original position so dependency order
 *   (e.g. category before product) holds.
 * - Replay is sequential. Each runner reports a tri-state outcome:
 *     'done'   → remove from queue
 *     'retry'  → connectivity problem: stop the flush, keep everything
 *     'reject' → the server refused: count the attempt, drop after maxAttempts
 */

export type QueueOutcome = 'done' | 'retry' | 'reject';

export type QueuedOperation = {
  id: string;
  op: string;
  args: unknown[];
  key: string;
  queuedAt: string;
  attempts: number;
  lastError?: string;
};

export type FlushResult = {
  flushed: number;
  remaining: number;
  dropped: QueuedOperation[];
  stoppedForNetwork: boolean;
};

export type OperationRunner = (...args: never[]) => Promise<{ outcome: QueueOutcome; error?: string }>;

type QueueListener = (pending: QueuedOperation[]) => void;

export type SyncQueue = ReturnType<typeof createSyncQueue>;

export function createSyncQueue(options: {
  storageKey: string;
  registry: Record<string, OperationRunner>;
  maxAttempts?: number;
}) {
  const { storageKey, registry } = options;
  const maxAttempts = options.maxAttempts ?? 8;
  const listeners = new Set<QueueListener>();
  let flushing = false;

  function load(): QueuedOperation[] {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function save(operations: QueuedOperation[]) {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(operations));
    } catch {
      // Storage full or unavailable — the in-memory flush still proceeds.
    }
    for (const listener of listeners) {
      listener(operations);
    }
  }

  function enqueue(op: string, args: unknown[], key: string): QueuedOperation {
    const operations = load();
    const entry: QueuedOperation = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      op,
      args,
      key,
      queuedAt: new Date().toISOString(),
      attempts: 0,
    };

    const existingIndex = operations.findIndex((item) => item.key === key);
    if (existingIndex >= 0) {
      // Same entity queued again: newest payload wins, position preserved.
      entry.id = operations[existingIndex].id;
      entry.queuedAt = operations[existingIndex].queuedAt;
      operations[existingIndex] = entry;
    } else {
      operations.push(entry);
    }

    save(operations);
    return entry;
  }

  function pending(): QueuedOperation[] {
    return load();
  }

  function subscribe(listener: QueueListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  async function flush(): Promise<FlushResult> {
    if (flushing) {
      return { flushed: 0, remaining: load().length, dropped: [], stoppedForNetwork: false };
    }
    flushing = true;

    const dropped: QueuedOperation[] = [];
    let flushed = 0;
    let stoppedForNetwork = false;

    try {
      let operations = load();
      // Each queued item gets at most one attempt per flush — a rejected op
      // moved to the back must wait for the NEXT flush, not spin in this one.
      let budget = operations.length;

      while (operations.length > 0 && budget > 0) {
        budget -= 1;
        const current = operations[0];
        const runner = registry[current.op];

        if (!runner) {
          // Unknown op (e.g. from an older app version) — drop it, don't wedge the queue.
          dropped.push({ ...current, lastError: 'Unknown operation.' });
          operations = operations.slice(1);
          save(operations);
          continue;
        }

        let outcome: QueueOutcome;
        let error: string | undefined;
        try {
          const result = await runner(...(current.args as never[]));
          outcome = result.outcome;
          error = result.error;
        } catch (err) {
          outcome = 'retry';
          error = err instanceof Error ? err.message : String(err);
        }

        if (outcome === 'done') {
          flushed += 1;
          operations = operations.slice(1);
          save(operations);
          continue;
        }

        if (outcome === 'retry') {
          // Connectivity: keep everything, try again on the next trigger.
          operations[0] = { ...current, lastError: error };
          save(operations);
          stoppedForNetwork = true;
          break;
        }

        // 'reject': the server understood and refused.
        const attempts = current.attempts + 1;
        if (attempts >= maxAttempts) {
          dropped.push({ ...current, attempts, lastError: error });
          operations = operations.slice(1);
        } else {
          operations[0] = { ...current, attempts, lastError: error };
          // Move it to the back so one rejected entity can't block the rest.
          operations = [...operations.slice(1), operations[0]];
        }
        save(operations);
      }

      return { flushed, remaining: load().length, dropped, stoppedForNetwork };
    } finally {
      flushing = false;
    }
  }

  function clear() {
    save([]);
  }

  return { enqueue, pending, flush, subscribe, clear };
}
