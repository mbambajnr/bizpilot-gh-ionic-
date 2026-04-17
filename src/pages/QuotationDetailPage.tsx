import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
  IonBadge,
} from '@ionic/react';
import { shareSocialOutline } from 'ionicons/icons';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import EmptyState from '../components/EmptyState';
import SectionCard from '../components/SectionCard';
import { useBusiness } from '../context/BusinessContext';
import { selectQuotationStatusDisplay } from '../selectors/businessSelectors';
import { formatCurrency, formatReceiptDate } from '../utils/format';

const QuotationDetailPage: React.FC = () => {
  const { quotationId } = useParams<{ quotationId: string }>();
  const { state, hasPermission } = useBusiness();
  const currency = state.businessProfile.currency;

  const quotation = useMemo(
    () => state.quotations.find((item) => item.id === quotationId) ?? null,
    [quotationId, state.quotations]
  );
  const customer = useMemo(
    () => state.customers.find((item) => item.id === quotation?.customerId) ?? null,
    [quotation, state.customers]
  );

  if (!quotation) {
    return (
      <IonPage>
        <IonHeader translucent={true}>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/quotations" />
            </IonButtons>
            <IonTitle>Quotation</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen={true}>
          <div className="page-shell">
            <SectionCard title="Quotation not found" subtitle="This quotation may have been removed or the link is invalid.">
              <EmptyState
                eyebrow="Missing document"
                title="We could not find that quotation."
                message="Return to the quotations list and try opening it again."
              />
            </SectionCard>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const statusDisplay = selectQuotationStatusDisplay(quotation);

  const handlePrint = () => {
    window.print();
  };

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/quotations" />
          </IonButtons>
          <IonTitle>Quotation Detail</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handlePrint}>
              <IonIcon slot="icon-only" icon={shareSocialOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <div className="page-shell">
          <SectionCard title="Sales Quotation" subtitle="Official price estimate for goods or services. This document is valid for 7 days.">
            <div className="list-block receipt-container">
              <div className="receipt-header">
                <div className="business-auth">
                  {state.businessProfile.logoUrl && (
                    <img src={state.businessProfile.logoUrl} alt="Logo" className="receipt-logo" />
                  )}
                  <h2>{state.businessProfile.businessName}</h2>
                  <p>{state.businessProfile.country} • {state.businessProfile.phone}</p>
                </div>
                <div className="receipt-meta-box">
                  <strong>{quotation.quotationNumber}</strong>
                  <p>{formatReceiptDate(quotation.createdAt)}</p>
                  <IonBadge color={statusDisplay.tone}>{statusDisplay.label}</IonBadge>
                </div>
              </div>

              <div className="receipt-divider" />

              <div className="list-row no-border">
                <div>
                  <p className="muted-label">Requested by</p>
                  <strong>{customer?.name ?? quotation.customerName}</strong>
                  <p className="code-label">{customer?.clientId ?? quotation.clientId}</p>
                </div>
                <div className="right-meta">
                  <p className="muted-label">Valid until</p>
                  <strong>{formatReceiptDate(new Date(new Date(quotation.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())}</strong>
                </div>
              </div>

              <div className="receipt-divider" />

              <div className="receipt-table">
                <div className="receipt-row header">
                  <span>Item Description</span>
                  <span style={{ textAlign: 'center' }}>Qty</span>
                  <span style={{ textAlign: 'right' }}>Price</span>
                  <span style={{ textAlign: 'right' }}>Total</span>
                </div>
                {quotation.items.map((item, idx) => (
                  <div className="receipt-row" key={`${quotation.id}-item-${idx}`}>
                    <div>
                      <p style={{ margin: 0, fontWeight: '600' }}>{item.productName}</p>
                      <p className="code-label" style={{ margin: 0 }}>{item.inventoryId}</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: 0 }}>{item.quantity}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0 }}>{formatCurrency(item.unitPrice, currency)}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ margin: 0 }}>{formatCurrency(item.total, currency)}</strong>
                    </div>
                  </div>
                ))}
              </div>

              <div className="receipt-divider" />

              <div className="receipt-footer">
                <div className="footer-row grand-total">
                  <p>Quotation Total</p>
                  <p>{formatCurrency(quotation.totalAmount, currency)}</p>
                </div>
                <p className="payment-note" style={{ marginTop: '12px' }}>
                  This is a formal quotation and not an invoice. Prices are subject to stock availability at the time of conversion.
                </p>
                {state.businessProfile.signatureUrl && (
                  <div className="receipt-signature">
                    <p className="muted-label">Authorized Signature</p>
                    <img src={state.businessProfile.signatureUrl} alt="Signature" />
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Actions" subtitle="Print or export this quotation to share with the customer.">
            <div className="button-group">
               <div className="dual-stat">
                {hasPermission('quotations.print') && (
                  <IonButton fill="outline" expand="block" onClick={handlePrint}>
                    Print Quotation
                  </IonButton>
                )}
                {hasPermission('quotations.export_pdf') && (
                  <IonButton fill="outline" expand="block" onClick={handlePrint}>
                    Export PDF
                  </IonButton>
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default QuotationDetailPage;
