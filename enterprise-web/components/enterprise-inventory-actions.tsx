'use client';

import { ArrowDown, ArrowRight, ArrowUp, Check, PackagePlus, Search, Send, SlidersHorizontal, Truck, X } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';

import { useBusiness } from '../../src/context/BusinessContext';
import { selectProductQuantityOnHand } from '../../src/selectors/businessSelectors';
import { formatRelativeDate } from '../../src/utils/format';

export function ProductComposer({ onClose, onComplete }: { onClose: () => void; onComplete: (message: string) => void }) {
  const { state, addProduct } = useBusiness();
  const activeLocations = state.locations.filter((entry) => entry.isActive);
  const categories = state.productCategories.filter((entry) => entry.isActive);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState('units');
  const [price, setPrice] = useState(0);
  const [cost, setCost] = useState(0);
  const [reorderLevel, setReorderLevel] = useState(0);
  const [quantity, setQuantity] = useState(0);
  const [locationId, setLocationId] = useState(activeLocations[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); const result = addProduct({ name, inventoryId: sku || undefined, unit, price, cost, reorderLevel, quantity, locationId, categoryId: state.businessProfile.inventoryCategoriesEnabled ? categoryId || undefined : undefined }); if (!result.ok) { setError(result.message); return; } onComplete(`${name} added to the inventory catalog.`); onClose(); }
  return <div className="dialog-backdrop"><form className="product-composer" onSubmit={submit}><header><div><p className="eyebrow">Catalog governance</p><h2>Create stock item</h2><span>Opening stock creates the first auditable movement at the selected location.</span></div><button className="icon-button" type="button" aria-label="Close product form" title="Close product form" onClick={onClose}><X size={17} /></button></header><div className="product-composer-body"><section><div className="inventory-form-heading"><PackagePlus size={16} /><span><strong>Product identity</strong><small>Information shared across sales, procurement, POS, and reports.</small></span></div><div className="settings-drawer-grid"><label className="form-field"><span>Product name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label><label className="form-field"><span>SKU / inventory ID <small>Generated when blank</small></span><input value={sku} onChange={(event) => setSku(event.target.value)} /></label><label className="form-field"><span>Unit of measure</span><input value={unit} onChange={(event) => setUnit(event.target.value)} /></label>{state.businessProfile.inventoryCategoriesEnabled ? <label className="form-field"><span>Category</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Uncategorized</option>{categories.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label> : null}</div></section><section><div className="inventory-form-heading"><Check size={16} /><span><strong>Commercial and stock controls</strong><small>Cost, selling value, reorder policy, and opening balance.</small></span></div><div className="product-number-grid"><label className="form-field"><span>Unit cost</span><input type="number" min="0" step="0.01" value={cost} onChange={(event) => setCost(Number(event.target.value))} /></label><label className="form-field"><span>Selling price</span><input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(Number(event.target.value))} /></label><label className="form-field"><span>Reorder level</span><input type="number" min="0" value={reorderLevel} onChange={(event) => setReorderLevel(Number(event.target.value))} /></label><label className="form-field"><span>Opening quantity</span><input type="number" min="0" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label></div><label className="form-field"><span>Opening stock location</span><select value={locationId} onChange={(event) => setLocationId(event.target.value)}>{activeLocations.map((entry) => <option value={entry.id} key={entry.id}>{entry.name} · {entry.type}</option>)}</select></label></section>{error ? <div className="settings-message" role="alert">{error}</div> : null}</div><footer><span>Future quantity changes should come through receiving, transfers, replenishment, or controlled adjustments.</span><button className="primary-button" type="submit" disabled={!name.trim() || !locationId}>Create stock item <ArrowRight size={14} /></button></footer></form></div>;
}

export function StockAdjustmentDialog({ productId, locationId, onClose, onComplete }: { productId: string; locationId: string; onClose: () => void; onComplete: (message: string) => void }) {
  const { state, currentUser, adjustStock } = useBusiness();
  const product = state.products.find((entry) => entry.id === productId);
  const location = state.locations.find((entry) => entry.id === locationId);
  const currentQuantity = selectProductQuantityOnHand(state, productId, locationId);
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const resultingQuantity = currentQuantity + (direction === 'increase' ? quantity : -quantity);

  if (!product || !location) return null;
  const productName = product.name;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const result = await adjustStock({
      productId,
      locationId,
      quantityDelta: direction === 'increase' ? quantity : -quantity,
      reason,
      performedBy: currentUser.userId,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onComplete(result.message ?? `Stock adjusted for ${productName}.`);
    onClose();
  }

  return <div className="dialog-backdrop"><form className="stock-adjustment-dialog" onSubmit={(event) => void submit(event)}><header><div className="stock-adjustment-icon"><SlidersHorizontal size={18} /></div><div><p className="eyebrow">Controlled inventory change</p><h2>Adjust stock</h2><span>{product.name} · {location.name}</span></div><button className="icon-button" type="button" aria-label="Close stock adjustment" title="Close stock adjustment" onClick={onClose}><X size={17} /></button></header><div className="stock-adjustment-body"><div className="stock-adjustment-balance"><span>Current balance<strong>{currentQuantity} {product.unit}</strong></span><ArrowRight size={16} /><span>Resulting balance<strong className={resultingQuantity < 0 ? 'balance-risk' : ''}>{resultingQuantity} {product.unit}</strong></span></div><fieldset className="adjustment-direction"><legend>Adjustment type</legend><button type="button" className={direction === 'increase' ? 'is-active' : ''} onClick={() => setDirection('increase')}><ArrowUp size={14} /> Increase</button><button type="button" className={direction === 'decrease' ? 'is-active' : ''} onClick={() => setDirection('decrease')}><ArrowDown size={14} /> Decrease</button></fieldset><label className="form-field"><span>Quantity</span><input autoFocus type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.floor(Number(event.target.value) || 1)))} /></label><label className="form-field"><span>Reason <small>Required for the audit ledger</small></span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Example: Cycle count correction after physical verification" /></label>{error ? <div className="settings-message" role="alert">{error}</div> : null}</div><footer><span>This creates a location-scoped stock movement with your user identity and reason.</span><button className="primary-button" type="submit" disabled={busy || reason.trim().length < 5 || resultingQuantity < 0}>{busy ? 'Recording…' : 'Record adjustment'} <ArrowRight size={14} /></button></footer></form></div>;
}

export function TransferWorkspace() {
  const { state, currentUser, hasPermission, createStockTransfer, approveStockTransfer, dispatchStockTransfer, receiveStockTransfer, cancelStockTransfer } = useBusiness();
  const warehouses = state.locations.filter((entry) => entry.type === 'warehouse' && entry.isActive);
  const stores = state.locations.filter((entry) => entry.type === 'store' && entry.isActive);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const validStoreIds = new Set(state.locationSupplyRoutes.filter((route) => route.isActive && route.fromLocationId === warehouseId).map((route) => route.toLocationId));
  const destinations = stores.filter((entry) => validStoreIds.has(entry.id));
  const [storeId, setStoreId] = useState(destinations[0]?.id ?? '');
  const [productId, setProductId] = useState(state.products[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const canCreate = hasPermission('transfers.create');
  const ordered = [...state.stockTransfers].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const selectedProduct = state.products.find((entry) => entry.id === productId);
  const [productSearch, setProductSearch] = useState(selectedProduct ? `${selectedProduct.name} ${selectedProduct.inventoryId}` : '');
  const searchableProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    const ranked = state.products.map((product) => {
      const haystack = `${product.name} ${product.inventoryId} ${product.unit}`.toLowerCase();
      const available = warehouseId ? selectProductQuantityOnHand(state, product.id, warehouseId) : selectProductQuantityOnHand(state, product.id);
      const exactSku = product.inventoryId.toLowerCase() === query;
      const nameStarts = product.name.toLowerCase().startsWith(query);
      const matches = !query || haystack.includes(query);
      return { product, available, score: exactSku ? 0 : nameStarts ? 1 : matches ? 2 : 3 };
    });
    return ranked
      .filter((entry) => entry.score < 3)
      .sort((a, b) => a.score - b.score || b.available - a.available || a.product.name.localeCompare(b.product.name))
      .slice(0, 8);
  }, [productSearch, state, warehouseId]);
  const productAvailability = productId && warehouseId ? selectProductQuantityOnHand(state, productId, warehouseId) : 0;

  function selectTransferProduct(nextProductId: string) {
    const product = state.products.find((entry) => entry.id === nextProductId);
    setProductId(nextProductId);
    setProductSearch(product ? `${product.name} ${product.inventoryId}` : '');
    setProductPickerOpen(false);
  }

  async function create(event: FormEvent) { event.preventDefault(); setBusy(true); const result = await createStockTransfer({ fromWarehouseId: warehouseId, toStoreId: storeId, items: [{ productId, quantity }], initiatedBy: currentUser.userId, note }); setBusy(false); setMessage(result.message ?? (result.ok ? 'Transfer request created.' : 'Transfer could not be created.')); if (result.ok) { setQuantity(1); setNote(''); } }
  async function act(id: string, action: 'approve' | 'dispatch' | 'receive' | 'cancel') { setBusy(true); const input = { transferId: id, performedBy: currentUser.userId }; const result = action === 'approve' ? await approveStockTransfer(input) : action === 'dispatch' ? await dispatchStockTransfer(input) : action === 'receive' ? await receiveStockTransfer(input) : await cancelStockTransfer(input); setBusy(false); setMessage(result.message ?? (result.ok ? `Transfer ${action} action completed.` : 'Transfer action failed.')); }
  return <section className="transfer-workspace"><div className="inventory-panel-heading"><div><p className="eyebrow">Controlled movement</p><h2>Stock transfers</h2><p>Warehouse-to-store movement follows configured supply routes and role-separated approval.</p></div><span>{ordered.filter((entry) => !['received', 'cancelled'].includes(entry.status)).length} open</span></div>{message ? <div className="settings-message" role="status">{message}</div> : null}{canCreate ? <form className="transfer-create-strip" onSubmit={(event) => void create(event)}><label><span>From warehouse</span><select value={warehouseId} onChange={(event) => { setWarehouseId(event.target.value); setStoreId(''); }}><option value="">Choose warehouse</option>{warehouses.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label><ArrowRight size={15} /><label><span>To store</span><select value={storeId} onChange={(event) => setStoreId(event.target.value)}><option value="">Choose routed store</option>{destinations.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label><div className="transfer-product-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setProductPickerOpen(false); }}><span>Product</span><label><Search size={14} /><span><input value={productSearch} onFocus={() => setProductPickerOpen(true)} onChange={(event) => { setProductSearch(event.target.value); setProductId(''); setProductPickerOpen(true); }} placeholder="Search name, SKU, or unit" /><small>{selectedProduct ? selectedProduct.inventoryId : 'Select from results'}</small></span><b>{productAvailability} available</b></label>{productPickerOpen ? <div className="transfer-product-results">{searchableProducts.map(({ product, available }) => <button className={product.id === productId ? 'is-selected' : ''} type="button" key={product.id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectTransferProduct(product.id)}><span><strong>{product.name}</strong><small>{product.inventoryId} · {product.unit}</small></span><b>{available}</b></button>)}{!searchableProducts.length ? <p>No matching product found.</p> : null}</div> : null}</div><label><span>Quantity</span><input type="number" min="1" max={productAvailability} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label><label><span>Movement note</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason or dispatch context" /></label><button className="primary-button" type="submit" disabled={busy || !warehouseId || !storeId || !productId || quantity < 1}><Send size={14} /> Create transfer</button></form> : null}<div className="transfer-table-wrap"><table className="transfer-table"><thead><tr><th>Transfer</th><th>Route</th><th>Items</th><th>Created</th><th>Status</th><th>Next action</th></tr></thead><tbody>{ordered.map((transfer) => { const source = state.locations.find((entry) => entry.id === transfer.fromWarehouseId); const target = state.locations.find((entry) => entry.id === transfer.toStoreId); return <tr key={transfer.id}><td><strong>{transfer.transferCode}</strong><span>{transfer.initiatedBy}</span></td><td><strong>{source?.name ?? transfer.fromWarehouseId}</strong><span>to {target?.name ?? transfer.toStoreId}</span></td><td>{transfer.items.map((item) => <span key={item.productId}>{item.quantity} × {item.productName}</span>)}</td><td>{formatRelativeDate(transfer.createdAt)}</td><td><span className={`transfer-status transfer-status--${transfer.status}`}>{transfer.status}</span></td><td><div className="transfer-actions">{transfer.status === 'pending' && hasPermission('transfers.approve') ? <button type="button" onClick={() => void act(transfer.id, 'approve')}>Approve</button> : null}{transfer.status === 'approved' && hasPermission('transfers.dispatch') ? <button type="button" onClick={() => void act(transfer.id, 'dispatch')}><Truck size={13} /> Dispatch</button> : null}{transfer.status === 'dispatched' && hasPermission('transfers.receive') ? <button type="button" onClick={() => void act(transfer.id, 'receive')}><Check size={13} /> Receive</button> : null}{!['received', 'cancelled'].includes(transfer.status) && hasPermission('transfers.approve') ? <button className="danger-text" type="button" onClick={() => void act(transfer.id, 'cancel')}>Cancel</button> : null}</div></td></tr>;})}</tbody></table>{!ordered.length ? <div className="inventory-loading">No stock transfers have been created.</div> : null}</div></section>;
}
