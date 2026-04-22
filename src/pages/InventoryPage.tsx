import {
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonPage,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useMemo, useState } from 'react';
import { resizeImage } from '../utils/imageUtils';
import type { InventoryImportPreview } from '../utils/inventoryImport';
import { buildInventoryTemplateCsv, validateInventoryImportCsv } from '../utils/inventoryImport';

import EmptyState from '../components/EmptyState';
import SectionCard from '../components/SectionCard';
import { useBusiness } from '../context/BusinessContext';
import {
  selectInventorySummaries,
  selectProductMovements,
  selectStockMovementDisplay,
} from '../selectors/businessSelectors';
import { formatCurrency, formatReceiptDate, formatRelativeDate } from '../utils/format';

const InventoryPage: React.FC = () => {
  const { state, addProduct, addRestockRequest, reviewRestockRequest, currentUser, hasPermission } = useBusiness();
  const [name, setName] = useState('');
  const [inventoryId, setInventoryId] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [cost, setCost] = useState<number | ''>('');
  const [reorderLevel, setReorderLevel] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [image, setImage] = useState<string>('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [savedItemName, setSavedItemName] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<InventoryImportPreview | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importSummaryMessage, setImportSummaryMessage] = useState('');
  const [showImportToast, setShowImportToast] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeSegment, setActiveSegment] = useState<'status' | 'activity' | 'supply'>('status');

  // Review state
  const [reviewNote, setReviewNote] = useState('');
  const [showReviewToast, setShowReviewToast] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');

  // Restock Request State
  const [restockQty, setRestockQty] = useState<number | ''>('');
  const [restockNote, setRestockNote] = useState('');
  const [urgency, setUrgency] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [restockMessage, setRestockMessage] = useState('');
  const [showRestockSuccess, setShowRestockSuccess] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setFormMessage('Photo is very large (over 10MB). Please choose a smaller file.');
        return;
      }
      
      try {
        setFormMessage('Processing photo...');
        const resized = await resizeImage(file, 600, 600);
        setImage(resized);
        setFormMessage('');
      } catch (err) {
        setFormMessage('Failed to process the photo. Please try again.');
        console.error(err);
      }
    }
  };
  const [selectedProductId, setSelectedProductId] = useState(state.products[0]?.id ?? '');

  useEffect(() => {
    if (!selectedProductId && state.products.length > 0) {
      setSelectedProductId(state.products[0].id);
    }
  }, [state.products, selectedProductId]);
  const inventorySummaries = useMemo(() => {
    const all = selectInventorySummaries(state);
    if (!searchTerm.trim()) return all;
    const lower = searchTerm.toLowerCase();
    return all.filter(({ product }) => 
      product.name.toLowerCase().includes(lower) || 
      product.inventoryId.toLowerCase().includes(lower)
    );
  }, [state, searchTerm]);
  const selectedSummary = useMemo(() => {
    return inventorySummaries.find((item) => item.product.id === selectedProductId) ?? 
           inventorySummaries[0] ?? 
           selectInventorySummaries(state).find(item => item.product.id === selectedProductId) ??
           null;
  }, [inventorySummaries, selectedProductId, state]);
  const selectedMovements = useMemo(
    () => (selectedSummary ? selectProductMovements(state, selectedSummary.product.id) : []),
    [selectedSummary, state]
  );
  const currency = state.businessProfile.currency;

  const handleAddProduct = () => {
    if (!name || price === '' || cost === '' || reorderLevel === '' || quantity === '') {
      setFormMessage('Complete all required inventory fields before saving.');
      return;
    }

    const itemName = name;

    const result = addProduct({
      name: itemName,
      inventoryId,
      unit: unit.trim() || 'units',
      price: Number(price),
      cost: Number(cost),
      reorderLevel: Number(reorderLevel),
      quantity: Number(quantity),
      image: image || undefined,
    });

    if (!result.ok) {
      setFormMessage(result.message);
      return;
    }

    setName('');
    setInventoryId('');
    setUnit('');
    setPrice('');
    setCost('');
    setReorderLevel('');
    setQuantity('');
    setImage('');
    setSavedItemName(itemName);
    setFormMessage('');
    setShowSuccessToast(true);
  };

  const handleDownloadTemplate = () => {
    const csv = buildInventoryTemplateCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'bisapilot-inventory-import-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportPreview(null);
    setImportMessage('');
    setImportFileName('');
    setIsImporting(false);
  };

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportMessage('Upload the BisaPilot inventory template as a CSV file.');
      setShowImportModal(true);
      return;
    }

    const text = await file.text();
    const preview = validateInventoryImportCsv(text, state.products);
    setImportPreview(preview);
    setImportFileName(file.name);
    setImportMessage(
      preview.headerErrors.length > 0
        ? preview.headerErrors.join(' ')
        : preview.invalidRows.length > 0
          ? `Found ${preview.invalidRows.length} invalid row${preview.invalidRows.length === 1 ? '' : 's'}. Fix them in the file and upload again.`
          : `Preview ready. ${preview.validRows.length} item${preview.validRows.length === 1 ? '' : 's'} can be imported safely.`
    );
    setShowImportModal(true);
  };

  const handleConfirmImport = () => {
    if (!importPreview || importPreview.headerErrors.length > 0 || importPreview.validRows.length === 0 || isImporting) {
      return;
    }

    setIsImporting(true);
    let importedCount = 0;
    const failedRows: string[] = [];

    importPreview.validRows.forEach((row) => {
      if (!row.normalizedInput) {
        return;
      }

      const result = addProduct(row.normalizedInput);
      if (result.ok) {
        importedCount += 1;
        return;
      }

      failedRows.push(`Row ${row.rowNumber}: ${result.message}`);
    });

    setIsImporting(false);

    if (failedRows.length > 0) {
      setImportMessage(`Imported ${importedCount} item${importedCount === 1 ? '' : 's'}, but some rows failed. ${failedRows.join(' ')}`);
      return;
    }

    setImportSummaryMessage(`Imported ${importedCount} inventory item${importedCount === 1 ? '' : 's'} successfully.`);
    setShowImportToast(true);
    closeImportModal();
  };

  const handleRequestRestock = () => {
    if (!selectedProductId || restockQty === '') {
      setRestockMessage('Enter a valid quantity.');
      return;
    }

    const result = addRestockRequest({
      productId: selectedProductId,
      requestedByUserId: currentUser.userId,
      requestedByName: currentUser.name,
      requestedQuantity: Number(restockQty),
      urgency,
      note: restockNote,
    });

    if (!result.ok) {
      setRestockMessage(result.message);
      return;
    }

    setRestockQty('');
    setRestockNote('');
    setUrgency('Medium');
    setRestockMessage('');
    setShowRestockSuccess(true);
  };

  const handleReviewRequest = (reqId: string, status: 'Approved' | 'Rejected' | 'Fulfilled') => {
    const result = reviewRestockRequest({
      requestId: reqId,
      status,
      reviewNote,
      reviewedByUserId: currentUser.userId,
      reviewedByName: currentUser.name,
    });

    if (result.ok) {
      setReviewNote('');
      setReviewMessage(`Request marked as ${status.toLowerCase()}.`);
      setShowReviewToast(true);
    } else {
      setRestockMessage(result.message);
    }
  };

  const openImageViewer = (src: string, alt: string) => {
    setExpandedImage({ src, alt });
  };

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Inventory</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSegment value={activeSegment} onIonChange={(e) => setActiveSegment(e.detail.value as any)}>
            <IonSegmentButton value="status">
              <IonLabel>Status</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="activity">
              <IonLabel>Activity</IonLabel>
            </IonSegmentButton>
            {hasPermission('restockRequests.view') && (
              <IonSegmentButton value="supply">
                <IonLabel>Supply</IonLabel>
              </IonSegmentButton>
            )}
          </IonSegment>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <div className="page-shell">
          {activeSegment === 'status' && (
            <>
              {hasPermission('inventory.create') && (
                <SectionCard title="Add stock item" subtitle="Create a sellable item with its details. Adding a photo is optional but helps with quick identification.">
                  <div className="form-grid">
                    <div className="button-group">
                      <IonButton fill="outline" onClick={handleDownloadTemplate}>
                        Download Import Template
                      </IonButton>
                      <input
                        id="inventory-import-input"
                        type="file"
                        accept=".csv,text/csv"
                        hidden
                        onChange={handleImportFileChange}
                      />
                      <IonButton fill="outline" onClick={() => document.getElementById('inventory-import-input')?.click()}>
                        Import from CSV
                      </IonButton>
                    </div>
                    <p className="muted-label">
                      Bulk import uses a CSV template with the exact BisaPilot inventory columns. Upload, preview, and confirm before anything is created.
                    </p>
                    <p className="muted-label">
                      Required: Item Name, Cost Price, Selling Price, Quantity In Stock, Reorder Level. Optional: Inventory ID, Unit, Image URL.
                    </p>
                    <div className="inventory-photo-section">
                      <div className="inventory-photo-preview">
                        {image ? (
                          <button
                            type="button"
                            className="image-thumb-button image-thumb-button-large"
                            onClick={() => openImageViewer(image, name.trim() || 'Product preview')}
                            aria-label="Expand product photo"
                          >
                            <img src={image} alt="Preview" />
                          </button>
                        ) : (
                          <div className="photo-placeholder">
                            <span>No photo</span>
                          </div>
                        )}
                      </div>
                      <div className="photo-actions">
                        <input
                          type="file"
                          accept="image/*"
                          id="inventory-photo-input"
                          hidden
                          onChange={handleFileChange}
                        />
                        <IonButton
                          fill="outline"
                          size="small"
                          onClick={() => document.getElementById('inventory-photo-input')?.click()}
                        >
                          {image ? 'Change Photo' : 'Add Photo (Optional)'}
                        </IonButton>
                        {image && (
                          <IonButton fill="clear" color="danger" size="small" onClick={() => setImage('')}>
                            Remove
                          </IonButton>
                        )}
                      </div>
                    </div>

                    <IonItem lines="none" className="app-item">
                      <IonLabel position="stacked">Item name</IonLabel>
                      <IonInput
                        value={name}
                        placeholder="e.g. Morning Fresh Soap"
                        onIonInput={(event) => setName(event.detail.value ?? '')}
                      />
                    </IonItem>

                    <IonItem lines="none" className="app-item">
                      <IonLabel position="stacked">Inventory ID (optional)</IonLabel>
                      <IonInput
                        value={inventoryId}
                        helperText="Leave blank to auto-generate one."
                        onIonInput={(event) => setInventoryId(event.detail.value ?? '')}
                      />
                    </IonItem>

                    <div className="triple-grid">
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Unit</IonLabel>
                        <IonInput
                          value={unit}
                          placeholder="e.g. packs, boxes, units"
                          onIonInput={(event) => setUnit(event.detail.value ?? '')}
                        />
                      </IonItem>
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Price</IonLabel>
                        <IonInput
                          type="number"
                          inputmode="decimal"
                          placeholder="0.00"
                          value={price}
                          onIonInput={(event) => setPrice(event.detail.value === '' ? '' : Number(event.detail.value))}
                        />
                      </IonItem>
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Cost</IonLabel>
                        <IonInput
                          type="number"
                          inputmode="decimal"
                          placeholder="0.00"
                          value={cost}
                          onIonInput={(event) => setCost(event.detail.value === '' ? '' : Number(event.detail.value))}
                        />
                      </IonItem>
                    </div>

                    <div className="dual-stat">
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Opening stock</IonLabel>
                        <IonInput
                          type="number"
                          inputmode="numeric"
                          placeholder="0"
                          value={quantity}
                          onIonInput={(event) => setQuantity(event.detail.value === '' ? '' : Number(event.detail.value))}
                        />
                      </IonItem>
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Reorder level</IonLabel>
                        <IonInput
                          type="number"
                          inputmode="numeric"
                          placeholder="0"
                          value={reorderLevel}
                          onIonInput={(event) => setReorderLevel(event.detail.value === '' ? '' : Number(event.detail.value))}
                        />
                      </IonItem>
                    </div>

                    <IonButton expand="block" onClick={handleAddProduct}>
                      Save Item
                    </IonButton>
                    {formMessage ? <p className="form-message">{formMessage}</p> : null}
                  </div>
                </SectionCard>
              )}

              <SectionCard title="Stock control" subtitle="Quantities now come from explicit stock movements instead of a loose on-hand counter.">
                <IonSearchbar 
                  placeholder="Search by name or ID..." 
                  value={searchTerm}
                  onIonInput={(e) => setSearchTerm(e.detail.value ?? '')}
                  style={{ padding: '0 8px 16px 8px' }}
                />
                {inventorySummaries.length === 0 ? (
                  <EmptyState
                    eyebrow="No stock yet"
                    title="Inventory visibility starts with the first item"
                    message="Add a sellable product above and BisaPilot will track quantity on hand, reorder risk, and the latest stock movement from that moment forward."
                  />
                ) : (
                  <div className="list-block">
                    {inventorySummaries.map(({ product, quantityOnHand, lowStock, latestMovement, stockStatusDisplay }) => {
                      const margin = product.price > 0 ? `${Math.round(((product.price - product.cost) / product.price) * 100)}%` : '0%';

                      return (
                        <div
                          className="list-row"
                          key={product.id}
                          onClick={() => {
                            setSelectedProductId(product.id);
                            setActiveSegment('activity');
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedProductId(product.id);
                              setActiveSegment('activity');
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="item-main">
                            <button
                              type="button"
                              className="image-thumb-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openImageViewer(product.image, product.name);
                              }}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                              }}
                              aria-label={`Expand ${product.name} image`}
                            >
                              <img className="product-thumb" src={product.image} alt={product.name} />
                            </button>
                            <div>
                              <strong>{product.name}</strong>
                              <p className="code-label">{product.inventoryId}</p>
                              <p>
                                Reorder at {product.reorderLevel} • Margin {margin} • {formatCurrency(product.price, currency)}
                              </p>
                              <p>
                                Latest movement:{' '}
                                {latestMovement ? `${latestMovement.type} • ${formatRelativeDate(latestMovement.createdAt)}` : 'No movements yet'}
                              </p>
                            </div>
                          </div>
                          <div className="right-meta">
                            <strong className={lowStock ? 'warning-text' : 'success-text'}>{stockStatusDisplay.label}</strong>
                            <p>{quantityOnHand} left</p>
                            <p>{stockStatusDisplay.helper}</p>
                            <p>{product.unit}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            </>
          )}

          {activeSegment === 'activity' && (
            <SectionCard
              title="Stock movement history"
              subtitle="See exactly why this product's quantity changed, from opening stock to sales and reversals."
            >
              {selectedSummary ? (
                <div className="list-block">
                  <div className="list-row header-row" style={{ background: 'rgba(0,0,0,0.05)', borderRadius: '12px', padding: '12px' }}>
                    <div className="item-main">
                      <button
                        type="button"
                        className="image-thumb-button"
                        onClick={() => openImageViewer(selectedSummary.product.image, selectedSummary.product.name)}
                        aria-label={`Expand ${selectedSummary.product.name} image`}
                      >
                        <img className="product-thumb" src={selectedSummary.product.image} alt={selectedSummary.product.name} />
                      </button>
                      <div>
                        <strong>{selectedSummary.product.name}</strong>
                        <p className="code-label">{selectedSummary.product.inventoryId}</p>
                        <p>{selectedSummary.stockStatusDisplay.helper}</p>
                      </div>
                    </div>
                    <div className="right-meta">
                      <strong className={selectedSummary.lowStock ? 'warning-text' : 'success-text'}>
                        {selectedSummary.quantityOnHand} left
                      </strong>
                      <p>{selectedSummary.product.unit}</p>
                    </div>
                  </div>

                  <div style={{ marginTop: '20px' }}>
                    {selectedMovements.length === 0 ? (
                      <EmptyState
                        eyebrow="No movement history"
                        title="No stock movement has been recorded yet."
                        message="Opening stock, sales, and reversals will appear here as this product is used."
                      />
                    ) : (
                      selectedMovements.map((movement) => {
                        const movementDisplay = selectStockMovementDisplay(movement);
                        const relatedSale = movement.relatedSaleId
                          ? state.sales.find((sale) => sale.id === movement.relatedSaleId)
                          : null;
                        const relatedCustomer = relatedSale
                          ? state.customers.find((customer) => customer.id === relatedSale.customerId)
                          : null;

                        return (
                          <div className="list-row" key={movement.id} style={{ borderBottom: '1px solid var(--border-color)', paddingTop: '16px', paddingBottom: '16px' }}>
                            <div>
                              <strong>{movementDisplay.label}</strong>
                              <p className="code-label">
                                {movement.movementNumber}
                                {movement.referenceNumber ? ` • ${movement.referenceNumber}` : ''}
                              </p>
                              <p>{movement.note || movementDisplay.helper}</p>
                              {relatedCustomer ? <p>Customer: {relatedCustomer.name}</p> : null}
                              <p className="muted-label">{formatReceiptDate(movement.createdAt)}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <strong className={movement.quantityDelta < 0 ? 'danger-text' : 'success-text'} style={{ fontSize: '1.1rem' }}>
                                {movement.quantityDelta > 0 ? '+' : ''}
                                {movement.quantityDelta}
                              </strong>
                              <p>After: {movement.quantityAfter}</p>
                              <p className={movementDisplay.tone === 'warning' ? 'warning-text' : 'success-text'}>
                                {movementDisplay.helper}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <EmptyState
                  eyebrow="No product selected"
                  title="Choose a product to see activity history."
                  message="Switch to the Status tab and tap on a product to view its detailed movement log here."
                />
              )}
            </SectionCard>
          )}

          {activeSegment === 'supply' && hasPermission('restockRequests.view') && (
            <>
              {/* REQUEST FORM - For Staff */}
              {selectedProductId && hasPermission('restockRequests.create') && (
                <SectionCard 
                  title="Request Restock" 
                  subtitle={`Request more ${selectedSummary?.product.name ?? 'stock'} for this shop.`}
                >
                  <div className="form-grid">
                    <div className="dual-stat">
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Requested quantity</IonLabel>
                        <IonInput 
                          type="number" 
                          value={restockQty} 
                          placeholder="0"
                          onIonInput={(e) => setRestockQty(e.detail.value === '' ? '' : Number(e.detail.value))} 
                        />
                      </IonItem>
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Urgency</IonLabel>
                        <IonInput 
                          value={urgency} 
                          readonly 
                          onClick={() => {
                            const next: Record<string, 'Low'|'Medium'|'High'> = { 'Low': 'Medium', 'Medium': 'High', 'High': 'Low' };
                            setUrgency(next[urgency]);
                          }} 
                        />
                      </IonItem>
                    </div>
                    <IonItem lines="none" className="app-item">
                      <IonLabel position="stacked">Notes (reason for restock)</IonLabel>
                      <IonInput 
                        value={restockNote} 
                        placeholder="e.g. Sudden demand spike"
                        onIonInput={(e) => setRestockNote(e.detail.value ?? '')} 
                      />
                    </IonItem>
                    <IonButton fill="outline" expand="block" onClick={handleRequestRestock}>
                      Submit Request
                    </IonButton>
                    {restockMessage && <p className="form-message">{restockMessage}</p>}
                  </div>
                </SectionCard>
              )}

              {/* ADMIN TASK LIST - Approved items needing physical restock */}
              {hasPermission('restockRequests.manage') && (state.restockRequests ?? []).filter(r => r.status === 'Approved').length > 0 && (
                <SectionCard 
                  title="To-Restock List" 
                  subtitle="These requests are approved. Once the physical stock arrives at the shop, mark them as fulfilled to update inventory."
                >
                  <div className="list-block">
                    {(state.restockRequests ?? [])
                      .filter(r => r.status === 'Approved')
                      .map(req => {
                        const product = state.products.find(p => p.id === req.productId);
                        return (
                          <div className="list-row" key={req.id} style={{ borderLeft: '4px solid var(--ion-color-success)', paddingLeft: '12px' }}>
                            <div>
                              <strong>{req.requestedQuantity} {product?.unit ?? 'units'}</strong>
                              <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{product?.name ?? 'Unknown item'}</p>
                              <p className="muted-label">Approved by {req.reviewedByName} • {formatReceiptDate(req.reviewedAt!)}</p>
                              <IonButton 
                                color="secondary" 
                                size="small" 
                                style={{ marginTop: '8px' }}
                                onClick={() => handleReviewRequest(req.id, 'Fulfilled')}
                              >
                                Mark as Received (Fulfilled)
                              </IonButton>
                            </div>
                            <div className="right-meta">
                              <IonBadge color="success">TO RESTOCK</IonBadge>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </SectionCard>
              )}

              {/* GENERAL LIST / PENDING APPROVALS */}
              <SectionCard 
                title={hasPermission('restockRequests.manage') ? "Review Requests" : "Request History"} 
                subtitle={hasPermission('restockRequests.manage') ? "Manage pending restock requests from the shop floor." : "Track the status of your submitted replenishment requests."}
              >
                {(state.restockRequests ?? []).filter(r => r.status !== 'Approved' || !hasPermission('restockRequests.manage')).length === 0 ? (
                  <EmptyState 
                    eyebrow="Clean queue"
                    title={hasPermission('restockRequests.manage') ? "No pending decisions" : "No requests yet"}
                    message={hasPermission('restockRequests.manage') ? "All restock requests have been approved, rejected, or are currently in the To-Restock list." : "When items run low, submit a request above."}
                  />
                ) : (
                  <div className="list-block">
                    {(state.restockRequests ?? [])
                      .filter(r => r.status !== 'Approved' || !hasPermission('restockRequests.manage'))
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map(req => {
                        const product = state.products.find(p => p.id === req.productId);
                        const isPending = req.status === 'Pending';

                        return (
                          <div className="list-row" key={req.id} style={{ borderBottom: '1px solid var(--border-color)', padding: '16px 0' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <strong>{req.requestedQuantity} {product?.unit ?? 'units'}</strong>
                                <IonBadge color={
                                  req.urgency === 'High' ? 'danger' : 
                                  req.urgency === 'Medium' ? 'warning' : 'primary'
                                } mode="ios">{req.urgency}</IonBadge>
                              </div>
                              <p style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '4px' }}>{product?.name ?? 'Unknown item'}</p>
                              <p>Requested by: {req.requestedByName}</p>
                              <p className="muted-label">Requested {formatReceiptDate(req.createdAt)}</p>
                              
                              {(req.status === 'Fulfilled' || req.status === 'Rejected') && (
                                <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', fontSize: '0.85rem' }}>
                                  <p><strong>Review Result:</strong> {req.reviewNote || 'No comment'}</p>
                                  <p className="muted-label">By {req.reviewedByName} • {formatReceiptDate(req.reviewedAt!)}</p>
                                </div>
                              )}

                              {isPending && hasPermission('restockRequests.manage') && (
                                <div className="form-grid" style={{ marginTop: '14px' }}>
                                  <IonItem lines="none" className="app-item">
                                    <IonLabel position="stacked">Decision Note (optional)</IonLabel>
                                    <IonInput 
                                      placeholder="e.g. Approving for delivery this Friday"
                                      value={reviewNote}
                                      onIonInput={(e) => setReviewNote(e.detail.value ?? '')}
                                    />
                                  </IonItem>
                                  <div className="dual-stat">
                                    <IonButton color="success" size="small" onClick={() => handleReviewRequest(req.id, 'Approved')}>Approve</IonButton>
                                    <IonButton color="danger" fill="outline" size="small" onClick={() => handleReviewRequest(req.id, 'Rejected')}>Reject</IonButton>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="right-meta">
                              <strong className={
                                req.status === 'Approved' ? 'success-text' : 
                                req.status === 'Rejected' ? 'danger-text' : 
                                req.status === 'Fulfilled' ? 'primary-text' : 'warning-text'
                               } style={{ fontSize: '1.1rem' }}>
                                {req.status}
                              </strong>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </div>
      </IonContent>
      <IonModal isOpen={!!expandedImage} onDidDismiss={() => setExpandedImage(null)}>
        <IonHeader translucent={true}>
          <IonToolbar>
            <IonTitle>{expandedImage?.alt ?? 'Product image'}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen={true}>
          {expandedImage ? (
            <div className="image-viewer-shell">
              <img className="image-viewer-image" src={expandedImage.src} alt={expandedImage.alt} />
              <IonButton fill="outline" onClick={() => setExpandedImage(null)}>
                Close
              </IonButton>
            </div>
          ) : null}
        </IonContent>
      </IonModal>
      <IonModal isOpen={showImportModal} onDidDismiss={closeImportModal}>
        <IonHeader translucent={true}>
          <IonToolbar>
            <IonTitle>Bulk Inventory Import</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen={true}>
          <div className="page-shell">
            <SectionCard
              title="CSV preview"
              subtitle={importFileName ? `Review ${importFileName} before creating inventory items.` : 'Upload the BisaPilot inventory template to preview rows before import.'}
            >
              <div className="form-grid">
                <div className="dual-stat">
                  <div className="mini-stat">
                    <p className="muted-label">Template format</p>
                    <h3>CSV</h3>
                  </div>
                  <div className="mini-stat">
                    <p className="muted-label">Valid rows</p>
                    <h3>{importPreview?.validRows.length ?? 0}</h3>
                  </div>
                  <div className="mini-stat">
                    <p className="muted-label">Invalid rows</p>
                    <h3>{importPreview?.invalidRows.length ?? 0}</h3>
                  </div>
                </div>

                {importMessage ? <p className="form-message">{importMessage}</p> : null}

                {!importPreview ? (
                  <EmptyState
                    eyebrow="No file loaded"
                    title="Upload the completed CSV template"
                    message="Download the template, fill it offline in Excel, then upload it here to validate and preview every row before import. Required columns are Item Name, Cost Price, Selling Price, Quantity In Stock, and Reorder Level."
                  />
                ) : (
                  <div className="list-block">
                    {importPreview.rows.map((row) => (
                      <div className="list-row" key={row.rowNumber}>
                        <div>
                          <strong>Row {row.rowNumber}: {row.values['Item Name'] || 'Unnamed item'}</strong>
                          <p className="code-label">{row.values['Inventory ID'] || 'Auto-generate Inventory ID'} • {row.values['Unit'] || 'units'}</p>
                          <p>
                            Cost {row.values['Cost Price'] || '—'} • Price {row.values['Selling Price'] || '—'} • Stock {row.values['Quantity In Stock'] || '—'} • Reorder {row.values['Reorder Level'] || '—'}
                          </p>
                          {row.errors.length > 0 ? (
                            <p className="danger-text">{row.errors.join(' ')}</p>
                          ) : (
                            <p className="success-text">Ready to import.</p>
                          )}
                        </div>
                        <div className="right-meta">
                          <IonBadge color={row.errors.length > 0 ? 'danger' : 'success'}>
                            {row.errors.length > 0 ? 'Invalid' : 'Valid'}
                          </IonBadge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="button-group">
                  <IonButton fill="outline" onClick={handleDownloadTemplate}>
                    Download Template
                  </IonButton>
                  <IonButton fill="outline" onClick={() => document.getElementById('inventory-import-input')?.click()}>
                    Upload Another File
                  </IonButton>
                  <IonButton onClick={handleConfirmImport} disabled={!importPreview || importPreview.headerErrors.length > 0 || importPreview.validRows.length === 0 || importPreview.invalidRows.length > 0 || isImporting}>
                    {isImporting ? 'Importing...' : 'Confirm Import'}
                  </IonButton>
                </div>
              </div>
            </SectionCard>
          </div>
        </IonContent>
      </IonModal>
      <IonToast
        isOpen={showSuccessToast}
        message={`${savedItemName} added successfully.`}
        duration={1800}
        color="success"
        position="top"
        onDidDismiss={() => setShowSuccessToast(false)}
      />
      <IonToast
        isOpen={showRestockSuccess}
        message="Restock request submitted to administrator."
        duration={1800}
        color="success"
        position="top"
        onDidDismiss={() => setShowRestockSuccess(false)}
      />
      <IonToast
        isOpen={showReviewToast}
        message={reviewMessage}
        duration={1800}
        color="success"
        position="top"
        onDidDismiss={() => setShowReviewToast(false)}
      />
      <IonToast
        isOpen={showImportToast}
        message={importSummaryMessage}
        duration={2200}
        color="success"
        position="top"
        onDidDismiss={() => setShowImportToast(false)}
      />
    </IonPage>
  );
};

export default InventoryPage;
