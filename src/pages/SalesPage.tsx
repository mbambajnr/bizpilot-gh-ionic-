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
  IonModal,
  IonButtons,
  IonNote,
  IonToolbar,
  IonTitle,
  IonSearchbar,
  IonRefresher,
  IonRefresherContent,
  IonIcon,
} from '@ionic/react';
import { useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { chevronDownCircleOutline, documentText } from 'ionicons/icons';

import EmptyState from '../components/EmptyState';
import SectionCard from '../components/SectionCard';
import SearchablePicker, { PickerItem } from '../components/SearchablePicker';
import { useBusiness } from '../context/BusinessContext';
import type { NewSaleLineItemInput } from '../utils/businessLogic';
import type { PaymentMethod } from '../data/seedBusiness';
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
  id: string;
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
  paymentReference?: string;
};

const WALK_IN_CUSTOMER_NAME = 'Walk-in customer';
const WALK_IN_CUSTOMER_PICKER_ID = '__walk_in_customer__';

const SalesPage: React.FC = () => {
  const { state, addSale, addCustomer, convertQuotationToSale, hasPermission } = useBusiness();
  const history = useHistory();
  const location = useLocation<{ correctionSourceSaleId?: string } | undefined>();
  const activeCustomers = useMemo(
    () => state.customers.filter((customer) => customer.status !== 'terminated'),
    [state.customers]
  );
  const [customerId, setCustomerId] = useState(activeCustomers[0]?.id ?? '');
  const [saleItems, setSaleItems] = useState<NewSaleLineItemInput[]>([
    { productId: state.products[0]?.id ?? '', quantity: 1 }
  ]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [correctionSourceSaleId, setCorrectionSourceSaleId] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [saleSuccessMessage, setSaleSuccessMessage] = useState('');
  const [lowStockMessage, setLowStockMessage] = useState('');
  const [latestReceipt, setLatestReceipt] = useState<ReceiptView | null>(null);
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showProductPickerIndex, setShowProductPickerIndex] = useState<number | null>(null);
  const [showQuotationPicker, setShowQuotationPicker] = useState(false);
  const [activeQuotationId, setActiveQuotationId] = useState('');
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [conversionMessage, setConversionMessage] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [latestConversionReceipts, setLatestConversionReceipts] = useState<any[]>([]);
  const [pendingWalkInSelection, setPendingWalkInSelection] = useState(false);
  const hasCustomers = activeCustomers.length > 0;
  const hasProducts = state.products.length > 0;
  const canCreateSales = hasPermission('sales.create');
  const canConvertQuotations = hasPermission('quotations.convert');
  const canCreateCustomers = hasPermission('customers.create');
  const canUseDocumentPack =
    hasPermission('invoices.print') ||
    hasPermission('invoices.export_pdf') ||
    hasPermission('quotations.print') ||
    hasPermission('quotations.export_pdf');
  const canViewInvoices = hasPermission('invoices.view');
  const canRecordSale = hasProducts && canCreateSales;
  const currency = state.businessProfile.currency;

  const walkInCustomer = useMemo(
    () =>
      activeCustomers.find(
        (customer) => customer.name.trim().toLowerCase() === WALK_IN_CUSTOMER_NAME.toLowerCase()
      ) ?? null,
    [activeCustomers]
  );

  useEffect(() => {
    if (!customerId && activeCustomers.length > 0) {
      setCustomerId(activeCustomers[0].id);
    }
  }, [activeCustomers, customerId]);

  useEffect(() => {
    if (customerId && activeCustomers.some((customer) => customer.id === customerId)) {
      return;
    }

    setCustomerId(activeCustomers[0]?.id ?? '');
  }, [activeCustomers, customerId]);

  useEffect(() => {
    if (!pendingWalkInSelection || !walkInCustomer) {
      return;
    }

    setCustomerId(walkInCustomer.id);
    setPendingWalkInSelection(false);
    setShowCustomerPicker(false);
  }, [pendingWalkInSelection, walkInCustomer]);

  useEffect(() => {
    if (saleItems.length === 0 && state.products.length > 0) {
      setSaleItems([{ productId: state.products[0].id, quantity: 1 }]);
    }
  }, [state.products, saleItems]);

  const addLineItem = () => {
    setSaleItems([...saleItems, { productId: state.products[0]?.id || '', quantity: 1 }]);
  };

  const updateLineItem = (index: number, updates: Partial<NewSaleLineItemInput>) => {
    const next = [...saleItems];
    next[index] = { ...next[index], ...updates };
    setSaleItems(next);
  };

  const removeLineItem = (index: number) => {
    if (saleItems.length <= 1) return;
    setSaleItems(saleItems.filter((_, i) => i !== index));
  };

  const saleTotal = useMemo(() => {
    return saleItems.reduce((acc, item) => {
      const p = state.products.find(prod => prod.id === item.productId);
      return acc + (p ? p.price * item.quantity : 0);
    }, 0);
  }, [saleItems, state.products]);

  const correctionSourceSale = useMemo(
    () => state.sales.find((sale) => sale.id === correctionSourceSaleId) ?? null,
    [correctionSourceSaleId, state.sales]
  );
  const normalizedPaidAmount = toValidPaidAmount(paidAmountInput, saleTotal);
  const outstandingAmount = Math.max(0, saleTotal - normalizedPaidAmount);
  const selectedCustomer = useMemo(
    () => activeCustomers.find((c) => c.id === customerId) ?? null,
    [activeCustomers, customerId]
  );

  const customerQuotations = useMemo(
    () => state.quotations.filter((q) => q.customerId === customerId && q.status === 'Draft'),
    [customerId, state.quotations]
  );

  const activeQuotation = useMemo(
    () => state.quotations.find((q) => q.id === activeQuotationId) ?? null,
    [activeQuotationId, state.quotations]
  );

  const quotationPickerItems: PickerItem[] = useMemo(
    () =>
      customerQuotations.map((q) => ({
        id: q.id,
        title: `${q.quotationNumber} (${formatCurrency(q.totalAmount, currency)})`,
        subtitle: formatReceiptDate(q.createdAt),
      })),
    [customerQuotations, currency]
  );

  const customerPickerItems = useMemo<PickerItem[]>(
    () => {
      const baseItems = state.customers
        .filter((customer) => customer.status !== 'terminated')
        .filter((customer) => customer.id !== walkInCustomer?.id)
        .map((customer) => ({
          id: customer.id,
          title: customer.name,
          subtitle: customer.clientId,
          meta: customer.phone || customer.whatsapp || 'No phone',
        }));

      const walkInItem: PickerItem = walkInCustomer
        ? {
            id: walkInCustomer.id,
            title: walkInCustomer.name,
            subtitle: walkInCustomer.clientId,
            meta: 'Default counter-sale buyer',
          }
        : {
            id: WALK_IN_CUSTOMER_PICKER_ID,
            title: WALK_IN_CUSTOMER_NAME,
            subtitle: 'Create and use for unregistered buyers',
            meta: 'Recommended for counter sales',
          };

      return [walkInItem, ...baseItems];
    },
    [state.customers, walkInCustomer]
  );

  const productPickerItems = useMemo<PickerItem[]>(
    () => state.products.map((p) => ({
      id: p.id,
      title: p.name,
      subtitle: p.inventoryId,
      meta: `${selectProductQuantityOnHand(state, p.id)} left`,
      image: p.image,
    })),
    [state]
  );
  
  const metrics = useMemo(() => selectDashboardMetrics(state), [state]);
  const recentSales = useMemo(() => {
    const all = selectRecentSales(state);
    if (!invoiceSearchTerm.trim()) return all.slice(0, 8);
    const lower = invoiceSearchTerm.toLowerCase();
    return all.filter((sale) => {
      const customer = state.customers.find((c) => c.id === sale.customerId);
      const hasMatchingProduct = sale.items?.some(item => 
        item.productName.toLowerCase().includes(lower)
      );
      return (
        sale.invoiceNumber.toLowerCase().includes(lower) ||
        sale.receiptId.toLowerCase().includes(lower) ||
        (customer && customer.name.toLowerCase().includes(lower)) ||
        hasMatchingProduct
      );
    });
  }, [state, invoiceSearchTerm]);

  useEffect(() => {
    const params = new URLSearchParams(history.location.search);
    const incomingCorrectionId = params.get('correctionSourceSaleId') || location.state?.correctionSourceSaleId;

    if (!incomingCorrectionId) {
      return;
    }

    const sourceSale = state.sales.find((sale) => sale.id === incomingCorrectionId);
    if (!sourceSale) {
      return;
    }

    setCustomerId(sourceSale.customerId);
    setSaleItems(sourceSale.items.map(i => ({ productId: i.productId, quantity: i.quantity })));
    setPaymentMethod(sourceSale.paymentMethod);
    setPaidAmountInput(String(sourceSale.paidAmount));
    setCorrectionSourceSaleId(sourceSale.id);
    history.replace('/sales');
  }, [history, location.state, state.sales, history.location.search]);

  const handleSubmit = (autoPrint = false) => {
    if (!canCreateSales) {
      setFormMessage('This role can view sales but cannot record a new sale.');
      return;
    }

    if (!canRecordSale) {
      setFormMessage('Add at least one inventory item before recording a sale.');
      return;
    }

    if (!customerId) {
      setFormMessage('Select a buyer first. Use Walk-in customer for unregistered counter sales.');
      return;
    }

    if (saleItems.some(i => !i.productId || i.quantity <=0)) {
      setFormMessage('Ensure all items have a valid product and quantity.');
      return;
    }

    const result = addSale({
      customerId,
      items: saleItems,
      paymentMethod,
      paidAmount: normalizedPaidAmount,
      paymentReference: paymentReference.trim() || undefined,
      correctionOfSaleId: correctionSourceSaleId || undefined,
      createdAt: saleDate ? new Date(saleDate).toISOString() : undefined,
    });

    if (!result.ok) {
      setFormMessage(result.message);
      return;
    }

    setFormMessage('');
    setSaleSuccessMessage(`Sale recorded and invoice created for ${formatCurrency(saleTotal, currency)}.`);
    setLatestReceipt(result.receipt);

    setLowStockMessage('');

    if (autoPrint && result.receipt) {
      history.push(`/sales/${result.receipt.id}`);
      setTimeout(() => window.print(), 800);
    }

    setSaleItems([{ productId: state.products[0]?.id || '', quantity: 1 }]);
    setPaidAmountInput('');
    setPaymentReference('');
    setCorrectionSourceSaleId('');
  };

  const handleConvertQuotation = () => {
    if (!canConvertQuotations) {
      setFormMessage('This role is not allowed to convert quotations into invoices.');
      return;
    }

    if (!activeQuotation) return;

    const result = convertQuotationToSale({
      quotationId: activeQuotation.id,
      paymentMethod,
      amountPaid: toValidPaidAmount(paidAmountInput, activeQuotation.totalAmount),
    });

    if (!result.ok) {
      setFormMessage(result.message);
      return;
    }

    setConversionMessage(`${result.quotationNumber} converted to invoices successfully.`);
    setLatestConversionReceipts(result.receipts);
    setShowConversionModal(false);
    setActiveQuotationId('');
    setPaidAmountInput('');
    setFormMessage('');
  };

  const handleCreateWalkInCustomer = () => {
    if (!canCreateCustomers) {
      setFormMessage('This role cannot create the default Walk-in customer record.');
      return;
    }

    if (walkInCustomer) {
      setCustomerId(walkInCustomer.id);
      setFormMessage('Walk-in customer selected. You can now record this counter sale.');
      return;
    }

    const result = addCustomer({
      name: WALK_IN_CUSTOMER_NAME,
      phone: '',
      whatsapp: '',
      email: '',
      channel: 'Counter sale',
    });

    if (!result.ok) {
      setFormMessage(result.message);
      return;
    }

    setPendingWalkInSelection(true);
    setFormMessage('Walk-in customer created. You can now record counter sales with that customer record.');
  };

    const handleRefresh = (event: CustomEvent) => {
    setTimeout(() => {
      event.detail.complete();
    }, 1500);
  };

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Sales</IonTitle>
          {canUseDocumentPack ? (
            <IonButtons slot="end">
              <IonButton onClick={() => history.push('/export/batch')}>
                <IonIcon slot="icon-only" icon={documentText} />
              </IonButton>
            </IonButtons>
          ) : null}
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent 
            pullingIcon={chevronDownCircleOutline}
            refreshingSpinner="circles"
          />
        </IonRefresher>
        <div className="page-shell" data-testid="sales-page">
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

                <div className="dual-stat">
                  <div className="picker-container">
                    <p className="muted-label">Buyer</p>
                    <IonButton 
                      expand="block" 
                      fill="outline" 
                      onClick={() => setShowCustomerPicker(true)}
                    >
                      {selectedCustomer ? selectedCustomer.name : 'Select Customer'}
                    </IonButton>
                  </div>

                  {customerQuotations.length > 0 && canConvertQuotations && !correctionSourceSale && (
                    <div className="picker-container">
                       <p className="muted-label">Quotes Available</p>
                       <IonButton 
                         expand="block" 
                         fill="solid" 
                         color="warning"
                         onClick={() => setShowQuotationPicker(true)}
                         data-testid="load-quote-btn"
                       >
                         Load from {customerQuotations.length} quotes
                       </IonButton>
                    </div>
                  )}
                </div>

                <div className="sale-items-list" style={{ marginTop: '24px' }}>
                  <p className="muted-label" style={{ marginBottom: '12px' }}>Items Purchased</p>
                  {saleItems.map((item, index) => {
                    const product = state.products.find(p => p.id === item.productId);
                    return (
                      <div key={index} className="sale-item-row" style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 80px 40px', 
                        gap: '12px', 
                        alignItems: 'end',
                        marginBottom: '16px',
                        padding: '12px',
                        background: 'rgba(0,0,0,0.02)',
                        borderRadius: '8px'
                      }}>
                        <div className="picker-container">
                          <IonButton 
                            expand="block" 
                            fill="outline" 
                            size="small"
                            onClick={() => setShowProductPickerIndex(index)}
                            style={{ textAlign: 'left', '--padding-start': '8px' }}
                          >
                            {product ? product.name : 'Select Item'}
                          </IonButton>
                        </div>
                        <div className="input-container">
                           <IonInput
                             type="number"
                             value={String(item.quantity)}
                             onIonInput={(e) => updateLineItem(index, { quantity: toPositiveInteger(e.detail.value ?? '1', 1) })}
                             className="app-input"
                             style={{ textAlign: 'center' }}
                           />
                        </div>
                        <IonButton 
                          fill="clear" 
                          color="danger" 
                          onClick={() => removeLineItem(index)}
                          disabled={saleItems.length <= 1}
                        >
                          ×
                        </IonButton>
                      </div>
                    );
                  })}
                  <IonButton fill="clear" color="primary" onClick={addLineItem} size="small">
                    + Add another item
                  </IonButton>
                </div>

                <SearchablePicker
                  isOpen={showCustomerPicker}
                  title="Select Customer"
                  placeholder="Search name, ID or phone..."
                  items={customerPickerItems}
                  onDismiss={() => setShowCustomerPicker(false)}
                  onSelect={(item) => {
                    if (item.id === WALK_IN_CUSTOMER_PICKER_ID) {
                      handleCreateWalkInCustomer();
                      return;
                    }

                    setCustomerId(item.id);
                  }}
                />

                <SearchablePicker
                  isOpen={showProductPickerIndex !== null}
                  title="Select Stock Item"
                  placeholder="Search name or ID..."
                  items={productPickerItems}
                  onDismiss={() => setShowProductPickerIndex(null)}
                  onSelect={(item) => {
                    if (showProductPickerIndex !== null) {
                      updateLineItem(showProductPickerIndex, { productId: item.id });
                    }
                    setShowProductPickerIndex(null);
                  }}
                />

                <SearchablePicker
                  isOpen={showQuotationPicker}
                  title={`Quotes for ${selectedCustomer?.name}`}
                  placeholder="Select a quote to convert..."
                  items={quotationPickerItems}
                  onDismiss={() => setShowQuotationPicker(false)}
                  onSelect={(item) => {
                    setActiveQuotationId(item.id);
                    setShowQuotationPicker(false);
                    setShowConversionModal(true);
                  }}
                />

                <IonModal isOpen={showConversionModal} onDidDismiss={() => setShowConversionModal(false)}>
                  <IonHeader translucent>
                    <IonToolbar>
                      <IonTitle>Convert Quote</IonTitle>
                      <IonButtons slot="end">
                        <IonButton onClick={() => setShowConversionModal(false)}>Cancel</IonButton>
                      </IonButtons>
                    </IonToolbar>
                  </IonHeader>
                  <IonContent className="ion-padding">
                    {activeQuotation ? (
                      <div className="form-grid">
                        <SectionCard title="Conversion Payment" subtitle={`Confirm payments for ${activeQuotation.quotationNumber}. Total value is ${formatCurrency(activeQuotation.totalAmount, currency)}.`}>
                          <div className="sale-summary">
                            <div>
                                <p className="muted-label">Quoted Total</p>
                                <h3>{formatCurrency(activeQuotation.totalAmount, currency)}</h3>
                            </div>
                            <div>
                                <p className="muted-label">Selected Items</p>
                                <h3>{activeQuotation.items.length} lines</h3>
                            </div>
                          </div>

                          <IonItem lines="none" className="app-item" style={{ marginTop: '16px' }}>
                            <IonLabel position="stacked">Payment Method</IonLabel>
                            <IonSelect 
                              value={paymentMethod} 
                              onIonChange={(e) => setPaymentMethod(e.detail.value)}
                              interface="popover"
                            >
                                <IonSelectOption value="Cash">Cash</IonSelectOption>
                                <IonSelectOption value="Mobile Money">Mobile Money</IonSelectOption>
                                <IonSelectOption value="Bank Account">Bank Account</IonSelectOption>
                            </IonSelect>
                          </IonItem>

                          <IonItem lines="none" className="app-item">
                            <IonLabel position="stacked">Amount Paid Now ({currency})</IonLabel>
                            <IonInput
                              type="number"
                              placeholder="0.00"
                              value={paidAmountInput}
                              onIonInput={(e) => setPaidAmountInput(e.detail.value ?? '')}
                            />
                          </IonItem>
                          <IonNote color="medium" style={{ padding: '0 8px' }}>
                            Remaining balance will be added to the customer's ledger automatically.
                          </IonNote>
                        </SectionCard>
                        
                        <IonButton expand="block" onClick={handleConvertQuotation}>
                          Confirm & Generate Bulk Invoices
                        </IonButton>
                      </div>
                    ) : null}
                  </IonContent>
                </IonModal>

                <div className="dual-stat">
                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">Payment method</IonLabel>
                    <IonSelect data-testid="payment-method-select" value={paymentMethod} onIonChange={(event) => setPaymentMethod(event.detail.value)} interface="popover">
                      <IonSelectOption value="Cash">Cash</IonSelectOption>
                      <IonSelectOption value="Mobile Money">Mobile Money</IonSelectOption>
                      <IonSelectOption value="Bank Account">Bank Account</IonSelectOption>
                    </IonSelect>
                  </IonItem>

                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">Sale Date (Optional)</IonLabel>
                    <IonInput
                      type="date"
                      value={saleDate}
                      onIonInput={(e) => setSaleDate(e.detail.value ?? '')}
                    />
                  </IonItem>
                </div>

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Amount paid now</IonLabel>
                  <IonInput
                    data-testid="paid-amount-input"
                    type="number"
                    inputmode="decimal"
                    min={0}
                    max={saleTotal}
                    value={paidAmountInput}
                    helperText={`Total value: ${formatCurrency(saleTotal, currency)}`}
                    onIonInput={(event) => {
                      setPaidAmountInput(event.detail.value ?? '');
                    }}
                  />
                </IonItem>

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Payment Reference (e.g. MoMo, bank, or cash note)</IonLabel>
                  <IonInput
                    placeholder="Optional reference number"
                    value={paymentReference}
                    onIonInput={(event) => setPaymentReference(event.detail.value ?? '')}
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

                <div className="button-group">
                  <IonButton data-testid="record-sale-button" expand="block" fill="solid" onClick={() => handleSubmit(false)}>
                    Record Sale
                  </IonButton>
                  <IonButton data-testid="create-sale-button" expand="block" fill="outline" onClick={() => handleSubmit(true)}>
                    Create Sale & Print
                  </IonButton>
                </div>
                {formMessage ? <p className="form-message">{formMessage}</p> : null}
              </div>
            ) : (
              <div className="form-grid">
                <EmptyState
                  eyebrow="Sales setup"
                  title="Recordings unlock once your shop basics are ready"
                  message="Add at least one inventory item before recording a sale. Once stock is ready, you can choose a registered buyer or use Walk-in customer for counter sales."
                />
                <div className="button-group">
                  {!hasProducts ? (
                    <IonButton expand="block" fill="solid" onClick={() => history.push('/inventory')}>
                      Add Inventory Item
                    </IonButton>
                  ) : null}
                  {hasProducts && !canCreateSales ? (
                    <EmptyState
                      eyebrow="View-only sales access"
                      title="This role cannot create new sales."
                      message="An admin can grant sales creation if this employee should record invoices from this workspace."
                    />
                  ) : null}
                  {!hasCustomers && hasProducts && canCreateCustomers ? (
                    <IonButton expand="block" fill="outline" onClick={handleCreateWalkInCustomer}>
                      Use Walk-in Customer
                    </IonButton>
                  ) : null}
                </div>
                {formMessage ? <p className="form-message">{formMessage}</p> : null}
              </div>
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
                    <strong>Items</strong>
                    <p>{latestReceipt.productName}</p>
                  </div>
                  <div className="right-meta">
                    <strong>{formatCurrency(latestReceipt.totalAmount, currency)}</strong>
                    <p>Total</p>
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
                    <p>Balance</p>
                  </div>
                </div>
                <div className="list-row" style={{ marginTop: '12px', padding: '0', border: 'none' }}>
                  {canViewInvoices ? (
                    <IonButton 
                      expand="block" 
                      fill="solid" 
                      color="primary" 
                      style={{ width: '100%' }}
                      onClick={() => history.push(`/sales/${latestReceipt.id}`)}
                    >
                      Open Full Invoice & Waybill
                    </IonButton>
                  ) : null}
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
            <IonSearchbar 
              placeholder="Search invoices by number, customer, or product..." 
              value={invoiceSearchTerm}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onIonInput={(e: any) => setInvoiceSearchTerm(e.detail.value ?? '')}
              style={{ padding: '0 8px 16px 8px' }}
            />
            {recentSales.length === 0 ? (
              <EmptyState
                eyebrow="No invoices yet"
                title="Your first recorded sale will appear here as an invoice"
                message="As soon as a teammate records a sale, this feed becomes a quick invoice trail for who bought what, how they paid, and how much is still outstanding."
              />
            ) : (
              <div className="list-block" data-testid="recent-invoices-list">
                {recentSales.map((sale) => {
                  const customer = state.customers.find((item) => item.id === sale.customerId);
                  const balanceLeft = selectSaleBalanceRemaining(sale);
                  const invoiceStatus = selectSaleStatusDisplay(sale);

                  return (
                    <div className="list-row" key={sale.id}>
                      <div className="item-main">
                        <div>
                          <strong>{customer?.name ?? 'Recorded customer'}</strong>
                          <p className="code-label">
                            {sale.invoiceNumber} · {(customer?.clientId ?? 'CLT-UNK')}
                          </p>
                          <p>
                            {sale.items?.length || 1} line items • {sale.paymentMethod} • {formatRelativeDate(sale.createdAt)}
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
                        {canViewInvoices ? (
                          <IonButton fill="clear" size="small" onClick={() => history.push(`/sales/${sale.id}`)}>
                            Open
                          </IonButton>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
          {latestConversionReceipts.length > 0 && (
            <SectionCard title="Converted Invoices" subtitle={`Successfully converted ${latestConversionReceipts.length} items from the quotation.`}>
               <div className="list-block">
                  {latestConversionReceipts.map((receipt, idx) => (
                    <div className="selected-product" key={`${receipt.receiptId}-${idx}`} style={{ marginBottom: '12px' }}>
                       <div className="list-row" style={{ width: '100%', borderBottom: 'none' }}>
                          <div>
                            <strong style={{ display: 'block' }}>{receipt.productName}</strong>
                            <span className="code-label" style={{ display: 'block', margin: '4px 0' }}>{receipt.receiptId}</span>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                {receipt.quantity} units · {formatCurrency(receipt.totalAmount, currency)}
                            </span>
                          </div>
                          <div className="right-meta">
                             <IonButton fill="clear" color="primary" onClick={() => history.push(`/invoices/${receipt.receiptId}`)}>
                               View Detail
                             </IonButton>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
               <IonButton expand="block" fill="outline" color="medium" style={{ marginTop: '14px' }} onClick={() => setLatestConversionReceipts([])}>
                  Clear batch view
               </IonButton>
            </SectionCard>
          )}
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
        isOpen={!!lowStockMessage}
        message={lowStockMessage}
        duration={3000}
        onDidDismiss={() => {
          setLowStockMessage('');
        }}
        position="bottom"
        color="warning"
      />

      <IonToast
        isOpen={!!conversionMessage}
        message={conversionMessage}
        duration={4000}
        onDidDismiss={() => setConversionMessage('')}
        position="bottom"
        color="success"
      />
    </IonPage>
  );
};

export default SalesPage;
