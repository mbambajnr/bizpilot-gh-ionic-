import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import {
  INVENTORY_IMPORT_COLUMNS,
  buildInventoryTemplateCsv,
  suggestInventoryImportMapping,
  validateInventoryImportCsv,
  validateInventoryImportRows,
} from './inventoryImport';

describe('inventoryImport', () => {
  it('builds a CSV template with the expected headers', () => {
    const csv = buildInventoryTemplateCsv();
    const [headerLine] = csv.trim().split('\n');

    expect(headerLine).toBe(INVENTORY_IMPORT_COLUMNS.join(','));
  });

  it('flags header mismatches before import', () => {
    const csv = [
      'Item Name,SKU,Unit,Wholesale Value,Selling Price,Quantity In Stock,Reorder Level,Image URL',
      'Morning Fresh Soap,INV-SOAP-001,units,12,18,40,10,',
    ].join('\n');

    const preview = validateInventoryImportCsv(csv, seedState.products);

    expect(preview.headerErrors).toHaveLength(1);
    expect(preview.validRows).toHaveLength(0);
  });

  it('maps common spreadsheet headings in any order', () => {
    const csv = [
      'SKU,Product Name,Qty,Retail Price,Unit Cost,UOM,Minimum Stock',
      'SOAP-900,Morning Fresh Soap,40,18,12,cartons,10',
    ].join('\n');

    const preview = validateInventoryImportCsv(csv, seedState.products);

    expect(preview.headerErrors).toHaveLength(0);
    expect(preview.validRows[0].normalizedInput).toMatchObject({
      inventoryId: 'SOAP-900',
      name: 'Morning Fresh Soap',
      quantity: 40,
      price: 18,
      cost: 12,
      unit: 'cartons',
      reorderLevel: 10,
    });
  });

  it('parses quoted commas and line breaks exported by spreadsheet applications', () => {
    const csv = [
      INVENTORY_IMPORT_COLUMNS.join(','),
      '"Soap, Premium",SOAP-901,units,12,18,40,10,"https://example.com/soap.png",',
    ].join('\n');
    const preview = validateInventoryImportCsv(csv, seedState.products);
    expect(preview.validRows[0].normalizedInput?.name).toBe('Soap, Premium');
  });

  it('blocks duplicate inventory ids and invalid numbers while warning about repeated item names', () => {
    const csv = [
      INVENTORY_IMPORT_COLUMNS.join(','),
      'Sunlight Detergent,INV-001,units,12,18,40,10,',
      'Sunlight Detergent,INV-NEW-001,units,abc,18,-1,10,',
    ].join('\n');

    const preview = validateInventoryImportCsv(csv, seedState.products);

    expect(preview.validRows).toHaveLength(0);
    expect(preview.invalidRows).toHaveLength(2);
    expect(preview.invalidRows[0].errors.join(' ')).toContain('Inventory ID already exists');
    expect(preview.invalidRows[0].warnings.join(' ')).toContain('Item Name already exists');
    expect(preview.invalidRows[1].errors.join(' ')).toContain('Cost Price must be a valid number');
    expect(preview.invalidRows[1].warnings.join(' ')).toContain('Item Name already exists');
    expect(preview.invalidRows[1].errors.join(' ')).toContain('Quantity In Stock must be a whole number that is 0 or more');
  });

  it('stages legacy ERP rows in catalogue-only mode with automatic field mapping', () => {
    const rows = [
      ['Number', 'Active', 'Processed', 'Error', 'Class', 'code', 'Brand', 'Item Describtion', 'UOM', 'CostPrice', 'SellingPrice'],
      ['1', 'True', 'True', '', 'ACCESS', 'A0001', '', 'LAMP EMERGENCY', '', '', ''],
      ['2', 'True', 'True', '', 'ACCESS', 'A0002', '', 'LAMP EMERGENCY', '', '', ''],
    ];

    const preview = validateInventoryImportRows(rows, [], { mode: 'catalogue' });

    expect(preview.headerErrors).toHaveLength(0);
    expect(preview.validRows).toHaveLength(2);
    expect(preview.warningRows).toHaveLength(2);
    expect(preview.unmappedHeaders).toEqual(['Number', 'Active', 'Processed', 'Error', 'Brand']);
    expect(preview.validRows[0].normalizedInput).toMatchObject({
      inventoryId: 'A0001',
      name: 'LAMP EMERGENCY',
      unit: 'units',
      categoryId: undefined,
      cost: 0,
      price: 0,
      quantity: 0,
      reorderLevel: 0,
    });
  });

  it('allows suggested mappings to be reviewed and explicitly ignored', () => {
    const headers = ['Item Describtion', 'code', 'Class'];
    const mapping = suggestInventoryImportMapping(headers);
    mapping[2] = undefined;

    const preview = validateInventoryImportRows([
      headers,
      ['LAMPHOLDER B22', 'A0002', 'ACCESS'],
    ], [], { mode: 'catalogue', columnMapping: mapping });

    expect(preview.validRows).toHaveLength(1);
    expect(preview.validRows[0].values.Category).toBe('');
    expect(preview.unmappedHeaders).toEqual(['Class']);
  });

  it('normalizes valid rows into addProduct inputs', () => {
    const csv = [
      'Item Name,Inventory ID,Unit,Cost Price,Selling Price,Quantity In Stock,Reorder Level,Image URL',
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

  it('accepts an optional category column and maps active categories when enabled', () => {
    const csv = [
      INVENTORY_IMPORT_COLUMNS.join(','),
      'Blue Detergent,INV-NEW-201,bottles,15,22,25,5,https://example.com/image.png,Household',
    ].join('\n');

    const preview = validateInventoryImportCsv(csv, seedState.products, {
      inventoryCategoriesEnabled: true,
      productCategories: [
        {
          id: 'pc-1',
          name: 'Household',
          slug: 'household',
          sortOrder: 0,
          isActive: true,
        },
      ],
    });

    expect(preview.headerErrors).toHaveLength(0);
    expect(preview.invalidRows).toHaveLength(0);
    expect(preview.validRows[0].normalizedInput?.categoryId).toBe('pc-1');
  });

  it('keeps category optional and supports legacy uncategorized rows safely', () => {
    const csv = [
      'Item Name,Inventory ID,Unit,Cost Price,Selling Price,Quantity In Stock,Reorder Level,Image URL',
      'Blue Detergent,INV-NEW-301,bottles,15,22,25,5,https://example.com/image.png',
    ].join('\n');

    const preview = validateInventoryImportCsv(csv, seedState.products, {
      inventoryCategoriesEnabled: true,
      productCategories: [
        {
          id: 'pc-1',
          name: 'Household',
          slug: 'household',
          sortOrder: 0,
          isActive: true,
        },
      ],
    });

    expect(preview.headerErrors).toHaveLength(0);
    expect(preview.invalidRows).toHaveLength(0);
    expect(preview.validRows[0].normalizedInput?.categoryId).toBeUndefined();
  });

  it('ignores category values when categories are disabled', () => {
    const csv = [
      INVENTORY_IMPORT_COLUMNS.join(','),
      'Blue Detergent,INV-NEW-401,bottles,15,22,25,5,https://example.com/image.png,Household',
    ].join('\n');

    const preview = validateInventoryImportCsv(csv, seedState.products, {
      inventoryCategoriesEnabled: false,
      productCategories: [
        {
          id: 'pc-1',
          name: 'Household',
          slug: 'household',
          sortOrder: 0,
          isActive: true,
        },
      ],
    });

    expect(preview.headerErrors).toHaveLength(0);
    expect(preview.invalidRows).toHaveLength(0);
    expect(preview.validRows[0].normalizedInput?.categoryId).toBeUndefined();
  });

  it('rejects missing or inactive categories when category import is used and enabled', () => {
    const csv = [
      INVENTORY_IMPORT_COLUMNS.join(','),
      'Blue Detergent,INV-NEW-501,bottles,15,22,25,5,https://example.com/image.png,Missing category',
      'Green Detergent,INV-NEW-502,bottles,15,22,25,5,https://example.com/image.png,Archived',
    ].join('\n');

    const preview = validateInventoryImportCsv(csv, seedState.products, {
      inventoryCategoriesEnabled: true,
      productCategories: [
        {
          id: 'pc-2',
          name: 'Archived',
          slug: 'archived',
          sortOrder: 0,
          isActive: false,
        },
      ],
    });

    expect(preview.validRows).toHaveLength(0);
    expect(preview.invalidRows[0].errors.join(' ')).toContain('Category could not be found');
    expect(preview.invalidRows[1].errors.join(' ')).toContain('Category is inactive');
  });
});
