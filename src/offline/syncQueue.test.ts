import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSyncQueue, type OperationRunner } from './syncQueue';

const STORAGE_KEY = 'test-sync-queue';

function makeQueue(registry: Record<string, OperationRunner>, maxAttempts = 3) {
  return createSyncQueue({ storageKey: STORAGE_KEY, registry, maxAttempts });
}

describe('syncQueue', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists queued operations across instances (survives app restart)', () => {
    const queue = makeQueue({});
    queue.enqueue('syncProduct', ['b1', { id: 'p1', name: 'Chair' }], 'syncProduct:p1');

    const revived = makeQueue({});
    expect(revived.pending()).toHaveLength(1);
    expect(revived.pending()[0].op).toBe('syncProduct');
  });

  it('de-dupes by key with last-write-wins, preserving queue position', () => {
    const queue = makeQueue({});
    queue.enqueue('syncProduct', [{ id: 'p1', name: 'old' }], 'syncProduct:p1');
    queue.enqueue('syncCustomer', [{ id: 'c1' }], 'syncCustomer:c1');
    queue.enqueue('syncProduct', [{ id: 'p1', name: 'new' }], 'syncProduct:p1');

    const pending = queue.pending();
    expect(pending).toHaveLength(2);
    expect(pending[0].op).toBe('syncProduct'); // kept original slot
    expect((pending[0].args[0] as { name: string }).name).toBe('new'); // newest payload
    expect(pending[1].op).toBe('syncCustomer');
  });

  it('flushes in order and removes completed operations', async () => {
    const calls: string[] = [];
    const runner: OperationRunner = vi.fn(async (...args: never[]) => {
      calls.push((args[0] as { id: string }).id);
      return { outcome: 'done' as const };
    });
    const queue = makeQueue({ op: runner });
    queue.enqueue('op', [{ id: 'first' }], 'op:first');
    queue.enqueue('op', [{ id: 'second' }], 'op:second');

    const result = await queue.flush();

    expect(calls).toEqual(['first', 'second']);
    expect(result.flushed).toBe(2);
    expect(queue.pending()).toHaveLength(0);
  });

  it('stops the whole flush on a network retry and keeps everything', async () => {
    const runner: OperationRunner = vi.fn(async () => ({ outcome: 'retry' as const, error: 'offline' }));
    const queue = makeQueue({ op: runner });
    queue.enqueue('op', [{ id: 'a' }], 'op:a');
    queue.enqueue('op', [{ id: 'b' }], 'op:b');

    const result = await queue.flush();

    expect(result.stoppedForNetwork).toBe(true);
    expect(result.remaining).toBe(2);
    expect(runner).toHaveBeenCalledTimes(1); // never reached the second op
  });

  it('moves a rejected op to the back so it cannot block the rest', async () => {
    const outcomes: Record<string, 'done' | 'reject'> = { bad: 'reject', good: 'done' };
    const calls: string[] = [];
    const runner: OperationRunner = vi.fn(async (...args: never[]) => {
      const id = (args[0] as { id: string }).id;
      calls.push(id);
      return { outcome: outcomes[id] };
    });
    const queue = makeQueue({ op: runner });
    queue.enqueue('op', [{ id: 'bad' }], 'op:bad');
    queue.enqueue('op', [{ id: 'good' }], 'op:good');

    const result = await queue.flush();

    expect(calls).toEqual(['bad', 'good']);
    expect(result.flushed).toBe(1);
    expect(queue.pending()).toHaveLength(1);
    expect(queue.pending()[0].args[0]).toEqual({ id: 'bad' });
    expect(queue.pending()[0].attempts).toBe(1);
  });

  it('gives each op at most one attempt per flush (no same-flush spinning)', async () => {
    const runner: OperationRunner = vi.fn(async () => ({ outcome: 'reject' as const, error: 'no' }));
    const queue = makeQueue({ op: runner }, 5);
    queue.enqueue('op', [{ id: 'a' }], 'op:a');

    await queue.flush();

    expect(runner).toHaveBeenCalledTimes(1);
    expect(queue.pending()[0].attempts).toBe(1);
  });

  it('drops an op after maxAttempts rejections', async () => {
    const runner: OperationRunner = vi.fn(async () => ({ outcome: 'reject' as const, error: 'RLS denied' }));
    const queue = makeQueue({ op: runner }, 2);
    queue.enqueue('op', [{ id: 'a' }], 'op:a');

    const first = await queue.flush();
    expect(first.dropped).toHaveLength(0);
    expect(queue.pending()).toHaveLength(1);

    const second = await queue.flush();
    expect(second.dropped).toHaveLength(1);
    expect(second.dropped[0].lastError).toBe('RLS denied');
    expect(queue.pending()).toHaveLength(0);
  });

  it('drops unknown operations instead of wedging the queue', async () => {
    const queue = makeQueue({});
    queue.enqueue('removedOp', [], 'removedOp:x');
    queue.enqueue('alsoRemoved', [], 'alsoRemoved:y');

    const result = await queue.flush();

    expect(result.dropped).toHaveLength(2);
    expect(queue.pending()).toHaveLength(0);
  });

  it('treats a throwing runner as a network retry', async () => {
    const runner: OperationRunner = vi.fn(async () => {
      throw new Error('fetch failed');
    });
    const queue = makeQueue({ op: runner });
    queue.enqueue('op', [{ id: 'a' }], 'op:a');

    const result = await queue.flush();

    expect(result.stoppedForNetwork).toBe(true);
    expect(queue.pending()).toHaveLength(1);
  });

  it('notifies subscribers on every change', () => {
    const queue = makeQueue({});
    const seen: number[] = [];
    queue.subscribe((pending) => seen.push(pending.length));

    queue.enqueue('op', [], 'op:1');
    queue.enqueue('op', [], 'op:2');
    queue.clear();

    expect(seen).toEqual([1, 2, 0]);
  });
});
