import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { readInventoryWorkbook } from './read-inventory-workbook';

function inventoryWorkbookFixture() {
  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
    <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <sheets><sheet name="Export by Scenario" sheetId="1" r:id="rId1" /></sheets>
    </workbook>`;
  const relationships = `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml" />
    </Relationships>`;
  const worksheet = `<?xml version="1.0" encoding="UTF-8"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <dimension ref="A1:XFD1048576" />
      <sheetData>
        <row r="1">
          <c r="A1" t="inlineStr"><is><t>Number</t></is></c>
          <c r="E1" t="inlineStr"><is><t>Class</t></is></c>
          <c r="F1" t="inlineStr"><is><t>code</t></is></c>
          <c r="H1" t="inlineStr"><is><t>Item Describtion</t></is></c>
        </row>
        <row r="2">
          <c r="A2"><v>1</v></c>
          <c r="E2" t="inlineStr"><is><t>ACCESS</t></is></c>
          <c r="F2" t="inlineStr"><is><t>A0001</t></is></c>
          <c r="H2" t="inlineStr"><is><t>LAMP EMERGENCY</t></is></c>
        </row>
      </sheetData>
    </worksheet>`;
  return zipSync({
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(relationships),
    'xl/worksheets/sheet1.xml': strToU8(worksheet),
  });
}

describe('readInventoryWorkbook', () => {
  it('reads actual cells without trusting oversized worksheet dimensions', async () => {
    const bytes = inventoryWorkbookFixture();
    const file = new File([bytes.slice().buffer], 'legacy-export.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.slice().buffer });

    const sheets = await readInventoryWorkbook(file);

    expect(sheets).toEqual([{
      name: 'Export by Scenario',
      rows: [
        ['Number', '', '', '', 'Class', 'code', '', 'Item Describtion'],
        ['1', '', '', '', 'ACCESS', 'A0001', '', 'LAMP EMERGENCY'],
      ],
    }]);
  });
});
