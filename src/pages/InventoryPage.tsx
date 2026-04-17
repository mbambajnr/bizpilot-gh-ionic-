import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonToast,
  IonTitle,
  IonToolbar,
  IonSearchbar,
} from '@ionic/react';
import { useMemo, useState } from 'react';
import { resizeImage } from '../utils/imageUtils';

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
  const { state, addProduct, addRestockRequest, currentUser, hasPermission } = useBusiness();
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

  // Restock form state
  const [restockQty, setRestockQty] = useState<number | ''>('');
  const [urgency, setUrgency] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [restockNote, setRestockNote] = useState('');
  const [restockMessage, setRestockMessage] = useState('');
  const [showRestockSuccess, setShowRestockSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Inventory</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <div className="page-shell">
          {hasPermission('inventory.create') && (
            <SectionCard title="Add stock item" subtitle="Create a sellable item with its details. Adding a photo is optional but helps with quick identification.">
              <div className="form-grid">
                <div className="inventory-photo-section">
                  <div className="inventory-photo-preview">
                    {image ? (
                      <img src={image} alt="Preview" />
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
                message="Add a sellable product above and BizPilot will track quantity on hand, reorder risk, and the latest stock movement from that moment forward."
              />
            ) : (
              <div className="list-block">
                {inventorySummaries.map(({ product, quantityOnHand, lowStock, latestMovement, stockStatusDisplay }) => {
                  const margin = product.price > 0 ? `${Math.round(((product.price - product.cost) / product.price) * 100)}%` : '0%';

                  return (
                    <div
                      className="list-row"
                      key={product.id}
                      onClick={() => setSelectedProductId(product.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedProductId(product.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="item-main">
                        <img className="product-thumb" src={product.image} alt={product.name} />
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
                          <p>{selectedSummary?.product.id === product.id ? 'Viewing movement history' : 'Tap to view movement history'}</p>
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

          <SectionCard
            title="Stock movement history"
            subtitle="See exactly why this product's quantity changed, from opening stock to sales and reversals."
          >
            {selectedSummary ? (
              <div className="list-block">
                <div className="list-row">
                  <div className="item-main">
                    <img className="product-thumb" src={selectedSummary.product.image} alt={selectedSummary.product.name} />
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
                      <div className="list-row" key={movement.id}>
                        <div>
                          <strong>{movementDisplay.label}</strong>
                          <p className="code-label">
                            {movement.movementNumber}
                            {movement.referenceNumber ? ` • ${movement.referenceNumber}` : ''}
                          </p>
                          <p>{movement.note || movementDisplay.helper}</p>
                          {relatedCustomer ? <p>Customer: {relatedCustomer.name}</p> : null}
                          <p>{formatReceiptDate(movement.createdAt)}</p>
                        </div>
                        <div className="right-meta">
                          <strong className={movement.quantityDelta < 0 ? 'danger-text' : 'success-text'}>
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
            ) : (
              <EmptyState
                eyebrow="No product selected"
                title="Add a product to see movement history."
                message="Once inventory exists, choose an item above to inspect how its stock changed."
              />
            )}
          </SectionCard>

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

          {selectedProductId && hasPermission('restockRequests.view') && (state.restockRequests ?? []).some(r => r.productId === selectedProductId) && (
            <SectionCard title="Active Restock Requests" subtitle="Track the progress of replenishment requests for this item.">
              <div className="list-block">
                {(state.restockRequests ?? []).filter(r => r.productId === selectedProductId).map(req => (
                  <div className="list-row" key={req.id}>
                    <div>
                      <strong>{req.requestedQuantity} {selectedSummary?.product.unit}</strong>
                      <p>Requested by: {req.requestedByName}</p>
                      <p>Urgency: {req.urgency} • {req.note || 'No note'}</p>
                      <p>Sent: {formatRelativeDate(req.createdAt)}</p>
                      {req.reviewedByUserId && (
                        <p>Reviewed by {req.reviewedByName}: {req.reviewNote || 'No comment'}</p>
                      )}
                    </div>
                    <div className="right-meta">
                      <strong className={
                        req.status === 'Approved' ? 'success-text' : 
                        req.status === 'Rejected' ? 'danger-text' : 
                        req.status === 'Fulfilled' ? 'primary-text' : 'warning-text'
                      }>
                        {req.status}
                      </strong>
                      <p>{req.reviewedAt ? `Finalized ${formatRelativeDate(req.reviewedAt)}` : 'Awaiting review'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      </IonContent>
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
    </IonPage>
  );
};

export default InventoryPage;
