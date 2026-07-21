'use client';

import {
  Archive,
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  Check,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileText,
  Landmark,
  PackageSearch,
  Printer,
  ReceiptText,
  Search,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';

import { useBusiness } from '../../src/context/BusinessContext';
import type { Quotation, Sale } from '../../src/data/seedBusiness';
import {
  selectAccountsPayableWorklist,
  selectInventoryCategoryReport,
  selectInventoryLocationReport,
  selectInventorySummaries,
  selectOutstandingReceivables,
  selectSaleBalanceRemaining,
  selectSalesSnapshotSegmentation,
} from '../../src/selectors/businessSelectors';
import { buildInvoicePdf, buildQuotationPdf, buildWaybillPdf, loadLogoDataUrl } from '../../src/utils/documentPackPdf';
import { formatCurrency, formatReceiptDate } from '../../src/utils/format';
import { buildZip } from '../../src/utils/zip';
import { EnterpriseApp } from './enterprise-app';
import { EnterpriseShell } from './enterprise-shell';

type ReportView = 'overview' | 'sales' | 'inventory' | 'documents';
type Period = '7' | '30' | '90' | 'all';
type DocumentType = 'invoices' | 'quotations' | 'waybills';

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

function downloadCsv(rows: Array<Array<string | number>>, fileName: string) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fileName);
}

function inPeriod(value: string, period: Period, now: number) {
  return period === 'all' || Date.parse(value) >= now - Number(period) * 24 * 60 * 60 * 1000;
}

export function EnterpriseReports({ initialView = 'overview' }: { initialView?: ReportView }) { return <EnterpriseApp><EnterpriseReportsView initialView={initialView} /></EnterpriseApp>; }

function EnterpriseReportsView({ initialView }: { initialView: ReportView }) {
  const { state, hasPermission } = useBusiness();
  const [openedAt] = useState(() => new Date());
  const [view, setView] = useState<ReportView>(initialView);
  const [period, setPeriod] = useState<Period>('30');
  const currency = state.businessProfile.currency;
  const canOverview = hasPermission('reports.dashboard.view') || hasPermission('reports.financial.view');
  const canSales = hasPermission('reports.sales.view');
  const canInventory = hasPermission('reports.inventory.view');
  const canDocuments = hasPermission('invoices.print') || hasPermission('invoices.export_pdf') || hasPermission('quotations.print') || hasPermission('quotations.export_pdf');
  const allowedViews = ([['overview', canOverview], ['sales', canSales], ['inventory', canInventory], ['documents', canDocuments]] as const).filter(([, allowed]) => allowed).map(([value]) => value);
  const activeView = allowedViews.includes(view) ? view : allowedViews[0];
  if (!activeView) return <EnterpriseShell active="Reports"><div className="page-content enterprise-document-missing"><BarChart3 size={26} /><h1>Reports access restricted</h1><p>This role has no reporting or document-export permissions.</p><Link className="secondary-button" href="/dashboard">Return to dashboard</Link></div></EnterpriseShell>;
  const periodSales = state.sales.filter((sale) => sale.status === 'Completed' && inPeriod(sale.createdAt, period, openedAt.getTime()));
  const periodExpenses = state.expenses.filter((expense) => inPeriod(expense.createdAt, period, openedAt.getTime()));
  return <EnterpriseShell active="Reports"><div className="page-content reports-native-page">
    <section className="page-heading reports-heading"><div><p className="eyebrow">Decision intelligence</p><h1>Business reports</h1><p>Compare commercial, financial, and inventory performance using the same live operating records.</p></div>{activeView !== 'documents' ? <div className="report-period-control"><span>Period</span>{(['7', '30', '90', 'all'] as const).map((value) => <button type="button" className={period === value ? 'is-active' : ''} onClick={() => setPeriod(value)} key={value}>{value === 'all' ? 'All' : `${value}d`}</button>)}</div> : null}</section>
    <nav className="report-tabs" aria-label="Report views">{allowedViews.map((value) => <button type="button" className={activeView === value ? 'report-tab report-tab--active' : 'report-tab'} onClick={() => setView(value)} key={value}>{value === 'overview' ? 'Executive overview' : value === 'sales' ? 'Sales analysis' : value === 'inventory' ? 'Inventory analysis' : 'Document packs'}</button>)}</nav>
    {activeView === 'overview' ? <ExecutiveReport state={state} sales={periodSales} expenses={periodExpenses} currency={currency} /> : activeView === 'sales' ? <SalesReport state={state} sales={periodSales} currency={currency} period={period} /> : activeView === 'inventory' ? <InventoryReport state={state} currency={currency} /> : <DocumentPacks state={state} hasPermission={hasPermission} openedAt={openedAt} />}
  </div></EnterpriseShell>;
}

function ExecutiveReport({ state, sales, expenses, currency }: { state: ReturnType<typeof useBusiness>['state']; sales: Sale[]; expenses: ReturnType<typeof useBusiness>['state']['expenses']; currency: string }) {
  const invoiced = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const collected = sales.reduce((sum, sale) => sum + sale.paidAmount, 0);
  const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const receivables = state.sales.filter((sale) => sale.status === 'Completed').reduce((sum, sale) => sum + selectSaleBalanceRemaining(sale), 0);
  const payables = selectAccountsPayableWorklist(state);
  const outstanding = selectOutstandingReceivables(state, 6);
  const collectionRate = invoiced ? Math.round((collected / invoiced) * 100) : 0;
  const categories = Object.entries(expenses.reduce<Record<string, number>>((result, expense) => { result[expense.category] = (result[expense.category] ?? 0) + expense.amount; return result; }, {})).sort((a, b) => b[1] - a[1]);
  return <><section className="report-metrics"><ReportMetric icon={TrendingUp} label="Revenue invoiced" value={formatCurrency(invoiced, currency)} note={`${sales.length} completed invoices`} /><ReportMetric icon={Landmark} label="Cash collected" value={formatCurrency(collected, currency)} note={`${collectionRate}% collection rate`} tone={collectionRate >= 80 ? 'good' : 'warn'} /><ReportMetric icon={Users} label="Receivables" value={formatCurrency(receivables, currency)} note={`${outstanding.length} priority accounts`} tone={receivables ? 'warn' : 'good'} /><ReportMetric icon={CircleDollarSign} label="Net cash movement" value={formatCurrency(collected - expenseTotal, currency)} note={`${formatCurrency(expenseTotal, currency)} expenses`} tone={collected >= expenseTotal ? 'good' : 'warn'} /></section>
    <section className="report-overview-grid"><div className="report-panel"><ReportPanelHeading eyebrow="Cash discipline" title="Collections and obligations" action={<Link href="/accounting" className="text-button">Open Accounting</Link>} /><div className="report-waterfall"><div><span>Collected</span><strong>{formatCurrency(collected, currency)}</strong><i style={{ width: '100%' }} /></div><div><span>Operating expenses</span><strong>{formatCurrency(expenseTotal, currency)}</strong><i className="is-expense" style={{ width: `${Math.min(100, collected ? expenseTotal / collected * 100 : expenseTotal ? 100 : 0)}%` }} /></div><div><span>Open supplier payables</span><strong>{formatCurrency(payables.totalOutstandingBalance, currency)}</strong><i className="is-payable" style={{ width: `${Math.min(100, collected ? payables.totalOutstandingBalance / collected * 100 : payables.totalOutstandingBalance ? 100 : 0)}%` }} /></div></div><div className="report-obligation-grid"><div><span>Open payables</span><strong>{payables.openCount}</strong></div><div><span>Overdue</span><strong>{payables.overdueCount}</strong></div><div><span>Approved to pay</span><strong>{payables.approvedAwaitingPaymentCount}</strong></div></div></div>
      <div className="report-panel"><ReportPanelHeading eyebrow="Collection queue" title="Largest receivables" action={<Link href="/customers" className="text-button">Open Customers</Link>} /><div className="report-ranked-list">{outstanding.map((entry, index) => <Link href={`/customers?customer=${entry.customerId}`} key={entry.customerId}><i>{index + 1}</i><span><strong>{entry.customerName}</strong><small>{entry.lastPayment}</small></span><b>{formatCurrency(entry.balance, currency)}</b></Link>)}{!outstanding.length ? <ReportEmpty text="No customer balances require follow-up." /> : null}</div></div>
    </section><section className="report-panel report-wide-panel"><ReportPanelHeading eyebrow="Cost control" title="Expense concentration" /><div className="report-category-bars">{categories.map(([category, amount]) => <div key={category}><span>{category}</span><i><b style={{ width: `${Math.max(4, expenseTotal ? amount / expenseTotal * 100 : 0)}%` }} /></i><strong>{formatCurrency(amount, currency)}</strong></div>)}{!categories.length ? <ReportEmpty text="No expenses were recorded in this period." /> : null}</div></section></>;
}

function SalesReport({ state, sales, currency, period }: { state: ReturnType<typeof useBusiness>['state']; sales: Sale[]; currency: string; period: Period }) {
  const days = period === 'all' ? 30 : Math.min(Number(period), 30);
  const trend = Array.from({ length: days }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (days - 1 - index)); const key = date.toISOString().slice(0, 10); return { key, label: date.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' }), value: sales.filter((sale) => sale.createdAt.slice(0, 10) === key).reduce((sum, sale) => sum + sale.totalAmount, 0) }; });
  const maxTrend = Math.max(...trend.map((entry) => entry.value), 1);
  const segments = selectSalesSnapshotSegmentation({ ...state, sales });
  const paymentMix = Object.entries(sales.reduce<Record<string, number>>((result, sale) => { result[sale.paymentMethod] = (result[sale.paymentMethod] ?? 0) + sale.paidAmount; return result; }, {})).sort((a, b) => b[1] - a[1]);
  const productSales = Object.values(sales.flatMap((sale) => sale.items).reduce<Record<string, { name: string; quantity: number; value: number }>>((result, item) => { const current = result[item.productId] ?? { name: item.productName, quantity: 0, value: 0 }; current.quantity += item.quantity; current.value += item.total; result[item.productId] = current; return result; }, {})).sort((a, b) => b.value - a.value).slice(0, 8);
  const exportRows = [['Invoice', 'Customer', 'Date', 'Method', 'Total', 'Paid', 'Balance'], ...sales.map((sale) => [sale.invoiceNumber, state.customers.find((customer) => customer.id === sale.customerId)?.name ?? sale.customerSnapshot?.name ?? 'Customer', sale.createdAt, sale.paymentMethod, sale.totalAmount, sale.paidAmount, selectSaleBalanceRemaining(sale)])];
  return <><div className="report-action-row"><span>{sales.length} invoices in this period</span><button className="secondary-button" type="button" onClick={() => downloadCsv(exportRows, `bizpilot-sales-${period}-days.csv`)}><Download size={14} /> Export CSV</button></div><section className="report-panel report-wide-panel"><ReportPanelHeading eyebrow="Revenue movement" title="Daily invoiced value" /><div className="report-trend-chart">{trend.map((entry) => <div key={entry.key} title={`${entry.label}: ${formatCurrency(entry.value, currency)}`}><i style={{ height: `${Math.max(2, entry.value / maxTrend * 100)}%` }} /><span>{days <= 14 || trend.indexOf(entry) % 5 === 0 ? entry.label : ''}</span></div>)}</div></section>
    <section className="report-sales-grid"><div className="report-panel"><ReportPanelHeading eyebrow="Customer mix" title="Sales segmentation" /><div className="report-segment-list">{segments.map((segment) => <div key={segment.label}><span><strong>{segment.label}</strong><small>{segment.transactionCount} transactions</small></span><b>{formatCurrency(segment.totalAmount, currency)}</b></div>)}</div></div><div className="report-panel"><ReportPanelHeading eyebrow="Collections" title="Payment channel mix" /><div className="report-category-bars">{paymentMix.map(([method, amount]) => <div key={method}><span>{method}</span><i><b style={{ width: `${Math.max(4, sales.reduce((sum, sale) => sum + sale.paidAmount, 0) ? amount / sales.reduce((sum, sale) => sum + sale.paidAmount, 0) * 100 : 0)}%` }} /></i><strong>{formatCurrency(amount, currency)}</strong></div>)}</div></div></section>
    <section className="report-panel report-wide-panel"><ReportPanelHeading eyebrow="Product demand" title="Top-selling products" /><div className="report-table-wrap"><table className="report-table"><thead><tr><th>Product</th><th>Units sold</th><th>Sales value</th></tr></thead><tbody>{productSales.map((product) => <tr key={product.name}><td><strong>{product.name}</strong></td><td>{product.quantity}</td><td><strong>{formatCurrency(product.value, currency)}</strong></td></tr>)}</tbody></table>{!productSales.length ? <ReportEmpty text="No completed sales were recorded in this period." /> : null}</div></section></>;
}

function InventoryReport({ state, currency }: { state: ReturnType<typeof useBusiness>['state']; currency: string }) {
  const categories = selectInventoryCategoryReport(state);
  const locations = selectInventoryLocationReport(state);
  const summaries = selectInventorySummaries(state);
  const value = summaries.reduce((sum, entry) => sum + entry.quantityOnHand * entry.product.cost, 0);
  const retailValue = summaries.reduce((sum, entry) => sum + entry.quantityOnHand * entry.product.price, 0);
  const lowStock = summaries.filter((entry) => entry.quantityOnHand <= entry.product.reorderLevel).sort((a, b) => a.quantityOnHand - b.quantityOnHand);
  const exportRows = [['Product', 'Inventory ID', 'Quantity', 'Reorder level', 'Cost value', 'Retail value'], ...summaries.map((entry) => [entry.product.name, entry.product.inventoryId, entry.quantityOnHand, entry.product.reorderLevel, entry.quantityOnHand * entry.product.cost, entry.quantityOnHand * entry.product.price])];
  return <><section className="report-metrics"><ReportMetric icon={Boxes} label="Stock cost value" value={formatCurrency(value, currency)} note={`${summaries.length} products`} /><ReportMetric icon={CircleDollarSign} label="Retail value" value={formatCurrency(retailValue, currency)} note={`${formatCurrency(retailValue - value, currency)} gross margin capacity`} tone="good" /><ReportMetric icon={PackageSearch} label="Low-stock exposure" value={String(lowStock.length)} note="At or below reorder level" tone={lowStock.length ? 'warn' : 'good'} /><ReportMetric icon={Building2} label="Active locations" value={String(locations.length)} note={`${locations.reduce((sum, entry) => sum + entry.quantityOnHand, 0)} units on hand`} /></section><div className="report-action-row"><span>Live inventory valuation</span><button className="secondary-button" type="button" onClick={() => downloadCsv(exportRows, 'bizpilot-inventory-report.csv')}><Download size={14} /> Export CSV</button></div>
    <section className="report-sales-grid"><div className="report-panel"><ReportPanelHeading eyebrow="Classification" title="Value by category" /><div className="report-category-bars">{categories.map((entry) => <div key={entry.label}><span>{entry.label}</span><i><b style={{ width: `${Math.max(4, value ? entry.stockValue / value * 100 : 0)}%` }} /></i><strong>{formatCurrency(entry.stockValue, currency)}</strong></div>)}</div></div><div className="report-panel"><ReportPanelHeading eyebrow="Network" title="Stock by location" /><div className="report-segment-list">{locations.map((entry) => <div key={entry.locationId}><span><strong>{entry.label}</strong><small>{entry.type} · {entry.productCount} products · {entry.lowStockCount} low</small></span><b>{formatCurrency(entry.stockValue, currency)}</b></div>)}</div></div></section>
    <section className="report-panel report-wide-panel"><ReportPanelHeading eyebrow="Replenishment" title="Low-stock priorities" action={<Link className="text-button" href="/inventory">Open Inventory</Link>} /><div className="report-table-wrap"><table className="report-table"><thead><tr><th>Product</th><th>On hand</th><th>Reorder level</th><th>Cost exposure</th><th /></tr></thead><tbody>{lowStock.map((entry) => <tr key={entry.product.id}><td><strong>{entry.product.name}</strong><span>{entry.product.inventoryId}</span></td><td>{entry.quantityOnHand} {entry.product.unit}</td><td>{entry.product.reorderLevel} {entry.product.unit}</td><td>{formatCurrency(entry.quantityOnHand * entry.product.cost, currency)}</td><td><Link className="icon-button" title={`Open ${entry.product.name}`} href={`/inventory?product=${entry.product.id}`}><ChevronRight size={14} /></Link></td></tr>)}</tbody></table>{!lowStock.length ? <ReportEmpty text="All products are above their reorder levels." /> : null}</div></section></>;
}

function DocumentPacks({ state, hasPermission, openedAt }: { state: ReturnType<typeof useBusiness>['state']; hasPermission: ReturnType<typeof useBusiness>['hasPermission']; openedAt: Date }) {
  const available = ([['invoices', hasPermission('invoices.print') || hasPermission('invoices.export_pdf')], ['quotations', hasPermission('quotations.print') || hasPermission('quotations.export_pdf')], ['waybills', hasPermission('invoices.print') || hasPermission('invoices.export_pdf')]] as const).filter(([, allowed]) => allowed).map(([value]) => value);
  const [type, setType] = useState<DocumentType>(available[0] ?? 'invoices');
  const [query, setQuery] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [selectedQuotations, setSelectedQuotations] = useState<Set<string>>(new Set());
  const [selectedWaybills, setSelectedWaybills] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const sets = { invoices: selectedInvoices, quotations: selectedQuotations, waybills: selectedWaybills };
  const setters = { invoices: setSelectedInvoices, quotations: setSelectedQuotations, waybills: setSelectedWaybills };
  const activeSet = sets[type];
  const sales = state.sales.filter((sale) => sale.status !== 'Reversed');
  const docs = type === 'quotations' ? state.quotations.map((quotation) => ({ id: quotation.id, number: quotation.quotationNumber, owner: quotation.customerName, amount: quotation.totalAmount, createdAt: quotation.createdAt })) : sales.map((sale) => ({ id: sale.id, number: type === 'waybills' ? `${state.businessProfile.waybillPrefix || 'WAY-'}${sale.invoiceNumber.split('-').pop()}` : sale.invoiceNumber, owner: state.customers.find((customer) => customer.id === sale.customerId)?.name ?? sale.customerSnapshot?.name ?? 'Customer', amount: sale.totalAmount, createdAt: sale.createdAt }));
  const filtered = docs.filter((doc) => `${doc.number} ${doc.owner}`.toLowerCase().includes(query.toLowerCase()));
  const totalSelected = selectedInvoices.size + selectedQuotations.size + selectedWaybills.size;
  const allFilteredSelected = filtered.length > 0 && filtered.every((doc) => activeSet.has(doc.id));
  function toggle(id: string) {
    const next = new Set(activeSet);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setters[type](next);
  }
  function selectAll() {
    const next = new Set(activeSet);
    filtered.forEach((doc) => allFilteredSelected ? next.delete(doc.id) : next.add(doc.id));
    setters[type](next);
  }
  async function zipDocuments() { if (!totalSelected || busy) return; setBusy(true); setMessage(''); try { const [logoDataUrl, signatureDataUrl] = await Promise.all([loadLogoDataUrl(state.businessProfile.logoUrl), loadLogoDataUrl(state.businessProfile.signatureUrl)]); const context = { businessProfile: state.businessProfile, currency: state.businessProfile.currency, logoDataUrl, signatureDataUrl }; const entries = [...state.sales.filter((sale) => selectedInvoices.has(sale.id)).map((sale) => ({ name: `invoices/${sale.invoiceNumber}.pdf`, content: buildInvoicePdf(sale, state.customers.find((customer) => customer.id === sale.customerId), context) })), ...state.quotations.filter((quotation) => selectedQuotations.has(quotation.id)).map((quotation) => ({ name: `quotations/${quotation.quotationNumber}.pdf`, content: buildQuotationPdf(quotation, context) })), ...state.sales.filter((sale) => selectedWaybills.has(sale.id)).map((sale) => ({ name: `waybills/${state.businessProfile.waybillPrefix || 'WAY-'}${sale.invoiceNumber.split('-').pop()}.pdf`, content: buildWaybillPdf(sale, state.customers.find((customer) => customer.id === sale.customerId), context) }))]; downloadBlob(buildZip(entries), `bizpilot-document-pack-${openedAt.toISOString().slice(0, 10)}.zip`); setMessage(`${entries.length} documents downloaded as a ZIP pack.`); } catch { setMessage('The document pack could not be generated.'); } finally { setBusy(false); } }
  const selectedQuotes = state.quotations.filter((quotation) => selectedQuotations.has(quotation.id));
  return <><section className="document-pack-toolbar"><div><Archive size={18} /><span><strong>Document pack builder</strong><small>Select invoices, quotations, and waybills for one controlled export.</small></span></div><div><span>{totalSelected} selected</span><button className="secondary-button" type="button" disabled={!totalSelected} onClick={() => window.print()}><Printer size={14} /> Print selected</button><button className="primary-button" type="button" disabled={!totalSelected || busy} onClick={() => void zipDocuments()}><Download size={14} /> {busy ? 'Building pack...' : 'Download ZIP'}</button></div></section>{message ? <div className="settings-message" role="status">{message}</div> : null}<nav className="document-type-tabs">{available.map((value) => <button type="button" className={type === value ? 'is-active' : ''} onClick={() => setType(value)} key={value}>{value} <span>{sets[value].size}</span></button>)}</nav><section className="report-panel document-selector"><div className="document-selector-toolbar"><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${type}`} /></label><button className="text-button" type="button" onClick={selectAll}>{allFilteredSelected ? 'Clear all' : 'Select all'}</button></div><div className="document-selector-list">{filtered.map((doc) => <label key={doc.id}><input type="checkbox" checked={activeSet.has(doc.id)} onChange={() => toggle(doc.id)} /><i>{type === 'invoices' ? <ReceiptText size={16} /> : type === 'quotations' ? <FileText size={16} /> : <ShoppingCart size={16} />}</i><span><strong>{doc.number}</strong><small>{doc.owner} · {formatReceiptDate(doc.createdAt)}</small></span><b>{formatCurrency(doc.amount, state.businessProfile.currency)}</b><Link className="icon-button" title={`Open ${doc.number}`} href={type === 'quotations' ? `/quotations/${doc.id}` : type === 'waybills' ? `/sales/${doc.id}/waybill` : `/sales/${doc.id}`}><ArrowRight size={14} /></Link></label>)}{!filtered.length ? <ReportEmpty text={`No ${type} match this search.`} /> : null}</div></section><div className="report-print-pack">{sales.filter((sale) => selectedInvoices.has(sale.id)).map((sale) => <PrintablePackDocument key={`invoice-${sale.id}`} title="Tax Invoice" number={sale.invoiceNumber} owner={state.customers.find((customer) => customer.id === sale.customerId)?.name ?? sale.customerSnapshot?.name ?? 'Customer'} items={sale.items} total={sale.totalAmount} currency={state.businessProfile.currency} business={state.businessProfile.businessName} />)}{sales.filter((sale) => selectedWaybills.has(sale.id)).map((sale) => <PrintablePackDocument key={`waybill-${sale.id}`} title="Waybill" number={`${state.businessProfile.waybillPrefix || 'WAY-'}${sale.invoiceNumber.split('-').pop()}`} owner={state.customers.find((customer) => customer.id === sale.customerId)?.name ?? sale.customerSnapshot?.name ?? 'Customer'} items={sale.items} currency={state.businessProfile.currency} business={state.businessProfile.businessName} />)}{selectedQuotes.map((quotation) => <PrintablePackDocument key={quotation.id} title="Quotation" number={quotation.quotationNumber} owner={quotation.customerName} items={quotation.items} total={quotation.totalAmount} currency={state.businessProfile.currency} business={state.businessProfile.businessName} />)}</div></>;
}

function PrintablePackDocument({ title, number, owner, items, total, currency, business }: { title: string; number: string; owner: string; items: Sale['items'] | Quotation['items']; total?: number; currency: string; business: string }) { return <article><header><div><strong>{business}</strong><span>{title}</span></div><div><strong>{number}</strong><span>{owner}</span></div></header><table><thead><tr><th>Description</th><th>Qty</th><th>{total === undefined ? 'Reference' : 'Amount'}</th></tr></thead><tbody>{items.map((item) => <tr key={item.productId}><td>{item.productName}</td><td>{item.quantity}</td><td>{total === undefined ? item.inventoryId : formatCurrency(item.total, currency)}</td></tr>)}</tbody></table>{total !== undefined ? <footer><span>Total</span><strong>{formatCurrency(total, currency)}</strong></footer> : null}</article>; }
function ReportMetric({ icon: Icon, label, value, note, tone = 'neutral' }: { icon: typeof BarChart3; label: string; value: string; note: string; tone?: 'neutral' | 'good' | 'warn' }) { return <article><div><Icon size={14} /><span>{label}</span></div><strong>{value}</strong><small className={`report-metric-note report-metric-note--${tone}`}>{note}</small></article>; }
function ReportPanelHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) { return <div className="report-panel-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action}</div>; }
function ReportEmpty({ text }: { text: string }) { return <div className="report-empty"><Check size={18} /><span>{text}</span></div>; }
