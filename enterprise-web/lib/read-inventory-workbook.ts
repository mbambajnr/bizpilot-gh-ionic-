import { strFromU8, unzipSync } from 'fflate';

export type InventoryWorkbookSheet = {
  name: string;
  rows: string[][];
};

const MAX_WORKBOOK_BYTES = 15 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 80 * 1024 * 1024;
const MAX_WORKSHEETS = 30;
const MAX_COLUMNS = 500;
const MAX_ROWS = 10_001;

function parseXml(xml: string, label: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error(`${label} contains invalid XML.`);
  return document;
}

function readXmlEntry(entries: Record<string, Uint8Array>, path: string, label: string) {
  const entry = entries[path];
  if (!entry) throw new Error(`${label} is missing from this workbook.`);
  return parseXml(strFromU8(entry), label);
}

function resolveRelationshipPath(target: string) {
  const path = new URL(target, 'https://workbook.local/xl/workbook.xml').pathname.slice(1);
  return decodeURIComponent(path);
}

function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Za-z]+/)?.[0].toUpperCase() ?? '';
  let result = 0;
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
  return result - 1;
}

function cellText(cell: Element, sharedStrings: string[]) {
  const type = cell.getAttribute('t');
  if (type === 'inlineStr') return [...cell.querySelectorAll('is t')].map((node) => node.textContent ?? '').join('');
  const raw = cell.querySelector('v')?.textContent ?? '';
  if (type === 's') return sharedStrings[Number(raw)] ?? '';
  if (type === 'b') return raw === '1' ? 'True' : 'False';
  return raw.trim();
}

function readSharedStrings(entries: Record<string, Uint8Array>) {
  const entry = entries['xl/sharedStrings.xml'];
  if (!entry) return [];
  const document = parseXml(strFromU8(entry), 'Shared strings');
  return [...document.querySelectorAll('si')].map((item) =>
    [...item.querySelectorAll('t')].map((node) => node.textContent ?? '').join('')
  );
}

function readSheetRows(document: Document, sharedStrings: string[]) {
  const rows: string[][] = [];
  for (const row of document.querySelectorAll('sheetData > row')) {
    const rowNumber = Number(row.getAttribute('r')) || rows.length + 1;
    if (rowNumber > MAX_ROWS) throw new Error('A worksheet can contain at most 10,000 inventory rows plus its header.');
    const values: string[] = [];
    for (const cell of row.querySelectorAll(':scope > c')) {
      const index = columnIndex(cell.getAttribute('r') ?? '');
      if (index < 0 || index >= MAX_COLUMNS) continue;
      values[index] = cellText(cell, sharedStrings);
    }
    while (values.length && !values.at(-1)) values.pop();
    rows[rowNumber - 1] = Array.from({ length: values.length }, (_, index) => values[index] ?? '');
  }
  return rows.map((row) => row ?? []).filter((row) => row.some((value) => value.trim()));
}

export async function readInventoryWorkbook(file: File): Promise<InventoryWorkbookSheet[]> {
  if (file.size > MAX_WORKBOOK_BYTES) throw new Error('Excel workbooks must be 15 MB or smaller.');
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const uncompressedBytes = Object.values(entries).reduce((total, entry) => total + entry.byteLength, 0);
  if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES) throw new Error('This workbook expands beyond the 80 MB safety limit.');

  const workbook = readXmlEntry(entries, 'xl/workbook.xml', 'Workbook structure');
  const relationships = readXmlEntry(entries, 'xl/_rels/workbook.xml.rels', 'Workbook relationships');
  const relationshipPaths = new Map(
    [...relationships.querySelectorAll('Relationship')].map((relationship) => [
      relationship.getAttribute('Id') ?? '',
      resolveRelationshipPath(relationship.getAttribute('Target') ?? ''),
    ])
  );
  const sharedStrings = readSharedStrings(entries);
  const sheetNodes = [...workbook.querySelectorAll('sheets > sheet')];
  if (sheetNodes.length > MAX_WORKSHEETS) throw new Error(`A workbook can contain at most ${MAX_WORKSHEETS} worksheets.`);

  return sheetNodes.flatMap((sheet, index) => {
    const relationshipId = sheet.getAttribute('r:id')
      ?? sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
      ?? '';
    const path = relationshipPaths.get(relationshipId);
    if (!path || !entries[path]) return [];
    const document = readXmlEntry(entries, path, `Worksheet ${index + 1}`);
    const rows = readSheetRows(document, sharedStrings);
    return rows.length ? [{ name: sheet.getAttribute('name') || `Worksheet ${index + 1}`, rows }] : [];
  });
}
