'use client';

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Unplug,
  Upload,
  Warehouse,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useBusiness } from '../../src/context/BusinessContext';
import { resolveCommerceRuntime } from '../../src/integrations/commerce/runtime';
import type { CommerceRuntime } from '../../src/integrations/commerce/types';
import type { MagentoStockSnapshot } from '../../src/lib/magentoClient';
import { loadMagentoStock } from '../../src/lib/magentoClient';
import {
  selectActiveLocations,
  selectInventorySummariesByLocation,
  selectLowStockByLocation,
  selectProductCategoryDisplayLabel,
  selectProductMovements,
  selectProductQuantityOnHand,
  selectStockMovementDisplay,
} from '../../src/selectors/businessSelectors';
import { formatCurrency, formatRelativeDate } from '../../src/utils/format';
import { forecastDemand, type DemandForecast, type DemandRiskBand } from '../../src/utils/demandForecast';
import type {
  InventoryImportColumnMapping,
  InventoryImportMode,
  InventoryImportPreview,
} from '../../src/utils/inventoryImport';
import {
  INVENTORY_IMPORT_COLUMNS,
  buildInventoryTemplateCsv,
  parseInventoryImportCsv,
  suggestInventoryImportMapping,
  validateInventoryImportRows,
} from '../../src/utils/inventoryImport';
import { EnterpriseApp } from './enterprise-app';
import { ProductComposer, StockAdjustmentDialog, TransferWorkspace } from './enterprise-inventory-actions';
import { EnterpriseShell } from './enterprise-shell';
import type { InventoryWorkbookSheet } from '../lib/read-inventory-workbook';

type InventoryTab = 'stock' | 'low' | 'movements' | 'transfers' | 'magento';

export function EnterpriseInventory({ initialTab = 'stock' }: { initialTab?: InventoryTab }) {
  return <EnterpriseApp><InventoryWorkspace initialTab={initialTab} /></EnterpriseApp>;
}

function InventoryWorkspace({ initialTab }: { initialTab: InventoryTab }) {
  const { state, currentUser, hasPermission, addRestockRequest, bulkImportProducts } = useBusiness();
  const locations = useMemo(() => selectActiveLocations(state), [state]);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '');
  const [tab, setTab] = useState<InventoryTab>(initialTab);
  const [query, setQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(state.products[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const [restockOpen, setRestockOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [magentoStock, setMagentoStock] = useState<MagentoStockSnapshot | null>(null);
  const [commerceRuntime, setCommerceRuntime] = useState<CommerceRuntime | null>(null);
  const [magentoLoading, setMagentoLoading] = useState(false);
  const [magentoError, setMagentoError] = useState('');
  const [magentoAttempted, setMagentoAttempted] = useState(false);
  const currency = state.businessProfile.currency;
  const location = locations.find((entry) => entry.id === locationId) ?? locations[0];
  const summaries = useMemo(
    () => selectInventorySummariesByLocation(state, location?.id),
    [location?.id, state]
  );
  const lowStock = useMemo(() => selectLowStockByLocation(state, location?.id), [location?.id, state]);
  const [forecastNow] = useState(() => Date.now());
  const demandForecast = useMemo(() => forecastDemand(state, forecastNow, location?.id), [location?.id, state, forecastNow]);
  const [restockSuggestedQty, setRestockSuggestedQty] = useState<number | undefined>(undefined);
  const filtered = summaries.filter(({ product }) =>
    `${product.name} ${product.inventoryId} ${selectProductCategoryDisplayLabel(state, product.categoryId)}`
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  );
  const selectedProduct = state.products.find((product) => product.id === selectedProductId) ?? filtered[0]?.product;
  const selectedSummary = summaries.find((summary) => summary.product.id === selectedProduct?.id);
  const stockValue = summaries.reduce((sum, summary) => sum + summary.quantityOnHand * summary.product.cost, 0);
  const unitsOnHand = summaries.reduce((sum, summary) => sum + summary.quantityOnHand, 0);
  const outOfStock = summaries.filter((summary) => summary.quantityOnHand <= 0).length;
  const movements = [...state.stockMovements]
    .filter((movement) => !location?.id || movement.locationId === location.id || movement.fromLocationId === location.id || movement.toLocationId === location.id)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const canRequestRestock = hasPermission('restockRequests.create');
  const canCreateProduct = hasPermission('inventory.create');
  const canAdjustStock = hasPermission('inventory.adjust');
  const canViewTransfers = hasPermission('transfers.view');
  const canViewInventoryValue = hasPermission('inventory.value.view');

  async function refreshMagento() {
    setMagentoAttempted(true);
    setMagentoLoading(true);
    setMagentoError('');
    try {
      const runtime = await resolveCommerceRuntime();
      setCommerceRuntime(runtime);
      if (runtime.mode === 'standalone') {
        setMagentoStock(null);
        return;
      }
      const result = await loadMagentoStock();
      setMagentoStock(result.stock);
    } catch (error) {
      setMagentoError(error instanceof Error ? error.message : 'Magento stock could not be loaded.');
    } finally {
      setMagentoLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== 'magento' || magentoAttempted || magentoStock || magentoLoading) return;
    if (commerceRuntime?.mode === 'standalone') return;
    const timer = window.setTimeout(() => void refreshMagento(), 0);
    return () => window.clearTimeout(timer);
  }, [commerceRuntime?.mode, tab, magentoAttempted, magentoLoading, magentoStock]);

  const magentoBySku = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of magentoStock?.items ?? []) {
      totals.set(item.sku.toLowerCase(), (totals.get(item.sku.toLowerCase()) ?? 0) + item.quantity);
    }
    return totals;
  }, [magentoStock]);

  const reconciliation = useMemo(() => state.products.map((product) => {
    const bizpilot = selectProductQuantityOnHand(state, product.id);
    const magento = magentoBySku.get(product.inventoryId.toLowerCase());
    return { product, bizpilot, magento, variance: magento === undefined ? null : bizpilot - magento };
  }), [magentoBySku, state]);

  const mismatchCount = magentoStock ? reconciliation.filter((entry) => entry.variance !== null && entry.variance !== 0).length : 0;
  const unmappedCount = magentoStock ? reconciliation.filter((entry) => entry.magento === undefined).length : 0;

  return <EnterpriseShell active="Inventory">
    <div className="page-content inventory-native-page">
      <header className="inventory-heading">
        <div><p className="eyebrow">Stock operations</p><h1>Inventory control</h1><p>Location stock, movement history, replenishment signals, and channel reconciliation.</p></div>
        <div className="inventory-heading-actions">{canCreateProduct ? <><button className="secondary-button" type="button" onClick={() => setImportOpen(true)}><Upload size={14} /> Bulk import</button><button className="primary-button" type="button" onClick={() => setProductOpen(true)}><Plus size={14} /> New product</button></> : null}<label className="inventory-location"><MapPin size={15} /><span><small>Viewing location</small><select value={location?.id ?? ''} onChange={(event) => setLocationId(event.target.value)}>{locations.map((entry) => <option value={entry.id} key={entry.id}>{entry.name} · {entry.type}</option>)}</select></span></label></div>
      </header>

      <section className="inventory-metrics" aria-label="Inventory health">
        <InventoryMetric icon={Package} label="Units on hand" value={unitsOnHand.toLocaleString()} note={`${summaries.filter((entry) => entry.quantityOnHand > 0).length} stocked products`} />
        {canViewInventoryValue
          ? <InventoryMetric icon={CircleDollarSign} label="Stock value" value={formatCurrency(stockValue, currency)} note="At current unit cost" />
          : <InventoryMetric icon={CheckCircle2} label="Stocked SKUs" value={String(summaries.filter((entry) => entry.quantityOnHand > 0).length)} note="Valuation restricted" />}
        <InventoryMetric icon={AlertTriangle} label="Below reorder" value={String(lowStock.length)} note={lowStock.length ? 'Action required' : 'Levels healthy'} tone={lowStock.length ? 'warn' : 'good'} />
        <InventoryMetric icon={Boxes} label="Out of stock" value={String(outOfStock)} note={outOfStock ? 'Unavailable at this location' : 'No stockouts'} tone={outOfStock ? 'risk' : 'good'} />
      </section>

      <nav className="inventory-tabs" aria-label="Inventory views">
        {([['stock', 'Stock'], ['low', `Replenishment${lowStock.length ? ` (${lowStock.length})` : ''}`], ['movements', 'Movements'], ...(canViewTransfers ? [['transfers', `Transfers${state.stockTransfers.filter((entry) => !['received', 'cancelled'].includes(entry.status)).length ? ` (${state.stockTransfers.filter((entry) => !['received', 'cancelled'].includes(entry.status)).length})` : ''}`] as const] : []), ['magento', `Channels${mismatchCount ? ` (${mismatchCount})` : ''}`]] as Array<readonly [InventoryTab, string]>).map(([value, label]) => <button type="button" className={tab === value ? 'inventory-tab inventory-tab--active' : 'inventory-tab'} onClick={() => setTab(value)} key={value}>{label}</button>)}
      </nav>
      {message ? <div className="settings-message" role="status">{message}</div> : null}

      {tab === 'stock' ? <section className="inventory-workspace">
        <div className="inventory-list-panel">
          <div className="inventory-toolbar"><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product, SKU, or category" /></label><span>{filtered.length} products</span></div>
          <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Product</th><th>On hand</th><th>Reorder</th>{canViewInventoryValue ? <th>Value</th> : null}<th>Status</th><th /></tr></thead><tbody>{filtered.map((summary) => <tr className={selectedProduct?.id === summary.product.id ? 'inventory-row inventory-row--selected' : 'inventory-row'} key={summary.product.id} onClick={() => setSelectedProductId(summary.product.id)}><td><ProductThumb product={summary.product} /><div><strong>{summary.product.name}</strong><span>{summary.product.inventoryId} · {selectProductCategoryDisplayLabel(state, summary.product.categoryId)}</span></div></td><td><strong>{summary.quantityOnHand}</strong><span>{summary.product.unit}</span></td><td>{summary.product.reorderLevel}</td>{canViewInventoryValue ? <td>{formatCurrency(summary.quantityOnHand * summary.product.cost, currency)}</td> : null}<td><span className={`inventory-status inventory-status--${summary.quantityOnHand <= 0 ? 'risk' : summary.lowStock ? 'warn' : 'good'}`}>{summary.quantityOnHand <= 0 ? 'Out of stock' : summary.stockStatus}</span></td><td><ChevronRight size={15} /></td></tr>)}</tbody></table>{!filtered.length ? <EmptyInventory icon={Search} title="No matching products" detail="Try another SKU, product name, or category." /> : null}</div>
        </div>
        <ProductInspector product={selectedProduct} summary={selectedSummary} state={state} currency={currency} locations={locations} canViewInventoryValue={canViewInventoryValue} canRequestRestock={canRequestRestock} canAdjustStock={canAdjustStock} onRequest={() => setRestockOpen(true)} onAdjust={() => setAdjustmentOpen(true)} />
      </section> : null}

      {tab === 'low' ? <DemandForecastPanel forecast={demandForecast} canRequest={canRequestRestock} onSelect={(productId, suggestedQty) => { setSelectedProductId(productId); setRestockSuggestedQty(suggestedQty); setRestockOpen(true); }} /> : null}
      {tab === 'movements' ? <MovementLedger movements={movements} state={state} locationName={location?.name ?? 'All locations'} /> : null}
      {tab === 'transfers' ? <TransferWorkspace /> : null}
      {tab === 'magento' ? commerceRuntime?.mode === 'standalone' ? <StandaloneCommerceState /> : <MagentoReconciliation entries={reconciliation} ready={Boolean(magentoStock)} loading={magentoLoading} error={magentoError} mismatchCount={mismatchCount} unmappedCount={unmappedCount} onRefresh={() => void refreshMagento()} /> : null}
    </div>
    {restockOpen && selectedProduct ? <RestockComposer product={selectedProduct} currentQuantity={selectProductQuantityOnHand(state, selectedProduct.id, location?.id)} suggestedQuantity={restockSuggestedQty} currentUser={currentUser} onClose={() => setRestockOpen(false)} onSubmit={(quantity, urgency, note) => { const result = addRestockRequest({ productId: selectedProduct.id, requestedByUserId: currentUser.userId, requestedByName: currentUser.name, requestedQuantity: quantity, urgency, note }); setMessage(result.ok ? `Replenishment request created for ${selectedProduct.name}.` : result.message); if (result.ok) setRestockOpen(false); return result.ok; }} /> : null}
    {productOpen ? <ProductComposer onClose={() => setProductOpen(false)} onComplete={setMessage} /> : null}
    {importOpen ? <InventoryImportWorkspace state={state} locations={locations} defaultLocationId={location?.id ?? ''} requiresEmployeeReauthentication={Boolean(currentUser.businessId && !currentUser.employeeSessionSecret)} onClose={() => setImportOpen(false)} onImport={async (preview, openingLocationId, employeePassword) => { const inputs = preview.validRows.flatMap((row) => row.normalizedInput ? [{ ...row.normalizedInput, locationId: preview.mode === 'stock' ? openingLocationId : undefined }] : []); const result = await bulkImportProducts(inputs, { employeeSessionSecret: employeePassword || undefined }); const succeeded = result.ok && Boolean(result.data); setMessage(succeeded ? preview.mode === 'catalogue' ? `${result.data?.importedCount.toLocaleString()} catalogue items imported. Pricing and stock can be completed when ready.` : `${result.data?.importedCount.toLocaleString()} inventory items imported with ${result.data?.openingMovements.toLocaleString()} opening stock entries.` : result.message ?? 'The inventory batch could not be imported.'); if (succeeded) setImportOpen(false); return result; }} /> : null}
    {adjustmentOpen && selectedProduct && location ? <StockAdjustmentDialog productId={selectedProduct.id} locationId={location.id} onClose={() => setAdjustmentOpen(false)} onComplete={setMessage} /> : null}
  </EnterpriseShell>;
}

function downloadInventoryFile(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function InventoryImportWorkspace({ state, locations, defaultLocationId, requiresEmployeeReauthentication, onClose, onImport }: { state: ReturnType<typeof useBusiness>['state']; locations: ReturnType<typeof selectActiveLocations>; defaultLocationId: string; requiresEmployeeReauthentication: boolean; onClose: () => void; onImport: (preview: InventoryImportPreview, locationId: string, employeePassword: string) => Promise<{ ok: boolean; message?: string }> }) {
  const [sourceRows, setSourceRows] = useState<string[][] | null>(null);
  const [columnMapping, setColumnMapping] = useState<InventoryImportColumnMapping>([]);
  const [mode, setMode] = useState<InventoryImportMode>('catalogue');
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<InventoryWorkbookSheet[]>([]);
  const [sheetName, setSheetName] = useState('');
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [employeePassword, setEmployeePassword] = useState('');
  const [error, setError] = useState('');
  const preview = useMemo(() => sourceRows ? validateInventoryImportRows(sourceRows, state.products, {
    inventoryCategoriesEnabled: state.businessProfile.inventoryCategoriesEnabled,
    productCategories: state.productCategories,
    mode,
    columnMapping,
  }) : null, [columnMapping, mode, sourceRows, state.businessProfile.inventoryCategoriesEnabled, state.productCategories, state.products]);
  const visibleRows = preview?.rows.slice(0, 100) ?? [];
  const mappedCount = columnMapping.filter(Boolean).length;

  function selectWorkbookSheet(sheet: InventoryWorkbookSheet) {
    setSheetName(sheet.name);
    setSourceRows(sheet.rows);
    setColumnMapping(suggestInventoryImportMapping(sheet.rows[0] ?? []));
  }

  async function loadFile(file?: File) {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xlsx')) {
      setError('Upload an Excel .xlsx workbook or a CSV file.');
      return;
    }

    setFileLoading(true);
    setError('');
    try {
      let nextSheets: InventoryWorkbookSheet[];
      if (lowerName.endsWith('.csv')) {
        nextSheets = [{ name: 'CSV data', rows: parseInventoryImportCsv(await file.text()) }];
      } else {
        const { readInventoryWorkbook } = await import('../lib/read-inventory-workbook');
        nextSheets = await readInventoryWorkbook(file);
      }

      if (!nextSheets.length) throw new Error('No populated worksheet was found in this file.');
      const bestSheet = nextSheets.reduce((best, sheet) => {
        const score = suggestInventoryImportMapping(sheet.rows[0] ?? []).filter(Boolean).length;
        const bestScore = suggestInventoryImportMapping(best.rows[0] ?? []).filter(Boolean).length;
        return score > bestScore ? sheet : best;
      });
      setSheets(nextSheets);
      setFileName(file.name);
      setMappingOpen(false);
      selectWorkbookSheet(bestSheet);
    } catch (loadError) {
      setSourceRows(null);
      setSheets([]);
      setFileName('');
      setError(loadError instanceof Error ? loadError.message : 'The spreadsheet could not be read.');
    } finally {
      setFileLoading(false);
    }
  }

  function updateMapping(index: number, value: string) {
    setColumnMapping((current) => current.map((entry, entryIndex) => entryIndex === index ? (value || undefined) as InventoryImportColumnMapping[number] : entry));
  }

  function downloadErrors() {
    if (!preview) return;
    const rows = [['Row', 'Item Name', 'Inventory ID', 'Errors'], ...preview.invalidRows.map((row) => [row.rowNumber, row.values['Item Name'], row.values['Inventory ID'], row.errors.join(' | ')])];
    downloadInventoryFile(rows.map((row) => row.map(escapeCsv).join(',')).join('\n'), 'bizpilot-inventory-import-errors.csv');
  }

  async function submit() {
    if (!preview || preview.headerErrors.length || preview.invalidRows.length || !preview.validRows.length || (mode === 'stock' && !locationId)) return;
    if (requiresEmployeeReauthentication && !employeePassword.trim()) {
      setError('Confirm your employee password before importing inventory.');
      return;
    }
    setBusy(true);
    setError('');
    const result = await onImport(preview, locationId, employeePassword.trim());
    setEmployeePassword('');
    if (!result.ok) setError(result.message || 'The inventory batch could not be imported.');
    setBusy(false);
  }

  return <div className="composer-backdrop"><section className="inventory-import-workspace" role="dialog" aria-modal="true" aria-label="Bulk inventory import">
    <header className="composer-heading"><div><p className="eyebrow">Catalogue onboarding</p><h2>Bulk inventory import</h2></div><button className="icon-button" type="button" aria-label="Close import" title="Close import" onClick={onClose}><X size={18} /></button></header>
    <div className="inventory-import-body">
      <section className="inventory-import-guidance"><div><FileSpreadsheet size={21} /><span><strong>Excel and CSV migration</strong><small>Map and validate up to 10,000 products before commit</small></span></div><button className="secondary-button" type="button" onClick={() => downloadInventoryFile(buildInventoryTemplateCsv(), 'bizpilot-inventory-import-template.csv')}><Download size={14} /> Download template</button></section>
      <fieldset className="inventory-import-mode"><legend>Import workflow</legend><button type="button" className={mode === 'catalogue' ? 'is-active' : ''} onClick={() => setMode('catalogue')}><Package size={15} /><span><strong>Catalogue only</strong><small>Products now; pricing and stock later</small></span></button><button type="button" className={mode === 'stock' ? 'is-active' : ''} onClick={() => setMode('stock')}><Warehouse size={15} /><span><strong>Catalogue and stock</strong><small>Require pricing, quantity, and location</small></span></button></fieldset>
      <label className={dragging ? 'inventory-import-dropzone is-dragging' : 'inventory-import-dropzone'} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void loadFile(event.dataTransfer.files[0]); }}><Upload size={24} /><strong>{fileLoading ? 'Reading workbook…' : fileName || 'Drop an Excel or CSV inventory file here'}</strong><span>{fileName ? 'Choose another file to replace this preview' : 'Supports .xlsx and .csv files'}</span><input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(event) => void loadFile(event.target.files?.[0])} /></label>
      {sourceRows && preview ? <>
        <section className="inventory-import-sourcebar">
          <div><span>Source</span><strong>{fileName}</strong><small>{sourceRows.length - 1} data rows · {mappedCount} mapped fields</small></div>
          {sheets.length > 1 ? <label><span>Worksheet</span><select value={sheetName} onChange={(event) => { const next = sheets.find((sheet) => sheet.name === event.target.value); if (next) selectWorkbookSheet(next); }}>{sheets.map((sheet) => <option value={sheet.name} key={sheet.name}>{sheet.name}</option>)}</select></label> : <span className="inventory-import-sheet">{sheetName}</span>}
          <button className="secondary-button" type="button" onClick={() => setMappingOpen((current) => !current)}>{mappingOpen ? 'Hide mapping' : 'Review mapping'} <ChevronRight className={mappingOpen ? 'is-rotated' : ''} size={14} /></button>
        </section>
        {mappingOpen ? <section className="inventory-import-mapping"><header><div><strong>Column mapping</strong><span>Confirm where each source field belongs. Leave operational flags and unused accounting fields ignored.</span></div><b>{preview.unmappedHeaders.length} ignored</b></header><div>{preview.sourceHeaders.map((header, index) => <label key={`${header}-${index}`}><span title={header}>{header || `Column ${index + 1}`}</span><ChevronRight size={13} /><select aria-label={`Map ${header || `column ${index + 1}`}`} value={columnMapping[index] ?? ''} onChange={(event) => updateMapping(index, event.target.value)}><option value="">Ignore</option>{INVENTORY_IMPORT_COLUMNS.map((column) => <option value={column} key={column} disabled={columnMapping.some((mapped, mappedIndex) => mappedIndex !== index && mapped === column)}>{column}</option>)}</select></label>)}</div></section> : null}
        {mode === 'stock' ? <label className="form-field inventory-import-location"><span>Opening stock location</span><select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">Select a location</option>{locations.map((entry) => <option value={entry.id} key={entry.id}>{entry.name} · {entry.type}</option>)}</select><small>All opening quantities in this file will be loaded into this location.</small></label> : <div className="inventory-import-catalogue-note"><CheckCircle2 size={16} /><span><strong>Safe staging mode</strong><small>Blank prices, quantities, and reorder levels will start at zero. No stock movement will be created.</small></span></div>}
        {requiresEmployeeReauthentication ? <label className="inventory-import-reauth"><LockKeyhole size={17} /><span><strong>Confirm employee access</strong><small>Your restored session needs a one-time password check for this inventory command.</small><input type="password" value={employeePassword} autoComplete="current-password" placeholder="Employee password" onChange={(event) => setEmployeePassword(event.target.value)} /></span></label> : null}
        <section className="inventory-import-scoreboard"><article><span>Total rows</span><strong>{preview.rows.length.toLocaleString()}</strong></article><article className="is-valid"><span>Ready</span><strong>{preview.validRows.length.toLocaleString()}</strong></article><article className={preview.warningRows.length ? 'is-warning' : 'is-valid'}><span>Warnings</span><strong>{preview.warningRows.length.toLocaleString()}</strong></article><article className={preview.invalidRows.length ? 'is-invalid' : 'is-valid'}><span>Blocked</span><strong>{preview.invalidRows.length.toLocaleString()}</strong></article></section>
        {preview.headerErrors.length ? <div className="inventory-import-alert"><AlertTriangle size={16} /><span>{preview.headerErrors.join(' ')}</span></div> : null}
        <div className="inventory-import-preview"><div className="inventory-import-preview-head"><div><strong>Validation preview</strong><span>{preview.rows.length > 100 ? 'Showing the first 100 rows for performance' : 'Every row checked before import'}</span></div>{preview.invalidRows.length ? <button className="text-button" type="button" onClick={downloadErrors}><Download size={13} /> Error report</button> : null}</div><table><thead><tr><th>Row</th><th>Product</th><th>SKU</th><th>Opening</th><th>Price</th><th>Result</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td><strong>{row.values['Item Name'] || 'Unnamed item'}</strong><span>{row.values.Unit || 'units'}{row.values.Category ? ` · ${row.values.Category}` : ''}</span></td><td>{row.values['Inventory ID'] || 'Auto-generate'}</td><td>{row.values['Quantity In Stock'] || '0'}</td><td>{row.values['Selling Price'] || '0'}</td><td>{row.errors.length ? <span className="inventory-import-result is-invalid" title={row.errors.join(' ')}><AlertTriangle size={12} /> {row.errors[0]}</span> : row.warnings.length ? <span className="inventory-import-result is-warning" title={row.warnings.join(' ')}><AlertTriangle size={12} /> Review</span> : <span className="inventory-import-result is-valid"><CheckCircle2 size={12} /> Ready</span>}</td></tr>)}</tbody></table></div>
      </> : <div className="inventory-import-checklist"><strong>Bring the catalogue you already have</strong><span>BizPilot recognizes common headings including SKU, Code, Item Description, Class, UOM, CostPrice, and SellingPrice.</span><span>Use catalogue-only mode for legacy exports that do not yet contain stock, pricing, or reorder information.</span></div>}
      {error ? <div className="settings-message" role="alert">{error}</div> : null}
    </div>
    <footer className="composer-footer"><span>{preview?.invalidRows.length ? 'Resolve blocked rows before import. Warnings can be reviewed without stopping the batch.' : mode === 'catalogue' ? 'Products will be created without stock movements.' : 'The catalogue and opening stock are committed together.'}</span><button className="primary-button" type="button" disabled={busy || !preview || Boolean(preview.headerErrors.length) || Boolean(preview.invalidRows.length) || !preview.validRows.length || (mode === 'stock' && !locationId) || (requiresEmployeeReauthentication && !employeePassword.trim())} onClick={() => void submit()}>{busy ? <><LoaderCircle className="spin" size={14} /> Importing batch</> : <>Import {preview?.validRows.length.toLocaleString() ?? 0} products <ChevronRight size={14} /></>}</button></footer>
  </section></div>;
}

function InventoryMetric({ icon: Icon, label, value, note, tone = 'neutral' }: { icon: typeof Package; label: string; value: string; note: string; tone?: 'neutral' | 'good' | 'warn' | 'risk' }) {
  return <article><div><Icon size={16} /><span>{label}</span></div><strong>{value}</strong><small className={`inventory-metric-note inventory-metric-note--${tone}`}>{note}</small></article>;
}

function ProductThumb({ product }: { product: ReturnType<typeof useBusiness>['state']['products'][number] }) {
  if (!product.image) return <span className="inventory-product-thumb"><Package size={16} /></span>;
  // Product imagery can be local data URLs or tenant-managed remote media.
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="inventory-product-thumb"><img src={product.image} alt="" /></span>;
}

function ProductInspector({ product, summary, state, currency, locations, canViewInventoryValue, canRequestRestock, canAdjustStock, onRequest, onAdjust }: { product?: ReturnType<typeof useBusiness>['state']['products'][number]; summary?: ReturnType<typeof selectInventorySummariesByLocation>[number]; state: ReturnType<typeof useBusiness>['state']; currency: string; locations: ReturnType<typeof selectActiveLocations>; canViewInventoryValue: boolean; canRequestRestock: boolean; canAdjustStock: boolean; onRequest: () => void; onAdjust: () => void }) {
  if (!product) return <aside className="inventory-inspector inventory-inspector--empty"><Package size={24} /><strong>Select a product</strong><span>Location balances and movement history will appear here.</span></aside>;
  const movements = selectProductMovements(state, product.id).slice(0, 5);
  return <aside className="inventory-inspector"><div className="inventory-inspector-head"><ProductThumb product={product} /><div><p className="eyebrow">{product.inventoryId}</p><h2>{product.name}</h2><span>{selectProductCategoryDisplayLabel(state, product.categoryId)} · {product.unit}</span></div><span className={`inventory-status inventory-status--${(summary?.quantityOnHand ?? 0) <= 0 ? 'risk' : summary?.lowStock ? 'warn' : 'good'}`}>{(summary?.quantityOnHand ?? 0) <= 0 ? 'Out of stock' : summary?.stockStatus ?? 'In stock'}</span></div><div className="inventory-inspector-values"><div><span>Selling price</span><strong>{formatCurrency(product.price, currency)}</strong></div>{canViewInventoryValue ? <div><span>Unit cost</span><strong>{formatCurrency(product.cost, currency)}</strong></div> : null}<div><span>Reorder level</span><strong>{product.reorderLevel}</strong></div></div><section className="inventory-balance-section"><div className="inventory-section-heading"><span>Location balances</span><small>{locations.length} active</small></div>{locations.map((location) => { const quantity = selectProductQuantityOnHand(state, product.id, location.id); return <div className="inventory-location-balance" key={location.id}><span><i>{location.type === 'warehouse' ? <Warehouse size={13} /> : <MapPin size={13} />}</i><span><strong>{location.name}</strong><small>{location.type}</small></span></span><b className={quantity <= product.reorderLevel ? 'balance-risk' : ''}>{quantity} {product.unit}</b></div>; })}</section><section className="inventory-movement-preview"><div className="inventory-section-heading"><span>Recent movements</span><small>{movements.length}</small></div>{movements.map((movement) => { const display = selectStockMovementDisplay(movement); return <div key={movement.id}><i className={movement.quantityDelta >= 0 ? 'movement-icon movement-icon--in' : 'movement-icon movement-icon--out'}>{movement.quantityDelta >= 0 ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}</i><span><strong>{display.label}</strong><small>{movement.movementNumber} · {formatRelativeDate(movement.createdAt)}</small></span><b>{movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta}</b></div>; })}{!movements.length ? <p>No stock movements recorded.</p> : null}</section>{canRequestRestock || canAdjustStock ? <div className="inventory-inspector-action">{canAdjustStock ? <button className="secondary-button" type="button" onClick={onAdjust}><SlidersHorizontal size={15} /> Adjust stock</button> : null}{canRequestRestock ? <button className="primary-button" type="button" onClick={onRequest}><ClipboardList size={15} /> Request replenishment</button> : null}</div> : null}</aside>;
}

const DEMAND_BAND_LABELS: Record<DemandRiskBand, string> = { healthy: 'Healthy', watch: 'Watch', reorder_now: 'Reorder now', stockout: 'Out of stock' };

function DemandForecastPanel({ forecast, canRequest, onSelect }: { forecast: DemandForecast[]; canRequest: boolean; onSelect: (productId: string, suggestedQuantity: number) => void }) {
  const urgent = forecast.filter((entry) => entry.riskBand === 'stockout' || entry.riskBand === 'reorder_now').length;
  return <section className="inventory-queue-panel"><div className="inventory-panel-heading"><div><p className="eyebrow inventory-ai-eyebrow"><Sparkles size={13} /> AI demand forecast</p><h2>Replenishment queue</h2><p>Products are ranked by projected stockout from recent sales velocity — flagged before they cross the reorder level. Advisory: each line becomes a controlled request you confirm.</p></div><span>{urgent} to reorder</span></div>
    <div className="demand-forecast-list">{forecast.map((entry) => <article key={`${entry.locationId}-${entry.productId}`} className={`demand-row demand-row--${entry.riskBand}`}>
      <div className="demand-lead"><span className={`demand-band demand-band--${entry.riskBand}`}>{DEMAND_BAND_LABELS[entry.riskBand]}</span><strong>{entry.productName}</strong><small>{entry.inventoryId} · {entry.locationLabel}</small></div>
      <div className="demand-metrics"><div><span>On hand</span><strong className={entry.quantityOnHand <= 0 ? 'balance-risk' : ''}>{entry.quantityOnHand} {entry.unit}</strong></div><div><span>Velocity</span><strong>{entry.dailyVelocity > 0 ? `${entry.dailyVelocity.toFixed(entry.dailyVelocity < 1 ? 2 : 1)}/day` : '—'}</strong></div><div><span>Cover left</span><strong>{entry.projectedStockoutInDays != null ? `${entry.projectedStockoutInDays}d` : '—'}</strong></div><div><span>Suggested</span><strong>{entry.suggestedReorderQty} {entry.unit}</strong></div></div>
      <ul className="demand-signals">{entry.signals.map((signal, index) => <li key={index}>{signal}</li>)}</ul>
      {canRequest ? <button className="secondary-button" type="button" onClick={() => onSelect(entry.productId, entry.suggestedReorderQty)}>Create request <ChevronRight size={14} /></button> : null}
    </article>)}</div>
    {!forecast.length ? <EmptyInventory icon={CheckCircle2} title="Stock levels are healthy" detail="No products are below their reorder level or trending toward a stockout at this location." /> : null}</section>;
}

function MovementLedger({ movements, state, locationName }: { movements: ReturnType<typeof useBusiness>['state']['stockMovements']; state: ReturnType<typeof useBusiness>['state']; locationName: string }) {
  return <section className="inventory-queue-panel"><div className="inventory-panel-heading"><div><p className="eyebrow">Audit ledger</p><h2>Stock movements</h2><p>{locationName}</p></div><span>{movements.length} entries</span></div><div className="inventory-movement-table"><table><thead><tr><th>Movement</th><th>Product</th><th>Source</th><th>Change</th><th>Balance</th><th>Time</th></tr></thead><tbody>{movements.map((movement) => { const product = state.products.find((entry) => entry.id === movement.productId); const display = selectStockMovementDisplay(movement); return <tr key={movement.id}><td><strong>{display.label}</strong><span>{movement.movementNumber}</span></td><td>{product?.name ?? movement.productId}</td><td>{movement.referenceNumber || movement.sourceType || movement.note}</td><td><b className={movement.quantityDelta >= 0 ? 'movement-positive' : 'movement-negative'}>{movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta}</b></td><td>{movement.quantityAfter}</td><td>{formatRelativeDate(movement.createdAt)}</td></tr>;})}</tbody></table></div>{!movements.length ? <EmptyInventory icon={SlidersHorizontal} title="No movement history" detail="Stock receipts, sales, transfers, and adjustments will appear here." /> : null}</section>;
}

function MagentoReconciliation({ entries, ready, loading, error, mismatchCount, unmappedCount, onRefresh }: { entries: Array<{ product: ReturnType<typeof useBusiness>['state']['products'][number]; bizpilot: number; magento?: number; variance: number | null }>; ready: boolean; loading: boolean; error: string; mismatchCount: number; unmappedCount: number; onRefresh: () => void }) {
  return <section className="inventory-queue-panel"><div className="inventory-panel-heading inventory-magento-heading"><div><p className="eyebrow">Commerce infrastructure</p><h2>Magento reconciliation</h2><p>Network quantities are matched using the BizPilot inventory ID and Magento SKU.</p></div><div><span className={mismatchCount ? 'inventory-sync-fact inventory-sync-fact--warn' : 'inventory-sync-fact'}>{mismatchCount} mismatches</span><span className={unmappedCount ? 'inventory-sync-fact inventory-sync-fact--risk' : 'inventory-sync-fact'}>{unmappedCount} unmapped</span><button className="secondary-button" type="button" disabled={loading} onClick={onRefresh}>{loading ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />} Refresh</button></div></div>{error ? <div className="inventory-magento-error"><Unplug size={16} />{error}</div> : null}{loading && !ready ? <div className="inventory-loading"><LoaderCircle className="spin" size={18} /> Loading Magento stock</div> : ready ? <div className="inventory-movement-table"><table><thead><tr><th>Product</th><th>SKU mapping</th><th>BizPilot</th><th>Magento</th><th>Variance</th><th>Status</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.product.id}><td><strong>{entry.product.name}</strong><span>{entry.product.inventoryId}</span></td><td>{entry.magento === undefined ? 'Not mapped' : 'Matched by SKU'}</td><td>{entry.bizpilot}</td><td>{entry.magento ?? '—'}</td><td><b className={entry.variance ? 'movement-negative' : ''}>{entry.variance === null ? '—' : entry.variance > 0 ? `+${entry.variance}` : entry.variance}</b></td><td><span className={`inventory-status inventory-status--${entry.magento === undefined ? 'risk' : entry.variance ? 'warn' : 'good'}`}>{entry.magento === undefined ? 'Unmapped' : entry.variance ? 'Review' : 'Aligned'}</span></td></tr>)}</tbody></table></div> : null}</section>;
}

function StandaloneCommerceState() {
  return <section className="inventory-queue-panel commerce-standalone-state"><div><i><CheckCircle2 size={24} /></i><p className="eyebrow">Commerce mode</p><h2>BizPilot is the source of truth</h2><p>Products, location stock, POS orders, customer balances, and movement history are operating without an external commerce platform.</p><dl><div><dt>Catalogue</dt><dd>BizPilot managed</dd></div><div><dt>Inventory</dt><dd>Location aware</dd></div><div><dt>Orders</dt><dd>Native sales ledger</dd></div><div><dt>External synchronization</dt><dd>Not required</dd></div></dl></div></section>;
}

function RestockComposer({ product, currentQuantity, suggestedQuantity, currentUser, onClose, onSubmit }: { product: ReturnType<typeof useBusiness>['state']['products'][number]; currentQuantity: number; suggestedQuantity?: number; currentUser: ReturnType<typeof useBusiness>['currentUser']; onClose: () => void; onSubmit: (quantity: number, urgency: 'Low' | 'Medium' | 'High', note: string) => boolean }) {
  const [quantity, setQuantity] = useState(suggestedQuantity && suggestedQuantity > 0 ? suggestedQuantity : Math.max(product.reorderLevel * 2 - currentQuantity, 1));
  const [urgency, setUrgency] = useState<'Low' | 'Medium' | 'High'>(currentQuantity <= 0 ? 'High' : 'Medium');
  const [note, setNote] = useState('');
  return <div className="composer-backdrop"><form className="inventory-restock-composer" onSubmit={(event) => { event.preventDefault(); onSubmit(quantity, urgency, note.trim()); }}><div className="composer-heading"><div><p className="eyebrow">Replenishment request</p><h2>{product.name}</h2></div><button className="icon-button" type="button" aria-label="Close request" title="Close request" onClick={onClose}>×</button></div><div className="composer-body"><div className="inventory-request-context"><div><span>Current stock</span><strong>{currentQuantity} {product.unit}</strong></div><div><span>Reorder level</span><strong>{product.reorderLevel} {product.unit}</strong></div><div><span>Requested by</span><strong>{currentUser.name}</strong></div></div><label className="form-field"><span>Requested quantity</span><input type="number" min="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} /></label><label className="form-field"><span>Urgency</span><select value={urgency} onChange={(event) => setUrgency(event.target.value as typeof urgency)}><option>Low</option><option>Medium</option><option>High</option></select></label><label className="form-field"><span>Operational note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Demand, customer order, or stockout context" /></label></div><div className="composer-footer"><span>Procurement will receive this demand signal.</span><button className="primary-button" type="submit" disabled={!quantity}>Create request</button></div></form></div>;
}

function EmptyInventory({ icon: Icon, title, detail }: { icon: typeof Search; title: string; detail: string }) {
  return <div className="inventory-empty"><Icon size={23} /><strong>{title}</strong><span>{detail}</span></div>;
}
