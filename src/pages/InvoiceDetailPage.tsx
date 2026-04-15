import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonModal,
  IonPage,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';

import EmptyState from '../components/EmptyState';
import SectionCard from '../components/SectionCard';
import { useBusiness } from '../context/BusinessContext';
import {
  selectCustomerLedgerEntries,
  selectProductMovements,
  selectSaleActivityEntries,
  selectSaleBalanceRemaining,
  selectSalePaymentStatus,
} from '../selectors/businessSelectors';
import { formatCurrency, formatReceiptDate } from '../utils/format';

const actionLabels: Record<string, string> = {
  invoice_created: 'Invoice created',
  receipt_issued: 'Receipt issued',
  invoice_reversed: 'Invoice reversed',
  corrected_copy_created: 'Corrected copy created',
};

const InvoiceDetailPage: React.FC = () => {
  const { saleId } = useParams<{ saleId: string }>();
  const history = useHistory();
  const { state, reverseSale } = useBusiness();
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
  const paymentStatus = selectSalePaymentStatus(sale);
  const receiptState = sale.status === 'Reversed' ? 'Receipt no longer active' : 'Receipt active';

  const handleConfirmReversal = () => {
    const result = reverseSale({
      saleId: sale.id,
      reason: reversalReason,
      actor: 'Owner',
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
          <IonTitle>Invoice Detail</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <div className="page-shell">
          <SectionCard title="Invoice summary" subtitle="Review the invoice, its current status, and any linked replacement history before taking action.">
            <div className="list-block">
              <div className="list-row">
                <div>
                  <strong>{sale.invoiceNumber}</strong>
                  <p>{sale.receiptId}</p>
                  <p>{formatReceiptDate(sale.createdAt)}</p>
                </div>
                <div className="right-meta">
                  <IonBadge color={sale.status === 'Reversed' ? 'danger' : paymentStatus === 'Paid' ? 'success' : 'warning'}>{paymentStatus}</IonBadge>
                  <p>{receiptState}</p>
                </div>
              </div>

              <div className="list-row">
                <div>
                  <strong>Customer</strong>
                  <p>{customer?.name ?? 'Unknown customer'}</p>
                </div>
                <div className="right-meta">
                  <strong>{customer?.clientId ?? 'CLT-UNK'}</strong>
                  <p>Client ID</p>
                </div>
              </div>

              <div className="list-row">
                <div>
                  <strong>Line item</strong>
                  <p>{product?.name ?? 'Missing product'}</p>
                  <p className="code-label">{product?.inventoryId ?? 'INV-UNK'}</p>
                </div>
                <div className="right-meta">
                  <strong>{sale.quantity} units</strong>
                  <p>{formatCurrency(sale.totalAmount / sale.quantity, currency)} each</p>
                </div>
              </div>

              <div className="list-row">
                <div>
                  <strong>Total</strong>
                  <p>{formatCurrency(sale.totalAmount, currency)}</p>
                </div>
                <div className="right-meta">
                  <strong>{sale.paymentMethod}</strong>
                  <p>Payment method</p>
                </div>
              </div>

              <div className="list-row">
                <div>
                  <strong>Amount paid</strong>
                  <p>{formatCurrency(sale.paidAmount, currency)}</p>
                </div>
                <div className="right-meta">
                  <strong className={paymentStatus === 'Paid' ? 'success-text' : 'danger-text'}>
                    {paymentStatus === 'Reversed' ? 'Reversed' : paymentStatus === 'Paid' ? 'Paid' : `${formatCurrency(balanceRemaining, currency)} due`}
                  </strong>
                  <p>Balance status</p>
                </div>
              </div>

              {sale.reversalReason ? (
                <div className="selected-product">
                  <div>
                    <p className="muted-label">Reversal reason</p>
                    <h3>{sale.reversalReason}</h3>
                    <p className="muted-label">
                      Reversed {sale.reversedAt ? formatReceiptDate(sale.reversedAt) : 'recently'} {sale.reversedBy ? `by ${sale.reversedBy}` : ''}
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
                    <IonButton fill="clear" size="small" onClick={() => history.push(`/sales/${correctionOfSale.id}`)}>
                      Open linked invoice
                    </IonButton>
                  </div>
                </div>
              ) : null}

              {correctedBySale ? (
                <div className="list-row">
                  <div>
                    <strong>Corrected replacement</strong>
                    <p>{correctedBySale.invoiceNumber}</p>
                  </div>
                  <div className="right-meta">
                    <IonButton fill="clear" size="small" onClick={() => history.push(`/sales/${correctedBySale.id}`)}>
                      Open linked invoice
                    </IonButton>
                  </div>
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Invoice actions"
            subtitle="Use these guarded actions to safely reverse an invoice or issue a corrected replacement without deleting history."
          >
            <div className="form-grid">
              {sale.status === 'Completed' ? (
                <IonButton color="danger" expand="block" onClick={() => setShowReverseModal(true)}>
                  Reverse Invoice
                </IonButton>
              ) : null}

              {sale.status === 'Reversed' && !sale.correctedBySaleId ? (
                <IonButton
                  expand="block"
                  onClick={() =>
                    history.push('/sales', {
                      correctionSourceSaleId: sale.id,
                    })
                  }
                >
                  Create Corrected Copy
                </IonButton>
              ) : null}

              {sale.correctedBySaleId ? (
                <IonText color="medium">
                  <p>A corrected replacement has already been issued for this invoice.</p>
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
                <div className="list-row" key={movement.id}>
                  <div>
                    <strong>Stock movement</strong>
                    <p className="code-label">{movement.movementNumber}</p>
                    <p>{movement.note}</p>
                  </div>
                  <div className="right-meta">
                    <strong className={movement.quantityDelta < 0 ? 'danger-text' : 'success-text'}>
                      {movement.quantityDelta > 0 ? '+' : ''}
                      {movement.quantityDelta}
                    </strong>
                    <p>After: {movement.quantityAfter}</p>
                  </div>
                </div>
              ))}
              {ledgerEntries.map((entry) => (
                <div className="list-row" key={entry.id}>
                  <div>
                    <strong>Customer ledger</strong>
                    <p className="code-label">{entry.entryNumber}</p>
                    <p>{entry.note}</p>
                  </div>
                  <div className="right-meta">
                    <strong className={entry.amountDelta > 0 ? 'danger-text' : 'success-text'}>
                      {entry.amountDelta > 0 ? '+' : '-'}
                      {formatCurrency(Math.abs(entry.amountDelta), currency)}
                    </strong>
                    <p>{entry.type.replace('_', ' ')}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Invoice history"
            subtitle="This activity log preserves creation, receipt generation, reversal, and corrected-copy actions."
          >
            {auditEvents.length === 0 ? (
              <EmptyState
                eyebrow="No history"
                title="No activity recorded yet"
                message="As invoice actions happen, they will appear here with their timestamps and notes."
              />
            ) : (
              <div className="list-block">
                {auditEvents.map((event) => (
                  <div className="roadmap-row" key={event.id}>
                    <span className={`status-dot ${event.status === 'warning' ? 'pending' : 'done'}`} />
                    <div>
                      <strong>{actionLabels[event.actionType] ?? event.title}</strong>
                      <p>{formatReceiptDate(event.createdAt)}</p>
                      <p>{event.detail}</p>
                      {event.relatedEntityId ? <p>Related invoice: {event.relatedEntityId}</p> : null}
                    </div>
                  </div>
                ))}
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
              subtitle="This will restore stock, remove the invoice from active totals, and reverse its receivable impact while keeping the record visible."
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
                    value={reversalReason}
                    autoGrow={true}
                    placeholder="e.g. duplicate invoice, wrong customer, goods not delivered"
                    onIonInput={(event) => setReversalReason(event.detail.value ?? '')}
                  />
                </IonItem>

                {formMessage ? <p className="form-message">{formMessage}</p> : null}
                <IonButton color="danger" expand="block" onClick={handleConfirmReversal}>
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
