import type { NewProductInput } from './businessLogic';
import type { Product, ProductCategory } from '../data/seedBusiness';

const INVENTORY_IMPORT_BASE_COLUMNS = [
  'Item Name',
  'Inventory ID',
  'Unit',
  'Cost Price',
  'Selling Price',
  'Quantity In Stock',
  'Reorder Level',
  'Image URL',
] as const;

const INVENTORY_IMPORT_OPTIONAL_COLUMNS = ['Category'] as const;

export const INVENTORY_IMPORT_COLUMNS = [
  ...INVENTORY_IMPORT_BASE_COLUMNS,
  ...INVENTORY_IMPORT_OPTIONAL_COLUMNS,
] as const;

export type InventoryImportColumn = (typeof INVENTORY_IMPORT_COLUMNS)[number];

export type InventoryImportMode = 'catalogue' | 'stock';

export type InventoryImportColumnMapping = Array<InventoryImportColumn | undefined>;

type InventoryImportRawRecord = Record<InventoryImportColumn, string>;

type InventoryImportOptions = {
  inventoryCategoriesEnabled?: boolean;
  productCategories?: ProductCategory[];
  mode?: InventoryImportMode;
  columnMapping?: InventoryImportColumnMapping;
};

export type InventoryImportPreviewRow = {
  rowNumber: number;
  values: InventoryImportRawRecord;
  normalizedInput?: NewProductInput;
  errors: string[];
  warnings: string[];
};

export type InventoryImportPreview = {
  rows: InventoryImportPreviewRow[];
  validRows: InventoryImportPreviewRow[];
  invalidRows: InventoryImportPreviewRow[];
  headerErrors: string[];
  warningRows: InventoryImportPreviewRow[];
  sourceHeaders: string[];
  columnMapping: InventoryImportColumnMapping;
  unmappedHeaders: string[];
  mode: InventoryImportMode;
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

const REQUIRED_IMPORT_COLUMNS: InventoryImportColumn[] = [
  'Item Name',
  'Cost Price',
  'Selling Price',
  'Quantity In Stock',
  'Reorder Level',
];

const HEADER_ALIASES: Record<InventoryImportColumn, string[]> = {
  'Item Name': ['item name', 'product name', 'name', 'item', 'item description', 'item describtion', 'description'],
  'Inventory ID': ['inventory id', 'sku', 'product code', 'item code', 'code'],
  Unit: ['unit', 'unit of measure', 'uom'],
  'Cost Price': ['cost price', 'costprice', 'cost', 'unit cost', 'purchase price'],
  'Selling Price': ['selling price', 'sellingprice', 'price', 'retail price', 'sales price'],
  'Quantity In Stock': ['quantity in stock', 'quantity', 'opening stock', 'stock', 'qty'],
  'Reorder Level': ['reorder level', 'minimum stock', 'min stock', 'reorder point'],
  'Image URL': ['image url', 'image', 'product image'],
  Category: ['category', 'product category', 'class', 'item class'],
};

export function parseInventoryImportCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const next = normalized[index + 1];

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
      row.push(current.trim());
      current = '';
      continue;
    }

    if (character === '\n' && !inQuotes) {
      row.push(current.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += character;
  }

  row.push(current.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

export function suggestInventoryImportMapping(headers: string[]): InventoryImportColumnMapping {
  return headers.map((header) => {
    const normalized = normalizeHeader(header);
    return INVENTORY_IMPORT_COLUMNS.find((column) => HEADER_ALIASES[column].includes(normalized));
  });
}

function toRecord(headers: Array<InventoryImportColumn | undefined>, row: string[]): InventoryImportRawRecord {
  const record = INVENTORY_IMPORT_COLUMNS.reduce((current, header) => {
    current[header] = '';
    return current;
  }, {} as InventoryImportRawRecord);

  headers.forEach((header, index) => {
    if (header) record[header] = row[index]?.trim() ?? '';
  });

  return record;
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
    '',
  ];

  return `${INVENTORY_IMPORT_COLUMNS.join(',')}\n${sampleRow.join(',')}\n`;
}

function normalizeComparableValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findProductCategoryMatch(productCategories: ProductCategory[], value: string) {
  const normalizedValue = normalizeComparableValue(value);
  if (!normalizedValue) {
    return null;
  }

  return (
    productCategories.find((category) => normalizeComparableValue(category.name) === normalizedValue) ??
    productCategories.find((category) => normalizeComparableValue(category.slug) === normalizedValue) ??
    null
  );
}

export function validateInventoryImportRows(
  parsed: string[][],
  existingProducts: Product[],
  options: InventoryImportOptions = {}
): InventoryImportPreview {
  const headerErrors: string[] = [];
  const mode = options.mode ?? 'stock';

  if (parsed.length === 0) {
    return {
      rows: [],
      validRows: [],
      invalidRows: [],
      headerErrors: ['The file is empty. Download the template and fill in at least one row.'],
      warningRows: [],
      sourceHeaders: [],
      columnMapping: [],
      unmappedHeaders: [],
      mode,
    };
  }

  const providedHeaders = parsed[0];
  const suggestedMapping = suggestInventoryImportMapping(providedHeaders);
  const matchedHeaders = providedHeaders.map((_, index) => options.columnMapping ? options.columnMapping[index] : suggestedMapping[index]);
  const duplicateHeaders = matchedHeaders.filter((header, index) => header && matchedHeaders.indexOf(header) !== index);
  const requiredColumns = mode === 'catalogue' ? (['Item Name'] as InventoryImportColumn[]) : REQUIRED_IMPORT_COLUMNS;
  const missingRequired = requiredColumns.filter((column) => !matchedHeaders.includes(column));
  if (duplicateHeaders.length) headerErrors.push(`Duplicate mapped columns: ${[...new Set(duplicateHeaders)].join(', ')}.`);
  if (missingRequired.length) headerErrors.push(`Missing required columns: ${missingRequired.join(', ')}.`);
  if (!matchedHeaders.some(Boolean)) headerErrors.push(`No recognized inventory columns were found. Use the BisaPilot template headings.`);
  if (parsed.length - 1 > 10_000) headerErrors.push('A single inventory import can contain at most 10,000 rows.');

  const inventoryCategoriesEnabled = options.inventoryCategoriesEnabled ?? false;
  const productCategories = options.productCategories ?? [];

  const rows = parsed.slice(1).map((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const values = toRecord(matchedHeaders, row);
    const errors: string[] = [];
    const warnings: string[] = [];
    const itemName = values['Item Name'].trim();
    const inventoryId = values['Inventory ID'].trim();
    const unit = values['Unit'].trim() || 'units';
    const cost = mode === 'catalogue' && !values['Cost Price'].trim() ? 0 : parseNonNegativeNumber(values['Cost Price'], 'Cost Price', errors);
    const price = mode === 'catalogue' && !values['Selling Price'].trim() ? 0 : parseNonNegativeNumber(values['Selling Price'], 'Selling Price', errors);
    const quantity = mode === 'catalogue' && !values['Quantity In Stock'].trim() ? 0 : parseNonNegativeInteger(values['Quantity In Stock'], 'Quantity In Stock', errors);
    const reorderLevel = mode === 'catalogue' && !values['Reorder Level'].trim() ? 0 : parseNonNegativeInteger(values['Reorder Level'], 'Reorder Level', errors);
    const categoryValue = values['Category'].trim();
    let categoryId: string | undefined;

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
      warnings.push('Item Name already exists in current inventory. Confirm the SKU identifies a distinct product.');
    }

    if (categoryValue && inventoryCategoriesEnabled) {
      const matchedCategory = findProductCategoryMatch(productCategories, categoryValue);
      if (!matchedCategory) {
        errors.push('Category could not be found.');
      } else if (!matchedCategory.isActive) {
        errors.push('Category is inactive and cannot be assigned.');
      } else {
        categoryId = matchedCategory.id;
      }
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
              categoryId,
            }
          : undefined,
      errors,
      warnings,
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
      row.warnings.push(`Item Name is repeated in this file on rows ${itemNameMatches.join(', ')}. Distinct SKUs will be preserved.`);
    }
  });

  const validRows =
    headerErrors.length > 0
      ? []
      : rows.filter((row) => row.errors.length === 0 && row.normalizedInput);
  const invalidRows = rows.filter((row) => row.errors.length > 0);
  const warningRows = rows.filter((row) => row.warnings.length > 0);

  return {
    rows,
    validRows,
    invalidRows,
    headerErrors,
    warningRows,
    sourceHeaders: providedHeaders,
    columnMapping: matchedHeaders,
    unmappedHeaders: providedHeaders.filter((header, index) => header.trim() && !matchedHeaders[index]),
    mode,
  };
}

export function validateInventoryImportCsv(
  text: string,
  existingProducts: Product[],
  options: InventoryImportOptions = {}
): InventoryImportPreview {
  return validateInventoryImportRows(parseInventoryImportCsv(text), existingProducts, options);
}
