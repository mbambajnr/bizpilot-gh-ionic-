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
import { useEffect, useMemo, useState } from 'react';

import EmptyState from '../components/EmptyState';
import SectionCard from '../components/SectionCard';
import { useBusiness } from '../context/BusinessContext';
import {
  selectCustomerBalance,
  selectCustomerLastPaymentLabel,
  selectCustomerLedgerEntries,
  selectCustomerSummaries,
  selectCustomerStatement,
  selectLedgerEntryDisplay,
  selectProductById,
  selectSaleBalanceRemaining,
  selectSaleStatusDisplay,
} from '../selectors/businessSelectors';
import { formatCurrency, formatReceiptDate } from '../utils/format';

const CustomersPage: React.FC = () => {
  const { state, addCustomer } = useBusiness();
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [channel, setChannel] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(state.customers[0]?.id ?? '');
  const [formMessage, setFormMessage] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [savedCustomerName, setSavedCustomerName] = useState('');
  const customerSummaries = useMemo(() => selectCustomerSummaries(state), [state]);
  const currency = state.businessProfile.currency;

  useEffect(() => {
    if (!state.customers.some((customer) => customer.id === selectedCustomerId)) {
      setSelectedCustomerId(state.customers[0]?.id ?? '');
    }
  }, [selectedCustomerId, state.customers]);

  const selectedCustomer = useMemo(
    () => state.customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [selectedCustomerId, state.customers]
  );

  const selectedCustomerSales = useMemo(() => {
    if (!selectedCustomer) {
      return [];
    }

    return state.sales
      .filter((sale) => sale.customerId === selectedCustomer.id)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [selectedCustomer, state.sales]);

  const selectedCustomerLedger = useMemo(() => {
    if (!selectedCustomer) {
      return [];
    }

    return selectCustomerLedgerEntries(state, selectedCustomer.id);
  }, [selectedCustomer, state]);
  const selectedCustomerStatement = useMemo(() => {
    if (!selectedCustomer) {
      return null;
    }

    return selectCustomerStatement(state, selectedCustomer.id);
  }, [selectedCustomer, state]);

  const handleAddCustomer = () => {
    const customerName = name.trim();

    if (!customerName) {
      setFormMessage('Enter a customer name before saving.');
      return;
    }

    const result = addCustomer({
      name: customerName,
      clientId,
      channel: channel.trim() || 'No action needed',
    });

    if (!result.ok) {
      setFormMessage(result.message);
      return;
    }

    setName('');
    setClientId('');
    setChannel('');
    setSavedCustomerName(customerName);
    setFormMessage('');
    setShowSuccessToast(true);
  };

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Customers</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <div className="page-shell">
          <SectionCard
            title="Add customer"
            subtitle="Create a customer profile so invoices, ledger entries, and follow-up status can be tied to the right buyer."
          >
            <div className="form-grid">
              <IonItem lines="none" className="app-item">
                <IonLabel position="stacked">Customer name</IonLabel>
                <IonInput
                  value={name}
                  placeholder="e.g. Adom Provision Store"
                  onIonInput={(event) => setName(event.detail.value ?? '')}
                />
              </IonItem>

              <IonItem lines="none" className="app-item">
                <IonLabel position="stacked">Client ID (optional)</IonLabel>
                <IonInput
                  value={clientId}
                  helperText="Leave blank to auto-generate one."
                  onIonInput={(event) => setClientId(event.detail.value ?? '')}
                />
              </IonItem>

              <IonItem lines="none" className="app-item">
                <IonLabel position="stacked">Follow-up channel</IonLabel>
                <IonInput
                  value={channel}
                  placeholder="e.g. WhatsApp follow-up"
                  helperText="Leave blank to use No action needed."
                  onIonInput={(event) => setChannel(event.detail.value ?? '')}
                />
              </IonItem>

              <IonButton expand="block" onClick={handleAddCustomer}>
                Save Customer
              </IonButton>
              {formMessage ? <p className="form-message">{formMessage}</p> : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Customer balances"
            subtitle="Outstanding balances now derive from customer ledger entries rather than stored balance fields."
          >
            {customerSummaries.length === 0 ? (
              <EmptyState
                eyebrow="No clients yet"
                title="Customer follow-up becomes visible after setup"
                message="Once clients are added, this page will show who owes, the latest payment signal, and which account needs a call or WhatsApp reminder."
              />
            ) : (
              <div className="list-block">
                {customerSummaries.map(({ customer, balance, lastPayment, accountStatus }) => (
                  <div
                    className="list-row"
                    key={customer.id}
                    onClick={() => setSelectedCustomerId(customer.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedCustomerId(customer.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div>
                      <strong>{customer.name}</strong>
                      <p className="code-label">Client ID: {customer.clientId}</p>
                      <p>Follow-up: {customer.channel}</p>
                      <p>Last payment: {lastPayment}</p>
                      <p>{selectedCustomerId === customer.id ? 'Viewing ledger and invoice history' : 'Tap to view ledger history'}</p>
                    </div>
                    <div className="right-meta">
                      <strong className={accountStatus.tone === 'success' ? 'success-text' : 'warning-text'}>
                        {accountStatus.label}
                      </strong>
                      <p>{balance === 0 ? accountStatus.helper : `${formatCurrency(balance, currency)} due`}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {selectedCustomer ? (
            <>
              <SectionCard
                title="Customer invoice history"
                subtitle="Review what this customer bought, how it was paid, and the current status of each invoice."
              >
                <div className="list-block">
                  <div className="list-row">
                    <div>
                      <strong>{selectedCustomer.name}</strong>
                      <p className="code-label">Client ID: {selectedCustomer.clientId}</p>
                      <p>Follow-up: {selectedCustomer.channel}</p>
                      <p>Last payment: {selectCustomerLastPaymentLabel(state, selectedCustomer.id)}</p>
                    </div>
                    <div className="right-meta">
                      <strong className={selectCustomerBalance(state, selectedCustomer.id) === 0 ? 'success-text' : 'danger-text'}>
                        {selectCustomerBalance(state, selectedCustomer.id) === 0
                          ? 'Paid'
                          : `${formatCurrency(selectCustomerBalance(state, selectedCustomer.id), currency)} due`}
                      </strong>
                      <p>Current balance</p>
                    </div>
                  </div>

                  {selectedCustomerSales.length === 0 ? (
                    <EmptyState
                      eyebrow="No transactions yet"
                      title="No transactions recorded yet for this customer."
                      message="Once a sale is recorded for this customer, the invoice history will appear here with payment and balance details."
                    />
                  ) : (
                    selectedCustomerSales.map((sale) => {
                      const product = selectProductById(state, sale.productId);
                      const invoiceStatus = selectSaleStatusDisplay(sale);
                      const balanceRemaining = selectSaleBalanceRemaining(sale);

                      return (
                        <div className="list-row" key={sale.id}>
                          <div>
                            <strong>{product?.name ?? 'Recorded item'}</strong>
                            <p className="code-label">{sale.invoiceNumber} • {sale.receiptId}</p>
                            <p>
                              {sale.quantity} units • {sale.paymentMethod} • {invoiceStatus.label}
                            </p>
                            <p>Recorded: {formatReceiptDate(sale.createdAt)}</p>
                            {sale.status === 'Reversed' && sale.reversalReason ? <p>Reason: {sale.reversalReason}</p> : null}
                          </div>
                          <div className="right-meta">
                            <strong className={invoiceStatus.tone === 'success' ? 'success-text' : invoiceStatus.tone === 'warning' ? 'warning-text' : 'danger-text'}>
                              {invoiceStatus.label}
                            </strong>
                            <p>Total: {formatCurrency(sale.totalAmount, currency)}</p>
                            <p>
                              {invoiceStatus.label === 'Reversed'
                                ? 'No longer active'
                                : balanceRemaining > 0
                                  ? `${formatCurrency(balanceRemaining, currency)} left`
                                  : 'Paid in full'}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Customer statement"
                subtitle="A plain-English receivables summary showing what increased or reduced this customer's balance."
              >
                <div className="list-block">
                  {selectedCustomerStatement ? (
                    <>
                      <div className="dual-stat">
                        <div>
                          <p className="muted-label">Opening balance</p>
                          <h3>{formatCurrency(selectedCustomerStatement.openingBalance, currency)}</h3>
                        </div>
                        <div>
                          <p className="muted-label">Closing balance</p>
                          <h3>{formatCurrency(selectedCustomerStatement.closingBalance, currency)}</h3>
                        </div>
                      </div>
                      <div className="triple-grid">
                        <div className="mini-stat">
                          <p className="muted-label">Invoices</p>
                          <h3>{formatCurrency(selectedCustomerStatement.invoiceCharges, currency)}</h3>
                        </div>
                        <div className="mini-stat">
                          <p className="muted-label">Payments</p>
                          <h3>{formatCurrency(selectedCustomerStatement.paymentsReceived, currency)}</h3>
                        </div>
                        <div className="mini-stat">
                          <p className="muted-label">Reversals</p>
                          <h3>{formatCurrency(selectedCustomerStatement.reversals, currency)}</h3>
                        </div>
                      </div>
                    </>
                  ) : null}

                  {selectedCustomerLedger.length === 0 ? (
                    <EmptyState
                      eyebrow="No ledger entries"
                      title="No receivables activity recorded yet."
                      message="Ledger entries appear automatically whenever an invoice is raised, money is received, or an invoice is reversed."
                    />
                  ) : (
                    selectedCustomerLedger.map((entry) => {
                      const entryDisplay = selectLedgerEntryDisplay(entry);
                      const relatedSale = entry.relatedSaleId
                        ? state.sales.find((sale) => sale.id === entry.relatedSaleId)
                        : null;
                      const relatedProduct = relatedSale ? selectProductById(state, relatedSale.productId) : null;

                      return (
                        <div className="list-row" key={entry.id}>
                          <div>
                            <strong>{entryDisplay.label}</strong>
                            <p className="code-label">
                              {entry.entryNumber}
                              {entry.referenceNumber ? ` • ${entry.referenceNumber}` : ''}
                            </p>
                            <p>{entryDisplay.helper}</p>
                            {relatedProduct ? <p>Item: {relatedProduct.name}</p> : null}
                            <p>{formatReceiptDate(entry.createdAt)}</p>
                          </div>
                          <div className="right-meta">
                            <strong className={entryDisplay.tone === 'warning' ? 'warning-text' : 'success-text'}>
                              {entry.amountDelta > 0 ? '+' : '-'}
                              {formatCurrency(Math.abs(entry.amountDelta), currency)}
                            </strong>
                            <p>{entryDisplay.amountLabel}</p>
                            <p>{entry.paymentMethod ?? 'Statement entry'}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </SectionCard>
            </>
          ) : null}
        </div>
      </IonContent>
      <IonToast
        isOpen={showSuccessToast}
        message={`${savedCustomerName} added successfully.`}
        duration={1800}
        color="success"
        position="top"
        onDidDismiss={() => setShowSuccessToast(false)}
      />
    </IonPage>
  );
};

export default CustomersPage;
