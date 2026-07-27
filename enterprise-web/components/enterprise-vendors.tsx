'use client';

import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleOff,
  ClipboardList,
  Edit3,
  Mail,
  MapPin,
  PackageCheck,
  Plus,
  Search,
  Store,
  Truck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useMemo, useState } from 'react';

import { useBusiness } from '../../src/context/BusinessContext';
import type { Purchase, Vendor } from '../../src/data/seedBusiness';
import { formatCurrency, formatRelativeDate } from '../../src/utils/format';
import { EnterpriseApp } from './enterprise-app';
import { EnterpriseShell } from './enterprise-shell';

type VendorView = 'directory' | 'exposure' | 'controls';

type VendorOperationalSummary = {
  vendor: Vendor;
  purchases: Purchase[];
  orderCount: number;
  openOrderCount: number;
  totalOrdered: number;
  outstandingBalance: number;
  overdueBalance: number;
  exceptionCount: number;
  onTimeRate: number | null;
};

const OPEN_PURCHASE_STATUSES: Purchase['status'][] = ['draft', 'submitted', 'adminReviewed', 'approved', 'arrivedPendingInspection', 'partiallyReceived'];

export function EnterpriseVendors() {
  return <EnterpriseApp><VendorsWorkspace /></EnterpriseApp>;
}

function VendorsWorkspace() {
  const { state, hasPermission, createVendor, updateVendor, setVendorStatus } = useBusiness();
  const [view, setView] = useState<VendorView>('directory');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Vendor['status']>('all');
  const [selectedVendorId, setSelectedVendorId] = useState(state.vendors[0]?.id ?? '');
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; vendor?: Vendor } | null>(null);
  const [statusTarget, setStatusTarget] = useState<Vendor | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const canView = hasPermission('vendors.view') || hasPermission('vendors.manage');
  const canManage = hasPermission('vendors.manage');

  const summaries = useMemo<VendorOperationalSummary[]>(() => state.vendors.map((vendor) => {
    const purchases = state.purchases
      .filter((purchase) => purchase.vendorId === vendor.id)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    const payables = state.accountsPayable.filter((payable) => payable.vendorId === vendor.id && payable.status !== 'cancelled');
    const completedWithDates = purchases.filter((purchase) => purchase.status === 'receivedToWarehouse' && purchase.expectedDeliveryDate && purchase.receipts?.length);
    const onTimeCount = completedWithDates.filter((purchase) => {
      const finalReceipt = [...(purchase.receipts ?? [])].sort((left, right) => Date.parse(right.receivedAt) - Date.parse(left.receivedAt))[0];
      return finalReceipt && Date.parse(finalReceipt.receivedAt) <= Date.parse(`${purchase.expectedDeliveryDate}T23:59:59`);
    }).length;
    const overdueOrders = purchases.filter((purchase) => purchase.expectedDeliveryDate && OPEN_PURCHASE_STATUSES.includes(purchase.status) && Date.parse(`${purchase.expectedDeliveryDate}T23:59:59`) < Date.now()).length;
    const matchExceptions = purchases.filter((purchase) => purchase.threeWayMatchStatus === 'variance').length;
    const overduePayables = payables.filter((payable) => payable.status === 'overdue' || Boolean(payable.dueDate && payable.balance > 0 && Date.parse(`${payable.dueDate}T23:59:59`) < Date.now()));

    return {
      vendor,
      purchases,
      orderCount: purchases.length,
      openOrderCount: purchases.filter((purchase) => OPEN_PURCHASE_STATUSES.includes(purchase.status)).length,
      totalOrdered: purchases.filter((purchase) => !['declined', 'cancelled'].includes(purchase.status)).reduce((sum, purchase) => sum + purchase.totalAmount, 0),
      outstandingBalance: payables.reduce((sum, payable) => sum + payable.balance, 0),
      overdueBalance: overduePayables.reduce((sum, payable) => sum + payable.balance, 0),
      exceptionCount: overdueOrders + matchExceptions + overduePayables.length,
      onTimeRate: completedWithDates.length ? Math.round((onTimeCount / completedWithDates.length) * 100) : null,
    };
  }), [state.accountsPayable, state.purchases, state.vendors]);

  const filteredSummaries = summaries.filter((summary) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || [summary.vendor.name, summary.vendor.vendorCode, summary.vendor.contactEmail ?? '', summary.vendor.location]
      .some((value) => value.toLowerCase().includes(needle));
    return matchesQuery && (statusFilter === 'all' || summary.vendor.status === statusFilter);
  });
  const selectedSummary = filteredSummaries.find((summary) => summary.vendor.id === selectedVendorId) ?? filteredSummaries[0];
  const activeCount = summaries.filter((summary) => summary.vendor.status === 'active').length;
  const outstandingTotal = summaries.reduce((sum, summary) => sum + summary.outstandingBalance, 0);
  const openOrders = summaries.reduce((sum, summary) => sum + summary.openOrderCount, 0);
  const attentionCount = summaries.filter((summary) => summary.exceptionCount > 0 || (summary.vendor.status === 'inactive' && summary.openOrderCount > 0)).length;

  async function saveVendor(input: { vendorCode: string; name: string; contactEmail: string; location: string }) {
    setBusy(true);
    setActionMessage('');
    const result = editor?.mode === 'edit' && editor.vendor
      ? await updateVendor({ vendorId: editor.vendor.id, ...input })
      : await createVendor({ vendorCode: input.vendorCode || undefined, name: input.name, contactEmail: input.contactEmail, location: input.location });
    setBusy(false);
    setActionMessage(result.message ?? (result.ok ? `Supplier ${editor?.mode === 'edit' ? 'updated' : 'created'}.` : 'The supplier could not be saved.'));
    if (result.ok) setEditor(null);
    return result.ok;
  }

  async function changeStatus() {
    if (!statusTarget) return;
    const nextStatus = statusTarget.status === 'active' ? 'inactive' : 'active';
    setBusy(true);
    const result = await setVendorStatus({ vendorId: statusTarget.id, status: nextStatus });
    setBusy(false);
    setActionMessage(result.message ?? (result.ok ? `Supplier ${nextStatus === 'active' ? 'activated' : 'deactivated'}.` : 'Supplier status could not be changed.'));
    if (result.ok) setStatusTarget(null);
  }

  if (!canView) {
    return <EnterpriseShell active="Vendors"><div className="page-content"><section className="access-denied"><Truck size={24} /><h1>Vendor access is restricted</h1><p>Your role does not include supplier records.</p></section></div></EnterpriseShell>;
  }

  return (
    <EnterpriseShell active="Vendors">
      <div className="page-content vendors-page">
        <section className="vendors-heading">
          <div><p className="eyebrow">Supplier operations</p><h1>Vendors</h1><p>Control supplier records, purchasing exposure, delivery performance, and settlement risk.</p></div>
          {canManage ? <button className="primary-button" type="button" onClick={() => setEditor({ mode: 'create' })}><Plus size={16} /> Add supplier</button> : null}
        </section>

        <section className="vendor-metrics" aria-label="Vendor portfolio summary">
          <VendorMetric icon={Building2} label="Active suppliers" value={String(activeCount)} helper={`${summaries.length - activeCount} inactive`} />
          <VendorMetric icon={ClipboardList} label="Open purchase orders" value={String(openOrders)} helper="Across all suppliers" tone={openOrders ? 'warn' : 'good'} />
          <VendorMetric icon={Banknote} label="Outstanding payables" value={formatCurrency(outstandingTotal, state.businessProfile.currency)} helper="Unsettled supplier balance" tone={outstandingTotal ? 'warn' : 'good'} />
          <VendorMetric icon={AlertTriangle} label="Needs attention" value={String(attentionCount)} helper="Delivery, match, or payment risk" tone={attentionCount ? 'risk' : 'good'} />
        </section>

        <nav className="vendor-tabs" aria-label="Vendor views">
          <button className={view === 'directory' ? 'vendor-tab vendor-tab--active' : 'vendor-tab'} type="button" onClick={() => setView('directory')}>Directory</button>
          <button className={view === 'exposure' ? 'vendor-tab vendor-tab--active' : 'vendor-tab'} type="button" onClick={() => setView('exposure')}>Financial exposure</button>
          <button className={view === 'controls' ? 'vendor-tab vendor-tab--active' : 'vendor-tab'} type="button" onClick={() => setView('controls')}>Delivery controls {attentionCount ? `(${attentionCount})` : ''}</button>
        </nav>

        {actionMessage ? <div className="settings-message" role="status">{actionMessage}</div> : null}

        {view === 'directory' ? (
          <section className="vendor-workspace">
            <div className="vendor-list-panel">
              <div className="vendor-toolbar">
                <label><Search size={15} /><input aria-label="Search suppliers" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, code, email, or location" /></label>
                <select aria-label="Filter supplier status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
                <span>{filteredSummaries.length} suppliers</span>
              </div>
              <div className="vendor-table-wrap">
                <table className="vendor-table">
                  <thead><tr><th>Supplier</th><th>Location</th><th>Orders</th><th>Outstanding</th><th>Status</th><th /></tr></thead>
                  <tbody>{filteredSummaries.map((summary) => <tr className={selectedSummary?.vendor.id === summary.vendor.id ? 'vendor-row vendor-row--selected' : 'vendor-row'} key={summary.vendor.id} onClick={() => setSelectedVendorId(summary.vendor.id)}><td><i><Store size={15} /></i><span><strong>{summary.vendor.name}</strong><small>{summary.vendor.vendorCode} · {summary.vendor.contactEmail || 'No accounts email'}</small></span></td><td>{summary.vendor.location}</td><td><strong>{summary.orderCount}</strong><small>{summary.openOrderCount} open</small></td><td>{formatCurrency(summary.outstandingBalance, state.businessProfile.currency)}</td><td><span className={`vendor-status vendor-status--${summary.vendor.status}`}>{summary.vendor.status}</span></td><td><ChevronRight size={14} /></td></tr>)}</tbody>
                </table>
                {!filteredSummaries.length ? <VendorEmpty title="No suppliers match this view" detail="Adjust the search or status filter, or add a new supplier record." /> : null}
              </div>
            </div>
            <VendorInspector summary={selectedSummary} currency={state.businessProfile.currency} canManage={canManage} onEdit={(vendor) => setEditor({ mode: 'edit', vendor })} onStatusChange={setStatusTarget} />
          </section>
        ) : view === 'exposure' ? (
          <ExposureWorkspace summaries={summaries} currency={state.businessProfile.currency} onSelect={(vendorId) => { setSelectedVendorId(vendorId); setView('directory'); }} />
        ) : (
          <VendorControls summaries={summaries} currency={state.businessProfile.currency} onSelect={(vendorId) => { setSelectedVendorId(vendorId); setView('directory'); }} />
        )}
      </div>

      {editor ? <VendorEditor mode={editor.mode} vendor={editor.vendor} busy={busy} onClose={() => setEditor(null)} onSave={saveVendor} /> : null}
      {statusTarget ? <StatusDialog vendor={statusTarget} summary={summaries.find((summary) => summary.vendor.id === statusTarget.id)} busy={busy} onClose={() => setStatusTarget(null)} onConfirm={() => void changeStatus()} /> : null}
    </EnterpriseShell>
  );
}

function VendorMetric({ icon: Icon, label, value, helper, tone = 'neutral' }: { icon: typeof Store; label: string; value: string; helper: string; tone?: 'neutral' | 'good' | 'warn' | 'risk' }) {
  return <article><i className={`vendor-metric-icon vendor-metric-icon--${tone}`}><Icon size={15} /></i><div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div></article>;
}

function VendorInspector({ summary, currency, canManage, onEdit, onStatusChange }: { summary?: VendorOperationalSummary; currency: string; canManage: boolean; onEdit: (vendor: Vendor) => void; onStatusChange: (vendor: Vendor) => void }) {
  if (!summary) return <aside className="vendor-inspector vendor-inspector--empty"><Store size={23} /><strong>Select a supplier</strong><span>Supplier history and exposure will appear here.</span></aside>;
  const { vendor, purchases } = summary;
  return <aside className="vendor-inspector"><div className="vendor-inspector-head"><i><Store size={18} /></i><div><p className="eyebrow">{vendor.vendorCode}</p><h2>{vendor.name}</h2><span className={`vendor-status vendor-status--${vendor.status}`}>{vendor.status}</span></div>{canManage ? <button className="icon-button" type="button" aria-label="Edit supplier" title="Edit supplier" onClick={() => onEdit(vendor)}><Edit3 size={15} /></button> : null}</div><div className="vendor-contact"><div><MapPin size={14} /><span><small>Location</small><strong>{vendor.location}</strong></span></div><div><Mail size={14} /><span><small>Accounts contact</small>{vendor.contactEmail ? <a href={`mailto:${vendor.contactEmail}`}>{vendor.contactEmail}</a> : <strong>Not provided</strong>}</span></div></div><div className="vendor-inspector-values"><div><span>Total ordered</span><strong>{formatCurrency(summary.totalOrdered, currency)}</strong></div><div><span>Open orders</span><strong>{summary.openOrderCount}</strong></div><div><span>Outstanding</span><strong className={summary.outstandingBalance ? 'vendor-risk-value' : ''}>{formatCurrency(summary.outstandingBalance, currency)}</strong></div></div><section className="vendor-performance"><div className="vendor-section-heading"><span>Control health</span><small>{summary.exceptionCount ? `${summary.exceptionCount} exceptions` : 'Clear'}</small></div><div className="vendor-control-row"><PackageCheck size={14} /><span><strong>On-time delivery</strong><small>{summary.onTimeRate === null ? 'Not enough completed deliveries' : `${summary.onTimeRate}% of measured orders`}</small></span><b>{summary.onTimeRate === null ? '—' : `${summary.onTimeRate}%`}</b></div><div className="vendor-control-row"><Banknote size={14} /><span><strong>Overdue payable balance</strong><small>Supplier obligations beyond due date</small></span><b className={summary.overdueBalance ? 'vendor-risk-value' : ''}>{formatCurrency(summary.overdueBalance, currency)}</b></div></section><section className="vendor-order-preview"><div className="vendor-section-heading"><span>Recent purchase orders</span><Link href="/procurement">Open procurement <ArrowRight size={12} /></Link></div>{purchases.slice(0, 4).map((purchase) => <div key={purchase.id}><span><strong>{purchase.purchaseCode}</strong><small>{formatRelativeDate(purchase.createdAt)} · {purchase.status}</small></span><b>{formatCurrency(purchase.totalAmount, currency)}</b></div>)}{!purchases.length ? <p>No purchase orders recorded.</p> : null}</section>{canManage ? <div className="vendor-inspector-actions"><button className="secondary-button" type="button" onClick={() => onEdit(vendor)}><Edit3 size={14} /> Edit supplier</button><button className={vendor.status === 'active' ? 'secondary-button danger-button' : 'secondary-button'} type="button" onClick={() => onStatusChange(vendor)}>{vendor.status === 'active' ? <CircleOff size={14} /> : <CheckCircle2 size={14} />}{vendor.status === 'active' ? 'Deactivate' : 'Activate'}</button></div> : null}</aside>;
}

function ExposureWorkspace({ summaries, currency, onSelect }: { summaries: VendorOperationalSummary[]; currency: string; onSelect: (vendorId: string) => void }) {
  return <section className="vendor-wide-panel"><div className="vendor-panel-heading"><div><p className="eyebrow">Supplier liabilities</p><h2>Financial exposure</h2><p>Ordered value and unpaid obligations grouped by supplier.</p></div><span>{formatCurrency(summaries.reduce((sum, item) => sum + item.outstandingBalance, 0), currency)} outstanding</span></div><div className="vendor-table-wrap"><table className="vendor-exposure-table"><thead><tr><th>Supplier</th><th>Total ordered</th><th>Open orders</th><th>Outstanding</th><th>Overdue</th><th /></tr></thead><tbody>{[...summaries].sort((left, right) => right.outstandingBalance - left.outstandingBalance).map((summary) => <tr key={summary.vendor.id}><td><strong>{summary.vendor.name}</strong><span>{summary.vendor.vendorCode}</span></td><td>{formatCurrency(summary.totalOrdered, currency)}</td><td>{summary.openOrderCount}</td><td><strong>{formatCurrency(summary.outstandingBalance, currency)}</strong></td><td><span className={summary.overdueBalance ? 'vendor-status vendor-status--risk' : 'vendor-status vendor-status--active'}>{formatCurrency(summary.overdueBalance, currency)}</span></td><td><button className="icon-button" type="button" aria-label={`Open ${summary.vendor.name}`} title={`Open ${summary.vendor.name}`} onClick={() => onSelect(summary.vendor.id)}><ChevronRight size={14} /></button></td></tr>)}</tbody></table></div></section>;
}

function VendorControls({ summaries, currency, onSelect }: { summaries: VendorOperationalSummary[]; currency: string; onSelect: (vendorId: string) => void }) {
  const exceptions = summaries.filter((summary) => summary.exceptionCount > 0 || (summary.vendor.status === 'inactive' && summary.openOrderCount > 0));
  return <section className="vendor-wide-panel"><div className="vendor-panel-heading"><div><p className="eyebrow">Exceptions</p><h2>Delivery and settlement controls</h2><p>Prioritize suppliers with overdue deliveries, invoice variance, or unsettled balances.</p></div><span>{exceptions.length} suppliers</span></div><div className="vendor-control-list">{exceptions.map((summary) => <article key={summary.vendor.id}><i><AlertTriangle size={16} /></i><div><strong>{summary.vendor.name}</strong><span>{summary.vendor.vendorCode} · {summary.vendor.location}</span></div><div><span>Exceptions</span><strong>{summary.exceptionCount}</strong></div><div><span>Overdue balance</span><strong>{formatCurrency(summary.overdueBalance, currency)}</strong></div><button className="secondary-button" type="button" onClick={() => onSelect(summary.vendor.id)}>Review <ChevronRight size={13} /></button></article>)}</div>{!exceptions.length ? <VendorEmpty title="Supplier controls are clear" detail="No overdue delivery, invoice-match, or supplier-payment exceptions require review." icon={CheckCircle2} /> : null}</section>;
}

function VendorEditor({ mode, vendor, busy, onClose, onSave }: { mode: 'create' | 'edit'; vendor?: Vendor; busy: boolean; onClose: () => void; onSave: (input: { vendorCode: string; name: string; contactEmail: string; location: string }) => Promise<boolean> }) {
  const [vendorCode, setVendorCode] = useState(vendor?.vendorCode ?? '');
  const [name, setName] = useState(vendor?.name ?? '');
  const [contactEmail, setContactEmail] = useState(vendor?.contactEmail ?? '');
  const [location, setLocation] = useState(vendor?.location ?? '');
  const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); if (!name.trim() || !location.trim() || (mode === 'edit' && !vendorCode.trim())) { setError('Supplier name, location, and vendor code are required.'); return; } const ok = await onSave({ vendorCode: vendorCode.trim(), name: name.trim(), contactEmail: contactEmail.trim(), location: location.trim() }); if (!ok) setError('Review the supplier details and try again.'); }
  return <div className="composer-backdrop" role="presentation"><form className="vendor-editor" role="dialog" aria-modal="true" aria-labelledby="vendor-editor-title" onSubmit={(event) => void submit(event)}><div className="composer-heading"><div><p className="eyebrow">{mode === 'create' ? 'Supplier onboarding' : vendor?.vendorCode}</p><h2 id="vendor-editor-title">{mode === 'create' ? 'Add supplier' : 'Edit supplier'}</h2></div><button className="icon-button" type="button" aria-label="Close supplier editor" title="Close supplier editor" onClick={onClose}><X size={18} /></button></div><div className="composer-body"><div className="vendor-form-note"><Building2 size={16} /><p>These details become the supplier identity used by purchase orders, receiving, invoice matching, and payables.</p></div><label className="form-field"><span>Supplier name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Registered or trading name" /></label><label className="form-field"><span>Vendor code</span><input value={vendorCode} onChange={(event) => setVendorCode(event.target.value)} placeholder={mode === 'create' ? 'Generated automatically when blank' : 'VEN-0001'} /></label><label className="form-field"><span>Accounts email</span><input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="accounts@supplier.com" /></label><label className="form-field"><span>Primary location</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City, region, or country" /></label>{error ? <p className="vendor-form-error" role="alert">{error}</p> : null}</div><div className="composer-footer"><span>{mode === 'create' ? 'New suppliers start active.' : 'Changes apply to future procurement records.'}</span><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving...' : mode === 'create' ? 'Add supplier' : 'Save changes'}</button></div></form></div>;
}

function StatusDialog({ vendor, summary, busy, onClose, onConfirm }: { vendor: Vendor; summary?: VendorOperationalSummary; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  const activating = vendor.status === 'inactive';
  return <div className="composer-backdrop vendor-dialog-backdrop" role="presentation"><section className="vendor-status-dialog" role="alertdialog" aria-modal="true" aria-labelledby="vendor-status-title"><i className={activating ? 'vendor-dialog-icon vendor-dialog-icon--good' : 'vendor-dialog-icon'}>{activating ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}</i><h2 id="vendor-status-title">{activating ? 'Activate' : 'Deactivate'} {vendor.name}?</h2><p>{activating ? 'The supplier will become available for new purchase orders.' : 'The supplier will be removed from new purchase-order selection. Existing orders and payables remain intact.'}</p>{!activating && summary?.openOrderCount ? <div className="vendor-dialog-warning">{summary.openOrderCount} open purchase order{summary.openOrderCount === 1 ? '' : 's'} will remain active.</div> : null}<div><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className={activating ? 'primary-button' : 'primary-button vendor-danger-confirm'} type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Updating...' : activating ? 'Activate supplier' : 'Deactivate supplier'}</button></div></section></div>;
}

function VendorEmpty({ title, detail, icon: Icon = Store }: { title: string; detail: string; icon?: typeof Store }) {
  return <div className="vendor-empty"><Icon size={23} /><strong>{title}</strong><span>{detail}</span></div>;
}
