import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonModal,
  IonPage,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { shareSocialOutline } from 'ionicons/icons';
import { useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';

import EmptyState from '../components/EmptyState';
import SectionCard from '../components/SectionCard';
import { useBusiness } from '../context/BusinessContext';
import {
  selectActivityDisplay,
  selectCustomerLedgerEntries,
  selectLedgerEntryDisplay,
  selectProductMovements,
  selectSaleActivityEntries,
  selectSaleBalanceRemaining,
  selectSaleStatusDisplay,
  selectStockMovementDisplay,
} from '../selectors/businessSelectors';
import { formatCurrency, formatReceiptDate } from '../utils/format';

const InvoiceDetailPage: React.FC = () => {
  const { saleId } = useParams<{ saleId: string }>();
  const history = useHistory();
  const { state, reverseSale, hasPermission, currentUser } = useBusiness();
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const currency = state.businessProfile.currency;

  const sale = useMemo(() => state.sales.find((item) => item.id === saleId) ?? null, [saleId, state.sales]);
  const customer = useMemo(() => state.customers.find((item) => item.id === sale?.customerId) ?? null, [sale, state.customers]);
  const product = useMemo(() => state.products.find((item) => item.id === sale?.productId) ?? null, [sale, state.products]);
  const correctionOfSale = useMemo(
    () => state.sales.find((item) => item.id === sale?.correctionOfSaleId) ?? null,
    [sale, state.sales]
  );
  const correctedBySale = useMemo(
    () => state.sales.find((item) => item.id === sale?.correctedBySaleId) ?? null,
    [sale, state.sales]
  );
  const auditEvents = useMemo(() => (sale ? selectSaleActivityEntries(state, sale.id) : []), [sale, state]);
  const stockMovements = useMemo(() => (product ? selectProductMovements(state, product.id).filter((entry) => entry.relatedSaleId === saleId) : []), [product, saleId, state]);
  const ledgerEntries = useMemo(() => (customer ? selectCustomerLedgerEntries(state, customer.id).filter((entry) => entry.relatedSaleId === saleId) : []), [customer, saleId, state]);

  if (!sale) {
    return (
      <IonPage>
        <IonHeader translucent={true}>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/sales" />
            </IonButtons>
            <IonTitle>Invoice</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen={true}>
          <div className="page-shell">
            <SectionCard title="Invoice not found" subtitle="This invoice may have been removed from the current local session or the link is invalid.">
              <EmptyState
                eyebrow="Missing invoice"
                title="We could not find that invoice."
                message="Return to the sales list and open another invoice to continue."
              />
            </SectionCard>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const balanceRemaining = selectSaleBalanceRemaining(sale);
  const invoiceStatus = selectSaleStatusDisplay(sale);
  const receiptState = sale.status === 'Reversed' ? 'Void' : 'Valid';

  const handleConfirmReversal = () => {
    const result = reverseSale({
      saleId: sale.id,
      reason: reversalReason,
      actor: currentUser.name || 'Owner',
    });

    if (!result.ok) {
      setFormMessage(result.message);
      return;
    }

    setFormMessage('');
    setReversalReason('');
    setShowReverseModal(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/sales" />
          </IonButtons>
          <IonTitle>Invoice Detail</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handlePrint}>
              <IonIcon slot="icon-only" icon={shareSocialOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <div className="page-shell" data-testid="invoice-detail-page">
          <SectionCard title="Official Receipt" subtitle="This document serves as proof of transaction and is recorded in your business ledger.">
            <div className="list-block receipt-container">
              <div className="receipt-header">
                <div className="business-auth">
                  <h2>{state.businessProfile.businessName}</h2>
                  <p>{state.businessProfile.country} • {state.businessProfile.phone}</p>
                </div>
                <div className="receipt-meta-box">
                  <strong>{sale.invoiceNumber}</strong>
                  <p>{formatReceiptDate(sale.createdAt)}</p>
                  <IonBadge color={invoiceStatus.tone}>{invoiceStatus.label}</IonBadge>
                </div>
              </div>

              <div className="receipt-divider" />

              <div className="list-row no-border">
                <div>
                  <p className="muted-label">Billed to</p>
                  <strong>{customer?.name ?? 'Walking customer'}</strong>
                  <p className="code-label">{customer?.clientId ?? 'CLT-GUEST'}</p>
                </div>
                <div className="right-meta">
                  <p className="muted-label">Status</p>
                  <strong>{receiptState}</strong>
                </div>
              </div>

              <div className="list-row no-border">
                <div>
                  <p className="muted-label">Description</p>
                  <strong>{product?.name ?? 'Item'}</strong>
                  <p className="code-label">{product?.inventoryId ?? 'INV-UNK'}</p>
                </div>
                <div className="right-meta">
                  <p className="muted-label">Quantity</p>
                  <strong>{sale.quantity} units</strong>
                </div>
              </div>

              <div className="receipt-divider" />

              <div className="receipt-footer">
                <div className="footer-row">
                  <p>Subtotal</p>
                  <p>{formatCurrency(sale.totalAmount, currency)}</p>
                </div>
                <div className="footer-row">
                  <p>Paid</p>
                  <p>{formatCurrency(sale.paidAmount, currency)}</p>
                </div>
                <div className="footer-row grand-total">
                  <p>Balance Due</p>
                  <p className={balanceRemaining > 0 ? 'danger-text' : 'success-text'}>
                    {formatCurrency(balanceRemaining, currency)}
                  </p>
                </div>
                <p className="payment-note">Paid via {sale.paymentMethod}</p>
              </div>
            </div>
          </SectionCard>

          {Boolean(sale.reversalReason || correctionOfSale || correctedBySale) && (
            <SectionCard
              title="Adjustment details"
              subtitle="Information regarding reversals or corrections linked to this invoice."
            >
              <div className="list-block">
                {sale.reversalReason ? (
                  <div className="selected-product">
                    <div>
                      <p className="muted-label">Reversal reason</p>
                      <h3>{sale.reversalReason}</h3>
                      <p className="muted-label">
                        Reversed {sale.reversedAt ? formatReceiptDate(sale.reversedAt) : 'recently'}{' '}
                        {sale.reversedBy ? `by ${sale.reversedBy}` : ''}
                      </p>
                    </div>
                  </div>
                ) : null}

                {correctionOfSale ? (
                  <div className="list-row">
                    <div>
                      <strong>Correction source</strong>
                      <p>{correctionOfSale.invoiceNumber}</p>
                    </div>
                    <div className="right-meta">
                      <IonButton
                        fill="clear"
                        size="small"
                        onClick={() => history.push(`/sales/${correctionOfSale.id}`)}
                      >
                        Open linked invoice
                      </IonButton>
                    </div>
                  </div>
                ) : null}

                {correctedBySale ? (
                  <div className="list-row">
                    <div>
                      <strong>Correction invoice</strong>
                      <p>{correctedBySale.invoiceNumber}</p>
                    </div>
                    <div className="right-meta">
                      <IonButton
                        fill="clear"
                        size="small"
                        onClick={() => history.push(`/sales/${correctedBySale.id}`)}
                      >
                        Open linked invoice
                      </IonButton>
                    </div>
                  </div>
                ) : null}
              </div>
            </SectionCard>
          )}

          <SectionCard
            title="Invoice actions"
            subtitle="Use these guarded actions to safely record a reversal or create a correction without deleting history."
          >
            <div className="form-grid">
              {sale.status === 'Completed' && hasPermission('sales.reverse') && (
                <IonButton data-testid="reverse-invoice-button" color="danger" expand="block" onClick={() => setShowReverseModal(true)}>
                  Reverse Invoice
                </IonButton>
              )}

              {sale.status === 'Reversed' && !sale.correctedBySaleId && hasPermission('sales.create') && (
                <IonButton
                  expand="block"
                  onClick={() =>
                    history.push('/sales', {
                      correctionSourceSaleId: sale.id,
                    })
                  }
                >
                  Create Correction Invoice
                </IonButton>
              )}

              {sale.correctedBySaleId ? (
                <IonText color="medium">
                  <p>A correction invoice has already been issued for this reversed invoice.</p>
                </IonText>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Stock and ledger impact"
            subtitle="These are the transactional records that drive inventory and receivables for this invoice."
          >
            <div className="list-block">
              {stockMovements.map((movement) => (
                (() => {
                  const movementDisplay = selectStockMovementDisplay(movement);

                  return (
                    <div className="list-row" key={movement.id}>
                      <div>
                        <strong>{movementDisplay.label}</strong>
                        <p className="code-label">{movement.movementNumber}</p>
                        <p>{movementDisplay.helper}</p>
                      </div>
                      <div className="right-meta">
                        <strong className={movement.quantityDelta < 0 ? 'danger-text' : 'success-text'}>
                          {movement.quantityDelta > 0 ? '+' : ''}
                          {movement.quantityDelta}
                        </strong>
                        <p>After: {movement.quantityAfter}</p>
                      </div>
                    </div>
                  );
                })()
              ))}
              {ledgerEntries.map((entry) => (
                (() => {
                  const entryDisplay = selectLedgerEntryDisplay(entry);

                  return (
                    <div className="list-row" key={entry.id}>
                      <div>
                        <strong>{entryDisplay.label}</strong>
                        <p className="code-label">{entry.entryNumber}</p>
                        <p>{entryDisplay.helper}</p>
                      </div>
                      <div className="right-meta">
                        <strong className={entryDisplay.tone === 'warning' ? 'warning-text' : 'success-text'}>
                          {entry.amountDelta > 0 ? '+' : '-'}
                          {formatCurrency(Math.abs(entry.amountDelta), currency)}
                        </strong>
                        <p>{entryDisplay.amountLabel}</p>
                      </div>
                    </div>
                  );
                })()
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Invoice history"
            subtitle="This activity log preserves creation, receipt generation, reversal, and correction actions."
          >
            {auditEvents.length === 0 ? (
              <EmptyState
                eyebrow="No history"
                title="No activity recorded yet"
                message="As invoice actions happen, they will appear here with their timestamps and notes."
              />
            ) : (
              <div className="list-block">
                {auditEvents.map((event) => {
                  const activityDisplay = selectActivityDisplay(event);
                  const relatedSale = event.relatedEntityId
                    ? state.sales.find((item) => item.id === event.relatedEntityId)
                    : null;

                  return (
                    <div className="roadmap-row" key={event.id}>
                      <span className={`status-dot ${activityDisplay.tone === 'warning' ? 'pending' : 'done'}`} />
                      <div>
                        <strong>{activityDisplay.label}</strong>
                        <p>{formatReceiptDate(event.createdAt)}</p>
                        <p>{activityDisplay.helper}</p>
                        {event.detail !== activityDisplay.helper ? <p>{event.detail}</p> : null}
                        {relatedSale ? <p>Linked invoice: {relatedSale.invoiceNumber}</p> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </IonContent>

      <IonModal isOpen={showReverseModal} onDidDismiss={() => setShowReverseModal(false)}>
        <IonHeader translucent={true}>
          <IonToolbar>
            <IonTitle>Reverse Invoice</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen={true}>
          <div className="page-shell">
            <SectionCard
            title="Confirm reversal"
              subtitle="This reversal restores stock, removes the invoice from active totals, and reverses its receivable impact while keeping the record visible."
            >
              <div className="form-grid">
                <div className="selected-product">
                  <div>
                    <p className="muted-label">Invoice</p>
                    <h3>{sale.invoiceNumber}</h3>
                    <p className="muted-label">A reason is required before this reversal can be recorded.</p>
                  </div>
                </div>

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Reason for reversal</IonLabel>
                  <IonTextarea
                    data-testid="reversal-reason-input"
                    value={reversalReason}
                    autoGrow={true}
                    placeholder="e.g. duplicate invoice, wrong customer, goods not delivered"
                    onIonInput={(event) => setReversalReason(event.detail.value ?? '')}
                  />
                </IonItem>

                {formMessage ? <p className="form-message">{formMessage}</p> : null}
                <IonButton data-testid="confirm-reversal-button" color="danger" expand="block" onClick={handleConfirmReversal}>
                  Confirm reversal
                </IonButton>
                <IonButton fill="clear" color="medium" expand="block" onClick={() => setShowReverseModal(false)}>
                  Cancel
                </IonButton>
              </div>
            </SectionCard>
          </div>
        </IonContent>
      </IonModal>
    </IonPage>
  );
};

export default InvoiceDetailPage;
