import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonPage,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { printOutline, mailOutline, logoWhatsapp, documentText, downloadOutline } from 'ionicons/icons';
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
  selectCustomerTypeDisplayLabel,
  selectDocumentTaxTotals,
  selectDocumentWithholdingTotals,
} from '../selectors/businessSelectors';
import { formatCurrency, formatReceiptDate } from '../utils/format';

const InvoiceDetailPage: React.FC = () => {
  const { saleId } = useParams<{ saleId: string }>();
  const history = useHistory();
  const { state, reverseSale, hasPermission, currentUser } = useBusiness();
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const currency = state.businessProfile.currency;
  const isCustomerClassificationEnabled = state.businessProfile.customerClassificationEnabled;

  const sale = useMemo(() => state.sales.find((item) => item.id === saleId) ?? null, [saleId, state.sales]);
  const customer = useMemo(() => state.customers.find((item) => item.id === sale?.customerId) ?? null, [sale, state.customers]);
  const legacyProduct = useMemo(() => state.products.find((item) => item.id === sale?.productId) ?? null, [sale, state.products]);
  const auditEvents = useMemo(() => (sale ? selectSaleActivityEntries(state, sale.id) : []), [sale, state]);
  
  // Aggregate stock movements for all products in this specific sale/invoice
  const stockMovements = useMemo(() => {
    if (!sale) return [];
    return state.stockMovements
      .filter((entry) => entry.relatedSaleId === saleId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [saleId, state.stockMovements, sale]);

  const ledgerEntries = useMemo(() => (customer ? selectCustomerLedgerEntries(state, customer.id).filter((entry) => entry.relatedSaleId === saleId) : []), [customer, saleId, state]);

  const customerPhone = customer?.whatsapp ?? customer?.phone ?? '';
  const canPrintInvoice = hasPermission('invoices.print');
  const canExportInvoicePdf = hasPermission('invoices.export_pdf');
  const canSendCustomerEmail = hasPermission('customers.email.send');
  const canViewCustomerLedger = hasPermission('customers.ledger.view');

  if (!sale) {
    return (
      <IonPage>
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/sales" />
            </IonButtons>
            <IonTitle>Invoice</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
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
  const taxTotals = selectDocumentTaxTotals(sale);
  const withholdingTotals = selectDocumentWithholdingTotals(sale);
  const receiptState = sale.status === 'Reversed' ? 'Void' : 'Valid';
  const customerName = customer?.name ?? 'Customer';
  const invoiceSummaryLine = `${sale.invoiceNumber} • ${customerName} • ${formatCurrency(sale.totalAmount, currency)} • ${sale.status}`;
  const whatsappDisabled = !customerPhone;

  const handlePrintInvoice = () => {
    if (!canPrintInvoice) {
      setActionMessage('This role cannot print invoices.');
      return;
    }
    setActionMessage('');
    window.print();
  };

  const handleSaveAsPdf = () => {
    if (!canExportInvoicePdf) {
      setActionMessage('This role cannot export invoices as PDF.');
      return;
    }
    setActionMessage('Your browser print dialog will open. Choose "Save as PDF" as the destination to download this invoice.');
    window.print();
  };

  const handleEmailInvoice = () => {
    if (!canSendCustomerEmail) {
      setActionMessage('This role is not allowed to send invoice emails.');
      return;
    }
    setActionMessage('');
    const subject = `Invoice ${sale.invoiceNumber} from ${state.businessProfile.businessName}`;
    const body = [
      `Hello ${customerName},`,
      '',
      `Please find your invoice details below:`,
      `Invoice Number: ${sale.invoiceNumber}`,
      `Customer: ${customerName}`,
      `Amount: ${formatCurrency(sale.totalAmount, currency)}`,
      `Status: ${sale.status}`,
      `Paid To Date: ${formatCurrency(sale.paidAmount, currency)}`,
      `Balance Due: ${formatCurrency(balanceRemaining, currency)}`,
      '',
      `Issued by: ${state.businessProfile.businessName}`,
    ].join('\n');

    const recipient = customer?.email?.trim() ?? '';
    window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleWhatsappInvoice = () => {
    if (whatsappDisabled) {
      setActionMessage('WhatsApp Invoice is unavailable because this customer does not have a phone number on file.');
      return;
    }

    setActionMessage('');
    const businessName = state.businessProfile.businessName;
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const message = `Hello ${customerName}, thank you for your patronage at ${businessName}.\n\nInvoice Number: ${sale.invoiceNumber}\nAmount: ${formatCurrency(sale.totalAmount, currency)}\nStatus: ${sale.status}\nPaid To Date: ${formatCurrency(sale.paidAmount, currency)}${balanceRemaining > 0 ? `\nBalance Due: ${formatCurrency(balanceRemaining, currency)}` : ''}\n\nWe appreciate your business!`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const invoiceActions = [
    canPrintInvoice ? {
      key: 'print',
      label: 'Print Invoice',
      helper: 'Open the print layout for paper copies.',
      icon: printOutline,
      onClick: handlePrintInvoice,
      disabled: false,
    } : null,
    canExportInvoicePdf ? {
      key: 'pdf',
      label: 'Save as PDF',
      helper: 'Use the print dialog to save a PDF file.',
      icon: downloadOutline,
      onClick: handleSaveAsPdf,
      disabled: false,
    } : null,
    canSendCustomerEmail ? {
      key: 'email',
      label: 'Email Invoice',
      helper: 'Open your email app with invoice details prefilled.',
      icon: mailOutline,
      onClick: handleEmailInvoice,
      disabled: false,
    } : null,
    {
      key: 'whatsapp',
      label: 'WhatsApp Invoice',
      helper: whatsappDisabled ? 'Add a customer phone or WhatsApp number to use WhatsApp.' : 'Send invoice details through WhatsApp.',
      icon: logoWhatsapp,
      onClick: handleWhatsappInvoice,
      disabled: whatsappDisabled,
    },
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    helper: string;
    icon: string;
    onClick: () => void;
    disabled: boolean;
  }>;

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
      <IonHeader className="ion-no-border no-print">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/sales" />
          </IonButtons>
          <IonTitle>Invoice</IonTitle>
          <IonButtons slot="end" className="toolbar-action-group">
            {canPrintInvoice ? (
              <IonButton onClick={handlePrintInvoice} className="toolbar-action-button" aria-label="Print Invoice">
                <IonIcon slot="start" icon={printOutline} />
                <span className="toolbar-action-label">Print Invoice</span>
              </IonButton>
            ) : null}
            <IonButton onClick={() => history.push(`/sales/${sale.id}/waybill`)} className="toolbar-action-button" aria-label="Open Waybill">
              <IonIcon slot="icon-only" icon={documentText} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="page-shell">
          <div className="document-scroll-shell">
            <div className="doc-page-force document-mobile-sheet">
              <div className="receipt-container" style={{ border: 'none', background: '#fff', color: '#000' }}>
              <div className="receipt-header" style={{ borderBottom: '3px solid #000', paddingBottom: '20px', marginBottom: '25px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', maxWidth: '60%' }}>
                    {state.businessProfile.logoUrl ? (
                      <img
                        src={state.businessProfile.logoUrl}
                        alt={`${state.businessProfile.businessName || 'Business'} logo`}
                        style={{ width: '84px', height: '84px', objectFit: 'contain', flexShrink: 0 }}
                      />
                    ) : null}
                    <div>
                    <h1 style={{ margin: '0', fontSize: '2rem', fontWeight: '900', textTransform: 'uppercase' }}>Tax Invoice</h1>
                    <p style={{ margin: '4px 0 0', fontWeight: '600' }}>{state.businessProfile.businessName}</p>
                    <p style={{ margin: '2px 0', fontSize: '0.9rem' }}>{state.businessProfile.address || ''}</p>
                    {state.businessProfile.phone && <p style={{ margin: '2px 0', fontSize: '0.9rem' }}><strong>Phone:</strong> {state.businessProfile.phone}</p>}
                    {state.businessProfile.website && <p style={{ margin: '2px 0', fontSize: '0.9rem' }}><strong>Website:</strong> {state.businessProfile.website}</p>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: '0', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', color: '#444' }}>Invoice Number</p>
                    <p style={{ margin: '2px 0 0', fontSize: '1.4rem', fontWeight: '800' }}>#{sale.invoiceNumber}</p>
                    <p style={{ margin: '15px 0 0', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', color: '#444' }}>Date Issued</p>
                    <p style={{ margin: '2px 0 0', fontSize: '1.1rem', fontWeight: '600' }}>{formatReceiptDate(sale.createdAt)}</p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '35px' }}>
                <div>
                  <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>Bill To</p>
                  <strong style={{ display: 'block', fontSize: '1.25rem' }}>{customer?.name}</strong>
                  <p style={{ margin: '2px 0', fontSize: '0.95rem' }}><strong>Client ID:</strong> {customer?.clientId}</p>
                  {isCustomerClassificationEnabled ? (
                    <p style={{ margin: '2px 0', fontSize: '0.95rem' }}>
                      <strong>Customer Type Snapshot:</strong> {selectCustomerTypeDisplayLabel(sale.customerTypeSnapshot)}
                    </p>
                  ) : null}
                  {customerPhone && <p style={{ margin: '2px 0', fontSize: '0.95rem' }}><strong>Phone:</strong> {customerPhone}</p>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>Status & Payment</p>
                  <div style={{ display: 'inline-block', padding: '4px 12px', border: '2px solid #000', fontWeight: '900', fontSize: '0.9rem' }}>
                    {sale.status.toUpperCase()}
                  </div>
                  <p style={{ margin: '12px 0 0', fontSize: '0.95rem' }}><strong>Method:</strong> {sale.paymentMethod}</p>
                  {sale.paymentReference && <p style={{ margin: '2px 0 0', fontSize: '0.95rem' }}><strong>Ref:</strong> {sale.paymentReference}</p>}
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
                <thead>
                  <tr style={{ background: '#eee', borderBottom: '2px solid #000' }}>
                    <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: '800', borderRight: '1px solid #ddd' }}>Item Description</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '800', borderRight: '1px solid #ddd' }}>Qty</th>
                    <th style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '800', borderRight: '1px solid #ddd' }}>Unit Price</th>
                    <th style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '800' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items && sale.items.length > 0 ? (
                    sale.items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px 10px', borderRight: '1px solid #eee' }}>
                          <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '2px' }}>{item.productName}</strong>
                          <span style={{ fontSize: '0.75rem', color: '#666', fontStyle: 'italic' }}>Ref: {item.inventoryId}</span>
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'center', borderRight: '1px solid #eee' }}>{item.quantity}</td>
                        <td style={{ padding: '12px 10px', textAlign: 'right', borderRight: '1px solid #eee' }}>{formatCurrency(item.unitPrice, currency)}</td>
                        <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(item.total, currency)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '12px 10px', borderRight: '1px solid #eee' }}>
                        <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '2px' }}>{legacyProduct?.name || 'Legacy Item'}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#666', fontStyle: 'italic' }}>Ref: {legacyProduct?.inventoryId || 'N/A'}</span>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', borderRight: '1px solid #eee' }}>{sale.quantity}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', borderRight: '1px solid #eee' }}>{formatCurrency(sale.totalAmount / sale.quantity, currency)}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(sale.totalAmount, currency)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '40px', marginTop: '20px', pageBreakInside: 'avoid' }}>
                <table style={{ width: '320px', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr style={{ borderTop: '2px solid #000' }}>
                      <td style={{ padding: '10px 0', fontSize: '0.95rem', fontWeight: '600' }}>SUBTOTAL</td>
                      <td style={{ padding: '10px 0', textAlign: 'right', fontSize: '1.1rem', fontWeight: '700' }}>{formatCurrency(taxTotals.subtotalAmount, currency)}</td>
                    </tr>
                    {taxTotals.hasTax && taxTotals.isExempt ? (
                      <tr style={{ borderTop: '1px solid #eee' }}>
                        <td style={{ padding: '10px 0', color: '#555', fontSize: '0.95rem' }}>{taxTotals.exemptionReason ? `TAX EXEMPT - ${taxTotals.exemptionReason}` : 'TAX EXEMPT'}</td>
                        <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(0, currency)}</td>
                      </tr>
                    ) : taxTotals.hasTax ? (
                      <tr style={{ borderTop: '1px solid #eee' }}>
                        <td style={{ padding: '10px 0', color: '#555', fontSize: '0.95rem' }}>TAX ({taxTotals.taxRate}%)</td>
                        <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(taxTotals.taxAmount, currency)}</td>
                      </tr>
                    ) : null}
                    {withholdingTotals.hasWithholding ? (
                      <>
                        <tr style={{ borderTop: '1px solid #eee' }}>
                          <td style={{ padding: '10px 0', color: '#555', fontSize: '0.95rem' }}>GROSS TOTAL</td>
                          <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(sale.totalAmount, currency)}</td>
                        </tr>
                        <tr style={{ borderTop: '1px solid #eee' }}>
                          <td style={{ padding: '10px 0', color: '#555', fontSize: '0.95rem' }}>{withholdingTotals.label.toUpperCase()} ({withholdingTotals.rate}%)</td>
                          <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: '700' }}>-{formatCurrency(withholdingTotals.amount, currency)}</td>
                        </tr>
                        <tr style={{ borderTop: '1px solid #eee' }}>
                          <td style={{ padding: '10px 0', color: '#555', fontSize: '0.95rem' }}>NET RECEIVABLE</td>
                          <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(withholdingTotals.netReceivableAmount, currency)}</td>
                        </tr>
                      </>
                    ) : null}
                    <tr style={{ borderTop: '1px solid #eee' }}>
                      <td style={{ padding: '10px 0', color: '#555', fontSize: '0.95rem' }}>PAID TO DATE</td>
                      <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: '700', color: '#2e8b57' }}>{formatCurrency(sale.paidAmount, currency)}</td>
                    </tr>
                    <tr style={{ borderTop: '2px solid #000', background: '#f9f9f9' }}>
                      <td style={{ padding: '15px 10px', fontSize: '1.1rem', fontWeight: '800', textTransform: 'uppercase' }}>Balance Due</td>
                      <td style={{ padding: '15px 10px', textAlign: 'right', fontSize: '1.4rem', fontWeight: '800', color: balanceRemaining > 0 ? '#eb445a' : '#000' }}>{formatCurrency(balanceRemaining, currency)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <footer style={{ marginTop: '100px', borderTop: '1px solid #eee', paddingTop: '20px', textAlign: 'center', fontSize: '0.75rem', color: '#666' }}>
                <p>Thank you for your business at {state.businessProfile.businessName}.</p>
                <p style={{ marginTop: '5px' }}>Generated via BisaPilot GH • {new Date().toLocaleDateString()} • {new Date().toLocaleTimeString()}</p>
              </footer>
              </div>
            </div>
          </div>

          <div className="form-grid no-print" style={{ marginTop: '40px' }}>
            <SectionCard title="Invoice Actions" subtitle={`Use ${invoiceSummaryLine} for printing, PDF saving, email, and WhatsApp sharing.`}>
              <div className="invoice-action-menu-wrap">
                <div className="invoice-action-menu" role="group" aria-label="Invoice actions">
                  {invoiceActions.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      className="invoice-action-pill"
                      onClick={action.onClick}
                      disabled={action.disabled}
                      aria-label={action.label}
                      title={action.label}
                    >
                      <IonIcon icon={action.icon} />
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>

                <div className="invoice-action-grid">
                  {invoiceActions.map((action) => (
                    <div key={`${action.key}-detail`} className={`invoice-action-card${action.disabled ? ' is-disabled' : ''}`}>
                      <div className="invoice-action-card-head">
                        <div className="invoice-action-icon">
                          <IonIcon icon={action.icon} />
                        </div>
                        <div>
                          <strong>{action.label}</strong>
                          <p>{action.helper}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {whatsappDisabled ? (
                <IonNote color="medium">
                  WhatsApp Invoice is disabled because this customer does not have a phone or WhatsApp number saved.
                </IonNote>
              ) : null}

              {actionMessage ? <p className="form-message">{actionMessage}</p> : null}

              <IonButton expand="block" fill="outline" color="primary" onClick={() => history.push(`/sales/${sale.id}/waybill`)}>
                <IonIcon slot="start" icon={documentText} />
                Open Waybill
              </IonButton>

              {sale.status === 'Completed' && hasPermission('sales.reverse') && (
                <IonButton expand="block" color="danger" fill="outline" onClick={() => setShowReverseModal(true)}>
                  Reverse & Void Invoice
                </IonButton>
              )}

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
            </SectionCard>

            <SectionCard title="Audit History" subtitle="Full visibility into stock movements and ledger impacts.">
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

                {canViewCustomerLedger ? (
                  <>
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
                  </>
                ) : (
                  <IonNote color="medium">Customer ledger details are hidden for this role.</IonNote>
                )}
              </div>
            </SectionCard>
          </div>
        </div>

        <IonModal isOpen={showReverseModal} onDidDismiss={() => setShowReverseModal(false)}>
          <IonHeader className="ion-no-border">
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
                      placeholder="e.g. Input error..."
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
