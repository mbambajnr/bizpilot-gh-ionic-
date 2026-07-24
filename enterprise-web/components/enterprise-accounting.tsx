'use client';

import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  Landmark,
  Plus,
  ReceiptText,
  Search,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useMemo, useState } from 'react';

import { useBusiness } from '../../src/context/BusinessContext';
import type { AccountsPayable, Expense, Payment, PaymentChannel } from '../../src/data/seedBusiness';
import { selectDashboardMetrics, selectSaleBalanceRemaining } from '../../src/selectors/businessSelectors';
import { canApproveCategory } from '../../src/utils/businessLogic';
import { formatCurrency, formatRelativeDate } from '../../src/utils/format';
import { EnterpriseApp } from './enterprise-app';
import { EnterpriseShell } from './enterprise-shell';

type AccountingView = 'overview' | 'financials' | 'receivables' | 'payables' | 'expenses' | 'cash' | 'payments' | 'approvals';

const EXPENSE_CATEGORIES = ['General', 'Rent', 'Utility', 'Staff Wages', 'Transportation', 'Stock Purchase', 'Repairs', 'Marketing'];
const PAYABLE_STATUS: Record<AccountsPayable['status'], { label: string; tone: 'neutral' | 'warn' | 'good' | 'risk' }> = {
  pendingReview: { label: 'Pending review', tone: 'warn' },
  approved: { label: 'Approved', tone: 'good' },
  partiallyPaid: { label: 'Partially paid', tone: 'warn' },
  paid: { label: 'Paid', tone: 'good' },
  overdue: { label: 'Overdue', tone: 'risk' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export function EnterpriseAccounting() {
  return <EnterpriseApp><AccountingWorkspace /></EnterpriseApp>;
}

function AccountingWorkspace() {
  const { state, currentUser, hasPermission, addExpense, approvePayable, recordPayablePayment } = useBusiness();
  const canAccess = hasPermission('accounting.access');
  const canViewPayables = hasPermission('payables.view') || hasPermission('payables.manage') || hasPermission('payables.pay');
  const canApprovePayables = canApproveCategory(state, currentUser, 'payables', hasPermission);
  const canPayPayables = hasPermission('payables.pay');
  const canViewExpenses = hasPermission('expenses.view');
  const canCreateExpenses = hasPermission('expenses.create');
  const canViewPayments = hasPermission('payments.view') || hasPermission('payments.record');
  const canViewSales = hasPermission('sales.view') || hasPermission('reports.sales.view');
  const canViewFinancials = hasPermission('reports.financial.view');
  const [view, setView] = useState<AccountingView>(() => {
    if (typeof window === 'undefined') return 'overview';
    const segment = new URLSearchParams(window.location.search).get('segment');
    if (segment === 'financials' && canViewFinancials) return 'financials';
    if (segment === 'receivables' && canViewSales) return 'receivables';
    if (segment === 'payables' && canViewPayables) return 'payables';
    if (segment === 'expenses' && (canViewExpenses || canCreateExpenses)) return 'expenses';
    if (segment === 'payments' && canViewPayments) return 'payments';
    if (segment === 'approvals') return 'approvals';
    return 'overview';
  });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AccountsPayable['status']>('all');
  const [selectedPayableId, setSelectedPayableId] = useState(state.accountsPayable[0]?.id ?? '');
  const [paymentTarget, setPaymentTarget] = useState<AccountsPayable | null>(() => {
    if (typeof window === 'undefined' || !canPayPayables) return null;
    const params = new URLSearchParams(window.location.search);
    if (params.get('segment') !== 'payables' || params.get('action') !== 'payment') return null;
    return state.accountsPayable.find((payable) => ['approved', 'partiallyPaid', 'overdue'].includes(payable.status) && payable.balance > 0) ?? null;
  });
  const [expenseEditorOpen, setExpenseEditorOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [accountingOpenedAt] = useState(() => new Date());
  const metrics = useMemo(() => selectDashboardMetrics(state), [state]);
  const currency = state.businessProfile.currency;

  const todayKey = accountingOpenedAt.toDateString();
  const monthKey = accountingOpenedAt.toISOString().slice(0, 7);
  const todaysSales = state.sales.filter((sale) => sale.status !== 'Reversed' && new Date(sale.createdAt).toDateString() === todayKey);
  const todaysExpenses = state.expenses.filter((expense) => new Date(expense.createdAt).toDateString() === todayKey);
  const monthlyExpenses = state.expenses.filter((expense) => expense.createdAt.slice(0, 7) === monthKey);
  const todaysSupplierPayments = state.payments.filter((payment) => payment.sourceType === 'payable' && new Date(payment.createdAt).toDateString() === todayKey);
  const todaysCustomerPayments = state.payments.filter((payment) => ['invoice', 'sale'].includes(payment.sourceType) && new Date(payment.createdAt).toDateString() === todayKey);
  const salesWithPaymentRecords = new Set(state.payments.filter((payment) => ['invoice', 'sale'].includes(payment.sourceType)).map((payment) => payment.sourceId));
  const legacyInvoiceCollections = todaysSales.filter((sale) => !salesWithPaymentRecords.has(sale.id)).reduce((sum, sale) => sum + sale.paidAmount, 0);
  const cashCollectedToday = legacyInvoiceCollections + todaysCustomerPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const expenseToday = todaysExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const supplierPaidToday = todaysSupplierPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const netCashMovement = cashCollectedToday - expenseToday - supplierPaidToday;
  const openReceivables = state.sales.filter((sale) => sale.status !== 'Reversed' && selectSaleBalanceRemaining(sale) > 0);
  const receivables = openReceivables.reduce((sum, sale) => sum + selectSaleBalanceRemaining(sale), 0);
  const openPayables = state.accountsPayable.filter((payable) => !['paid', 'cancelled'].includes(payable.status) && payable.balance > 0);
  const payableBalance = openPayables.reduce((sum, payable) => sum + payable.balance, 0);
  const pendingApprovalCount = state.accountsPayable.filter((payable) => payable.status === 'pendingReview').length;
  const payableReadyCount = state.accountsPayable.filter((payable) => ['approved', 'partiallyPaid', 'overdue'].includes(payable.status) && payable.balance > 0).length;
  const overduePayableCount = openPayables.filter((payable) => payable.status === 'overdue' || Boolean(payable.dueDate && Date.parse(`${payable.dueDate}T23:59:59`) < accountingOpenedAt.getTime())).length;
  const cashSales = todaysSales.filter((sale) => sale.paymentMethod === 'Cash');
  const missingCashReferences = cashSales.filter((sale) => !sale.paymentReference?.trim());

  const payableRows = state.accountsPayable.map((payable) => ({
    payable,
    vendor: state.vendors.find((vendor) => vendor.id === payable.vendorId),
    purchase: state.purchases.find((purchase) => purchase.id === payable.purchaseId),
  }));
  const filteredPayables = payableRows.filter(({ payable, vendor, purchase }) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || `${payable.payableCode} ${vendor?.name ?? payable.vendorCode} ${purchase?.purchaseCode ?? ''}`.toLowerCase().includes(needle);
    return matchesQuery && (statusFilter === 'all' || payable.status === statusFilter);
  });
  const selectedPayableRow = filteredPayables.find(({ payable }) => payable.id === selectedPayableId) ?? filteredPayables[0];

  async function approve(payable: AccountsPayable) {
    setBusy(true);
    setActionMessage('');
    const result = await approvePayable({ payableId: payable.id, approvedBy: currentUser.userId });
    setBusy(false);
    setActionMessage(result.message ?? (result.ok ? `${payable.payableCode} approved for settlement.` : 'The payable could not be approved.'));
  }

  async function pay(input: { amount: number; method: PaymentChannel; reference: string }) {
    if (!paymentTarget) return false;
    setBusy(true);
    setActionMessage('');
    const result = await recordPayablePayment({ payableId: paymentTarget.id, amount: input.amount, method: input.method, reference: input.reference, paidBy: currentUser.userId });
    setBusy(false);
    setActionMessage(result.message ?? (result.ok ? `Payment recorded against ${paymentTarget.payableCode}.` : 'The supplier payment could not be recorded.'));
    if (result.ok) setPaymentTarget(null);
    return result.ok;
  }

  function recordExpense(input: { category: string; amount: number; note: string }) {
    const result = addExpense({ ...input, recordedByUserId: currentUser.userId, recordedByName: currentUser.name });
    setActionMessage(result.message ?? (result.ok ? 'Expense recorded.' : 'The expense could not be recorded.'));
    if (result.ok) setExpenseEditorOpen(false);
    return result.ok;
  }

  if (!canAccess) {
    return <EnterpriseShell active="Accounting"><div className="page-content"><section className="access-denied"><CircleDollarSign size={24} /><h1>Accounting access is restricted</h1><p>Your role does not include the finance workspace.</p></section></div></EnterpriseShell>;
  }

  return (
    <EnterpriseShell active="Accounting">
      <div className="page-content accounting-page">
        <section className="accounting-heading"><div><p className="eyebrow">Finance operations</p><h1>Accounting</h1><p>Review obligations, record settlements, control expenses, and close each day with traceable evidence.</p></div><div className="accounting-heading-actions">{canCreateExpenses ? <button className="secondary-button" type="button" onClick={() => setExpenseEditorOpen(true)}><Plus size={15} /> Record expense</button> : null}{canPayPayables && payableReadyCount ? <button className="primary-button" type="button" onClick={() => setPaymentTarget(openPayables.find((payable) => ['approved', 'partiallyPaid', 'overdue'].includes(payable.status)) ?? null)}><Banknote size={15} /> Pay supplier</button> : null}</div></section>

        <section className="accounting-metrics" aria-label="Accounting summary">
          <AccountingMetric icon={ArrowDownLeft} label="Cash collected today" value={formatCurrency(cashCollectedToday, currency)} helper={`${todaysSales.length} invoices`} tone="good" />
          <AccountingMetric icon={WalletCards} label="Receivables" value={formatCurrency(receivables, currency)} helper="Customer balances open" tone={receivables ? 'warn' : 'good'} />
          <AccountingMetric icon={ArrowUpRight} label="Accounts payable" value={formatCurrency(payableBalance, currency)} helper={`${openPayables.length} supplier bills`} tone={payableBalance ? 'warn' : 'good'} />
          <AccountingMetric icon={TrendingUp} label="Net cash movement" value={formatCurrency(netCashMovement, currency)} helper="Sales less expenses and settlements" tone={netCashMovement < 0 ? 'risk' : 'good'} />
        </section>

        <nav className="accounting-tabs" aria-label="Accounting views">
          <button className={view === 'overview' ? 'accounting-tab accounting-tab--active' : 'accounting-tab'} type="button" onClick={() => setView('overview')}>Overview</button>
          {canViewFinancials ? <button className={view === 'financials' ? 'accounting-tab accounting-tab--active' : 'accounting-tab'} type="button" onClick={() => setView('financials')}>Financial statements</button> : null}
          {canViewSales ? <button className={view === 'receivables' ? 'accounting-tab accounting-tab--active' : 'accounting-tab'} type="button" onClick={() => setView('receivables')}>Receivables {openReceivables.length ? `(${openReceivables.length})` : ''}</button> : null}
          {canViewPayables ? <button className={view === 'payables' ? 'accounting-tab accounting-tab--active' : 'accounting-tab'} type="button" onClick={() => setView('payables')}>Payables {openPayables.length ? `(${openPayables.length})` : ''}</button> : null}
          {canViewExpenses || canCreateExpenses ? <button className={view === 'expenses' ? 'accounting-tab accounting-tab--active' : 'accounting-tab'} type="button" onClick={() => setView('expenses')}>Expenses</button> : null}
          {canViewSales ? <button className={view === 'cash' ? 'accounting-tab accounting-tab--active' : 'accounting-tab'} type="button" onClick={() => setView('cash')}>Cash control {missingCashReferences.length ? `(${missingCashReferences.length})` : ''}</button> : null}
          {canViewPayments ? <button className={view === 'payments' ? 'accounting-tab accounting-tab--active' : 'accounting-tab'} type="button" onClick={() => setView('payments')}>Payment ledger</button> : null}
          <button className={view === 'approvals' ? 'accounting-tab accounting-tab--active' : 'accounting-tab'} type="button" onClick={() => setView('approvals')}>Approvals</button>
        </nav>

        {actionMessage ? <div className="settings-message" role="status">{actionMessage}</div> : null}

        {view === 'overview' ? <AccountingOverview currency={currency} pendingApprovalCount={pendingApprovalCount} payableReadyCount={payableReadyCount} overduePayableCount={overduePayableCount} missingCashReferences={missingCashReferences.length} expenseToday={expenseToday} supplierPaidToday={supplierPaidToday} monthlyExpenses={monthlyExpenses} metrics={metrics} onOpen={setView} canViewPayables={canViewPayables} canViewExpenses={canViewExpenses || canCreateExpenses} canViewCash={canViewSales} /> : null}
        {view === 'receivables' && canViewSales ? <ReceivablesWorkspace sales={state.sales} customers={state.customers} currency={currency} now={accountingOpenedAt.getTime()} canOpenInvoice={hasPermission('invoices.view')} /> : null}
        {view === 'payables' && canViewPayables ? <PayablesWorkspace rows={filteredPayables} selected={selectedPayableRow} query={query} statusFilter={statusFilter} currency={currency} busy={busy} canApprove={canApprovePayables} canPay={canPayPayables} onQuery={setQuery} onStatusFilter={setStatusFilter} onSelect={setSelectedPayableId} onApprove={(payable) => void approve(payable)} onPay={setPaymentTarget} /> : null}
        {view === 'expenses' && (canViewExpenses || canCreateExpenses) ? <ExpensesWorkspace expenses={state.expenses} currency={currency} canView={canViewExpenses} canCreate={canCreateExpenses} onCreate={() => setExpenseEditorOpen(true)} /> : null}
        {view === 'cash' && canViewSales ? <CashControl sales={todaysSales} customers={state.customers} currency={currency} missingReferenceCount={missingCashReferences.length} /> : null}
        {view === 'payments' && canViewPayments ? <PaymentLedger payments={state.payments} payables={state.accountsPayable} vendors={state.vendors} sales={state.sales} customers={state.customers} users={state.users} currency={currency} /> : null}
        {view === 'financials' && canViewFinancials ? <FinancialStatements state={state} currency={currency} /> : null}
        {view === 'approvals' ? <ApprovalsAudit payables={state.accountsPayable} purchases={state.purchases} transfers={state.stockTransfers} vendors={state.vendors} users={state.users} /> : null}
      </div>

      {paymentTarget ? <PaymentEditor payable={paymentTarget} vendorName={state.vendors.find((vendor) => vendor.id === paymentTarget.vendorId)?.name ?? paymentTarget.vendorCode} currency={currency} busy={busy} onClose={() => setPaymentTarget(null)} onSave={pay} /> : null}
      {expenseEditorOpen ? <ExpenseEditor currency={currency} onClose={() => setExpenseEditorOpen(false)} onSave={recordExpense} /> : null}
    </EnterpriseShell>
  );
}

function AccountingMetric({ icon: Icon, label, value, helper, tone }: { icon: typeof Banknote; label: string; value: string; helper: string; tone: 'good' | 'warn' | 'risk' }) {
  return <article><i className={`accounting-metric-icon accounting-metric-icon--${tone}`}><Icon size={15} /></i><div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div></article>;
}

function AccountingOverview({ currency, pendingApprovalCount, payableReadyCount, overduePayableCount, missingCashReferences, expenseToday, supplierPaidToday, monthlyExpenses, metrics, onOpen, canViewPayables, canViewExpenses, canViewCash }: { currency: string; pendingApprovalCount: number; payableReadyCount: number; overduePayableCount: number; missingCashReferences: number; expenseToday: number; supplierPaidToday: number; monthlyExpenses: Expense[]; metrics: ReturnType<typeof selectDashboardMetrics>; onOpen: (view: AccountingView) => void; canViewPayables: boolean; canViewExpenses: boolean; canViewCash: boolean }) {
  const monthlyTotal = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const categoryTotals = Object.entries(monthlyExpenses.reduce<Record<string, number>>((totals, expense) => ({ ...totals, [expense.category]: (totals[expense.category] ?? 0) + expense.amount }), {})).sort((left, right) => right[1] - left[1]).slice(0, 4);
  const maxCategory = Math.max(...categoryTotals.map(([, amount]) => amount), 1);
  const queues = [
    canViewPayables ? { label: 'Payables awaiting approval', count: pendingApprovalCount, detail: 'Three-way matched bills requiring General Manager approval', view: 'payables' as const, tone: pendingApprovalCount ? 'warn' : 'good' } : null,
    canViewPayables ? { label: 'Approved supplier payments', count: payableReadyCount, detail: 'Approved or partly paid bills ready for settlement', view: 'payables' as const, tone: payableReadyCount ? 'warn' : 'good' } : null,
    canViewPayables ? { label: 'Overdue supplier bills', count: overduePayableCount, detail: 'Supplier obligations beyond their due date', view: 'payables' as const, tone: overduePayableCount ? 'risk' : 'good' } : null,
    canViewCash ? { label: 'Cash references missing', count: missingCashReferences, detail: 'Cash invoices without banking evidence', view: 'cash' as const, tone: missingCashReferences ? 'risk' : 'good' } : null,
  ].filter(Boolean) as Array<{ label: string; count: number; detail: string; view: AccountingView; tone: string }>;
  return <section className="accounting-overview-grid"><div className="finance-queue-panel"><div className="accounting-panel-heading"><div><p className="eyebrow">Action centre</p><h2>Finance work queue</h2><p>Exceptions are prioritized before routine ledger review.</p></div><span>{queues.reduce((sum, item) => sum + item.count, 0)} actions</span></div><div className="finance-queue-list">{queues.map((item) => <button type="button" key={item.label} onClick={() => onOpen(item.view)}><i className={`finance-queue-icon finance-queue-icon--${item.tone}`}>{item.count ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}</i><span><strong>{item.label}</strong><small>{item.detail}</small></span><b>{item.count}</b><ChevronRight size={14} /></button>)}</div></div><aside className="daily-position-panel"><div className="accounting-panel-heading"><div><p className="eyebrow">Daily position</p><h2>Cash movement</h2></div></div><dl><div><dt>Gross sales</dt><dd>{formatCurrency(metrics.salesToday, currency)}</dd></div><div><dt>Operating expenses</dt><dd className={expenseToday ? 'accounting-negative' : ''}>-{formatCurrency(expenseToday, currency)}</dd></div><div><dt>Supplier settlements</dt><dd className={supplierPaidToday ? 'accounting-negative' : ''}>-{formatCurrency(supplierPaidToday, currency)}</dd></div></dl><p>Operational cash position only. It is not a statutory profit and loss statement.</p></aside>{canViewExpenses ? <section className="expense-analysis-panel"><div className="accounting-panel-heading"><div><p className="eyebrow">Current month</p><h2>Expense concentration</h2><p>{formatCurrency(monthlyTotal, currency)} recorded across {monthlyExpenses.length} entries.</p></div><button className="text-button" type="button" onClick={() => onOpen('expenses')}>View ledger</button></div><div className="expense-bars">{categoryTotals.map(([category, amount]) => <div key={category}><span><strong>{category}</strong><small>{formatCurrency(amount, currency)}</small></span><i><b style={{ transform: `scaleX(${amount / maxCategory})` }} /></i></div>)}{!categoryTotals.length ? <div className="accounting-empty-small"><ReceiptText size={20} /><span>No expenses recorded this month.</span></div> : null}</div></section> : null}</section>;
}

function PayablesWorkspace({ rows, selected, query, statusFilter, currency, busy, canApprove, canPay, onQuery, onStatusFilter, onSelect, onApprove, onPay }: { rows: Array<{ payable: AccountsPayable; vendor?: ReturnType<typeof useBusiness>['state']['vendors'][number]; purchase?: ReturnType<typeof useBusiness>['state']['purchases'][number] }>; selected?: { payable: AccountsPayable; vendor?: ReturnType<typeof useBusiness>['state']['vendors'][number]; purchase?: ReturnType<typeof useBusiness>['state']['purchases'][number] }; query: string; statusFilter: 'all' | AccountsPayable['status']; currency: string; busy: boolean; canApprove: boolean; canPay: boolean; onQuery: (value: string) => void; onStatusFilter: (value: 'all' | AccountsPayable['status']) => void; onSelect: (id: string) => void; onApprove: (payable: AccountsPayable) => void; onPay: (payable: AccountsPayable) => void }) {
  return <section className="accounting-workspace"><div className="payable-list-panel"><div className="accounting-toolbar"><label><Search size={15} /><input aria-label="Search payables" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search payable, supplier, or purchase" /></label><select aria-label="Filter payable status" value={statusFilter} onChange={(event) => onStatusFilter(event.target.value as typeof statusFilter)}><option value="all">All statuses</option>{Object.entries(PAYABLE_STATUS).map(([value, meta]) => <option value={value} key={value}>{meta.label}</option>)}</select></div><div className="accounting-table-wrap"><table className="payable-table"><thead><tr><th>Payable</th><th>Supplier</th><th>Due date</th><th>Balance</th><th>Status</th><th /></tr></thead><tbody>{rows.map(({ payable, vendor, purchase }) => { const meta = PAYABLE_STATUS[payable.status]; return <tr className={selected?.payable.id === payable.id ? 'payable-row payable-row--selected' : 'payable-row'} key={payable.id} onClick={() => onSelect(payable.id)}><td><strong>{payable.payableCode}</strong><span>{purchase?.purchaseCode ?? 'No purchase link'}</span></td><td>{vendor?.name ?? payable.vendorCode}</td><td>{payable.dueDate ? new Date(`${payable.dueDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set'}</td><td><strong>{formatCurrency(payable.balance, currency)}</strong><span>of {formatCurrency(payable.amountDue, currency)}</span></td><td><span className={`payable-status payable-status--${meta.tone}`}>{meta.label}</span></td><td><ChevronRight size={14} /></td></tr>; })}</tbody></table>{!rows.length ? <AccountingEmpty icon={FileCheck2} title="No payables in this view" detail="Approved procurement obligations will appear here for review and settlement." /> : null}</div></div><PayableInspector row={selected} currency={currency} busy={busy} canApprove={canApprove} canPay={canPay} onApprove={onApprove} onPay={onPay} /></section>;
}

function PayableInspector({ row, currency, busy, canApprove, canPay, onApprove, onPay }: { row?: { payable: AccountsPayable; vendor?: ReturnType<typeof useBusiness>['state']['vendors'][number]; purchase?: ReturnType<typeof useBusiness>['state']['purchases'][number] }; currency: string; busy: boolean; canApprove: boolean; canPay: boolean; onApprove: (payable: AccountsPayable) => void; onPay: (payable: AccountsPayable) => void }) {
  if (!row) return <aside className="payable-inspector payable-inspector--empty"><FileCheck2 size={23} /><strong>Select a payable</strong><span>Approval and settlement controls will appear here.</span></aside>;
  const { payable, vendor, purchase } = row;
  const meta = PAYABLE_STATUS[payable.status];
  const paymentsAllowed = ['approved', 'partiallyPaid', 'overdue'].includes(payable.status) && payable.balance > 0;
  return <aside className="payable-inspector"><div className="payable-inspector-head"><i><ReceiptText size={18} /></i><div><p className="eyebrow">{payable.payableCode}</p><h2>{vendor?.name ?? payable.vendorCode}</h2><span className={`payable-status payable-status--${meta.tone}`}>{meta.label}</span></div></div><div className="payable-inspector-values"><div><span>Amount due</span><strong>{formatCurrency(payable.amountDue, currency)}</strong></div><div><span>Paid</span><strong>{formatCurrency(payable.amountPaid, currency)}</strong></div><div><span>Balance</span><strong className={payable.balance ? 'accounting-negative' : ''}>{formatCurrency(payable.balance, currency)}</strong></div></div><section className="payable-control-section"><div className="accounting-section-heading"><span>Procurement controls</span><Link href="/procurement">Open order <ArrowRight size={12} /></Link></div><div className="payable-control-row"><ClipboardCheck size={14} /><span><strong>Purchase order</strong><small>{purchase?.purchaseCode ?? 'Unavailable'}</small></span><b>{purchase?.status ?? '—'}</b></div><div className="payable-control-row"><FileCheck2 size={14} /><span><strong>Three-way match</strong><small>Order, receipt, and supplier invoice</small></span><b className={purchase?.threeWayMatchStatus === 'matched' ? 'accounting-positive' : 'accounting-negative'}>{purchase?.threeWayMatchStatus ?? 'pending'}</b></div><div className="payable-control-row"><Landmark size={14} /><span><strong>Due date</strong><small>{payable.dueDate ? new Date(`${payable.dueDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Not specified'}</small></span><b>{payable.paymentMethod ?? '—'}</b></div></section><section className="payable-audit"><div className="accounting-section-heading"><span>Settlement evidence</span></div><dl><div><dt>Reference</dt><dd>{payable.paymentReference || 'Not recorded'}</dd></div><div><dt>Last update</dt><dd>{formatRelativeDate(payable.updatedAt)}</dd></div><div><dt>Approved by</dt><dd>{payable.approvedBy || 'Pending'}</dd></div></dl></section><div className="payable-inspector-actions">{canApprove && payable.status === 'pendingReview' ? <button className="primary-button" type="button" disabled={busy || purchase?.threeWayMatchStatus !== 'matched'} onClick={() => onApprove(payable)}><CheckCircle2 size={14} /> Approve payable</button> : null}{canPay && paymentsAllowed ? <button className="primary-button" type="button" disabled={busy} onClick={() => onPay(payable)}><Banknote size={14} /> Record payment</button> : null}{payable.status === 'pendingReview' && purchase?.threeWayMatchStatus !== 'matched' ? <p><AlertTriangle size={13} /> Complete the three-way match before approval.</p> : null}</div></aside>;
}

function ExpensesWorkspace({ expenses, currency, canView, canCreate, onCreate }: { expenses: Expense[]; currency: string; canView: boolean; canCreate: boolean; onCreate: () => void }) {
  return <section className="accounting-wide-panel"><div className="accounting-panel-heading"><div><p className="eyebrow">Operating costs</p><h2>Expense ledger</h2><p>Every entry retains its recorder, category, note, and timestamp.</p></div>{canCreate ? <button className="primary-button" type="button" onClick={onCreate}><Plus size={15} /> Record expense</button> : null}</div>{canView ? <div className="accounting-table-wrap"><table className="expense-table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Recorded by</th><th>Amount</th></tr></thead><tbody>{[...expenses].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)).map((expense) => <tr key={expense.id}><td>{new Date(expense.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td><td><span className="expense-category">{expense.category}</span></td><td>{expense.note || 'No description'}</td><td>{expense.recordedByName}</td><td><strong className="accounting-negative">-{formatCurrency(expense.amount, currency)}</strong></td></tr>)}</tbody></table>{!expenses.length ? <AccountingEmpty icon={ReceiptText} title="No expenses recorded" detail="Authorized users can add the first operating expense using the action above." /> : null}</div> : <AccountingEmpty icon={ReceiptText} title="Expense history is restricted" detail="Your role can record expenses but cannot inspect the full ledger." />}</section>;
}

function CashControl({ sales, customers, currency, missingReferenceCount }: { sales: ReturnType<typeof useBusiness>['state']['sales']; customers: ReturnType<typeof useBusiness>['state']['customers']; currency: string; missingReferenceCount: number }) {
  const cash = sales.filter((sale) => sale.paymentMethod === 'Cash');
  return <section className="accounting-wide-panel"><div className="accounting-panel-heading"><div><p className="eyebrow">Daily close</p><h2>Cash-to-bank control</h2><p>Cash invoices require a banking or deposit reference to complete daily evidence.</p></div><span className={missingReferenceCount ? 'accounting-risk-badge' : 'accounting-good-badge'}>{missingReferenceCount ? `${missingReferenceCount} missing` : 'Evidence complete'}</span></div><div className="accounting-table-wrap"><table className="cash-control-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Cash collected</th><th>Banking reference</th><th>Status</th><th /></tr></thead><tbody>{cash.map((sale) => <tr key={sale.id}><td><strong>{sale.invoiceNumber}</strong><span>{formatRelativeDate(sale.createdAt)}</span></td><td>{customers.find((customer) => customer.id === sale.customerId)?.name ?? sale.customerSnapshot?.name ?? 'Walk-in customer'}</td><td>{formatCurrency(sale.paidAmount, currency)}</td><td>{sale.paymentReference || 'Not recorded'}</td><td><span className={`payable-status payable-status--${sale.paymentReference ? 'good' : 'risk'}`}>{sale.paymentReference ? 'Reconciled' : 'Action required'}</span></td><td><Link className="icon-button" title={`Open ${sale.invoiceNumber}`} href={`/sales/${sale.id}`}><ChevronRight size={14} /></Link></td></tr>)}</tbody></table>{!cash.length ? <AccountingEmpty icon={Landmark} title="No cash sales today" detail="Cash invoices recorded today will appear here for banking evidence." /> : null}</div></section>;
}

function ApprovalsAudit({ payables, purchases, transfers, vendors, users }: { payables: AccountsPayable[]; purchases: ReturnType<typeof useBusiness>['state']['purchases']; transfers: ReturnType<typeof useBusiness>['state']['stockTransfers']; vendors: ReturnType<typeof useBusiness>['state']['vendors']; users: ReturnType<typeof useBusiness>['state']['users'] }) {
  const resolveUser = (id?: string) => (id ? users.find((user) => user.userId === id)?.name ?? id : 'Unknown');
  const resolveVendor = (id?: string) => vendors.find((vendor) => vendor.id === id)?.name;
  type ApprovalRow = { id: string; type: string; tone: 'good' | 'warn' | 'neutral'; reference: string; detail: string; approvedBy: string; at: string };
  const rows: ApprovalRow[] = [
    ...payables.filter((payable) => payable.approvedBy).map((payable) => ({ id: `pay-${payable.id}`, type: 'Payable', tone: 'good' as const, reference: payable.payableCode, detail: resolveVendor(payable.vendorId) ?? payable.vendorCode, approvedBy: resolveUser(payable.approvedBy), at: payable.updatedAt })),
    ...purchases.filter((purchase) => purchase.approvedBy).map((purchase) => ({ id: `pur-${purchase.id}`, type: 'Purchase', tone: 'warn' as const, reference: purchase.purchaseCode, detail: resolveVendor(purchase.vendorId) ?? purchase.vendorCode, approvedBy: resolveUser(purchase.approvedBy), at: purchase.approvedAt ?? purchase.updatedAt })),
    ...transfers.filter((transfer) => transfer.approvedBy).map((transfer) => ({ id: `trf-${transfer.id}`, type: 'Transfer', tone: 'neutral' as const, reference: transfer.transferCode, detail: 'Stock transfer', approvedBy: resolveUser(transfer.approvedBy), at: transfer.approvedAt ?? transfer.createdAt })),
  ].sort((left, right) => Date.parse(right.at) - Date.parse(left.at));
  return <section className="accounting-wide-panel"><div className="accounting-panel-heading"><div><p className="eyebrow">Governance</p><h2>Approval history</h2><p>Company-wide record of authorized payables, purchases, and stock transfers — who approved what, and when.</p></div><span>{rows.length} approvals</span></div><div className="accounting-table-wrap"><table className="payment-ledger-table"><thead><tr><th>Type</th><th>Reference</th><th>Details</th><th>Approved by</th><th>When</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><span className={`payable-status payable-status--${row.tone}`}>{row.type}</span></td><td><strong>{row.reference}</strong></td><td>{row.detail}</td><td>{row.approvedBy}</td><td>{formatRelativeDate(row.at)}</td></tr>)}</tbody></table>{!rows.length ? <AccountingEmpty icon={ClipboardCheck} title="No approvals recorded yet" detail="Approved payables, purchases, and transfers will appear here as an audit trail." /> : null}</div></section>;
}

function FinancialStatements({ state, currency }: { state: ReturnType<typeof useBusiness>['state']; currency: string }) {
  const [period, setPeriod] = useState<'month' | 'year' | 'all'>('month');
  const [now] = useState(() => Date.now());
  const nowDate = new Date(now);
  const cutoff = period === 'month' ? new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime() : period === 'year' ? new Date(nowDate.getFullYear(), 0, 1).getTime() : 0;
  const periodLabel = period === 'month' ? nowDate.toLocaleDateString('en-GH', { month: 'long', year: 'numeric' }) : period === 'year' ? String(nowDate.getFullYear()) : 'All time';

  const sales = state.sales.filter((sale) => sale.status === 'Completed' && Date.parse(sale.createdAt) >= cutoff);
  const expenses = state.expenses.filter((expense) => Date.parse(expense.createdAt) >= cutoff);
  const productCost = (productId: string) => state.products.find((product) => product.id === productId)?.cost ?? 0;
  const netRevenueOf = (sale: typeof sales[number]) => sale.subtotalAmount ?? (sale.totalAmount - (sale.taxAmount ?? 0));
  const cogsOf = (sale: typeof sales[number]) => sale.items.reduce((sum, item) => sum + item.quantity * productCost(item.productId), 0);

  const revenue = sales.reduce((sum, sale) => sum + netRevenueOf(sale), 0);
  const tax = sales.reduce((sum, sale) => sum + (sale.taxAmount ?? 0), 0);
  const cogs = sales.reduce((sum, sale) => sum + cogsOf(sale), 0);
  const grossProfit = revenue - cogs;
  const grossMargin = revenue ? Math.round((grossProfit / revenue) * 100) : 0;
  const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const netProfit = grossProfit - expenseTotal;
  const expenseByCategory = Object.entries(expenses.reduce<Record<string, number>>((result, expense) => { result[expense.category] = (result[expense.category] ?? 0) + expense.amount; return result; }, {})).sort((left, right) => right[1] - left[1]);
  const maxCategory = Math.max(...expenseByCategory.map(([, amount]) => amount), 1);

  const saleLocation = new Map<string, string>();
  state.stockMovements.forEach((movement) => { if (movement.relatedSaleId && movement.locationId && !saleLocation.has(movement.relatedSaleId)) saleLocation.set(movement.relatedSaleId, movement.locationId); });
  const branchAgg = new Map<string, { revenue: number; cogs: number }>();
  sales.forEach((sale) => { const key = saleLocation.get(sale.id) ?? 'unassigned'; const acc = branchAgg.get(key) ?? { revenue: 0, cogs: 0 }; branchAgg.set(key, { revenue: acc.revenue + netRevenueOf(sale), cogs: acc.cogs + cogsOf(sale) }); });
  const branchRows = [...branchAgg.entries()].map(([locationId, agg]) => ({ name: state.locations.find((location) => location.id === locationId)?.name ?? 'Unassigned', revenue: agg.revenue, cogs: agg.cogs, gross: agg.revenue - agg.cogs })).sort((left, right) => right.revenue - left.revenue);

  return <section className="accounting-wide-panel">
    <div className="accounting-panel-heading"><div><p className="eyebrow">Profit &amp; loss · {periodLabel}</p><h2>Income statement</h2><p>Accrual-basis statement from recorded sales, product cost, and expenses.</p></div><div className="payment-segments">{([['month', 'This month'], ['year', 'This year'], ['all', 'All time']] as const).map(([value, label]) => <button type="button" className={period === value ? 'payment-segment payment-segment--active' : 'payment-segment'} onClick={() => setPeriod(value)} key={value}>{label}</button>)}</div></div>
    <div className="income-statement">
      <div className="is-row"><span>Revenue (net of tax)</span><b>{formatCurrency(revenue, currency)}</b></div>
      <div className="is-row is-deduct"><span>Cost of sales</span><b>({formatCurrency(cogs, currency)})</b></div>
      <div className="is-row is-subtotal"><span>Gross profit</span><b>{formatCurrency(grossProfit, currency)}</b></div>
      <div className="is-row is-muted"><span>Gross margin</span><b>{grossMargin}%</b></div>
      <div className="is-row is-deduct"><span>Operating expenses</span><b>({formatCurrency(expenseTotal, currency)})</b></div>
      <div className={`is-row is-total ${netProfit < 0 ? 'is-loss' : ''}`}><span>{netProfit < 0 ? 'Net loss' : 'Net profit'}</span><b>{formatCurrency(netProfit, currency)}</b></div>
    </div>
    <p className="is-note">Output VAT of {formatCurrency(tax, currency)} is collected for the tax authority and excluded from revenue. This is a management statement, not a filed statutory return.</p>
    <div className="accounting-panel-heading"><div><p className="eyebrow">By branch</p><h2>Revenue and margin by location</h2></div></div>
    <div className="report-table-scroll"><table className="financials-table"><thead><tr><th>Branch</th><th>Revenue</th><th>Cost of sales</th><th>Gross profit</th><th>Margin</th></tr></thead><tbody>{branchRows.map((row) => <tr key={row.name}><td>{row.name}</td><td>{formatCurrency(row.revenue, currency)}</td><td>{formatCurrency(row.cogs, currency)}</td><td><strong>{formatCurrency(row.gross, currency)}</strong></td><td>{row.revenue ? Math.round((row.gross / row.revenue) * 100) : 0}%</td></tr>)}</tbody></table></div>
    {!branchRows.length ? <AccountingEmpty icon={TrendingUp} title="No sales in this period" detail="Completed sales will populate the income statement and branch breakdown." /> : null}
    <div className="accounting-panel-heading"><div><p className="eyebrow">By category</p><h2>Operating expenses</h2></div></div>
    <div className="report-category-bars">{expenseByCategory.map(([category, amount]) => <div key={category}><span>{category}</span><i><b style={{ width: `${Math.max(4, expenseTotal ? amount / maxCategory * 100 : 0)}%` }} /></i><strong>{formatCurrency(amount, currency)}</strong></div>)}{!expenseByCategory.length ? <div className="accounting-empty-small"><ReceiptText size={20} /><span>No expenses recorded in this period.</span></div> : null}</div>
  </section>;
}

function ReceivablesWorkspace({ sales, customers, currency, now, canOpenInvoice }: { sales: ReturnType<typeof useBusiness>['state']['sales']; customers: ReturnType<typeof useBusiness>['state']['customers']; currency: string; now: number; canOpenInvoice: boolean }) {
  const rows = sales
    .filter((sale) => sale.status !== 'Reversed' && selectSaleBalanceRemaining(sale) > 0)
    .map((sale) => ({ sale, balance: selectSaleBalanceRemaining(sale), ageDays: Math.max(0, Math.floor((now - Date.parse(sale.createdAt)) / 86400000)) }))
    .sort((left, right) => right.balance - left.balance);
  const total = rows.reduce((sum, row) => sum + row.balance, 0);
  return <section className="accounting-wide-panel"><div className="accounting-panel-heading"><div><p className="eyebrow">Accounts receivable</p><h2>Outstanding receivables</h2><p>Completed customer invoices that still carry an unpaid balance.</p></div><span>{formatCurrency(total, currency)} across {rows.length} invoices</span></div><div className="accounting-table-wrap"><table className="payment-ledger-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Invoiced</th><th>Paid</th><th>Balance due</th><th>Age</th><th /></tr></thead><tbody>{rows.map(({ sale, balance, ageDays }) => <tr key={sale.id}><td><strong>{sale.invoiceNumber}</strong><span>{formatRelativeDate(sale.createdAt)}</span></td><td>{customers.find((customer) => customer.id === sale.customerId)?.name ?? sale.customerSnapshot?.name ?? 'Walk-in customer'}</td><td>{formatCurrency(sale.totalAmount, currency)}</td><td>{formatCurrency(sale.paidAmount, currency)}</td><td><strong className="accounting-negative">{formatCurrency(balance, currency)}</strong></td><td><span className={`payable-status payable-status--${ageDays > 30 ? 'risk' : ageDays > 14 ? 'warn' : 'good'}`}>{ageDays} day{ageDays === 1 ? '' : 's'}</span></td><td>{canOpenInvoice ? <Link className="icon-button" aria-label={`Open ${sale.invoiceNumber}`} title={`Open ${sale.invoiceNumber}`} href={`/sales/${sale.id}`}><ChevronRight size={14} /></Link> : null}</td></tr>)}</tbody></table>{!rows.length ? <AccountingEmpty icon={WalletCards} title="No outstanding receivables" detail="Fully paid and unpaid customer invoices will appear here when a balance is due." /> : null}</div></section>;
}

function PaymentLedger({ payments, payables, vendors, sales, customers, users, currency }: { payments: Payment[]; payables: AccountsPayable[]; vendors: ReturnType<typeof useBusiness>['state']['vendors']; sales: ReturnType<typeof useBusiness>['state']['sales']; customers: ReturnType<typeof useBusiness>['state']['customers']; users: ReturnType<typeof useBusiness>['state']['users']; currency: string }) {
  return <section className="accounting-wide-panel"><div className="accounting-panel-heading"><div><p className="eyebrow">Settlement audit</p><h2>Payment ledger</h2><p>Immutable customer receipts and supplier payments linked to their source obligations.</p></div><span>{payments.length} records</span></div><div className="accounting-table-wrap"><table className="payment-ledger-table"><thead><tr><th>Payment</th><th>Source</th><th>Counterparty</th><th>Method</th><th>Reference</th><th>Recorded by</th><th>Amount</th></tr></thead><tbody>{[...payments].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)).map((payment) => { const payable = payment.sourceType === 'payable' ? payables.find((entry) => entry.id === payment.sourceId) : undefined; const sale = ['invoice', 'sale'].includes(payment.sourceType) ? sales.find((entry) => entry.id === payment.sourceId) : undefined; const vendor = payable ? vendors.find((entry) => entry.id === payable.vendorId) : undefined; const customer = sale ? customers.find((entry) => entry.id === sale.customerId) : undefined; return <tr key={payment.id}><td><strong>{payment.paymentCode}</strong><span>{formatRelativeDate(payment.createdAt)}</span></td><td>{payable?.payableCode ?? sale?.invoiceNumber ?? payment.sourceType}</td><td>{vendor?.name ?? customer?.name ?? sale?.customerSnapshot?.name ?? 'Business transaction'}</td><td>{formatPaymentMethod(payment.method)}</td><td>{payment.reference || 'Not provided'}</td><td>{users.find((user) => user.userId === payment.recordedBy)?.name ?? payment.recordedBy}</td><td><strong>{formatCurrency(payment.amount, currency)}</strong></td></tr>; })}</tbody></table>{!payments.length ? <AccountingEmpty icon={CreditCard} title="No payment records" detail="Customer receipts and supplier settlements will appear here." /> : null}</div></section>;
}

function PaymentEditor({ payable, vendorName, currency, busy, onClose, onSave }: { payable: AccountsPayable; vendorName: string; currency: string; busy: boolean; onClose: () => void; onSave: (input: { amount: number; method: PaymentChannel; reference: string }) => Promise<boolean> }) {
  const [amount, setAmount] = useState(String(payable.balance));
  const [method, setMethod] = useState<PaymentChannel>('bank');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); const numericAmount = Number(amount); if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError('Enter a payment amount greater than zero.'); return; } if (numericAmount > payable.balance) { setError('Payment cannot exceed the remaining balance.'); return; } setError(''); const ok = await onSave({ amount: numericAmount, method, reference: reference.trim() }); if (!ok) setError('Review the settlement details and try again.'); }
  return <div className="composer-backdrop" role="presentation"><form className="accounting-editor" role="dialog" aria-modal="true" aria-labelledby="payment-editor-title" onSubmit={(event) => void submit(event)}><div className="composer-heading"><div><p className="eyebrow">{payable.payableCode}</p><h2 id="payment-editor-title">Record supplier payment</h2></div><button className="icon-button" type="button" aria-label="Close payment" title="Close payment" onClick={onClose}><X size={18} /></button></div><div className="composer-body"><div className="payment-context"><div><span>Supplier</span><strong>{vendorName}</strong></div><div><span>Amount due</span><strong>{formatCurrency(payable.amountDue, currency)}</strong></div><div><span>Balance</span><strong>{formatCurrency(payable.balance, currency)}</strong></div></div><label className="form-field"><span>Payment amount ({currency})</span><input autoFocus type="number" min="0.01" max={payable.balance} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label className="form-field"><span>Payment method</span><select value={method} onChange={(event) => setMethod(event.target.value as PaymentChannel)}><option value="bank">Bank</option><option value="cash">Cash</option><option value="mobileMoney">Mobile Money</option><option value="creditCard">Credit Card</option></select></label><label className="form-field"><span>Payment reference</span><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Bank slip, transaction ID, or cheque number" /></label>{error ? <p className="accounting-form-error" role="alert">{error}</p> : null}</div><div className="composer-footer"><span>Partial payments retain the remaining supplier balance.</span><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Recording...' : 'Record payment'}</button></div></form></div>;
}

function ExpenseEditor({ currency, onClose, onSave }: { currency: string; onClose: () => void; onSave: (input: { category: string; amount: number; note: string }) => boolean }) {
  const [category, setCategory] = useState('General');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); const numericAmount = Number(amount); if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError('Enter an expense amount greater than zero.'); return; } const ok = onSave({ category, amount: numericAmount, note: note.trim() }); if (!ok) setError('Review the expense details and try again.'); }
  return <div className="composer-backdrop" role="presentation"><form className="accounting-editor" role="dialog" aria-modal="true" aria-labelledby="expense-editor-title" onSubmit={submit}><div className="composer-heading"><div><p className="eyebrow">Operating cost</p><h2 id="expense-editor-title">Record expense</h2></div><button className="icon-button" type="button" aria-label="Close expense" title="Close expense" onClick={onClose}><X size={18} /></button></div><div className="composer-body"><div className="accounting-editor-note"><ReceiptText size={16} /><p>The expense will be timestamped and attributed to the signed-in user for audit purposes.</p></div><label className="form-field"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{EXPENSE_CATEGORIES.map((option) => <option key={option}>{option}</option>)}</select></label><label className="form-field"><span>Amount ({currency})</span><input autoFocus type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label><label className="form-field"><span>Business purpose</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What was this expense for?" /></label>{error ? <p className="accounting-form-error" role="alert">{error}</p> : null}</div><div className="composer-footer"><span>Expense records cannot be silently removed.</span><button className="primary-button" type="submit">Record expense</button></div></form></div>;
}

function AccountingEmpty({ icon: Icon, title, detail }: { icon: typeof Banknote; title: string; detail: string }) {
  return <div className="accounting-empty"><Icon size={23} /><strong>{title}</strong><span>{detail}</span></div>;
}

function formatPaymentMethod(method: PaymentChannel) {
  if (method === 'mobileMoney') return 'Mobile Money';
  if (method === 'creditCard') return 'Credit Card';
  return method.charAt(0).toUpperCase() + method.slice(1);
}
