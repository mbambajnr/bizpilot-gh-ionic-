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
  IonToast,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';

import EmptyState from '../components/EmptyState';
import SectionCard from '../components/SectionCard';
import { useBusiness } from '../context/BusinessContext';
import {
  selectDashboardMetrics,
  selectProductQuantityOnHand,
  selectRecentSales,
  selectSaleBalanceRemaining,
  selectSaleStatusDisplay,
} from '../selectors/businessSelectors';
import { formatCurrency, formatReceiptDate, formatRelativeDate } from '../utils/format';
import { toPositiveInteger, toValidPaidAmount } from '../utils/salesMath';

type ReceiptView = {
  receiptId: string;
  createdAt: string;
  customerName: string;
  clientId: string;
  productName: string;
  inventoryId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  amountPaid: number;
  balanceRemaining: number;
  paymentMethod: string;
};

const SalesPage: React.FC = () => {
  const { state, addSale } = useBusiness();
  const history = useHistory();
  const location = useLocation<{ correctionSourceSaleId?: string } | undefined>();
  const [customerId, setCustomerId] = useState(state.customers[0]?.id ?? '');
  const [productId, setProductId] = useState(state.products[0]?.id ?? '');
  const [quantityInput, setQuantityInput] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Mobile Money'>('Cash');
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [correctionSourceSaleId, setCorrectionSourceSaleId] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [saleSuccessMessage, setSaleSuccessMessage] = useState('');
  const [lowStockMessage, setLowStockMessage] = useState('');
  const [showLowStockToast, setShowLowStockToast] = useState(false);
  const [latestReceipt, setLatestReceipt] = useState<ReceiptView | null>(null);
  const hasCustomers = state.customers.length > 0;
  const hasProducts = state.products.length > 0;
  const canRecordSale = hasCustomers && hasProducts;
  const quantity = toPositiveInteger(quantityInput, 1);
  const currency = state.businessProfile.currency;

  useEffect(() => {
    if (!state.customers.some((customer) => customer.id === customerId)) {
      setCustomerId(state.customers[0]?.id ?? '');
    }
  }, [customerId, state.customers]);

  useEffect(() => {
    if (!state.products.some((product) => product.id === productId)) {
      setProductId(state.products[0]?.id ?? '');
    }
  }, [productId, state.products]);

  const selectedProduct = useMemo(
    () => state.products.find((item) => item.id === productId),
    [productId, state.products]
  );
  const correctionSourceSale = useMemo(
    () => state.sales.find((sale) => sale.id === correctionSourceSaleId) ?? null,
    [correctionSourceSaleId, state.sales]
  );
  const saleTotal = selectedProduct ? selectedProduct.price * quantity : 0;
  const normalizedPaidAmount = toValidPaidAmount(paidAmountInput, saleTotal);
  const outstandingAmount = Math.max(0, saleTotal - normalizedPaidAmount);
  const quantityOnHand = selectedProduct ? selectProductQuantityOnHand(state, selectedProduct.id) : 0;
  const metrics = useMemo(() => selectDashboardMetrics(state), [state]);
  const recentSales = useMemo(() => selectRecentSales(state).slice(0, 6), [state]);

  useEffect(() => {
    const incomingCorrectionId = location.state?.correctionSourceSaleId;

    if (!incomingCorrectionId) {
      return;
    }

    const sourceSale = state.sales.find((sale) => sale.id === incomingCorrectionId);
    if (!sourceSale) {
      return;
    }

    setCustomerId(sourceSale.customerId);
    setProductId(sourceSale.productId);
    setQuantityInput(String(sourceSale.quantity));
    setPaymentMethod(sourceSale.paymentMethod);
    setPaidAmountInput(String(sourceSale.paidAmount));
    setCorrectionSourceSaleId(sourceSale.id);
    history.replace('/sales');
  }, [history, location.state, state.sales]);

  const handleSubmit = () => {
    if (!canRecordSale) {
      setFormMessage('Add at least one customer and one inventory item before recording a sale.');
      return;
    }

    if (!selectedProduct) {
      setFormMessage('Select an item before recording the sale.');
      return;
    }

    const result = addSale({
      customerId,
      productId,
      quantity,
      paymentMethod,
      paidAmount: normalizedPaidAmount,
      correctionOfSaleId: correctionSourceSaleId || undefined,
    });

    if (!result.ok) {
      setFormMessage(result.message);
      return;
    }

    setFormMessage('');
    setSaleSuccessMessage(`Sale recorded and invoice created for ${formatCurrency(saleTotal, currency)}.`);
    setLatestReceipt(result.receipt);

    if (result.lowStockAlert) {
      const { name, quantity: alertQuantity, reorderLevel } = result.lowStockAlert;
      const message =
        alertQuantity < reorderLevel
          ? `Low stock alert: ${name} is below reorder level. Only ${alertQuantity} left.`
          : `Low stock alert: ${name} has reached its reorder level at ${alertQuantity} left.`;

      setLowStockMessage(message);
      setShowLowStockToast(true);
    }

    setQuantityInput('1');
    setPaidAmountInput('');
    setCorrectionSourceSaleId('');
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
            {canRecordSale ? (
              <div className="form-grid">
                {correctionSourceSale ? (
                  <div className="selected-product">
                    <div>
                      <p className="muted-label">Correction mode</p>
                      <h3>Correcting invoice {correctionSourceSale.invoiceNumber}</h3>
                      <p className="muted-label">
                        This correction invoice will stay linked to the reversed original for audit history.
                      </p>
                    </div>
                    <IonButton
                      fill="clear"
                      color="medium"
                      onClick={() => {
                        setCorrectionSourceSaleId('');
                        setPaidAmountInput('');
                      }}
                    >
                      Clear
                    </IonButton>
                  </div>
                ) : null}

                {selectedProduct ? (
                  <div className="selected-product">
                    <img className="product-hero" src={selectedProduct.image} alt={selectedProduct.name} />
                    <div>
                      <p className="muted-label">Selected item</p>
                      <h3>{selectedProduct.name}</h3>
                      <p className="muted-label">
                        {selectedProduct.inventoryId} • {quantityOnHand} left in stock • {formatCurrency(selectedProduct.price, currency)} each
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
                        {product.inventoryId} · {product.name} ({selectProductQuantityOnHand(state, product.id)} left)
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
                      inputmode="numeric"
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
                    inputmode="decimal"
                    min={0}
                    max={saleTotal}
                    value={paidAmountInput}
                    helperText={`Leave blank to mark ${formatCurrency(saleTotal, currency)} as fully paid.`}
                    onIonInput={(event) => {
                      setPaidAmountInput(event.detail.value ?? '');
                    }}
                  />
                </IonItem>

                <div className="sale-summary">
                  <div>
                    <p className="muted-label">Sale total</p>
                    <h3>{formatCurrency(saleTotal, currency)}</h3>
                  </div>
                  <div>
                    <p className="muted-label">Outstanding after sale</p>
                    <h3>{formatCurrency(outstandingAmount, currency)}</h3>
                  </div>
                </div>

                <IonButton expand="block" onClick={handleSubmit}>
                  Record Sale and Create Invoice
                </IonButton>
                {formMessage ? <p className="form-message">{formMessage}</p> : null}
              </div>
            ) : (
              <EmptyState
                eyebrow="Sales setup"
                title="Recordings unlock once your shop basics are ready"
                message="Add inventory items and at least one customer first, then each sale will create an invoice, update stock movements, customer ledger balances, and the dashboard automatically."
              />
            )}
          </SectionCard>

          {latestReceipt ? (
            <SectionCard title="Latest receipt" subtitle="Review the transaction details immediately after recording a sale.">
              <div className="list-block">
                <div className="list-row">
                  <div>
                    <strong>Receipt ID</strong>
                    <p>{latestReceipt.receiptId}</p>
                  </div>
                  <div className="right-meta">
                    <strong>{formatReceiptDate(latestReceipt.createdAt)}</strong>
                    <p>Date</p>
                  </div>
                </div>
                <div className="list-row">
                  <div>
                    <strong>Customer</strong>
                    <p>{latestReceipt.customerName}</p>
                  </div>
                  <div className="right-meta">
                    <strong>{latestReceipt.clientId}</strong>
                    <p>Client ID</p>
                  </div>
                </div>
                <div className="list-row">
                  <div>
                    <strong>Product</strong>
                    <p>{latestReceipt.productName}</p>
                  </div>
                  <div className="right-meta">
                    <strong>{latestReceipt.inventoryId}</strong>
                    <p>Inventory ID</p>
                  </div>
                </div>
                <div className="list-row">
                  <div>
                    <strong>Quantity</strong>
                    <p>{latestReceipt.quantity} units</p>
                  </div>
                  <div className="right-meta">
                    <strong>{formatCurrency(latestReceipt.unitPrice, currency)}</strong>
                    <p>Unit Price</p>
                  </div>
                </div>
                <div className="list-row">
                  <div>
                    <strong>Total</strong>
                    <p>{formatCurrency(latestReceipt.totalAmount, currency)}</p>
                  </div>
                  <div className="right-meta">
                    <strong>{latestReceipt.paymentMethod}</strong>
                    <p>Payment Method</p>
                  </div>
                </div>
                <div className="list-row">
                  <div>
                    <strong>Amount Paid</strong>
                    <p>{formatCurrency(latestReceipt.amountPaid, currency)}</p>
                  </div>
                  <div className="right-meta">
                    <strong className={latestReceipt.balanceRemaining > 0 ? 'danger-text' : 'success-text'}>
                      {latestReceipt.balanceRemaining > 0 ? formatCurrency(latestReceipt.balanceRemaining, currency) : 'Paid'}
                    </strong>
                    <p>Balance Remaining</p>
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Payment mix today" subtitle="These totals derive from today's payment-received ledger entries.">
            <div className="dual-stat">
              <div>
                <p className="muted-label">Cash</p>
                <h3>{formatCurrency(metrics.cashInHand, currency)}</h3>
              </div>
              <div>
                <p className="muted-label">Mobile money</p>
                <h3>{formatCurrency(metrics.mobileMoneyReceived, currency)}</h3>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Recent invoices" subtitle="Each recorded sale creates an invoice record that feeds the dashboard automatically.">
            {recentSales.length === 0 ? (
              <EmptyState
                eyebrow="No invoices yet"
                title="Your first recorded sale will appear here as an invoice"
                message="As soon as a teammate records a sale, this feed becomes a quick invoice trail for who bought what, how they paid, and how much is still outstanding."
              />
            ) : (
              <div className="list-block">
                {recentSales.map((sale) => {
                  const customer = state.customers.find((item) => item.id === sale.customerId);
                  const product = state.products.find((item) => item.id === sale.productId);
                  const balanceLeft = selectSaleBalanceRemaining(sale);
                  const invoiceStatus = selectSaleStatusDisplay(sale);

                  return (
                    <div className="list-row" key={sale.id}>
                      <div className="item-main">
                        <img className="product-thumb" src={product?.image} alt={product?.name ?? 'Item'} />
                        <div>
                          <strong>{customer?.name ?? 'Recorded customer'}</strong>
                          <p className="code-label">
                            {sale.invoiceNumber} · {(customer?.clientId ?? 'CLT-UNK')} · {(product?.inventoryId ?? 'INV-UNK')}
                          </p>
                          <p>
                            {product?.name ?? 'Recorded item'} • {sale.quantity} units • {sale.paymentMethod} • {formatRelativeDate(sale.createdAt)}
                          </p>
                          <p className="sale-meta">
                            {sale.status === 'Reversed'
                              ? `Reversed${sale.reversalReason ? ` • ${sale.reversalReason}` : ''}`
                              : `Paid now ${formatCurrency(sale.paidAmount, currency)} • Balance left ${formatCurrency(balanceLeft, currency)}`}
                          </p>
                        </div>
                      </div>
                      <div className="right-meta">
                        <strong className={invoiceStatus.tone === 'success' ? 'success-text' : invoiceStatus.tone === 'warning' ? 'warning-text' : 'danger-text'}>
                          {invoiceStatus.label}
                        </strong>
                        <p>{formatCurrency(sale.totalAmount, currency)}</p>
                        <IonButton fill="clear" size="small" onClick={() => history.push(`/sales/${sale.id}`)}>
                          Open
                        </IonButton>
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
        isOpen={saleSuccessMessage !== ''}
        message={saleSuccessMessage}
        duration={1800}
        color="success"
        position="top"
        onDidDismiss={() => setSaleSuccessMessage('')}
      />
      <IonToast
        isOpen={showLowStockToast}
        message={lowStockMessage}
        duration={2200}
        color="warning"
        position="top"
        onDidDismiss={() => {
          setShowLowStockToast(false);
          setLowStockMessage('');
        }}
      />
    </IonPage>
  );
};

export default SalesPage;
