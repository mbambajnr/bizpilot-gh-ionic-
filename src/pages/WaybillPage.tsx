import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton
} from '@ionic/react';
import { printOutline } from 'ionicons/icons';
import React from 'react';
import { useParams } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import { formatReceiptDate } from '../utils/format';

const WaybillPage: React.FC = () => {
  const { saleId } = useParams<{ saleId: string }>();
  const { state, hasPermission } = useBusiness();
  const canPrintWaybill = hasPermission('invoices.print');

  const sale = state.sales.find((s) => s.id === saleId);
  const customer = state.customers.find((c) => c.id === sale?.customerId);

  if (!sale || !customer) return <div className="page-shell">Document not found.</div>;

  const waybillPrefix = state.businessProfile.waybillPrefix ?? 'WAY-';
  const waybillNumber = `${waybillPrefix}${sale.invoiceNumber.split('-').pop()}`;
  const originCountry = state.businessProfile.country?.trim() || 'GH';

  return (
    <IonPage>
      <IonHeader className="ion-no-border no-print">
        <IonToolbar>
          <IonButtons slot="start">
              <IonBackButton defaultHref="/sales" />
          </IonButtons>
          <IonTitle>Waybill</IonTitle>
          <IonButtons slot="end" className="toolbar-action-group">
            {canPrintWaybill ? (
              <IonButton onClick={() => window.print()} className="toolbar-action-button" aria-label="Print Waybill">
                <IonIcon slot="start" icon={printOutline} />
                <span className="toolbar-action-label">Print Waybill</span>
              </IonButton>
            ) : null}
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="document-scroll-shell">
          <div className="doc-page-force waybill-mobile-sheet">
            <div className="waybill-container">
            <header style={{ borderBottom: '4px solid #000', paddingBottom: '20px', marginBottom: '30px', color: '#000' }}>
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
                        <h1 style={{ margin: '0', fontSize: '2.4rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '2px' }}>Waybill</h1>
                        <p style={{ margin: '5px 0 0', fontSize: '1.1rem', fontWeight: '600' }}>Official Delivery Document</p>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: '0', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', color: '#444' }}>Waybill Number</p>
                        <p style={{ margin: '2px 0 0', fontSize: '1.4rem', fontWeight: '800' }}>#{waybillNumber}</p>
                        <p style={{ margin: '15px 0 0', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', color: '#444' }}>Dispatch Date</p>
                        <p style={{ margin: '2px 0 0', fontSize: '1.1rem', fontWeight: '600' }}>{formatReceiptDate(sale.createdAt)}</p>
                    </div>
                </div>
            </header>

            <div className="waybill-identity-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '40px', color: '#000' }}>
                <section style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '4px', background: '#fcfcfc' }}>
                    <p style={{ margin: '0 0 12px', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: '#555', borderBottom: '1px solid #eee', paddingBottom: '6px' }}>Sender / Consignor</p>
                    <h2 style={{ margin: '0', fontSize: '1.25rem', fontWeight: '800' }}>{state.businessProfile.businessName}</h2>
                    <p style={{ margin: '8px 0', fontSize: '0.95rem', lineHeight: '1.5' }}>{state.businessProfile.address || ''}</p>
                    {state.businessProfile.phone && <p style={{ margin: '4px 0', fontSize: '0.95rem' }}><strong>Phone:</strong> {state.businessProfile.phone}</p>}
                    {state.businessProfile.website && <p style={{ margin: '4px 0', fontSize: '0.95rem' }}><strong>Website:</strong> {state.businessProfile.website}</p>}
                </section>

                <section style={{ padding: '20px', border: '1px solid #000', borderRadius: '4px' }}>
                    <p style={{ margin: '0 0 12px', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: '#000', borderBottom: '1px solid #000', paddingBottom: '6px' }}>Recipient / Consignee</p>
                    <h2 style={{ margin: '0', fontSize: '1.25rem', fontWeight: '800' }}>{customer.name}</h2>
                    <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                            <p style={{ margin: '0', fontSize: '0.7rem', color: '#666', fontWeight: '700' }}>CLIENT ID</p>
                            <p style={{ margin: '2px 0 0', fontWeight: '700' }}>{customer.clientId}</p>
                        </div>
                        {customer.phone && (
                          <div>
                            <p style={{ margin: '0', fontSize: '0.7rem', color: '#666', fontWeight: '700' }}>PHONE</p>
                            <p style={{ margin: '2px 0 0', fontWeight: '700' }}>{customer.phone}</p>
                          </div>
                        )}
                    </div>
                </section>
            </div>

            <div className="waybill-goods" style={{ color: '#000' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000' }}>
                    <thead>
                        <tr style={{ background: '#eee', borderBottom: '2px solid #000' }}>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem', fontWeight: '800', borderRight: '1px solid #000' }}>NO</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem', fontWeight: '800', borderRight: '1px solid #000' }}>GOODS DESCRIPTION</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', borderRight: '1px solid #000' }}>UNITS</th>
                            <th style={{ padding: '12px', textAlign: 'right', fontSize: '0.8rem', fontWeight: '800' }}>QUANTITY</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sale.items && sale.items.length > 0 ? (
                            sale.items.map((item, idx) => {
                                const product = state.products.find(p => p.id === item.productId);
                                return (
                                    <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                                        <td style={{ padding: '12px', textAlign: 'left', borderRight: '1px solid #000' }}>{idx + 1}</td>
                                        <td style={{ padding: '12px', textAlign: 'left', borderRight: '1px solid #000' }}>
                                            <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '2px' }}>{item.productName}</strong>
                                            <span style={{ fontSize: '0.75rem', color: '#666', fontStyle: 'italic' }}>Ref: {item.inventoryId}</span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', borderRight: '1px solid #000' }}>{product?.unit || 'Units'}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: '800', fontSize: '1.1rem' }}>{item.quantity}</td>
                                    </tr>
                                )
                            })
                        ) : (
                            <tr style={{ borderBottom: '1px solid #ddd' }}>
                                <td style={{ padding: '12px', textAlign: 'left', borderRight: '1px solid #000' }}>1</td>
                                <td style={{ padding: '12px', textAlign: 'left', borderRight: '1px solid #000' }}>
                                    <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '2px' }}>{state.products.find(p => p.id === sale.productId)?.name || 'Product'}</strong>
                                    <span style={{ fontSize: '0.75rem', color: '#666', fontStyle: 'italic' }}>Ref: {sale.productId}</span>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', borderRight: '1px solid #000' }}>Units</td>
                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: '800' }}>{sale.quantity}</td>
                            </tr>
                        )}
                        {/* Fill rows to maintain depth if few items */}
                        {[...Array(Math.max(0, 5 - (sale.items?.length || 1)))].map((_, i) => (
                             <tr key={`fill-${i}`} style={{ borderBottom: '1px solid #eee', height: '40px' }}>
                                <td style={{ borderRight: '1px solid #000' }}></td>
                                <td style={{ borderRight: '1px solid #000' }}></td>
                                <td style={{ borderRight: '1px solid #000' }}></td>
                                <td></td>
                             </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: '30px', padding: '15px', background: '#f9f9f9', border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', color: '#000' }}>
                <p style={{ margin: '0', fontSize: '0.9rem' }}><strong>Ref Invoice:</strong> {sale.invoiceNumber}</p>
                <p style={{ margin: '0', fontSize: '0.9rem' }}><strong>Origin:</strong> {originCountry}</p>
                <p style={{ margin: '0', fontSize: '0.9rem' }}><strong>System ID:</strong> {sale.id.slice(0, 8)}</p>
            </div>

            <div className="waybill-auth" style={{ marginTop: '60px', display: 'flex', justifyContent: 'space-between', gap: '30px', color: '#000' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <p style={{ margin: '0 0 45px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: '#444' }}>Dispatched By</p>
                    <div style={{ borderBottom: '1.5px solid #000' }}></div>
                    <p style={{ margin: '8px 0 0', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>Warehouse Stamp</p>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <p style={{ margin: '0 0 45px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: '#444' }}>Messenger / Carrier</p>
                    <div style={{ borderBottom: '1.5px solid #000' }}></div>
                    <p style={{ margin: '8px 0 0', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>Delivery Officer</p>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <p style={{ margin: '0 0 45px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: '#444' }}>Received In Good Condition</p>
                    <div style={{ borderBottom: '1.5px solid #000' }}></div>
                    <p style={{ margin: '8px 0 0', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>Consignee Signature</p>
                </div>
            </div>

            <footer style={{ marginTop: '80px', paddingTop: '15px', borderTop: '1px dashed #aaa', textAlign: 'center', fontSize: '0.7rem', color: '#666', fontWeight: '500' }}>
                <p style={{ margin: '0' }}>This {state.businessProfile.businessName} Waybill is a legally binding logistics record of goods in transit.</p>
                <p style={{ margin: '4px 0' }}>Generated via BisaPilot GH Management System • {new Date().toLocaleTimeString()} • Page 1 of 1</p>
            </footer>
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default WaybillPage;
