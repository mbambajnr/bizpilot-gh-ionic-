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
import { useState } from 'react';

import SectionCard from '../components/SectionCard';
import { useBusiness } from '../context/BusinessContext';
import { formatCurrency } from '../utils/format';

const InventoryPage: React.FC = () => {
  const { state, addProduct } = useBusiness();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [cost, setCost] = useState<number | ''>('');
  const [reorderLevel, setReorderLevel] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [savedItemName, setSavedItemName] = useState('');

  const handleAddProduct = () => {
    if (!name || price === '' || cost === '' || reorderLevel === '' || quantity === '') {
      return;
    }

    const itemName = name;

    addProduct({
      name: itemName,
      unit: unit.trim() || 'units',
      price: Number(price),
      cost: Number(cost),
      reorderLevel: Number(reorderLevel),
      quantity: Number(quantity),
    });

    setName('');
    setUnit('');
    setPrice('');
    setCost('');
    setReorderLevel('');
    setQuantity('');
    setSavedItemName(itemName);
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
                <IonInput value={name} onIonInput={(event) => setName(event.detail.value ?? '')} />
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
                  <IonInput type="number" value={price} onIonInput={(event) => setPrice(event.detail.value === '' ? '' : Number(event.detail.value))} />
                </IonItem>
                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Cost</IonLabel>
                  <IonInput type="number" value={cost} onIonInput={(event) => setCost(event.detail.value === '' ? '' : Number(event.detail.value))} />
                </IonItem>
              </div>

              <div className="dual-stat">
                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Opening quantity</IonLabel>
                  <IonInput type="number" value={quantity} onIonInput={(event) => setQuantity(event.detail.value === '' ? '' : Number(event.detail.value))} />
                </IonItem>
                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Reorder level</IonLabel>
                  <IonInput type="number" value={reorderLevel} onIonInput={(event) => setReorderLevel(event.detail.value === '' ? '' : Number(event.detail.value))} />
                </IonItem>
              </div>

              <IonButton expand="block" onClick={handleAddProduct}>
                Save Item
              </IonButton>
            </div>
          </SectionCard>

          <SectionCard title="Stock control" subtitle="These quantities decrease automatically whenever a sale is recorded.">
            <div className="list-block">
              {state.products.map((item) => {
                const lowStock = item.quantity <= item.reorderLevel;
                const margin = item.price > 0 ? `${Math.round(((item.price - item.cost) / item.price) * 100)}%` : '0%';

                return (
                  <div className="list-row" key={item.id}>
                    <div className="item-main">
                      <img className="product-thumb" src={item.image} alt={item.name} />
                      <div>
                        <strong>{item.name}</strong>
                        <p className="code-label">{item.inventoryId}</p>
                        <p>
                          Reorder at {item.reorderLevel} • Margin {margin} • {formatCurrency(item.price)}
                        </p>
                      </div>
                    </div>
                    <div className="right-meta">
                      <strong className={lowStock ? 'danger-text' : ''}>{item.quantity} left</strong>
                      <p>{item.unit}</p>
                    </div>
                  </div>
                );
              })}
            </div>
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
