'use client';

import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  CalendarClock,
  ExternalLink,
  FileText,
  History,
  Upload,
  Trash2,
  FilePlus2,
  PackageCheck,
  Plus,
  Search,
  ShoppingBag,
  Store,
  TrendingUp,
  X,
} from 'lucide-react';
import { type FormEvent, type KeyboardEvent as ReactKeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';

import { useBusiness } from '../../src/context/BusinessContext';
import type { ProcurementDocument, Purchase, PurchaseItem, PurchaseStatus } from '../../src/data/seedBusiness';
import { loadMagentoReorder, type MagentoReorderItem, type MagentoReorderResult } from '../../src/lib/magentoClient';
import { selectProcurementWorklist, selectWarehouseWorklist } from '../../src/selectors/businessSelectors';
import { canApproveCategory, selectPurchaseDeliveredQuantity, selectPurchaseOpenInspection, selectPurchaseReceivedQuantity } from '../../src/utils/businessLogic';
import { formatCurrency, formatRelativeDate } from '../../src/utils/format';
import { EnterpriseApp } from './enterprise-app';
import { EnterpriseShell } from './enterprise-shell';
import { deleteProcurementDocument, getProcurementDocumentUrl, uploadProcurementDocument } from '../lib/procurement-documents';

type ProcurementTab = 'orders' | 'approvals' | 'receiving' | 'invoices' | 'exceptions' | 'reorder' | 'suppliers';
type DraftLine = Pick<PurchaseItem, 'productId' | 'productName' | 'quantity' | 'unitCost' | 'totalCost'>;

const STATUS_META: Record<PurchaseStatus, { label: string; tone: 'neutral' | 'warn' | 'good' | 'risk' }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  submitted: { label: 'Awaiting approval', tone: 'warn' },
  adminReviewed: { label: 'Under review', tone: 'warn' },
  approved: { label: 'Awaiting receipt', tone: 'good' },
  arrivedPendingInspection: { label: 'Inspection required', tone: 'warn' },
  partiallyReceived: { label: 'Partially received', tone: 'warn' },
  receivedToWarehouse: { label: 'Received', tone: 'good' },
  declined: { label: 'Declined', tone: 'risk' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

function isOverduePurchase(purchase: Purchase) {
  return Boolean(purchase.expectedDeliveryDate && ['approved', 'partiallyReceived'].includes(purchase.status) && Date.parse(`${purchase.expectedDeliveryDate}T23:59:59`) < Date.now());
}

function getPurchaseExceptions(purchase: Purchase) {
  const exceptions: Array<{ label: string; tone: 'warn' | 'risk' }> = [];
  if (isOverduePurchase(purchase)) exceptions.push({ label: 'Delivery overdue', tone: 'risk' });
  if (purchase.status === 'partiallyReceived') exceptions.push({ label: 'Backorder open', tone: 'warn' });
  if (purchase.status === 'arrivedPendingInspection') exceptions.push({ label: 'Inspection pending', tone: 'risk' });
  if ((purchase.receipts ?? []).some((receipt) => receipt.status === 'exception')) exceptions.push({ label: 'Receipt exception', tone: 'risk' });
  if (purchase.status === 'receivedToWarehouse' && !purchase.supplierInvoiceNumber) exceptions.push({ label: 'Supplier invoice missing', tone: 'warn' });
  if (purchase.threeWayMatchStatus === 'variance') exceptions.push({ label: 'Three-way match variance', tone: 'risk' });
  return exceptions;
}

export function EnterpriseProcurement() {
  return (
    <EnterpriseApp>
      <EnterpriseProcurementView />
    </EnterpriseApp>
  );
}

function EnterpriseProcurementView() {
  const {
    state,
    currentUser,
    hasPermission,
    createPurchaseDraft,
    submitPurchase,
    approvePurchase,
    cancelPurchase,
    recordPurchaseArrival,
    completePurchaseInspection,
    recordSupplierInvoice,
    updatePurchaseDetails,
    addPurchaseDocument,
    removePurchaseDocument,
  } = useBusiness();
  const [tab, setTab] = useState<ProcurementTab>('orders');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PurchaseStatus>('all');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState(state.purchases[0]?.id ?? '');
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerPrefill, setComposerPrefill] = useState<{ productId: string; quantity: number } | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [declineNote, setDeclineNote] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [reorder, setReorder] = useState<MagentoReorderResult | null>(null);
  const [reorderError, setReorderError] = useState('');
  const procurement = useMemo(() => selectProcurementWorklist(state), [state]);
  const warehouse = useMemo(() => selectWarehouseWorklist(state), [state]);
  const activeWarehouses = state.locations.filter((location) => location.type === 'warehouse' && location.isActive);
  const activeVendors = state.vendors.filter((vendor) => vendor.status === 'active');
  const canView = hasPermission('purchases.view') || hasPermission('procurement.view') || hasPermission('payables.manage');
  const canCreate = hasPermission('purchases.create') || hasPermission('procurement.create');
  const canApprove = canApproveCategory(state, currentUser, 'purchases', hasPermission);
  const canReceive = hasPermission('purchases.receive');
  const canRecordInvoice = hasPermission('payables.manage');
  const canEditPurchase = canCreate || canApprove || canRecordInvoice;
  const matchExceptions = state.purchases.filter((purchase) =>
    ['approved', 'arrivedPendingInspection', 'partiallyReceived', 'receivedToWarehouse'].includes(purchase.status) && purchase.threeWayMatchStatus !== 'matched'
  ).length;
  const exceptionPurchases = useMemo(() => state.purchases.filter((purchase) => getPurchaseExceptions(purchase).length > 0), [state.purchases]);

  useEffect(() => {
    let active = true;
    void loadMagentoReorder(30)
      .then(({ reorder: result }) => {
        if (active) setReorder(result);
      })
      .catch((error: unknown) => {
        if (active) setReorderError(error instanceof Error ? error.message : 'Magento reorder intelligence is unavailable.');
      });
    return () => { active = false; };
  }, []);

  const scopedPurchases = useMemo(() => {
    if (tab === 'approvals') return state.purchases.filter((purchase) => ['submitted', 'adminReviewed'].includes(purchase.status));
    if (tab === 'receiving') return state.purchases.filter((purchase) => ['approved', 'arrivedPendingInspection', 'partiallyReceived'].includes(purchase.status));
    if (tab === 'invoices') return state.purchases.filter((purchase) => ['approved', 'arrivedPendingInspection', 'partiallyReceived', 'receivedToWarehouse'].includes(purchase.status));
    if (tab === 'exceptions') return exceptionPurchases;
    return state.purchases;
  }, [exceptionPurchases, state.purchases, tab]);
  const filteredPurchases = scopedPurchases.filter((purchase) => {
    const vendor = state.vendors.find((entry) => entry.id === purchase.vendorId);
    const matchesQuery = `${purchase.purchaseCode} ${purchase.vendorCode} ${vendor?.name ?? ''}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (statusFilter === 'all' || purchase.status === statusFilter);
  });
  const selectedPurchase = filteredPurchases.find((purchase) => purchase.id === selectedPurchaseId) ?? filteredPurchases[0];

  async function runAction(action: () => Promise<{ ok: boolean; message?: string }>, successMessage: string) {
    setActionBusy(true);
    setActionMessage('');
    const result = await action();
    setActionMessage(result.message ?? (result.ok ? successMessage : 'The action could not be completed.'));
    setActionBusy(false);
  }

  function openReorderDraft(item: MagentoReorderItem) {
    const product = state.products.find((entry) => entry.inventoryId.toLowerCase() === item.sku.toLowerCase());
    if (!product) {
      setActionMessage(`${item.sku} is not mapped to a BisaPilot inventory item yet.`);
      return;
    }
    setComposerPrefill({ productId: product.id, quantity: item.suggested_reorder || 1 });
    setComposerOpen(true);
  }

  async function uploadDocument(purchase: Purchase, file: File, category: ProcurementDocument['category']) {
    setActionBusy(true);
    setActionMessage('Uploading document securely...');
    try {
      const result = await uploadProcurementDocument(file, { purchaseId: purchase.id, businessId: state.businessProfile.id, category, user: currentUser });
      const saved = await addPurchaseDocument({ purchaseId: purchase.id, category, ...result.document, uploadedBy: currentUser.userId });
      setActionMessage(saved.message ?? (saved.ok ? 'Document uploaded and attached.' : 'The uploaded file could not be attached.'));
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'The document upload failed.');
    } finally {
      setActionBusy(false);
    }
  }

  async function openDocument(purchase: Purchase, document: ProcurementDocument) {
    if (document.url) {
      window.open(document.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!document.storagePath) return;
    try {
      const result = await getProcurementDocumentUrl({ purchaseId: purchase.id, businessId: state.businessProfile.id, storagePath: document.storagePath, user: currentUser });
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'The document could not be opened.');
    }
  }

  async function removeDocument(purchase: Purchase, document: ProcurementDocument) {
    setActionBusy(true);
    setActionMessage('Removing document...');
    try {
      if (document.storagePath) await deleteProcurementDocument({ purchaseId: purchase.id, businessId: state.businessProfile.id, storagePath: document.storagePath, user: currentUser });
      const result = await removePurchaseDocument({ purchaseId: purchase.id, documentId: document.id, removedBy: currentUser.userId });
      setActionMessage(result.message ?? (result.ok ? 'Document removed.' : 'The document could not be removed.'));
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'The document could not be removed.');
    } finally {
      setActionBusy(false);
    }
  }

  if (!canView) {
    return <EnterpriseShell active="Procurement"><div className="page-content"><section className="access-denied"><ClipboardCheck size={24} /><h1>Procurement access is restricted</h1><p>Your role does not include purchase-order visibility.</p></section></div></EnterpriseShell>;
  }

  return (
    <EnterpriseShell active="Procurement">
      <div className="page-content procurement-page">
        <section className="page-heading procurement-heading">
          <div><p className="eyebrow">Supply operations</p><h1>Procurement workspace</h1><p>Move supplier demand through approval, receipt, and accounting control.</p></div>
          {canCreate ? <button className="primary-button" type="button" onClick={() => { setComposerPrefill(null); setComposerOpen(true); }}><Plus size={16} /> New purchase order</button> : null}
        </section>

        <section className="procurement-metrics" aria-label="Procurement worklist">
          <ProcurementMetric icon={FilePlus2} label="Draft orders" value={procurement.draftCount} helper="Not yet submitted" />
          <ProcurementMetric icon={ClipboardCheck} label="Awaiting approval" value={procurement.awaitingApprovalCount} helper={canApprove ? 'Needs your review' : 'With General Manager'} tone={procurement.awaitingApprovalCount ? 'warn' : 'good'} />
          <ProcurementMetric icon={PackageCheck} label="Awaiting receipt" value={warehouse.approvedPurchasesAwaitingReceiptCount} helper="Approved supplier orders" tone={warehouse.approvedPurchasesAwaitingReceiptCount ? 'warn' : 'good'} />
          <ProcurementMetric icon={ClipboardCheck} label="Match exceptions" value={matchExceptions} helper="Receipt or invoice pending" tone={matchExceptions ? 'warn' : 'good'} />
        </section>

        <nav className="procurement-tabs" aria-label="Procurement views">
          {([
            ['orders', 'Purchase orders'],
            ['approvals', `Approvals${procurement.awaitingApprovalCount ? ` (${procurement.awaitingApprovalCount})` : ''}`],
            ['receiving', `Receiving${warehouse.approvedPurchasesAwaitingReceiptCount ? ` (${warehouse.approvedPurchasesAwaitingReceiptCount})` : ''}`],
            ['invoices', `Invoice matching${matchExceptions ? ` (${matchExceptions})` : ''}`],
            ['exceptions', `Exceptions${exceptionPurchases.length ? ` (${exceptionPurchases.length})` : ''}`],
            ['reorder', 'Reorder intelligence'],
            ['suppliers', 'Suppliers'],
          ] as const).map(([value, label]) => <button type="button" className={tab === value ? 'procurement-tab procurement-tab--active' : 'procurement-tab'} onClick={() => { setTab(value); setActionMessage(''); }} key={value}>{label}</button>)}
        </nav>

        {actionMessage ? <div className="settings-message" role="status">{actionMessage}</div> : null}

        {tab === 'reorder' ? (
          <ReorderWorkspace feed={reorder} error={reorderError} canCreate={canCreate} onCreateDraft={openReorderDraft} currency={state.businessProfile.currency} />
        ) : tab === 'suppliers' ? (
          <SupplierWorkspace vendors={state.vendors} purchaseCounts={new Map(state.vendors.map((vendor) => [vendor.id, state.purchases.filter((purchase) => purchase.vendorId === vendor.id).length]))} />
        ) : tab === 'exceptions' ? (
          <ExceptionWorkspace purchases={exceptionPurchases} currency={state.businessProfile.currency} onOpen={(purchase) => { setSelectedPurchaseId(purchase.id); setTab('orders'); }} />
        ) : (
          <section className="procurement-workspace">
            <div className="purchase-list-panel">
              <div className="purchase-toolbar">
                <label className="purchase-search"><Search size={15} /><input aria-label="Search purchase orders" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search orders or suppliers" /></label>
                <select aria-label="Filter purchase status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                  <option value="all">All statuses</option>
                  {Object.entries(STATUS_META).map(([value, meta]) => <option value={value} key={value}>{meta.label}</option>)}
                </select>
              </div>
              <div className="purchase-table-wrap">
                <table className="purchase-table">
                  <thead><tr><th>Purchase order</th><th>Supplier</th><th>Total</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {filteredPurchases.map((purchase) => {
                      const vendor = state.vendors.find((entry) => entry.id === purchase.vendorId);
                      const meta = STATUS_META[purchase.status];
                      return <tr className={selectedPurchase?.id === purchase.id ? 'purchase-row purchase-row--selected' : 'purchase-row'} key={purchase.id} onClick={() => setSelectedPurchaseId(purchase.id)}><td><strong>{purchase.purchaseCode}</strong><span>{formatRelativeDate(purchase.createdAt)} · {purchase.items.length} lines</span></td><td>{vendor?.name ?? purchase.vendorCode}</td><td>{formatCurrency(purchase.totalAmount, state.businessProfile.currency)}</td><td><span className={`purchase-status purchase-status--${meta.tone}`}>{meta.label}</span></td><td><ChevronRight size={15} /></td></tr>;
                    })}
                  </tbody>
                </table>
                {!filteredPurchases.length ? <div className="procurement-empty"><ShoppingBag size={22} /><strong>No purchase orders in this view</strong><span>New and matching supplier orders will appear here.</span></div> : null}
              </div>
            </div>

            <PurchaseDetail
              key={selectedPurchase?.id ?? 'empty'}
              purchase={selectedPurchase}
              state={state}
              currentUserId={currentUser.userId}
              canCreate={canCreate}
              canApprove={selectedPurchase ? canApproveCategory(state, currentUser, 'purchases', hasPermission, selectedPurchase.totalAmount) : canApprove}
              canReceive={canReceive}
              canRecordInvoice={canRecordInvoice}
              canEditPurchase={canEditPurchase}
              actionBusy={actionBusy}
              declineNote={declineNote}
              warehouseId={warehouseId}
              onDeclineNoteChange={setDeclineNote}
              onWarehouseChange={setWarehouseId}
              onSubmit={(purchase) => void runAction(() => submitPurchase({ purchaseId: purchase.id, performedBy: currentUser.userId }), `${purchase.purchaseCode} submitted for approval.`)}
              onApprove={(purchase) => void runAction(() => approvePurchase({ purchaseId: purchase.id, performedBy: currentUser.userId }), `${purchase.purchaseCode} approved.`)}
              onDecline={(purchase) => void runAction(() => cancelPurchase({ purchaseId: purchase.id, performedBy: currentUser.userId, note: declineNote }), `${purchase.purchaseCode} declined.`)}
              onRecordArrival={(purchase, arrival) => void runAction(() => recordPurchaseArrival({ purchaseId: purchase.id, warehouseId: warehouseId || activeWarehouses[0]?.id || '', performedBy: currentUser.userId, ...arrival }), `${purchase.purchaseCode} arrival recorded.`)}
              onCompleteInspection={(purchase, receiptId, items, inspectionNote) => void runAction(() => completePurchaseInspection({ purchaseId: purchase.id, receiptId, inspectedBy: currentUser.userId, items, inspectionNote }), `${purchase.purchaseCode} inspection completed.`)}
              onRecordInvoice={(purchase, invoice) => void runAction(() => recordSupplierInvoice({ purchaseId: purchase.id, ...invoice, recordedBy: currentUser.userId }), `Supplier invoice matched against ${purchase.purchaseCode}.`)}
              onUpdateDetails={(purchase, details) => void runAction(() => updatePurchaseDetails({ purchaseId: purchase.id, ...details, updatedBy: currentUser.userId }), `Delivery details saved for ${purchase.purchaseCode}.`)}
              onAddDocument={(purchase, document) => void runAction(() => addPurchaseDocument({ purchaseId: purchase.id, ...document, uploadedBy: currentUser.userId }), `Document linked to ${purchase.purchaseCode}.`)}
              onUploadDocument={(purchase, file, category) => void uploadDocument(purchase, file, category)}
              onOpenDocument={(purchase, document) => void openDocument(purchase, document)}
              onRemoveDocument={(purchase, document) => void removeDocument(purchase, document)}
            />
          </section>
        )}
      </div>

      {composerOpen ? <PurchaseComposer vendors={activeVendors} products={state.products} currency={state.businessProfile.currency} currentUserId={currentUser.userId} prefill={composerPrefill} onClose={() => setComposerOpen(false)} onCreate={createPurchaseDraft} onMessage={setActionMessage} /> : null}
    </EnterpriseShell>
  );
}

function ProcurementMetric({ icon: Icon, label, value, helper, tone = 'neutral' }: { icon: typeof FilePlus2; label: string; value: number; helper: string; tone?: 'neutral' | 'warn' | 'good' }) {
  return <article><div className={`procurement-metric-icon procurement-metric-icon--${tone}`}><Icon size={17} /></div><div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div></article>;
}

function ExceptionWorkspace({ purchases, currency, onOpen }: { purchases: Purchase[]; currency: string; onOpen: (purchase: Purchase) => void }) {
  return <section className="exception-workspace"><div className="reorder-heading"><div><p className="eyebrow">Control centre</p><h2>Procurement exceptions</h2><p>Prioritized delivery, receipt, invoice, and matching issues that need intervention.</p></div><span className={`status-pill ${purchases.length ? 'status-pill--warn' : 'status-pill--good'}`}>{purchases.length} open</span></div>{purchases.length ? <div className="exception-list">{purchases.map((purchase) => <article key={purchase.id}><div><strong>{purchase.purchaseCode}</strong><span>{purchase.vendorCode} · {formatCurrency(purchase.totalAmount, currency)}</span></div><div className="exception-tags">{getPurchaseExceptions(purchase).map((exception) => <span className={`purchase-status purchase-status--${exception.tone}`} key={exception.label}>{exception.label}</span>)}</div><div className="exception-date"><span>Expected delivery</span><strong>{purchase.expectedDeliveryDate ? new Date(`${purchase.expectedDeliveryDate}T00:00:00`).toLocaleDateString() : 'Not committed'}</strong></div><button className="secondary-button" type="button" onClick={() => onOpen(purchase)}>Open order <ChevronRight size={14} /></button></article>)}</div> : <div className="procurement-empty"><ClipboardCheck size={22} /><strong>No procurement exceptions</strong><span>Delivery, receipt, invoice, and matching controls are currently clear.</span></div>}</section>;
}

function PurchaseDetail({ purchase, state, currentUserId, canCreate, canApprove, canReceive, canRecordInvoice, canEditPurchase, actionBusy, declineNote, warehouseId, onDeclineNoteChange, onWarehouseChange, onSubmit, onApprove, onDecline, onRecordArrival, onCompleteInspection, onRecordInvoice, onUpdateDetails, onAddDocument, onUploadDocument, onOpenDocument, onRemoveDocument }: {
  purchase?: Purchase;
  state: ReturnType<typeof useBusiness>['state'];
  currentUserId: string;
  canCreate: boolean;
  canApprove: boolean;
  canReceive: boolean;
  canRecordInvoice: boolean;
  canEditPurchase: boolean;
  actionBusy: boolean;
  declineNote: string;
  warehouseId: string;
  onDeclineNoteChange: (value: string) => void;
  onWarehouseChange: (value: string) => void;
  onSubmit: (purchase: Purchase) => void;
  onApprove: (purchase: Purchase) => void;
  onDecline: (purchase: Purchase) => void;
  onRecordArrival: (purchase: Purchase, arrival: { receivedItems: Array<{ productId: string; quantity: number }>; deliveryNoteNumber?: string; carrier?: string }) => void;
  onCompleteInspection: (purchase: Purchase, receiptId: string, items: Array<{ productId: string; acceptedQuantity: number; quarantinedQuantity: number; rejectedQuantity: number; inspectionNote?: string }>, inspectionNote?: string) => void;
  onRecordInvoice: (purchase: Purchase, invoice: { invoiceNumber: string; invoiceAmount: number; invoiceDate: string }) => void;
  onUpdateDetails: (purchase: Purchase, details: { expectedDeliveryDate: string; paymentTerms: string; internalNotes: string }) => void;
  onAddDocument: (purchase: Purchase, document: { category: 'supplierQuote' | 'purchaseOrder' | 'supplierInvoice' | 'deliveryNote' | 'other'; name: string; url: string }) => void;
  onUploadDocument: (purchase: Purchase, file: File, category: ProcurementDocument['category']) => void;
  onOpenDocument: (purchase: Purchase, document: ProcurementDocument) => void;
  onRemoveDocument: (purchase: Purchase, document: ProcurementDocument) => void;
}) {
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, number>>(() => Object.fromEntries((purchase?.items ?? []).map((item) => [item.productId, Math.max(0, item.quantity - selectPurchaseReceivedQuantity(purchase!, item.productId))])));
  const openInspection = purchase ? selectPurchaseOpenInspection(purchase) : undefined;
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [inspectionNote, setInspectionNote] = useState('');
  const [inspectionQuantities, setInspectionQuantities] = useState<Record<string, { accepted: number; quarantined: number; rejected: number }>>(() => Object.fromEntries((openInspection?.items ?? []).map((item) => [item.productId, { accepted: item.quantity, quarantined: 0, rejected: 0 }])));
  const [invoiceNumber, setInvoiceNumber] = useState(purchase?.supplierInvoiceNumber ?? '');
  const [invoiceAmount, setInvoiceAmount] = useState(purchase?.supplierInvoiceAmount ?? purchase?.totalAmount ?? 0);
  const [invoiceDate, setInvoiceDate] = useState(purchase?.supplierInvoiceDate ?? new Date().toISOString().slice(0, 10));
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(purchase?.expectedDeliveryDate ?? '');
  const [paymentTerms, setPaymentTerms] = useState(purchase?.paymentTerms ?? '');
  const [internalNotes, setInternalNotes] = useState(purchase?.internalNotes ?? '');
  const [documentCategory, setDocumentCategory] = useState<'supplierQuote' | 'purchaseOrder' | 'supplierInvoice' | 'deliveryNote' | 'other'>('supplierQuote');
  const [documentName, setDocumentName] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  if (!purchase) return <aside className="purchase-detail purchase-detail--empty"><ShoppingBag size={24} /><strong>Select a purchase order</strong><span>Its line items, approval trail, and actions will appear here.</span></aside>;
  const vendor = state.vendors.find((entry) => entry.id === purchase.vendorId);
  const payable = state.accountsPayable.find((entry) => entry.purchaseId === purchase.id && entry.status !== 'cancelled');
  const warehouses = state.locations.filter((location) => location.type === 'warehouse' && location.isActive);
  const status = STATUS_META[purchase.status];
  const activity = state.activityLogEntries.filter((entry) => entry.entityId === purchase.id).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  return (
    <aside className="purchase-detail">
      <div className="purchase-detail-heading"><div><p className="eyebrow">Purchase order</p><h2>{purchase.purchaseCode}</h2><span>{vendor?.name ?? purchase.vendorCode}</span></div><span className={`purchase-status purchase-status--${status.tone}`}>{status.label}</span></div>
      <div className="purchase-timeline" aria-label="Purchase progress">
        <TimelineStep label="Created" complete />
        <TimelineStep label="Submitted" complete={Boolean(purchase.submittedAt)} />
        <TimelineStep label="Approved" complete={Boolean(purchase.approvedAt)} />
        <TimelineStep label="Arrived" complete={Boolean(purchase.receipts?.length)} />
        <TimelineStep label="Inspected" complete={Boolean(purchase.receipts?.length) && !openInspection} />
        <TimelineStep label="Put away" complete={purchase.status === 'receivedToWarehouse'} />
      </div>
      <div className="purchase-detail-lines">
        {purchase.items.map((item) => <div key={item.productId}><div><strong>{item.productName}</strong><span>{item.quantity} × {formatCurrency(item.unitCost, state.businessProfile.currency)}</span></div><b>{formatCurrency(item.totalCost, state.businessProfile.currency)}</b></div>)}
      </div>
      <div className="purchase-total"><span>Order total</span><strong>{formatCurrency(purchase.totalAmount, state.businessProfile.currency)}</strong></div>
      <div className="match-summary">
        <div><span>Delivered / accepted</span><strong>{purchase.items.reduce((sum, item) => sum + selectPurchaseDeliveredQuantity(purchase, item.productId), 0)} / {purchase.items.reduce((sum, item) => sum + selectPurchaseReceivedQuantity(purchase, item.productId), 0)} units</strong></div>
        <div><span>Supplier invoice</span><strong>{purchase.supplierInvoiceNumber || 'Not recorded'}</strong></div>
        <div><span>Three-way match</span><strong className={`match-value match-value--${purchase.threeWayMatchStatus ?? 'pending'}`}>{purchase.threeWayMatchStatus === 'matched' ? 'Matched' : purchase.threeWayMatchStatus === 'variance' ? 'Variance' : 'Pending'}</strong></div>
      </div>
      <dl className="purchase-meta"><div><dt>Created by</dt><dd>{state.users.find((user) => user.userId === purchase.createdBy)?.name ?? (purchase.createdBy === currentUserId ? 'You' : 'Team member')}</dd></div><div><dt>Supplier code</dt><dd>{purchase.vendorCode}</dd></div>{payable ? <div><dt>Supplier payable</dt><dd>{payable.payableCode} · {formatCurrency(payable.balance, state.businessProfile.currency)} open</dd></div> : null}</dl>
      <section className="purchase-control-section">
        <div className="purchase-section-heading"><div><CalendarClock size={16} /><strong>Delivery commitment</strong></div>{purchase.expectedDeliveryDate && isOverduePurchase(purchase) ? <span className="purchase-status purchase-status--risk">Overdue</span> : null}</div>
        <div className="purchase-detail-form"><label><span>Expected delivery</span><input type="date" value={expectedDeliveryDate} disabled={!canEditPurchase || purchase.status === 'receivedToWarehouse'} onChange={(event) => setExpectedDeliveryDate(event.target.value)} /></label><label><span>Payment terms</span><input value={paymentTerms} disabled={!canEditPurchase || purchase.status === 'receivedToWarehouse'} onChange={(event) => setPaymentTerms(event.target.value)} placeholder="Net 30, COD, milestone" /></label><label className="purchase-notes"><span>Internal notes</span><textarea value={internalNotes} disabled={!canEditPurchase || purchase.status === 'receivedToWarehouse'} onChange={(event) => setInternalNotes(event.target.value)} placeholder="Buyer notes and delivery instructions" /></label></div>
        {canEditPurchase && purchase.status !== 'receivedToWarehouse' ? <button className="secondary-button" type="button" disabled={actionBusy} onClick={() => onUpdateDetails(purchase, { expectedDeliveryDate, paymentTerms, internalNotes })}>Save delivery details</button> : null}
      </section>
      <section className="purchase-control-section">
        <div className="purchase-section-heading"><div><FileText size={16} /><strong>Supporting documents</strong></div><span>{purchase.documents?.length ?? 0}</span></div>
        <div className="purchase-document-list">{(purchase.documents ?? []).map((document) => <div className="purchase-document-row" key={document.id}><button type="button" onClick={() => onOpenDocument(purchase, document)}><FileText size={14} /><span><strong>{document.name}</strong><small>{document.category.replace(/([A-Z])/g, ' $1')} · {document.size ? `${(document.size / 1024).toFixed(0)} KB · ` : ''}{new Date(document.uploadedAt).toLocaleDateString()}</small></span><ExternalLink size={13} /></button>{canEditPurchase ? <button className="document-remove-button" type="button" title={`Remove ${document.name}`} disabled={actionBusy} onClick={() => onRemoveDocument(purchase, document)}><Trash2 size={14} /></button> : null}</div>)}{!purchase.documents?.length ? <p>No supplier documents have been attached.</p> : null}</div>
        {canEditPurchase ? <><div className="purchase-file-upload"><label><Upload size={15} /><span>{selectedFile?.name ?? 'Choose PDF, image, Word, or Excel file'}</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} /></label><button className="primary-button" type="button" disabled={actionBusy || !selectedFile} onClick={() => { if (selectedFile) { onUploadDocument(purchase, selectedFile, documentCategory); setSelectedFile(null); } }}>Upload file</button></div><div className="purchase-document-divider"><span>or attach a secure link</span></div><div className="purchase-document-form"><select aria-label="Document category" value={documentCategory} onChange={(event) => setDocumentCategory(event.target.value as typeof documentCategory)}><option value="supplierQuote">Supplier quote</option><option value="purchaseOrder">Purchase order</option><option value="supplierInvoice">Supplier invoice</option><option value="deliveryNote">Delivery note</option><option value="other">Other</option></select><input aria-label="Document name" value={documentName} onChange={(event) => setDocumentName(event.target.value)} placeholder="Document name" /><input aria-label="Secure document link" type="url" value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} placeholder="https://secure-document-link" /><button className="secondary-button" type="button" disabled={actionBusy || !documentName.trim() || !documentUrl.trim()} onClick={() => { onAddDocument(purchase, { category: documentCategory, name: documentName, url: documentUrl }); setDocumentName(''); setDocumentUrl(''); }}>Attach link</button></div></> : null}
      </section>
      {(purchase.receipts?.length ?? 0) > 0 ? <section className="purchase-control-section"><div className="purchase-section-heading"><div><PackageCheck size={16} /><strong>Goods receipt history</strong></div><span>{purchase.receipts?.length}</span></div><div className="purchase-audit-list">{purchase.receipts?.slice().reverse().map((receipt) => { const accepted = receipt.items.reduce((sum, item) => sum + (receipt.status === 'pendingInspection' ? 0 : item.acceptedQuantity ?? item.quantity), 0); const held = receipt.items.reduce((sum, item) => sum + (item.quarantinedQuantity ?? 0) + (item.rejectedQuantity ?? 0), 0); return <div key={receipt.id}><i className={receipt.status === 'exception' ? 'audit-dot audit-dot--warning' : receipt.status === 'accepted' ? 'audit-dot audit-dot--success' : undefined} /><span><strong>{receipt.receiptNumber ?? 'Legacy GRN'} · {receipt.status === 'pendingInspection' ? 'Inspection pending' : `${accepted} accepted${held ? ` · ${held} held` : ''}`}</strong><small>{new Date(receipt.receivedAt).toLocaleString()} · {state.locations.find((location) => location.id === receipt.warehouseId)?.name ?? 'Warehouse'}{receipt.deliveryNoteNumber ? ` · DN ${receipt.deliveryNoteNumber}` : ''}</small></span></div>; })}</div></section> : null}
      <section className="purchase-control-section"><div className="purchase-section-heading"><div><History size={16} /><strong>Audit history</strong></div><span>{activity.length}</span></div><div className="purchase-audit-list">{activity.map((entry) => <div key={entry.id}><i className={`audit-dot audit-dot--${entry.status}`} /><span><strong>{entry.title}</strong><small>{entry.detail} · {new Date(entry.createdAt).toLocaleString()}</small></span></div>)}{!activity.length ? <p>No audit events recorded yet.</p> : null}</div></section>
      {purchase.status === 'draft' && canCreate ? <div className="purchase-actions"><button className="primary-button" type="button" disabled={actionBusy} onClick={() => onSubmit(purchase)}>Submit for approval <ArrowRight size={15} /></button></div> : null}
      {['submitted', 'adminReviewed'].includes(purchase.status) && canApprove ? <div className="purchase-actions purchase-review-actions"><label><span>Decision note</span><textarea value={declineNote} onChange={(event) => onDeclineNoteChange(event.target.value)} placeholder="Required when declining" /></label><div><button className="secondary-button danger-button" type="button" disabled={actionBusy || !declineNote.trim()} onClick={() => onDecline(purchase)}>Decline</button><button className="primary-button" type="button" disabled={actionBusy} onClick={() => onApprove(purchase)}><Check size={15} /> Approve</button></div></div> : null}
      {['approved', 'partiallyReceived'].includes(purchase.status) && canReceive ? <div className="purchase-actions receipt-actions"><p className="eyebrow">Dock arrival and GRN</p><div className="receipt-reference-grid"><label><span>Receiving warehouse</span><select value={warehouseId || warehouses[0]?.id || ''} onChange={(event) => onWarehouseChange(event.target.value)}>{warehouses.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select></label><label><span>Delivery note</span><input value={deliveryNoteNumber} onChange={(event) => setDeliveryNoteNumber(event.target.value)} placeholder="Supplier delivery note" /></label><label><span>Carrier / vehicle</span><input value={carrier} onChange={(event) => setCarrier(event.target.value)} placeholder="Carrier or vehicle reference" /></label></div><div className="receipt-quantity-list">{purchase.items.map((item) => { const received = selectPurchaseReceivedQuantity(purchase, item.productId); const remaining = Math.max(0, item.quantity - received); return <label key={item.productId}><span>{item.productName}<small>{received} accepted · {remaining} outstanding</small></span><input type="number" min="0" max={remaining} value={receiptQuantities[item.productId] ?? remaining} onChange={(event) => setReceiptQuantities((current) => ({ ...current, [item.productId]: Number(event.target.value) }))} /></label>; })}</div><button className="primary-button" type="button" disabled={actionBusy || !warehouses.length || !deliveryNoteNumber.trim() || !Object.values(receiptQuantities).some((quantity) => quantity > 0)} onClick={() => onRecordArrival(purchase, { deliveryNoteNumber, carrier, receivedItems: purchase.items.map((item) => ({ productId: item.productId, quantity: receiptQuantities[item.productId] ?? 0 })) })}><PackageCheck size={15} /> Record arrival and issue GRN</button></div> : null}
      {openInspection && canReceive ? <div className="purchase-actions inspection-actions"><div className="inspection-heading"><div><p className="eyebrow">Warehouse inspection</p><strong>{openInspection.receiptNumber ?? 'Goods receipt'}</strong></div><span className="purchase-status purchase-status--warn">Stock on hold</span></div><div className="inspection-table"><div className="inspection-row inspection-row--head"><span>Item</span><span>Delivered</span><span>Accept</span><span>Quarantine</span><span>Reject</span></div>{openInspection.items.map((item) => { const values = inspectionQuantities[item.productId] ?? { accepted: item.quantity, quarantined: 0, rejected: 0 }; return <div className="inspection-row" key={item.productId}><strong>{purchase.items.find((line) => line.productId === item.productId)?.productName ?? item.productId}</strong><span>{item.quantity}</span>{(['accepted', 'quarantined', 'rejected'] as const).map((field) => <input aria-label={`${field} quantity`} type="number" min="0" max={item.quantity} value={values[field]} onChange={(event) => setInspectionQuantities((current) => ({ ...current, [item.productId]: { ...values, [field]: Number(event.target.value) } }))} key={field} />)}</div>; })}</div><label><span>Inspection note</span><textarea value={inspectionNote} onChange={(event) => setInspectionNote(event.target.value)} placeholder="Condition, damage, batch, or supplier exception reference" /></label><button className="primary-button" type="button" disabled={actionBusy || openInspection.items.some((item) => { const values = inspectionQuantities[item.productId] ?? { accepted: item.quantity, quarantined: 0, rejected: 0 }; return values.accepted + values.quarantined + values.rejected !== item.quantity; })} onClick={() => onCompleteInspection(purchase, openInspection.id, openInspection.items.map((item) => { const values = inspectionQuantities[item.productId] ?? { accepted: item.quantity, quarantined: 0, rejected: 0 }; return { productId: item.productId, acceptedQuantity: values.accepted, quarantinedQuantity: values.quarantined, rejectedQuantity: values.rejected }; }), inspectionNote)}><ClipboardCheck size={15} /> Complete inspection and put-away</button></div> : null}
      {['approved', 'arrivedPendingInspection', 'partiallyReceived', 'receivedToWarehouse'].includes(purchase.status) && canRecordInvoice ? <div className="purchase-actions invoice-actions"><p className="eyebrow">Supplier invoice</p><label><span>Invoice number</span><input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Supplier reference" /></label><div><label><span>Invoice amount</span><input type="number" min="0.01" step="0.01" value={invoiceAmount} onChange={(event) => setInvoiceAmount(Number(event.target.value))} /></label><label><span>Invoice date</span><input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} /></label></div>{purchase.threeWayMatchStatus === 'variance' ? <p className="invoice-variance">Invoice differs from the PO by {formatCurrency(Math.abs(purchase.threeWayMatchVariance ?? 0), state.businessProfile.currency)}.</p> : null}<button className="secondary-button" type="button" disabled={actionBusy || !invoiceNumber.trim() || invoiceAmount <= 0} onClick={() => onRecordInvoice(purchase, { invoiceNumber, invoiceAmount, invoiceDate })}>Record and run match</button></div> : null}
      {purchase.status === 'declined' && purchase.declineNote ? <p className="decline-note"><strong>Decline reason:</strong> {purchase.declineNote}</p> : null}
    </aside>
  );
}

function TimelineStep({ label, complete }: { label: string; complete: boolean }) { return <div className={complete ? 'timeline-step timeline-step--complete' : 'timeline-step'}><i>{complete ? <Check size={10} /> : null}</i><span>{label}</span></div>; }

type SearchOption = { id: string; label: string; hint?: string };

/** Type-ahead combobox: filter a list by name or code and pick one. Keyboard + mouse accessible. */
function SearchSelect({ options, value, onChange, placeholder, ariaLabel }: {
  options: SearchOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 60);
    return options.filter((option) => `${option.label} ${option.hint ?? ''}`.toLowerCase().includes(q)).slice(0, 60);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) { setOpen(false); setQuery(''); }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function choose(option: SearchOption) { onChange(option.id); setOpen(false); setQuery(''); }

  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') { event.preventDefault(); setOpen(true); }
      return;
    }
    if (event.key === 'ArrowDown') { event.preventDefault(); setHighlight((current) => Math.min(current + 1, filtered.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setHighlight((current) => Math.max(current - 1, 0)); }
    else if (event.key === 'Enter') { event.preventDefault(); const option = filtered[highlight]; if (option) choose(option); }
    else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setQuery(''); }
  }

  return (
    <div className="search-select" ref={rootRef}>
      <div className="search-select__control">
        <Search size={15} className="search-select__icon" aria-hidden />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={menuId}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          className="search-select__input"
          value={open ? query : (selected?.label ?? '')}
          placeholder={selected ? selected.label : placeholder}
          onChange={(event) => { setQuery(event.target.value); setHighlight(0); if (!open) setOpen(true); }}
          onFocus={() => { setOpen(true); setQuery(''); setHighlight(0); }}
          onKeyDown={onKeyDown}
        />
        <ChevronDown size={16} className="search-select__chevron" aria-hidden />
      </div>
      {open ? (
        <ul className="search-select__menu" id={menuId} role="listbox" aria-label={ariaLabel}>
          {filtered.length ? filtered.map((option, index) => (
            <li
              key={option.id}
              role="option"
              aria-selected={option.id === value}
              className={`search-select__option${index === highlight ? ' is-active' : ''}${option.id === value ? ' is-selected' : ''}`}
              onMouseEnter={() => setHighlight(index)}
              onMouseDown={(event) => { event.preventDefault(); choose(option); }}
            >
              <span className="search-select__label">{option.label}</span>
              {option.hint ? <span className="search-select__hint">{option.hint}</span> : null}
              {option.id === value ? <Check size={14} className="search-select__check" aria-hidden /> : null}
            </li>
          )) : <li className="search-select__empty">No matches</li>}
        </ul>
      ) : null}
    </div>
  );
}

function PurchaseComposer({ vendors, products, currency, currentUserId, prefill, onClose, onCreate, onMessage }: {
  vendors: ReturnType<typeof useBusiness>['state']['vendors'];
  products: ReturnType<typeof useBusiness>['state']['products'];
  currency: string;
  currentUserId: string;
  prefill: { productId: string; quantity: number } | null;
  onClose: () => void;
  onCreate: ReturnType<typeof useBusiness>['createPurchaseDraft'];
  onMessage: (message: string) => void;
}) {
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? '');
  const initialProduct = products.find((product) => product.id === prefill?.productId) ?? products[0];
  const [productId, setProductId] = useState(initialProduct?.id ?? '');
  const [quantity, setQuantity] = useState(prefill?.quantity ?? 1);
  const [unitCost, setUnitCost] = useState(initialProduct?.cost ?? 0);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [busy, setBusy] = useState(false);

  function addLine() {
    const product = products.find((entry) => entry.id === productId);
    if (!product || quantity <= 0 || unitCost < 0) return;
    setLines((current) => [...current.filter((line) => line.productId !== product.id), { productId: product.id, productName: product.name, quantity, unitCost, totalCost: quantity * unitCost }]);
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!vendorId || !lines.length) return;
    setBusy(true);
    const result = await onCreate({ vendorId, createdBy: currentUserId, items: lines.map(({ productId: id, quantity: qty, unitCost: cost }) => ({ productId: id, quantity: qty, unitCost: cost })) });
    onMessage(result.message ?? (result.ok ? 'Purchase order draft created.' : 'The purchase order could not be created.'));
    setBusy(false);
    if (result.ok) onClose();
  }

  const total = lines.reduce((sum, line) => sum + line.totalCost, 0);
  return <div className="composer-backdrop" role="presentation"><form className="purchase-composer" onSubmit={(event) => void create(event)}><div className="composer-heading"><div><p className="eyebrow">New purchase order</p><h2>Build supplier order</h2></div><button className="icon-button" type="button" aria-label="Close purchase order" title="Close purchase order" onClick={onClose}><X size={18} /></button></div><div className="composer-body"><div className="form-field"><span>Supplier</span><SearchSelect ariaLabel="Search suppliers by name or code" placeholder="Search suppliers by name or code" value={vendorId} onChange={setVendorId} options={vendors.map((vendor) => ({ id: vendor.id, label: vendor.name, hint: vendor.vendorCode }))} /></div><div className="composer-line-builder"><div className="form-field"><span>Stock item</span><SearchSelect ariaLabel="Search stock items by name or code" placeholder="Search items by name or code" value={productId} onChange={(nextId) => { setProductId(nextId); setUnitCost(products.find((product) => product.id === nextId)?.cost ?? 0); }} options={products.map((product) => ({ id: product.id, label: product.name, hint: product.inventoryId }))} /></div><label className="form-field"><span>Quantity</span><input type="number" min="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label><label className="form-field"><span>Unit cost</span><input type="number" min="0" step="0.01" value={unitCost} onChange={(event) => setUnitCost(Number(event.target.value))} /></label><button className="secondary-button add-line-button" type="button" onClick={addLine}><Plus size={15} /> Add line</button></div><div className="composer-lines">{lines.map((line) => <div key={line.productId}><div><strong>{line.productName}</strong><span>{line.quantity} × {formatCurrency(line.unitCost, currency)}</span></div><b>{formatCurrency(line.totalCost, currency)}</b><button className="icon-button" type="button" aria-label={`Remove ${line.productName}`} title={`Remove ${line.productName}`} onClick={() => setLines((current) => current.filter((entry) => entry.productId !== line.productId))}><X size={14} /></button></div>)}{!lines.length ? <p>Add at least one product line to create the draft.</p> : null}</div></div><div className="composer-footer"><div><span>Purchase total</span><strong>{formatCurrency(total, currency)}</strong></div><button className="primary-button" type="submit" disabled={busy || !vendorId || !lines.length}>{busy ? 'Creating...' : 'Create draft'}</button></div></form></div>;
}

function ReorderWorkspace({ feed, error, canCreate, onCreateDraft, currency }: { feed: MagentoReorderResult | null; error: string; canCreate: boolean; onCreateDraft: (item: MagentoReorderItem) => void; currency: string }) {
  const items = feed?.items ?? [];
  return <section className="reorder-workspace"><div className="reorder-heading"><div><p className="eyebrow">Magento demand</p><h2>Reorder intelligence</h2><p>Branch demand, stock cover, and suggested supplier replenishment from the last {feed?.period_days ?? 30} days.</p></div><span className="status-pill status-pill--good">Live feed</span></div>{error ? <div className="procurement-empty"><TrendingUp size={22} /><strong>Demand feed unavailable</strong><span>{error}</span></div> : <div className="reorder-table-wrap"><table className="reorder-table"><thead><tr><th>Product</th><th>Branch</th><th>Sold</th><th>On hand</th><th>Cover</th><th>Recommendation</th><th /></tr></thead><tbody>{items.map((item) => <tr key={`${item.sku}-${item.source_code}`}><td><strong>{item.name}</strong><span>{item.sku} · {formatCurrency(item.revenue, currency)} revenue</span></td><td>{item.branch_name}</td><td>{item.units_sold}</td><td>{item.on_hand}</td><td><span className={`purchase-status purchase-status--${item.needs_reorder ? 'warn' : 'good'}`}>{item.days_of_cover} days</span></td><td>{item.needs_reorder ? `${item.suggested_reorder} units` : 'Stock healthy'}</td><td>{item.needs_reorder && canCreate ? <button className="secondary-button" type="button" onClick={() => onCreateDraft(item)}>Create PO</button> : null}</td></tr>)}</tbody></table>{!items.length && !error ? <div className="procurement-empty"><TrendingUp size={22} /><strong>Loading Magento demand</strong><span>Reorder recommendations will appear shortly.</span></div> : null}</div>}</section>;
}

function SupplierWorkspace({ vendors, purchaseCounts }: { vendors: ReturnType<typeof useBusiness>['state']['vendors']; purchaseCounts: Map<string, number> }) {
  return <section className="supplier-workspace"><div className="reorder-heading"><div><p className="eyebrow">Supplier directory</p><h2>Approved vendors</h2><p>Supplier status and purchase-order activity available to procurement.</p></div><span className="status-pill">{vendors.length} suppliers</span></div><div className="supplier-grid">{vendors.map((vendor) => <article key={vendor.id}><div className="supplier-icon"><Store size={17} /></div><div><strong>{vendor.name}</strong><span>{vendor.vendorCode} · {vendor.location}</span><small>{vendor.contactEmail || 'No accounts email'}</small></div><div><span className={`purchase-status purchase-status--${vendor.status === 'active' ? 'good' : 'neutral'}`}>{vendor.status}</span><small>{purchaseCounts.get(vendor.id) ?? 0} orders</small></div></article>)}</div></section>;
}
