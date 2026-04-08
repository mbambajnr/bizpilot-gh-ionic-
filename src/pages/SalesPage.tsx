import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useMemo, useState } from 'react';

import SectionCard from '../components/SectionCard';
import { useBusiness } from '../context/BusinessContext';
import { formatCurrency, formatRelativeDate } from '../utils/format';

const SalesPage: React.FC = () => {
  const { state, addSale } = useBusiness();
  const [customerId, setCustomerId] = useState(state.customers[0]?.id ?? '');
  const [productId, setProductId] = useState(state.products[0]?.id ?? '');
  const [quantityInput, setQuantityInput] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Mobile Money'>('Cash');
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [feedback, setFeedback] = useState<string>('');
  const quantity = Math.max(1, Number(quantityInput || '1'));

  const selectedProduct = useMemo(
    () => state.products.find((item) => item.id === productId),
    [productId, state.products]
  );
  const saleTotal = selectedProduct ? selectedProduct.price * quantity : 0;
  const salesToday = state.sales.filter((sale) => new Date(sale.createdAt).toDateString() === new Date().toDateString());
  const cashToday = salesToday.filter((sale) => sale.paymentMethod === 'Cash').reduce((sum, sale) => sum + sale.paidAmount, 0);
  const momoToday = salesToday
    .filter((sale) => sale.paymentMethod === 'Mobile Money')
    .reduce((sum, sale) => sum + sale.paidAmount, 0);

  const handleSubmit = () => {
    if (!selectedProduct) {
      setFeedback('Select an item before recording the sale.');
      return;
    }

    const normalizedPaidAmount = paidAmountInput.trim() === '' ? saleTotal : Number(paidAmountInput);

    const result = addSale({
      customerId,
      productId,
      quantity,
      paymentMethod,
      paidAmount: normalizedPaidAmount,
    });

    if (!result.ok) {
      setFeedback(result.message);
      return;
    }

    setFeedback(`Sale recorded for ${formatCurrency(saleTotal)}.`);
    setQuantityInput('1');
    setPaidAmountInput('');
  };

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Sales</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <div className="page-shell">
          <SectionCard title="Record a sale" subtitle="Capture the buyer, item sold, quantity, and whether payment came by cash or mobile money.">
            <div className="form-grid">
              {selectedProduct ? (
                <div className="selected-product">
                  <img className="product-hero" src={selectedProduct.image} alt={selectedProduct.name} />
                  <div>
                    <p className="muted-label">Selected item</p>
                    <h3>{selectedProduct.name}</h3>
                    <p className="muted-label">
                      {selectedProduct.inventoryId} • {selectedProduct.quantity} left in stock • {formatCurrency(selectedProduct.price)} each
                    </p>
                  </div>
                </div>
              ) : null}

              <IonItem lines="none" className="app-item">
                <IonLabel position="stacked">Buyer</IonLabel>
                <IonSelect value={customerId} onIonChange={(event) => setCustomerId(event.detail.value)} interface="popover">
                  {state.customers.map((customer) => (
                    <IonSelectOption key={customer.id} value={customer.id}>
                      {customer.clientId} · {customer.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>

              <IonItem lines="none" className="app-item">
                <IonLabel position="stacked">Item sold</IonLabel>
                <IonSelect value={productId} onIonChange={(event) => setProductId(event.detail.value)} interface="popover">
                  {state.products.map((product) => (
                    <IonSelectOption key={product.id} value={product.id}>
                      {product.inventoryId} · {product.name} ({product.quantity} left)
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>

              <div className="dual-stat">
                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Quantity</IonLabel>
                  <IonInput
                    type="number"
                    min={1}
                    value={quantityInput}
                    onIonInput={(event) => setQuantityInput(event.detail.value ?? '1')}
                  />
                </IonItem>

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Payment method</IonLabel>
                  <IonSelect value={paymentMethod} onIonChange={(event) => setPaymentMethod(event.detail.value)} interface="popover">
                    <IonSelectOption value="Cash">Cash</IonSelectOption>
                    <IonSelectOption value="Mobile Money">Mobile Money</IonSelectOption>
                  </IonSelect>
                </IonItem>
              </div>

              <IonItem lines="none" className="app-item">
                <IonLabel position="stacked">Amount paid now</IonLabel>
                <IonInput
                  type="number"
                  min={0}
                  max={saleTotal}
                  value={paidAmountInput}
                  helperText={`Leave blank to mark ${formatCurrency(saleTotal)} as fully paid.`}
                  onIonInput={(event) => {
                    setPaidAmountInput(event.detail.value ?? '');
                  }}
                />
              </IonItem>

              <div className="sale-summary">
                <div>
                  <p className="muted-label">Sale total</p>
                  <h3>{formatCurrency(saleTotal)}</h3>
                </div>
                <div>
                  <p className="muted-label">Outstanding after sale</p>
                  <h3>
                    {formatCurrency(
                      Math.max(0, saleTotal - (paidAmountInput.trim() === '' ? saleTotal : Number(paidAmountInput)))
                    )}
                  </h3>
                </div>
              </div>

              <IonButton expand="block" onClick={handleSubmit}>
                Record Sale
              </IonButton>
              {feedback ? <IonText color="primary">{feedback}</IonText> : null}
            </div>
          </SectionCard>

          <SectionCard title="Payment mix today" subtitle="These totals now update from recorded sales.">
            <div className="dual-stat">
              <div>
                <p className="muted-label">Cash</p>
                <h3>{formatCurrency(cashToday)}</h3>
              </div>
              <div>
                <p className="muted-label">Mobile money</p>
                <h3>{formatCurrency(momoToday)}</h3>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Recent sales" subtitle="The newest transactions appear first and feed the dashboard automatically.">
            <div className="list-block">
              {state.sales.slice(0, 6).map((sale) => {
                const customer = state.customers.find((item) => item.id === sale.customerId);
                const product = state.products.find((item) => item.id === sale.productId);

                return (
                  <div className="list-row" key={sale.id}>
                    <div className="item-main">
                      <img className="product-thumb" src={product?.image} alt={product?.name ?? 'Item'} />
                      <div>
                        <strong>{customer?.name ?? 'Recorded customer'}</strong>
                        <p className="code-label">
                          {(customer?.clientId ?? 'CLT-UNK')} · {(product?.inventoryId ?? 'INV-UNK')}
                        </p>
                        <p>
                          {product?.name ?? 'Recorded item'} • {sale.quantity} units • {sale.paymentMethod} • {formatRelativeDate(sale.createdAt)}
                        </p>
                      </div>
                    </div>
                    <strong>{formatCurrency(sale.totalAmount)}</strong>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SalesPage;
