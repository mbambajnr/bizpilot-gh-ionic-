import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import { archiveOutline, printOutline } from 'ionicons/icons';
import React, { useMemo, useState } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { formatCurrency, formatReceiptDate } from '../utils/format';
import SectionCard from '../components/SectionCard';
import EmptyState from '../components/EmptyState';
import {
  buildInvoicePdf,
  buildQuotationPdf,
  buildWaybillPdf,
  loadLogoDataUrl,
} from '../utils/documentPackPdf';
import { buildZip } from '../utils/zip';

function slugifyFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'document';
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const BatchExportPage: React.FC = () => {
  const { state, hasPermission } = useBusiness();
  const canPrintInvoices = hasPermission('invoices.print');
  const canExportInvoicesPdf = hasPermission('invoices.export_pdf');
  const canPrintQuotations = hasPermission('quotations.print');
  const canExportQuotationsPdf = hasPermission('quotations.export_pdf');
  const canPrintWaybills = hasPermission('invoices.print');
  const canExportWaybillsPdf = hasPermission('invoices.export_pdf');
  const availableTabs = [
    canPrintInvoices || canExportInvoicesPdf ? 'invoices' : null,
    canPrintQuotations || canExportQuotationsPdf ? 'quotations' : null,
    canPrintWaybills || canExportWaybillsPdf ? 'waybills' : null,
  ].filter(Boolean) as Array<'invoices' | 'quotations' | 'waybills'>;
  const [activeTab, setActiveTab] = useState<'invoices' | 'quotations' | 'waybills'>('invoices');
  
  // Selection state
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [selectedQuotations, setSelectedQuotations] = useState<Set<string>>(new Set());
  const [selectedWaybills, setSelectedWaybills] = useState<Set<string>>(new Set());

  const [isPrintMode, setIsPrintMode] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [zipMessage, setZipMessage] = useState('');
  const [showZipToast, setShowZipToast] = useState(false);

  React.useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] ?? 'invoices');
    }
  }, [activeTab, availableTabs]);

  const toggleSelection = (type: string, id: string) => {
    const setters: Record<string, [Set<string>, React.Dispatch<React.SetStateAction<Set<string>>>]> = {
      invoices: [selectedInvoices, setSelectedInvoices],
      quotations: [selectedQuotations, setSelectedQuotations],
      waybills: [selectedWaybills, setSelectedWaybills]
    };

    const [currentSet, setter] = setters[type];
    const nextSet = new Set(currentSet);
    if (nextSet.has(id)) nextSet.delete(id);
    else nextSet.add(id);
    setter(nextSet);
  };

  const handlePrint = () => {
    const totalPrintableCount =
      (canPrintInvoices ? selectedInvoices.size : 0) +
      (canPrintQuotations ? selectedQuotations.size : 0) +
      (canPrintWaybills ? selectedWaybills.size : 0);
    if (totalPrintableCount === 0) {
      return;
    }

    setIsPrintMode(true);
    
    const cleanup = () => {
      setIsPrintMode(false);
      window.removeEventListener('afterprint', cleanup);
      window.removeEventListener('focus', cleanup);
    };

    window.addEventListener('afterprint', cleanup);
    window.addEventListener('focus', cleanup, { once: true });

    setTimeout(() => {
      window.print();
    }, 800);
  };

  const selectedInvoicesData = useMemo(() => 
    (canPrintInvoices || canExportInvoicesPdf ? (state?.sales || []).filter(s => selectedInvoices.has(s.id)) : []), 
  [canExportInvoicesPdf, canPrintInvoices, state?.sales, selectedInvoices]);

  const selectedQuotationsData = useMemo(() => 
    (canPrintQuotations || canExportQuotationsPdf ? (state?.quotations || []).filter(q => selectedQuotations.has(q.id)) : []), 
  [canExportQuotationsPdf, canPrintQuotations, state?.quotations, selectedQuotations]);

  const selectedWaybillsData = useMemo(() => 
    (canPrintWaybills || canExportWaybillsPdf ? (state?.sales || []).filter(s => selectedWaybills.has(s.id)) : []), 
  [canExportWaybillsPdf, canPrintWaybills, state?.sales, selectedWaybills]);

  const totalSelectedCount = selectedInvoices.size + selectedQuotations.size + selectedWaybills.size;
  const totalPrintableCount =
    (canPrintInvoices ? selectedInvoices.size : 0) +
    (canPrintQuotations ? selectedQuotations.size : 0) +
    (canPrintWaybills ? selectedWaybills.size : 0);
  const totalZipCount =
    (canExportInvoicesPdf ? selectedInvoices.size : 0) +
    (canExportQuotationsPdf ? selectedQuotations.size : 0) +
    (canExportWaybillsPdf ? selectedWaybills.size : 0);

  const handleDownloadZip = async () => {
    if (totalZipCount === 0 || isDownloadingZip) {
      return;
    }

    setIsDownloadingZip(true);

    try {
      const logoDataUrl = await loadLogoDataUrl(state.businessProfile.logoUrl);
      const pdfContext = {
        businessProfile: state.businessProfile,
        currency: state.businessProfile.currency,
        logoDataUrl,
      };

      const zipEntries = [
        ...selectedInvoicesData.map((sale) => {
          const customer = state.customers.find((item) => item.id === sale.customerId);
          return {
            name: `invoices/${slugifyFileName(sale.invoiceNumber)}.pdf`,
            content: buildInvoicePdf(sale, customer, pdfContext),
          };
        }),
        ...selectedQuotationsData.map((quotation) => ({
          name: `quotations/${slugifyFileName(quotation.quotationNumber)}.pdf`,
          content: buildQuotationPdf(quotation, pdfContext),
        })),
        ...selectedWaybillsData.map((sale) => {
          const customer = state.customers.find((item) => item.id === sale.customerId);
          const waybillPrefix = state.businessProfile.waybillPrefix ?? 'WAY-';
          const waybillNumber = `${waybillPrefix}${sale.invoiceNumber.split('-').pop()}`;
          return {
            name: `waybills/${slugifyFileName(waybillNumber)}.pdf`,
            content: buildWaybillPdf(sale, customer, pdfContext),
          };
        }),
      ];

      const zipBlob = buildZip(zipEntries);
      downloadBlob(zipBlob, `bisapilot-document-pack-${new Date().toISOString().slice(0, 10)}.zip`);
      setZipMessage(`Downloaded ZIP with ${totalZipCount} document${totalZipCount === 1 ? '' : 's'}.`);
      setShowZipToast(true);
    } catch (error) {
      console.error(error);
      setZipMessage('Could not build the ZIP file right now. Please try again.');
      setShowZipToast(true);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  if (isPrintMode) {
    return (
      <div className="doc-pack-shell" style={{ background: '#fff' }}>
        {/* INVOICES CHAPTER */}
        {selectedInvoicesData.length > 0 && (
          <div className="chapter-wrapper">
            <div className="doc-chapter-divider" style={{ borderBottom: '6px solid #000', padding: '100px 40px', marginBottom: '40px', textAlign: 'center' }}>
              <h1 style={{ fontSize: '4rem', fontWeight: '900', textTransform: 'uppercase', color: '#000' }}>Invoices</h1>
              <p style={{ fontSize: '1.2rem', color: '#444' }}>{selectedInvoicesData.length} Document(s) Included</p>
            </div>
            {selectedInvoicesData.map(sale => {
              const customer = state.customers.find(c => c.id === sale.customerId);
              const currency = state.businessProfile.currency;
              return (
                <div className="doc-page-force" key={`inv-${sale.id}`} style={{ pageBreakAfter: 'always', padding: '20mm', color: '#000' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '15px', marginBottom: '25px' }}>
                      <h2 style={{ fontSize: '1.8rem', fontWeight: '900', margin: '0' }}>TAX INVOICE</h2>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: '0', fontWeight: '700' }}>#{sale.invoiceNumber}</p>
                        <p style={{ margin: '0', fontSize: '0.9rem' }}>{formatReceiptDate(sale.createdAt)}</p>
                      </div>
                   </div>
                   
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '30px' }}>
                      <div>
                        <p style={{ fontSize: '0.7rem', fontWeight: '800', margin: '0 0 5px', color: '#666' }}>FROM</p>
                        <strong>{state.businessProfile.businessName}</strong>
                        <p style={{ margin: '5px 0', fontSize: '0.9rem' }}>{state.businessProfile.address}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.7rem', fontWeight: '800', margin: '0 0 5px', color: '#666' }}>BILL TO</p>
                        <strong>{customer?.name}</strong>
                        {customer?.phone && <p style={{ margin: '5px 0', fontSize: '0.9rem' }}>Phone: {customer.phone}</p>}
                        {customer?.email && <p style={{ margin: '5px 0', fontSize: '0.9rem' }}>Email: {customer.email}</p>}
                      </div>
                   </div>

                   <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px' }}>
                      <thead>
                        <tr style={{ background: '#000', color: '#fff' }}>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Item Description</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Qty</th>
                          <th style={{ padding: '10px', textAlign: 'right' }}>Price</th>
                          <th style={{ padding: '10px', textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sale.items || []).map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '12px 10px' }}>
                              <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '2px' }}>{item.productName}</strong>
                              <span style={{ fontSize: '0.75rem', color: '#666', fontStyle: 'italic' }}>Ref: {item.inventoryId}</span>
                            </td>
                            <td style={{ padding: '12px 10px', textAlign: 'center' }}>{item.quantity}</td>
                            <td style={{ padding: '12px 10px', textAlign: 'right' }}>{formatCurrency(item.unitPrice, currency)}</td>
                            <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(item.total, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                   </table>

                   <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', pageBreakInside: 'avoid' }}>
                      <table style={{ width: '300px', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr style={{ borderTop: '2px solid #000' }}>
                            <td style={{ padding: '8px 0', fontSize: '0.9rem', fontWeight: '600' }}>INV TOTAL</td>
                            <td style={{ padding: '8px 0', textAlign: 'right', fontSize: '1.1rem', fontWeight: '700' }}>{formatCurrency(sale.totalAmount, currency)}</td>
                          </tr>
                          <tr style={{ borderTop: '1px solid #eee' }}>
                            <td style={{ padding: '5px 0', fontSize: '0.9rem', color: '#666' }}>PAID TO DATE</td>
                            <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: '600', color: '#2e8b57' }}>{formatCurrency(sale.paidAmount, currency)}</td>
                          </tr>
                          <tr style={{ borderTop: '1.5px solid #000', marginTop: '5px', background: '#f5f5f5' }}>
                            <td style={{ padding: '10px', fontSize: '1.0rem', fontWeight: '700', textTransform: 'uppercase' }}>Balance Due</td>
                            <td style={{ padding: '10px', textAlign: 'right', fontSize: '1.2rem', fontWeight: '800', color: (sale.totalAmount - sale.paidAmount) > 0 ? '#eb445a' : '#000' }}>{formatCurrency(Math.max(0, sale.totalAmount - sale.paidAmount), currency)}</td>
                          </tr>
                        </tbody>
                      </table>
                   </div>
                </div>
              );
            })}
          </div>
        )}

        {/* QUOTATIONS CHAPTER */}
        {selectedQuotationsData.length > 0 && (
          <div className="chapter-wrapper">
            <div className="doc-chapter-divider" style={{ borderBottom: '6px solid #000', padding: '100px 40px', margin: '40px 0', textAlign: 'center' }}>
              <h1 style={{ fontSize: '4rem', fontWeight: '900', textTransform: 'uppercase', color: '#000' }}>Quotations</h1>
              <p style={{ fontSize: '1.2rem', color: '#444' }}>{selectedQuotationsData.length} Document(s) Included</p>
            </div>
            {selectedQuotationsData.map(quotation => {
              const currency = state.businessProfile.currency;
              return (
                <div className="doc-page-force" key={`qtn-${quotation.id}`} style={{ pageBreakAfter: 'always', padding: '20mm', color: '#000' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '15px', marginBottom: '25px' }}>
                      <h2 style={{ fontSize: '1.8rem', fontWeight: '900', margin: '0' }}>QUOTATION</h2>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: '0', fontWeight: '700' }}>#{quotation.quotationNumber}</p>
                        <p style={{ margin: '0', fontSize: '0.9rem' }}>{formatReceiptDate(quotation.createdAt)}</p>
                      </div>
                   </div>

                   <div style={{ marginBottom: '30px' }}>
                      <p style={{ fontSize: '0.7rem', fontWeight: '800', margin: '0 0 5px', color: '#666' }}>PREPARED FOR</p>
                      <strong style={{ fontSize: '1.2rem' }}>{quotation.customerName}</strong>
                   </div>

                   <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #000' }}>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Item Description</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Qty</th>
                          <th style={{ padding: '10px', textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quotation.items.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '12px 10px' }}>
                              <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '2px' }}>{item.productName}</strong>
                              <span style={{ fontSize: '0.75rem', color: '#666', fontStyle: 'italic' }}>Ref: {item.inventoryId}</span>
                            </td>
                            <td style={{ padding: '12px 10px', textAlign: 'center' }}>{item.quantity}</td>
                            <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(item.total, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                   </table>

                   <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                      <div style={{ width: '300px', padding: '15px', background: '#f5f5f5', border: '1px solid #ddd' }}>
                         <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '20px' }}>
                            <span style={{ fontWeight: '600' }}>EST. TOTAL:</span>
                            <strong style={{ fontSize: '1.2rem' }}>{formatCurrency(quotation.totalAmount, currency)}</strong>
                         </div>
                      </div>
                   </div>
                </div>
              );
            })}
          </div>
        )}

        {/* WAYBILLS CHAPTER */}
        {selectedWaybillsData.length > 0 && (
          <div className="chapter-wrapper">
            <div className="doc-chapter-divider" style={{ borderBottom: '6px solid #000', padding: '100px 40px', margin: '40px 0', textAlign: 'center' }}>
              <h1 style={{ fontSize: '4rem', fontWeight: '900', textTransform: 'uppercase', color: '#000' }}>Waybills</h1>
              <p style={{ fontSize: '1.2rem', color: '#444' }}>{selectedWaybillsData.length} Document(s) Included</p>
            </div>
            {selectedWaybillsData.map(sale => {
              const customer = state.customers.find(c => c.id === sale.customerId);
              const waybillPrefix = state.businessProfile.waybillPrefix ?? 'WAY-';
              const waybillNumber = `${waybillPrefix}${sale.invoiceNumber.split('-').pop()}`;
              return (
                <div className="doc-page-force" key={`wb-${sale.id}`} style={{ pageBreakAfter: 'always', padding: '20mm', color: '#000' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '4px solid #000', paddingBottom: '15px', marginBottom: '30px' }}>
                      <h2 style={{ fontSize: '2rem', fontWeight: '900', margin: '0' }}>WAYBILL</h2>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: '0', fontWeight: '800' }}>#{waybillNumber}</p>
                        <p style={{ margin: '0', fontSize: '0.9rem' }}>{formatReceiptDate(sale.createdAt)}</p>
                      </div>
                   </div>

                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '40px' }}>
                      <section style={{ padding: '15px', border: '1px solid #ddd' }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#666', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>CONSIGNOR</p>
                        <strong>{state.businessProfile.businessName}</strong>
                        <p style={{ fontSize: '0.9rem', margin: '5px 0' }}>{state.businessProfile.address}</p>
                      </section>
                      <section style={{ padding: '15px', border: '2px solid #000' }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: '800', borderBottom: '1px solid #000', paddingBottom: '5px' }}>CONSIGNEE</p>
                        <strong>{customer?.name}</strong>
                        {customer?.phone && <p style={{ fontSize: '0.9rem', margin: '0' }}>Phone: {customer.phone}</p>}
                        {customer?.email && <p style={{ fontSize: '0.9rem', margin: '5px 0 0' }}>Email: {customer.email}</p>}
                      </section>
                   </div>

                   <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '40px' }}>
                      <thead>
                        <tr style={{ background: '#eee', borderBottom: '2px solid #000' }}>
                          <th style={{ padding: '12px', textAlign: 'left', borderRight: '1px solid #000' }}>Description</th>
                          <th style={{ padding: '12px', textAlign: 'right' }}>Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sale.items || []).map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '12px', borderRight: '1px solid #000' }}>
                                <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '2px' }}>{item.productName}</strong>
                                <span style={{ fontSize: '0.75rem', color: '#666', fontStyle: 'italic' }}>Ref: {item.inventoryId}</span>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: '700', fontSize: '1.1rem' }}>{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                   </table>

                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '30px', marginTop: '60px' }}>
                      <div>
                        <div style={{ height: '50px', borderBottom: '1px solid #000' }}></div>
                        <p style={{ fontSize: '0.7rem', textAlign: 'center', marginTop: '5px' }}>DISPATCHER</p>
                      </div>
                      <div>
                        <div style={{ height: '50px', borderBottom: '1px solid #000' }}></div>
                        <p style={{ fontSize: '0.7rem', textAlign: 'center', marginTop: '5px' }}>CARRIER</p>
                      </div>
                      <div>
                        <div style={{ height: '50px', borderBottom: '1px solid #000' }}></div>
                        <p style={{ fontSize: '0.7rem', textAlign: 'center', marginTop: '5px' }}>RECIPIENT</p>
                      </div>
                   </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/sales" />
          </IonButtons>
          <IonTitle>Document Pack</IonTitle>
          <IonButtons slot="end" className="toolbar-action-group">
            <IonButton 
              className="toolbar-action-button"
              disabled={totalZipCount === 0 || isDownloadingZip}
              onClick={handleDownloadZip}
              color="medium"
              fill="outline"
              aria-label={isDownloadingZip ? 'Building ZIP' : 'Download ZIP'}
            >
              <IonIcon slot="start" icon={archiveOutline} />
              <span className="toolbar-action-label">{isDownloadingZip ? 'Building ZIP...' : 'Download ZIP'}</span>
            </IonButton>
            <IonButton 
              className="toolbar-action-button"
              disabled={totalPrintableCount === 0}
              onClick={handlePrint}
              color="primary"
              fill="solid"
              aria-label="Export PDF"
            >
              <IonIcon slot="start" icon={printOutline} />
              <span className="toolbar-action-label">Export PDF</span>
            </IonButton>
          </IonButtons>
        </IonToolbar>
        <IonToolbar>
           <IonSegment value={activeTab} onIonChange={(e) => setActiveTab(e.detail.value as any)}>
             {availableTabs.includes('invoices') ? <IonSegmentButton value="invoices">Invoices</IonSegmentButton> : null}
             {availableTabs.includes('quotations') ? <IonSegmentButton value="quotations">Quotes</IonSegmentButton> : null}
             {availableTabs.includes('waybills') ? <IonSegmentButton value="waybills">Waybills</IonSegmentButton> : null}
           </IonSegment>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="page-shell">
            <SectionCard title="Select Documents" subtitle="Pick exactly what should be included in your generated document pack.">
               {availableTabs.length === 0 ? (
                 <EmptyState
                   eyebrow="Document access disabled"
                   title="This role cannot export any document packs."
                   message="Ask an admin to grant invoice or quotation print/PDF permissions before using the document pack builder."
                 />
               ) : (
                 <IonList lines="full" className="app-list">
                  {activeTab === 'invoices' && (state?.sales || []).filter(s => s.status !== 'Reversed').map(sale => {
                    const customer = state.customers.find(c => c.id === sale.customerId);
                    return (
                      <IonItem key={sale.id} className="app-item">
                        <IonCheckbox 
                          slot="start" 
                          checked={selectedInvoices.has(sale.id)} 
                          onIonChange={() => toggleSelection('invoices', sale.id)}
                        />
                        <IonLabel>
                          <strong>{sale.invoiceNumber}</strong>
                          <p>{customer?.name} • {formatCurrency(sale.totalAmount, state.businessProfile.currency)}</p>
                        </IonLabel>
                      </IonItem>
                    );
                  })}

                  {activeTab === 'quotations' && (state?.quotations || []).map(q => (
                    <IonItem key={q.id} className="app-item">
                      <IonCheckbox 
                        slot="start" 
                        checked={selectedQuotations.has(q.id)} 
                        onIonChange={() => toggleSelection('quotations', q.id)}
                      />
                      <IonLabel>
                        <strong>{q.quotationNumber}</strong>
                        <p>{q.customerName} • {formatCurrency(q.totalAmount, state.businessProfile.currency)}</p>
                      </IonLabel>
                    </IonItem>
                  ))}

                  {activeTab === 'waybills' && (state?.sales || []).filter(s => s.status !== 'Reversed').map(sale => {
                     const customer = state.customers.find(c => c.id === sale.customerId);
                     const waybillPrefix = state.businessProfile.waybillPrefix ?? 'WAY-';
                     const waybillNumber = `${waybillPrefix}${sale.invoiceNumber.split('-').pop()}`;
                     return (
                       <IonItem key={sale.id} className="app-item">
                         <IonCheckbox 
                           slot="start" 
                           checked={selectedWaybills.has(sale.id)} 
                           onIonChange={() => toggleSelection('waybills', sale.id)}
                         />
                         <IonLabel>
                           <strong>{waybillNumber}</strong>
                           <p>{customer?.name} • Invoice {sale.invoiceNumber}</p>
                         </IonLabel>
                       </IonItem>
                     );
                  })}
                 </IonList>
               )}
            </SectionCard>
        </div>
      </IonContent>
      <IonToast
        isOpen={showZipToast}
        message={zipMessage}
        duration={2200}
        color={zipMessage.startsWith('Could not') ? 'danger' : 'success'}
        position="top"
        onDidDismiss={() => setShowZipToast(false)}
      />
    </IonPage>
  );
};

export default BatchExportPage;
