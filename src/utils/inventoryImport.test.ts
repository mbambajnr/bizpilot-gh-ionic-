import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import {
  INVENTORY_IMPORT_COLUMNS,
  buildInventoryTemplateCsv,
  validateInventoryImportCsv,
} from './inventoryImport';

describe('inventoryImport', () => {
  it('builds a CSV template with the expected headers', () => {
    const csv = buildInventoryTemplateCsv();
    const [headerLine] = csv.trim().split('\n');

    expect(headerLine).toBe(INVENTORY_IMPORT_COLUMNS.join(','));
  });

  it('flags header mismatches before import', () => {
    const csv = [
      'Item Name,SKU,Unit,Cost Price,Selling Price,Quantity In Stock,Reorder Level,Image URL',
      'Morning Fresh Soap,INV-SOAP-001,units,12,18,40,10,',
    ].join('\n');

    const preview = validateInventoryImportCsv(csv, seedState.products);

    expect(preview.headerErrors).toHaveLength(1);
    expect(preview.validRows).toHaveLength(0);
  });

  it('marks duplicate inventory ids, duplicate existing item names, and invalid numeric values as invalid rows', () => {
    const csv = [
      INVENTORY_IMPORT_COLUMNS.join(','),
      'Sunlight Detergent,INV-001,units,12,18,40,10,',
      'Sunlight Detergent,INV-NEW-001,units,abc,18,-1,10,',
    ].join('\n');

    const preview = validateInventoryImportCsv(csv, seedState.products);

    expect(preview.validRows).toHaveLength(0);
    expect(preview.invalidRows).toHaveLength(2);
    expect(preview.invalidRows[0].errors.join(' ')).toContain('Inventory ID already exists');
    expect(preview.invalidRows[0].errors.join(' ')).toContain('Item Name already exists');
    expect(preview.invalidRows[1].errors.join(' ')).toContain('Cost Price must be a valid number');
    expect(preview.invalidRows[1].errors.join(' ')).toContain('Item Name already exists');
    expect(preview.invalidRows[1].errors.join(' ')).toContain('Quantity In Stock must be a whole number that is 0 or more');
  });

  it('normalizes valid rows into addProduct inputs', () => {
    const csv = [
      INVENTORY_IMPORT_COLUMNS.join(','),
      'Blue Detergent,INV-NEW-101,bottles,15,22,25,5,https://example.com/image.png',
    ].join('\n');

    const preview = validateInventoryImportCsv(csv, seedState.products);

    expect(preview.headerErrors).toHaveLength(0);
    expect(preview.invalidRows).toHaveLength(0);
    expect(preview.validRows).toHaveLength(1);
    expect(preview.validRows[0].normalizedInput).toEqual({
      name: 'Blue Detergent',
      inventoryId: 'INV-NEW-101',
      unit: 'bottles',
      cost: 15,
      price: 22,
      quantity: 25,
      reorderLevel: 5,
      image: 'https://example.com/image.png',
    });
  });
});
