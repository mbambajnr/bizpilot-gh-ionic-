import type { NewProductInput } from './businessLogic';
import type { Product } from '../data/seedBusiness';

export const INVENTORY_IMPORT_COLUMNS = [
  'Item Name',
  'Inventory ID',
  'Unit',
  'Cost Price',
  'Selling Price',
  'Quantity In Stock',
  'Reorder Level',
  'Image URL',
] as const;

type InventoryImportColumn = (typeof INVENTORY_IMPORT_COLUMNS)[number];

type InventoryImportRawRecord = Record<InventoryImportColumn, string>;

export type InventoryImportPreviewRow = {
  rowNumber: number;
  values: InventoryImportRawRecord;
  normalizedInput?: NewProductInput;
  errors: string[];
};

export type InventoryImportPreview = {
  rows: InventoryImportPreviewRow[];
  validRows: InventoryImportPreviewRow[];
  invalidRows: InventoryImportPreviewRow[];
  headerErrors: string[];
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];

    if (character === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseCsvLine);
}

function toRecord(headers: InventoryImportColumn[], row: string[]): InventoryImportRawRecord {
  return headers.reduce((record, header, index) => {
    record[header] = row[index]?.trim() ?? '';
    return record;
  }, {} as InventoryImportRawRecord);
}

function parseRequiredNumber(value: string, label: string, rowErrors: string[]) {
  const trimmed = value.trim();
  if (!trimmed) {
    rowErrors.push(`${label} is required.`);
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    rowErrors.push(`${label} must be a valid number.`);
    return null;
  }

  return parsed;
}

function parseNonNegativeInteger(value: string, label: string, rowErrors: string[]) {
  const parsed = parseRequiredNumber(value, label, rowErrors);
  if (parsed === null) {
    return null;
  }

  if (!Number.isInteger(parsed) || parsed < 0) {
    rowErrors.push(`${label} must be a whole number that is 0 or more.`);
    return null;
  }

  return parsed;
}

function parseNonNegativeNumber(value: string, label: string, rowErrors: string[]) {
  const parsed = parseRequiredNumber(value, label, rowErrors);
  if (parsed === null) {
    return null;
  }

  if (parsed < 0) {
    rowErrors.push(`${label} must be 0 or more.`);
    return null;
  }

  return parsed;
}

export function buildInventoryTemplateCsv() {
  const sampleRow = [
    'Morning Fresh Soap',
    'INV-SOAP-001',
    'units',
    '12',
    '18',
    '40',
    '10',
    '',
  ];

  return `${INVENTORY_IMPORT_COLUMNS.join(',')}\n${sampleRow.join(',')}\n`;
}

export function validateInventoryImportCsv(text: string, existingProducts: Product[]): InventoryImportPreview {
  const parsed = parseCsv(text);
  const headerErrors: string[] = [];

  if (parsed.length === 0) {
    return {
      rows: [],
      validRows: [],
      invalidRows: [],
      headerErrors: ['The file is empty. Download the template and fill in at least one row.'],
    };
  }

  const providedHeaders = parsed[0];
  const normalizedHeaders = providedHeaders.map(normalizeHeader);
  const expectedHeaders = INVENTORY_IMPORT_COLUMNS.map(normalizeHeader);

  const missingHeaders = INVENTORY_IMPORT_COLUMNS.filter(
    (_, index) => normalizedHeaders[index] !== expectedHeaders[index]
  );

  if (providedHeaders.length !== INVENTORY_IMPORT_COLUMNS.length || missingHeaders.length > 0) {
    headerErrors.push(`Template columns must match exactly: ${INVENTORY_IMPORT_COLUMNS.join(', ')}.`);
  }

  const rows = parsed.slice(1).map((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const values = toRecord(INVENTORY_IMPORT_COLUMNS.slice() as InventoryImportColumn[], row);
    const errors: string[] = [];
    const itemName = values['Item Name'].trim();
    const inventoryId = values['Inventory ID'].trim();
    const unit = values['Unit'].trim() || 'units';
    const cost = parseNonNegativeNumber(values['Cost Price'], 'Cost Price', errors);
    const price = parseNonNegativeNumber(values['Selling Price'], 'Selling Price', errors);
    const quantity = parseNonNegativeInteger(values['Quantity In Stock'], 'Quantity In Stock', errors);
    const reorderLevel = parseNonNegativeInteger(values['Reorder Level'], 'Reorder Level', errors);

    if (!itemName) {
      errors.push('Item Name is required.');
    }

    if (!unit) {
      errors.push('Unit is required.');
    }

    if (inventoryId && existingProducts.some((product) => product.inventoryId.trim().toLowerCase() === inventoryId.toLowerCase())) {
      errors.push('Inventory ID already exists in current inventory.');
    }

    if (itemName && existingProducts.some((product) => product.name.trim().toLowerCase() === itemName.toLowerCase())) {
      errors.push('Item Name already exists in current inventory.');
    }

    return {
      rowNumber,
      values,
      normalizedInput:
        errors.length === 0 && cost !== null && price !== null && quantity !== null && reorderLevel !== null
          ? {
              name: itemName,
              inventoryId,
              unit,
              cost,
              price,
              quantity,
              reorderLevel,
              image: values['Image URL'].trim() || undefined,
            }
          : undefined,
      errors,
    };
  });

  const fileInventoryIds = new Map<string, number[]>();
  const fileItemNames = new Map<string, number[]>();
  rows.forEach((row) => {
    const inventoryId = row.values['Inventory ID'].trim().toLowerCase();
    const itemName = row.values['Item Name'].trim().toLowerCase();
    if (!inventoryId) {
      // Continue checking names even when inventory id is blank.
    } else {
      const list = fileInventoryIds.get(inventoryId) ?? [];
      list.push(row.rowNumber);
      fileInventoryIds.set(inventoryId, list);
    }

    if (itemName) {
      const list = fileItemNames.get(itemName) ?? [];
      list.push(row.rowNumber);
      fileItemNames.set(itemName, list);
    }
  });

  rows.forEach((row) => {
    const inventoryId = row.values['Inventory ID'].trim().toLowerCase();
    if (!inventoryId) {
      return;
    }

    const matches = fileInventoryIds.get(inventoryId) ?? [];
    if (matches.length > 1) {
      row.errors.push(`Inventory ID is duplicated in this file on rows ${matches.join(', ')}.`);
      row.normalizedInput = undefined;
    }

    const itemNameMatches = fileItemNames.get(row.values['Item Name'].trim().toLowerCase()) ?? [];
    if (row.values['Item Name'].trim() && itemNameMatches.length > 1) {
      row.errors.push(`Item Name is duplicated in this file on rows ${itemNameMatches.join(', ')}.`);
      row.normalizedInput = undefined;
    }
  });

  const validRows =
    headerErrors.length > 0
      ? []
      : rows.filter((row) => row.errors.length === 0 && row.normalizedInput);
  const invalidRows = rows.filter((row) => row.errors.length > 0);

  return {
    rows,
    validRows,
    invalidRows,
    headerErrors,
  };
}
