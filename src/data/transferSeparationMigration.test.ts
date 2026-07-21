import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607161330_transfer_separation_of_duties.sql'),
  'utf8'
);

describe('stock transfer separation migration', () => {
  it('enforces role-separated approval, dispatch, and destination receipt', () => {
    expect(migration).toContain("actor_role is distinct from 'GeneralManager'");
    expect(migration).toContain("actor_role is distinct from 'WarehouseManager'");
    expect(migration).toContain("actor_role is distinct from 'StoreManager'");
    expect(migration).toContain("old.status <> 'dispatched'");
    expect(migration).toContain('actor_id = new.dispatched_by');
  });
});
