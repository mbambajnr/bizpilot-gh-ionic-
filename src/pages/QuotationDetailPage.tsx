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
import DocumentHeader from '../components/DocumentHeader';
import { selectCustomerTypeDisplayLabel, selectDocumentTaxTotals, selectDocumentWithholdingTotals, selectQuotationStatusDisplay } from '../selectors/businessSelectors';
import { formatCurrency, formatReceiptDate } from '../utils/format';

const QuotationDetailPage: React.FC = () => {
  const { quotationId } = useParams<{ quotationId: string }>();
  const { state, hasPermission } = useBusiness();
  const currency = state.businessProfile.currency;
  const isCustomerClassificationEnabled = state.businessProfile.customerClassificationEnabled;

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
  const taxTotals = selectDocumentTaxTotals(quotation);
  const withholdingTotals = selectDocumentWithholdingTotals(quotation);
  const canPrintQuotation = hasPermission('quotations.print');
  const canExportQuotationPdf = hasPermission('quotations.export_pdf');

  const handlePrint = () => {
    if (!canPrintQuotation) {
      return;
    }
    window.print();
  };

  const handleExportPdf = () => {
    if (!canExportQuotationPdf) {
      return;
    }
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
          <IonButtons slot="end" className="toolbar-action-group">
            {canPrintQuotation ? (
              <IonButton onClick={handlePrint} className="toolbar-action-button" aria-label="Print Quotation">
                <IonIcon slot="icon-only" icon={shareSocialOutline} />
              </IonButton>
            ) : null}
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <div className="page-shell">
          <SectionCard title="Sales Quotation" subtitle="Official price estimate for goods or services. This document is valid for 7 days.">
            <div className="document-scroll-shell">
              <div className="list-block receipt-container document-mobile-sheet">
                <DocumentHeader 
                  profile={state.businessProfile}
                  type="Quotation"
                  referenceNumber={quotation.quotationNumber}
                  date={formatReceiptDate(quotation.createdAt)}
                />

              <div className="receipt-divider" />

              <div className="list-row no-border">
                <div>
                  <p className="muted-label">Requested by</p>
                  <strong>{customer?.name ?? quotation.customerName}</strong>
                  <p className="code-label">{customer?.clientId ?? quotation.clientId}</p>
                  {isCustomerClassificationEnabled ? (
                    <p className="code-label">Customer type snapshot: {selectCustomerTypeDisplayLabel(quotation.customerTypeSnapshot)}</p>
                  ) : null}
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
                  <div className="receipt-row" key={`${quotation.id}-item-${idx}`} style={{ padding: '12px 0', borderBottom: '1px solid #eee' }}>
                    <div style={{ flex: 2 }}>
                      <p style={{ margin: '0 0 2px', fontWeight: '700', fontSize: '1rem' }}>{item.productName}</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', fontStyle: 'italic' }}>Ref: {item.inventoryId}</p>
                    </div>
                    <div style={{ textAlign: 'center', flex: 0.5 }}>
                      <p style={{ margin: 0 }}>{item.quantity}</p>
                    </div>
                    <div style={{ textAlign: 'right', flex: 1 }}>
                      <p style={{ margin: 0 }}>{formatCurrency(item.unitPrice, currency)}</p>
                    </div>
                    <div style={{ textAlign: 'right', flex: 1 }}>
                      <strong style={{ margin: 0 }}>{formatCurrency(item.total, currency)}</strong>
                    </div>
                  </div>
                ))}
              </div>

              <div className="receipt-summary" style={{ width: '100%', maxWidth: '300px' }}>
                <div className="summary-line">
                  <span>Subtotal</span>
                  <strong>{formatCurrency(taxTotals.subtotalAmount, currency)}</strong>
                </div>
                {taxTotals.hasTax && taxTotals.isExempt ? (
                  <div className="summary-line">
                    <span>{taxTotals.exemptionReason ? `Tax exempt - ${taxTotals.exemptionReason}` : 'Tax exempt'}</span>
                    <strong>{formatCurrency(0, currency)}</strong>
                  </div>
                ) : taxTotals.hasTax ? (
                  <div className="summary-line">
                    <span>Tax ({taxTotals.taxRate}%)</span>
                    <strong>{formatCurrency(taxTotals.taxAmount, currency)}</strong>
                  </div>
                ) : null}
                <div className="summary-line highlight">
                  <span>{withholdingTotals.hasWithholding ? 'Gross Total' : 'Quotation Total'}</span>
                  <strong>{formatCurrency(quotation.totalAmount, currency)}</strong>
                </div>
                {withholdingTotals.hasWithholding ? (
                  <>
                    <div className="summary-line">
                      <span>{withholdingTotals.label} ({withholdingTotals.rate}%)</span>
                      <strong>-{formatCurrency(withholdingTotals.amount, currency)}</strong>
                    </div>
                    <div className="summary-line highlight">
                      <span>Net Receivable</span>
                      <strong>{formatCurrency(withholdingTotals.netReceivableAmount, currency)}</strong>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="receipt-footer" style={{ marginTop: '32px' }}>
                <p className="payment-note">
                  This is a formal quotation and not an invoice. Prices are subject to stock availability at the time of conversion. This estimate is valid for 7 days.
                </p>
                {state.businessProfile.signatureUrl && (
                  <div className="receipt-signature" style={{ marginTop: '24px' }}>
                    <p className="muted-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Authorized Signature</p>
                    <img src={state.businessProfile.signatureUrl} alt="Signature" style={{ maxHeight: '60px', marginTop: '8px' }} />
                  </div>
                )}
              </div>
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
                  <IonButton fill="outline" expand="block" onClick={handleExportPdf}>
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
