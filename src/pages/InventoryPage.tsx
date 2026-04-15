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
} from '@ionic/react';
import { useMemo, useState } from 'react';

import EmptyState from '../components/EmptyState';
import SectionCard from '../components/SectionCard';
import { useBusiness } from '../context/BusinessContext';
import { selectInventorySummaries } from '../selectors/businessSelectors';
import { formatCurrency, formatRelativeDate } from '../utils/format';

const InventoryPage: React.FC = () => {
  const { state, addProduct } = useBusiness();
  const [name, setName] = useState('');
  const [inventoryId, setInventoryId] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [cost, setCost] = useState<number | ''>('');
  const [reorderLevel, setReorderLevel] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [savedItemName, setSavedItemName] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const inventorySummaries = useMemo(() => selectInventorySummaries(state), [state]);
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
    setSavedItemName(itemName);
    setFormMessage('');
    setShowSuccessToast(true);
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
          <SectionCard title="Add stock item" subtitle="Create a sellable item with its unit, price, cost, opening quantity, and reorder point.">
            <div className="form-grid">
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
                  <IonLabel position="stacked">Selling price</IonLabel>
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
                  <IonLabel position="stacked">Opening quantity</IonLabel>
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

          <SectionCard title="Stock control" subtitle="Quantities now come from explicit stock movements instead of a loose on-hand counter.">
            {inventorySummaries.length === 0 ? (
              <EmptyState
                eyebrow="No stock yet"
                title="Inventory visibility starts with the first item"
                message="Add a sellable product above and BizPilot will track quantity on hand, reorder risk, and the latest stock movement from that moment forward."
              />
            ) : (
              <div className="list-block">
                {inventorySummaries.map(({ product, quantityOnHand, lowStock, latestMovement, stockStatus }) => {
                  const margin = product.price > 0 ? `${Math.round(((product.price - product.cost) / product.price) * 100)}%` : '0%';

                  return (
                    <div className="list-row" key={product.id}>
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
                        </div>
                      </div>
                      <div className="right-meta">
                        <strong className={lowStock ? 'danger-text' : 'success-text'}>{quantityOnHand} left</strong>
                        <p>{stockStatus}</p>
                        <p>{product.unit}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
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
    </IonPage>
  );
};

export default InventoryPage;
