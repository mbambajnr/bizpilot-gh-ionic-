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
import { printOutline, shareOutline } from 'ionicons/icons';
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

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/sales" />
          </IonButtons>
          <IonTitle>Invoice {sale.invoiceNumber}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => window.print()}>
              <IonIcon slot="icon-only" icon={printOutline} />
            </IonButton>
            <IonButton onClick={() => alert('Sharing integration would land here.')}>
              <IonIcon slot="icon-only" icon={shareOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen={true}>
        <div className="page-shell">
          <SectionCard title="Invoice snapshot" subtitle={`Reference #${sale.invoiceNumber} recorded on ${formatReceiptDate(sale.createdAt)}.`}>
            <div className="receipt-container">
              <div className="receipt-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ margin: '0', fontSize: '1.5rem', fontWeight: '800' }}>{state.businessProfile.businessName}</h2>
                    <p className="muted-label">{state.businessProfile.businessType}</p>
                  </div>
                  <IonBadge color={sale.status === 'Completed' ? 'success' : 'danger'}>
                    {sale.status.toUpperCase()}
                  </IonBadge>
                </div>
                
                <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <p className="muted-label">Bill To</p>
                    <strong style={{ display: 'block', fontSize: '1.1rem' }}>{customer?.name}</strong>
                    <p style={{ margin: '4px 0 0', opacity: 0.8 }}>ID: {customer?.clientId}</p>
                    {customer?.phone && <p style={{ margin: '2px 0 0', opacity: 0.8 }}>{customer.phone}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p className="muted-label">Invoice Info</p>
                    <p style={{ margin: '0' }}>No: {sale.invoiceNumber}</p>
                    <p style={{ margin: '2px 0 0' }}>Date: {formatReceiptDate(sale.createdAt)}</p>
                    <p style={{ margin: '2px 0 0' }}>Method: {sale.paymentMethod}</p>
                  </div>
                </div>
              </div>

              <div className="receipt-table">
                <div className="receipt-row header">
                  <span>Description</span>
                  <span style={{ textAlign: 'center' }}>Qty</span>
                  <span style={{ textAlign: 'right' }}>Unit Price</span>
                  <span style={{ textAlign: 'right' }}>Total</span>
                </div>
                <div className="receipt-row">
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong>{product?.name}</strong>
                    <span className="muted-label" style={{ fontSize: '0.7rem' }}>{product?.inventoryId}</span>
                  </div>
                  <span style={{ textAlign: 'center' }}>{sale.quantity}</span>
                  <span style={{ textAlign: 'right' }}>{formatCurrency(sale.totalAmount / sale.quantity, currency)}</span>
                  <span style={{ textAlign: 'right' }}>{formatCurrency(sale.totalAmount, currency)}</span>
                </div>
              </div>

              <div className="receipt-summary">
                <div className="summary-line">
                  <span>Total Amount</span>
                  <strong>{formatCurrency(sale.totalAmount, currency)}</strong>
                </div>
                <div className="summary-line">
                  <span>Amount Paid</span>
                  <strong className="success-text">{formatCurrency(sale.paidAmount, currency)}</strong>
                </div>
                {balanceRemaining > 0 && (
                  <div className="summary-line highlight">
                    <span>Balance Outstanding</span>
                    <strong className="danger-text">{formatCurrency(balanceRemaining, currency)}</strong>
                  </div>
                )}
                {sale.paymentReference && (
                  <div className="summary-line" style={{ borderTop: '1px dashed var(--border-color)', marginTop: '8px', paddingTop: '8px' }}>
                    <span className="muted-label">Payment Ref:</span>
                    <span style={{ fontWeight: '600' }}>{sale.paymentReference}</span>
                  </div>
                )}
              </div>

              <div className="receipt-footer">
                <p>Status: {invoiceStatus.label}</p>
                <p style={{ marginTop: '4px' }}>Receipt State: {receiptState}</p>
                <div className="receipt-divider" />
                <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                  This is a {receiptState.toLowerCase()} computer-generated business document for {state.businessProfile.businessName}.
                </p>
              </div>
            </div>

            <div className="form-grid">
              {sale.status === 'Completed' && hasPermission('sales.reverse') && (
                <IonButton expand="block" color="danger" fill="outline" onClick={() => setShowReverseModal(true)}>
                  Reverse & Void Invoice
                </IonButton>
              )}
              
              <div className="dual-stat">
                {hasPermission('invoices.print') && (
                  <IonButton expand="block" fill="clear" color="medium" onClick={() => window.print()}>
                    <IonIcon slot="start" icon={printOutline} />
                    Print
                  </IonButton>
                )}
                {hasPermission('invoices.export_pdf') && (
                  <IonButton expand="block" fill="clear" color="medium" onClick={() => alert('PDF export would land here.')}>
                    PDF
                  </IonButton>
                )}
              </div>

              {sale.status === 'Reversed' && !sale.correctedBySaleId && hasPermission('sales.create') && (
                <div className="empty-state">
                  <p className="muted-label">Correction available</p>
                  <h3>Voided invoice detected</h3>
                  <p>You can create a corrected copy of this invoice to replace the reversed transaction.</p>
                  <IonButton 
                    expand="block" 
                    style={{ marginTop: '14px' }}
                    onClick={() => history.push(`/sales?correctionSourceSaleId=${sale.id}`)}
                  >
                    Create corrected copy
                  </IonButton>
                </div>
              )}

              {sale.status === 'Reversed' && (
                <div className="empty-state" style={{ borderColor: 'var(--ion-color-danger)' }}>
                  <p className="muted-label">Reversal Log</p>
                  <h3>Invoice Reversed</h3>
                  <IonText color="medium">
                    Reason: {sale.reversalReason || 'No reason provided'}
                  </IonText>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Audit History" subtitle="Full visibility into stock movements and ledger impacts for this invoice.">
            <div className="list-block">
              <p className="muted-label">Inventory Impact</p>
              {stockMovements.map((movement) => {
                const movementDisplay = selectStockMovementDisplay(movement);
                return (
                  <div className="list-row" key={movement.id}>
                    <div>
                      <strong>{movementDisplay.label}</strong>
                      <p>{movementDisplay.helper}</p>
                      <p className="muted-label">Ref: {movement.movementNumber}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong className={movement.quantityDelta < 0 ? 'danger-text' : 'success-text'}>
                        {movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta}
                      </strong>
                      <p className="muted-label">End: {movement.quantityAfter}</p>
                    </div>
                  </div>
                );
              })}

              <p className="muted-label" style={{ marginTop: '20px' }}>Ledger Impact</p>
              {ledgerEntries.map((entry) => {
                const entryDisplay = selectLedgerEntryDisplay(entry);
                return (
                  <div className="list-row" key={entry.id}>
                    <div>
                      <strong>{entryDisplay.label}</strong>
                      <p>{entryDisplay.helper}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong className={entry.amountDelta > 0 ? 'danger-text' : 'success-text'}>
                        {formatCurrency(entry.amountDelta, currency)}
                      </strong>
                    </div>
                  </div>
                );
              })}

              <p className="muted-label" style={{ marginTop: '20px' }}>Activity Log</p>
              {auditEvents.map((event) => {
                const activityDisplay = selectActivityDisplay(event);
                return (
                  <div className="list-row" key={event.id}>
                    <div>
                      <strong>{activityDisplay.label}</strong>
                      <p>{activityDisplay.helper}</p>
                      <p className="muted-label">{formatReceiptDate(event.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>

        <IonModal isOpen={showReverseModal} onDidDismiss={() => setShowReverseModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Reverse Invoice</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowReverseModal(false)}>Close</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <div className="page-shell" style={{ padding: '0' }}>
              <SectionCard title="Reason for reversal" subtitle="Explain why this invoice is being voided for audit purposes.">
                <div className="form-grid">
                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">Reversal Reason</IonLabel>
                    <IonTextarea
                      placeholder="e.g. Input error, Customer returned item, Wrong price..."
                      value={reversalReason}
                      onIonInput={(event) => setReversalReason(event.detail.value ?? '')}
                      rows={4}
                    />
                  </IonItem>

                  {formMessage && <p className="danger-text" style={{ textAlign: 'center' }}>{formMessage}</p>}

                  <IonButton expand="block" color="danger" onClick={handleConfirmReversal} disabled={!reversalReason.trim()}>
                    Confirm Reversal
                  </IonButton>
                </div>
              </SectionCard>
            </div>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default InvoiceDetailPage;
