import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607161500_atomic_inventory_import.sql'),
  'utf8'
);
const locationResolutionMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607161830_resolve_inventory_import_locations.sql'),
  'utf8'
);
const locationBootstrapMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607161900_bootstrap_inventory_import_locations.sql'),
  'utf8'
);

describe('atomic inventory import migration', () => {
  it('authorizes owners or inventory-capable employees and inserts products with opening stock atomically', () => {
    expect(migration).toContain('public.import_inventory_batch');
    expect(migration).toContain("employee_record.role not in ('GeneralManager', 'PurchaseManager')");
    expect(migration).toContain('public.user_owns_business(target_business_id)');
    expect(migration).toContain('insert into public.products');
    expect(migration).toContain('insert into public.stock_movements');
    expect(migration).toContain('product_count > 10000');
  });

  it('resolves restored local location ids against canonical workspace locations', () => {
    expect(locationResolutionMigration).toContain("batch_payload -> 'locations'");
    expect(locationResolutionMigration).toContain('lower(trim(location_code)) = lower(trim(location_record.location_code))');
    expect(locationResolutionMigration).toContain('lower(trim(name)) = lower(trim(location_record.name))');
    expect(locationBootstrapMigration).toContain('insert into public.business_locations');
    expect(locationBootstrapMigration).toContain("resolved_locations ->> item.location_id::text");
  });
});
