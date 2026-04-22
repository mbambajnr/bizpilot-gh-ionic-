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
  IonTitle,
  IonToast,
  IonToolbar,
  IonSearchbar,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/react';
import { chevronDownCircleOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';

import EmptyState from '../components/EmptyState';
import SectionCard from '../components/SectionCard';
import SearchablePicker, { PickerItem } from '../components/SearchablePicker';
import { useBusiness } from '../context/BusinessContext';
import type { PaymentMethod } from '../data/seedBusiness';
import { selectQuotationStatusDisplay } from '../selectors/businessSelectors';
import { formatCurrency, formatReceiptDate } from '../utils/format';
import { toPositiveInteger, toValidPaidAmount } from '../utils/salesMath';

type DraftLine = {
  id: string;
  productId: string;
  quantityInput: string;
};


const createDraftLine = (productId = ''): DraftLine => ({
  id: crypto.randomUUID(),
  productId,
  quantityInput: '1',
});

const QuotationsPage: React.FC = () => {
  const history = useHistory();
  const { state, addQuotation, convertQuotationToSale, hasPermission } = useBusiness();
  const canCreateQuotations = hasPermission('quotations.create');
  const canConvertQuotations = hasPermission('quotations.convert');
  const activeCustomers = useMemo(
    () => state.customers.filter((customer) => customer.status !== 'terminated'),
    [state.customers]
  );
  const [customerId, setCustomerId] = useState(activeCustomers[0]?.id ?? '');
  const [lines, setLines] = useState<DraftLine[]>([createDraftLine(state.products[0]?.id ?? '')]);
  const [formMessage, setFormMessage] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [latestQuotationNumber, setLatestQuotationNumber] = useState('');
  const [conversionMessage, setConversionMessage] = useState('');
  const [showConversionToast, setShowConversionToast] = useState(false);
  const [convertingQuotationId, setConvertingQuotationId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [amountPaidInput, setAmountPaidInput] = useState('');
  const [conversionFormMessage, setConversionFormMessage] = useState('');
  const [latestConversionReceipts, setLatestConversionReceipts] = useState<
    Array<{
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
    }>
  >([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [activePickingLineId, setActivePickingLineId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCustomers.some((customer) => customer.id === customerId)) {
      setCustomerId(activeCustomers[0]?.id ?? '');
    }
  }, [activeCustomers, customerId]);

  useEffect(() => {
    setLines((current) =>
      current.map((line, index) => {
        if (state.products.some((product) => product.id === line.productId)) {
          return line;
        }

        return {
          ...line,
          productId: index === 0 ? state.products[0]?.id ?? '' : '',
        };
      })
    );
  }, [state.products]);

  const selectedCustomer = useMemo(
    () => activeCustomers.find((customer) => customer.id === customerId) ?? null,
    [activeCustomers, customerId]
  );

  const quotationPreview = useMemo(() => {
    const items = lines
      .map((line) => {
        const product = state.products.find((item) => item.id === line.productId);
        const quantity = toPositiveInteger(line.quantityInput, 1);

        if (!product) {
          return null;
        }

        return {
          id: line.id,
          product,
          quantity,
          total: product.price * quantity,
        };
      })
      .filter(Boolean);

    return {
      items,
      totalAmount: items.reduce((sum, item) => sum + (item?.total ?? 0), 0),
    };
  }, [lines, state.products]);

  const activeQuotation = useMemo(
    () => state.quotations.find((quotation) => quotation.id === convertingQuotationId) ?? null,
    [convertingQuotationId, state.quotations]
  );
  const normalizedAmountPaid = toValidPaidAmount(amountPaidInput, activeQuotation?.totalAmount ?? 0);

  const handleLineChange = (lineId: string, updates: Partial<DraftLine>) => {
    setLines((current) => current.map((line) => (line.id === lineId ? { ...line, ...updates } : line)));
  };

  const handleAddLine = () => {
    setLines((current) => [...current, createDraftLine(state.products[0]?.id ?? '')]);
  };

  const handleRemoveLine = (lineId: string) => {
    setLines((current) => (current.length === 1 ? current : current.filter((line) => line.id !== lineId)));
  };

  const filteredQuotations = useMemo(() => {
    const all = [...state.quotations].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (!searchTerm.trim()) return all;
    const lower = searchTerm.toLowerCase();
    return all.filter((q) => {
      return q.quotationNumber.toLowerCase().includes(lower) || q.customerName.toLowerCase().includes(lower);
    });
  }, [state.quotations, searchTerm]);

  const customerPickerItems = useMemo<PickerItem[]>(
    () => activeCustomers.map((c) => ({
      id: c.id,
      title: c.name,
      subtitle: c.clientId,
      meta: c.phone || 'No phone',
    })),
    [activeCustomers]
  );

  const productPickerItems = useMemo<PickerItem[]>(
    () => state.products.map((p) => ({
      id: p.id,
      title: p.name,
      subtitle: p.inventoryId,
      meta: `${formatCurrency(p.price)}`,
      image: p.image,
    })),
    [state.products]
  );

  const handleCreateQuotation = () => {
    if (!canCreateQuotations) {
      setFormMessage('This role can view quotations but cannot create a new one.');
      return;
    }

    const result = addQuotation({
      customerId,
      items: lines
        .filter((line) => line.productId)
        .map((line) => ({
          productId: line.productId,
          quantity: toPositiveInteger(line.quantityInput, 1),
        })),
    });

    if (!result.ok) {
      setFormMessage(result.message);
      return;
    }

    const savedQuotation = state.quotations[0];
    const fallbackNumber = `QTN-${String(state.quotations.length + 1).padStart(3, '0')}`;

    setFormMessage('');
    setLatestQuotationNumber(savedQuotation?.quotationNumber ?? fallbackNumber);
    setShowSuccessToast(true);
    setLines([createDraftLine(state.products[0]?.id ?? '')]);
  };

  const handleStartConversion = (quotationId: string) => {
    if (!canConvertQuotations) {
      setConversionFormMessage('This role is not allowed to convert quotations.');
      return;
    }

    setConvertingQuotationId(quotationId);
    setPaymentMethod('Cash');
    setAmountPaidInput('');
    setConversionFormMessage('');
  };

  const handleConvertQuotation = () => {
    if (!canConvertQuotations) {
      setConversionFormMessage('This role is not allowed to convert quotations.');
      return;
    }

    if (!activeQuotation) {
      setConversionFormMessage('Choose a quotation to convert first.');
      return;
    }

    const result = convertQuotationToSale({
      quotationId: activeQuotation.id,
      paymentMethod,
      amountPaid: normalizedAmountPaid,
    });

    if (!result.ok) {
      setConversionFormMessage(result.message);
      return;
    }

    setLatestConversionReceipts(result.receipts);
    setConversionMessage(`${result.quotationNumber} converted to invoice successfully.`);
    setShowConversionToast(true);
    setConvertingQuotationId('');
    setAmountPaidInput('');
    setConversionFormMessage('');
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
          <IonTitle>Quotations</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent 
            pullingIcon={chevronDownCircleOutline}
            refreshingSpinner="circles"
          />
        </IonRefresher>
        <div className="page-shell">
          <SectionCard
            title="Create quotation"
            subtitle="Prepare a pre-sale document for a customer before recording the final invoice."
          >
            {!canCreateQuotations ? (
              <EmptyState
                eyebrow="View-only access"
                title="This role cannot create new quotations."
                message="Quotation history is still available below, but an admin must grant quotation creation before this employee can draft new quotes."
              />
            ) : activeCustomers.length === 0 || state.products.length === 0 ? (
              <EmptyState
                eyebrow="Quotation setup"
                title="Add customers and products first"
                message="Quotations need at least one active customer and one product so the app can calculate pricing correctly."
              />
            ) : (
              <div className="form-grid">
                <div className="picker-container">
                    <p className="muted-label">Client</p>
                    <IonButton 
                        expand="block" 
                        fill="outline" 
                        onClick={() => setShowCustomerPicker(true)}
                    >
                        {selectedCustomer ? selectedCustomer.name : 'Select Client'}
                    </IonButton>
                </div>

                <SearchablePicker
                    isOpen={showCustomerPicker}
                    title="Select Client"
                    placeholder="Search name, ID or phone..."
                    items={customerPickerItems}
                    onDismiss={() => setShowCustomerPicker(false)}
                    onSelect={(item) => setCustomerId(item.id)}
                />

                <SearchablePicker
                    isOpen={showProductPicker}
                    title="Select Product"
                    placeholder="Search name or ID..."
                    items={productPickerItems}
                    onDismiss={() => {
                        setShowProductPicker(false);
                        setActivePickingLineId(null);
                    }}
                    onSelect={(item) => {
                        if (activePickingLineId) {
                            handleLineChange(activePickingLineId, { productId: item.id });
                        }
                    }}
                />

                {lines.map((line, index) => {
                  const previewItem = quotationPreview.items.find((item) => item?.id === line.id) ?? null;

                  return (
                    <div className="selected-product" key={line.id}>
                      <div className="form-grid" style={{ flex: 1 }}>
                        <p className="muted-label">Item line {index + 1}</p>
                        <div className="picker-container">
                            <IonButton 
                                expand="block" 
                                fill="outline" 
                                onClick={() => {
                                    setActivePickingLineId(line.id);
                                    setShowProductPicker(true);
                                }}
                            >
                                {state.products.find(p => p.id === line.productId)?.name || 'Select Product'}
                            </IonButton>
                        </div>

                        <IonItem lines="none" className="app-item">
                          <IonLabel position="stacked">Quantity</IonLabel>
                          <IonInput
                            type="number"
                            min={1}
                            inputmode="numeric"
                            value={line.quantityInput}
                            onIonInput={(event) => handleLineChange(line.id, { quantityInput: event.detail.value ?? '1' })}
                          />
                        </IonItem>

                        {previewItem ? (
                          <div className="sale-summary">
                            <div>
                              <p className="muted-label">Unit price</p>
                              <h3>{formatCurrency(previewItem.product.price)}</h3>
                            </div>
                            <div>
                              <p className="muted-label">Line total</p>
                              <h3>{formatCurrency(previewItem.total)}</h3>
                            </div>
                          </div>
                        ) : null}

                        {lines.length > 1 ? (
                          <IonButton fill="clear" color="medium" onClick={() => handleRemoveLine(line.id)}>
                            Remove line
                          </IonButton>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                <IonButton expand="block" fill="outline" onClick={handleAddLine}>
                  Add another item
                </IonButton>

                <div className="sale-summary">
                  <div>
                    <p className="muted-label">Client</p>
                    <h3>{selectedCustomer?.name ?? 'Choose client'}</h3>
                  </div>
                  <div>
                    <p className="muted-label">Grand total</p>
                    <h3>{formatCurrency(quotationPreview.totalAmount)}</h3>
                  </div>
                </div>

                <IonButton expand="block" onClick={handleCreateQuotation}>
                  Save quotation
                </IonButton>
                {formMessage ? <p className="form-message">{formMessage}</p> : null}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Quotation history"
            subtitle="Recently created quotations stay in the app so you can review totals and line items before an invoice is confirmed."
          >
            <IonSearchbar 
              placeholder="Search by number or customer..." 
              value={searchTerm}
              onIonInput={(e) => setSearchTerm(e.detail.value ?? '')}
              style={{ padding: '0 8px 16px 8px' }}
            />
            {filteredQuotations.length === 0 ? (
              <EmptyState
                eyebrow={searchTerm ? "No matches" : "No quotations yet"}
                title={searchTerm ? `No results for "${searchTerm}"` : "No quotations created yet."}
                message={searchTerm ? "Try searching for a different name or number." : "Once you create a quotation, it will appear here with client details, line items, and the total value."}
              />
            ) : (
              <div className="list-block">
                {filteredQuotations.map((quotation) => {
                  const quotationStatus = selectQuotationStatusDisplay(quotation);

                  return (
                  <div className="selected-product" key={quotation.id}>
                    <div className="form-grid" style={{ flex: 1 }}>
                      <div className="list-row">
                        <div>
                          <strong>{quotation.customerName}</strong>
                          <p className="code-label">
                            {quotation.quotationNumber} · {quotation.clientId}
                          </p>
                          <p>{formatReceiptDate(quotation.createdAt)}</p>
                          {quotation.convertedAt ? <p>Converted: {formatReceiptDate(quotation.convertedAt)}</p> : null}
                        </div>
                        <div className="right-meta">
                          <strong>{formatCurrency(quotation.totalAmount)}</strong>
                          <p className={quotationStatus.tone === 'success' ? 'success-text' : 'warning-text'}>{quotationStatus.label}</p>
                        </div>
                      </div>

                      {quotation.items.map((item) => (
                        <div className="list-row" key={`${quotation.id}-${item.productId}`}>
                          <div>
                            <strong>{item.productName}</strong>
                            <p className="code-label">Inventory ID: {item.inventoryId}</p>
                            <p>{item.quantity} units</p>
                          </div>
                          <div className="right-meta">
                            <strong>{formatCurrency(item.total)}</strong>
                            <p>{formatCurrency(item.unitPrice)} each</p>
                          </div>
                        </div>
                      ))}

                      <div className="dual-stat">
                        {quotation.status === 'Draft' && canConvertQuotations && (
                          <IonButton expand="block" onClick={() => handleStartConversion(quotation.id)}>
                            Convert to Invoice
                          </IonButton>
                        )}
                        <IonButton fill="outline" expand="block" onClick={() => history.push(`/quotations/${quotation.id}`)}>
                          View Document
                        </IonButton>
                      </div>

                      {convertingQuotationId === quotation.id && canConvertQuotations ? (
                        <div className="form-grid">
                          <div className="sale-summary">
                            <div>
                              <p className="muted-label">Customer</p>
                              <h3>{quotation.customerName}</h3>
                            </div>
                            <div>
                              <p className="muted-label">Quotation total</p>
                              <h3>{formatCurrency(quotation.totalAmount)}</h3>
                            </div>
                          </div>

                          <IonItem lines="none" className="app-item">
                            <IonLabel position="stacked">Payment method</IonLabel>
                            <IonSelect
                              value={paymentMethod}
                              onIonChange={(event) => setPaymentMethod(event.detail.value)}
                              interface="popover"
                            >
                              <IonSelectOption value="Cash">Cash</IonSelectOption>
                              <IonSelectOption value="Mobile Money">Mobile Money</IonSelectOption>
                              <IonSelectOption value="Bank Account">Bank Account</IonSelectOption>
                            </IonSelect>
                          </IonItem>

                          <IonItem lines="none" className="app-item">
                            <IonLabel position="stacked">Amount paid now</IonLabel>
                            <IonInput
                              type="number"
                              inputmode="decimal"
                              min={0}
                              max={quotation.totalAmount}
                              helperText={`Leave blank to mark the converted invoice total of ${formatCurrency(quotation.totalAmount)} as fully paid.`}
                              value={amountPaidInput}
                              onIonInput={(event) => setAmountPaidInput(event.detail.value ?? '')}
                            />
                          </IonItem>

                          <div className="sale-summary">
                            <div>
                              <p className="muted-label">Paid now</p>
                              <h3>{formatCurrency(normalizedAmountPaid)}</h3>
                            </div>
                            <div>
                              <p className="muted-label">Balance after conversion</p>
                              <h3>{formatCurrency(Math.max(0, quotation.totalAmount - normalizedAmountPaid))}</h3>
                            </div>
                          </div>

                          <IonButton expand="block" onClick={handleConvertQuotation}>
                            Confirm conversion
                          </IonButton>
                          <IonButton
                            expand="block"
                            fill="clear"
                            color="medium"
                            onClick={() => {
                              setConvertingQuotationId('');
                              setAmountPaidInput('');
                              setConversionFormMessage('');
                            }}
                          >
                            Cancel
                          </IonButton>
                          {conversionFormMessage ? <p className="form-message">{conversionFormMessage}</p> : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {latestConversionReceipts.length > 0 ? (
            <SectionCard
              title="Latest converted invoices"
              subtitle="Each quotation line becomes an invoice record so stock, balances, and receipts stay aligned."
            >
              <div className="list-block">
                {latestConversionReceipts.map((receipt) => (
                  <div className="list-row" key={receipt.receiptId}>
                    <div>
                      <strong>{receipt.productName}</strong>
                      <p className="code-label">
                        {receipt.receiptId} · {receipt.inventoryId}
                      </p>
                      <p>
                        {receipt.quantity} units • {receipt.paymentMethod} • {formatReceiptDate(receipt.createdAt)}
                      </p>
                      <p>
                        Paid {formatCurrency(receipt.amountPaid)} • Remaining{' '}
                        {receipt.balanceRemaining > 0 ? formatCurrency(receipt.balanceRemaining) : 'Paid'}
                      </p>
                    </div>
                    <div className="right-meta">
                      <strong>{formatCurrency(receipt.totalAmount)}</strong>
                      <p>{receipt.clientId}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}
        </div>
      </IonContent>
      <IonToast
        isOpen={showSuccessToast}
        message={`${latestQuotationNumber} created successfully.`}
        duration={1800}
        color="success"
        position="top"
        onDidDismiss={() => setShowSuccessToast(false)}
      />
      <IonToast
        isOpen={showConversionToast}
        message={conversionMessage}
        duration={2200}
        color="success"
        position="top"
        onDidDismiss={() => setShowConversionToast(false)}
      />
    </IonPage>
  );
};

export default QuotationsPage;
