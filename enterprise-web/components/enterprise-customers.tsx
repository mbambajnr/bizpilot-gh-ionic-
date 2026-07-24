'use client';

import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  UserX,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useMemo, useState } from 'react';

import { useBusiness } from '../../src/context/BusinessContext';
import type { Customer, CustomerType } from '../../src/data/seedBusiness';
import {
  selectCustomerBalance,
  selectCustomerLastPaymentLabel,
  selectCustomerLedgerEntries,
  selectCustomerStatement,
  selectLedgerEntryDisplay,
  selectSaleBalanceRemaining,
} from '../../src/selectors/businessSelectors';
import { formatCurrency, formatRelativeDate } from '../../src/utils/format';
import { EnterpriseApp } from './enterprise-app';
import { EnterpriseShell } from './enterprise-shell';

type CustomerView = 'directory' | 'receivables' | 'inactive';
type EditorState = { mode: 'create' } | { mode: 'edit'; customer: Customer };
type CustomerRecord = {
  customer: Customer;
  sales: ReturnType<typeof useBusiness>['state']['sales'];
  balance: number;
  lifetimeValue: number;
  lastSale: ReturnType<typeof useBusiness>['state']['sales'][number] | undefined;
};

function contactNumber(customer: Customer) {
  return customer.whatsapp?.trim() || customer.phone?.trim() || '';
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'CU';
}

export function EnterpriseCustomers() {
  return <EnterpriseApp><EnterpriseCustomersView /></EnterpriseApp>;
}

function EnterpriseCustomersView() {
  const { state, hasPermission, addCustomer, updateCustomer, updateCustomerStatus } = useBusiness();
  const [view, setView] = useState<CustomerView>('directory');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | CustomerType | 'unclassified'>('all');
  const [selectedId, setSelectedId] = useState(state.customers[0]?.id ?? '');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [statusTarget, setStatusTarget] = useState<Customer | null>(null);
  const [message, setMessage] = useState('');
  const currency = state.businessProfile.currency;
  const canCreate = hasPermission('customers.create');
  const canEdit = hasPermission('customers.edit');
  const canEmail = hasPermission('customers.email.send');
  const canViewLedger = hasPermission('customers.ledger.view');
  const canCreateInvoice = hasPermission('sales.create');

  const records = useMemo(() => state.customers.map((customer) => {
    const sales = state.sales.filter((sale) => sale.customerId === customer.id && sale.status === 'Completed');
    const balance = selectCustomerBalance(state, customer.id);
    const lifetimeValue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const lastSale = sales.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    return { customer, sales, balance, lifetimeValue, lastSale };
  }), [state]);

  const activeRecords = records.filter(({ customer }) => customer.status !== 'terminated');
  const receivableRecords = activeRecords.filter(({ balance }) => balance > 0);
  const totalReceivables = receivableRecords.reduce((sum, record) => sum + record.balance, 0);
  const totalRevenue = activeRecords.reduce((sum, record) => sum + record.lifetimeValue, 0);
  const filtered = records
    .filter(({ customer, balance }) => view === 'inactive' ? customer.status === 'terminated' : customer.status !== 'terminated' && (view !== 'receivables' || balance > 0))
    .filter(({ customer }) => typeFilter === 'all' || (typeFilter === 'unclassified' ? !customer.customerType : customer.customerType === typeFilter))
    .filter(({ customer }) => `${customer.name} ${customer.clientId} ${customer.email ?? ''} ${contactNumber(customer)}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((left, right) => view === 'receivables' ? right.balance - left.balance : left.customer.name.localeCompare(right.customer.name));
  const selected = filtered.find(({ customer }) => customer.id === selectedId) ?? filtered[0];

  function changeStatus(reason: string) {
    if (!statusTarget) return;
    const nextStatus = statusTarget.status === 'terminated' ? 'active' : 'terminated';
    const result = updateCustomerStatus({ customerId: statusTarget.id, status: nextStatus, terminationReason: nextStatus === 'terminated' ? reason : undefined });
    setMessage(result.ok ? `${statusTarget.name} is now ${nextStatus}.` : result.message);
    if (result.ok) setStatusTarget(null);
  }

  return <EnterpriseShell active="Customers"><div className="page-content customers-native-page">
    <section className="page-heading customers-heading">
      <div><p className="eyebrow">Customer operations</p><h1>Customer portfolio</h1><p>Manage relationships, receivables, account history, and commercial follow-up from one workspace.</p></div>
      {canCreate ? <button className="primary-button" type="button" onClick={() => setEditor({ mode: 'create' })}><Plus size={16} /> New customer</button> : null}
    </section>

    <section className="customer-metrics" aria-label="Customer portfolio summary">
      <CustomerMetric label="Active customers" value={String(activeRecords.length)} note={`${activeRecords.filter(({ customer }) => customer.customerType === 'B2B').length} business accounts`} icon={Users} />
      <CustomerMetric label="Portfolio revenue" value={formatCurrency(totalRevenue, currency)} note="Completed invoice value" icon={CircleDollarSign} />
      <CustomerMetric label="Receivables" value={formatCurrency(totalReceivables, currency)} note={`${receivableRecords.length} accounts need follow-up`} icon={FileText} tone={totalReceivables ? 'warn' : 'good'} />
      <CustomerMetric label="Clean accounts" value={String(activeRecords.length - receivableRecords.length)} note="No balance outstanding" icon={ShieldCheck} tone="good" />
    </section>

    <nav className="customer-tabs" aria-label="Customer views">
      {([['directory', `Directory (${activeRecords.length})`], ['receivables', `Receivables (${receivableRecords.length})`], ['inactive', `Inactive (${records.length - activeRecords.length})`]] as const).map(([value, label]) => <button type="button" className={view === value ? 'customer-tab customer-tab--active' : 'customer-tab'} onClick={() => setView(value)} key={value}>{label}</button>)}
    </nav>
    {message ? <div className="settings-message" role="status">{message}</div> : null}

    <section className="customer-workspace">
      <div className="customer-list-panel">
        <div className="customer-toolbar">
          <label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, customer ID, phone, or email" /></label>
          {state.businessProfile.customerClassificationEnabled ? <select aria-label="Customer classification" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}><option value="all">All types</option><option value="B2B">B2B</option><option value="B2C">B2C</option><option value="unclassified">Unclassified</option></select> : null}
          <span>{filtered.length} records</span>
        </div>
        <div className="customer-table-wrap"><table className="customer-table"><thead><tr><th>Customer</th><th>Type</th><th>Last activity</th><th>Lifetime value</th><th>Account</th><th /></tr></thead><tbody>
          {filtered.map((record) => <tr className={selected?.customer.id === record.customer.id ? 'customer-row customer-row--selected' : 'customer-row'} onClick={() => setSelectedId(record.customer.id)} key={record.customer.id}>
            <td><i className="customer-avatar">{initials(record.customer.name)}</i><div><strong>{record.customer.name}</strong><span>{record.customer.clientId} · {record.customer.email || contactNumber(record.customer) || 'Contact missing'}</span></div></td>
            <td><span className="customer-type">{record.customer.customerType ?? 'Unclassified'}</span></td>
            <td>{record.lastSale ? formatRelativeDate(record.lastSale.createdAt) : 'No invoices'}</td>
            <td><strong>{formatCurrency(record.lifetimeValue, currency)}</strong></td>
            <td><span className={`customer-account-status customer-account-status--${record.customer.status === 'terminated' ? 'inactive' : record.balance > 0 ? 'due' : 'clear'}`}>{record.customer.status === 'terminated' ? 'Inactive' : record.balance > 0 ? `${formatCurrency(record.balance, currency)} due` : 'Clear'}</span></td>
            <td><ChevronRight size={15} /></td>
          </tr>)}
        </tbody></table>{!filtered.length ? <CustomerEmpty view={view} canCreate={canCreate} onCreate={() => setEditor({ mode: 'create' })} /> : null}</div>
      </div>
      <CustomerInspector record={selected} state={state} currency={currency} canEdit={canEdit} canEmail={canEmail} canViewLedger={canViewLedger} canCreateInvoice={canCreateInvoice} onEdit={(customer) => setEditor({ mode: 'edit', customer })} onStatus={setStatusTarget} />
    </section>
  </div>
  {editor ? <CustomerEditor state={editor} classificationEnabled={state.businessProfile.customerClassificationEnabled} taxEnabled={state.businessProfile.taxEnabled} onClose={() => setEditor(null)} onSave={(input) => { const result = editor.mode === 'create' ? addCustomer(input) : updateCustomer({ ...input, customerId: editor.customer.id }); setMessage(result.ok ? `${input.name} saved.` : result.message); if (result.ok) setEditor(null); return result.ok; }} /> : null}
  {statusTarget ? <CustomerStatusDialog customer={statusTarget} onClose={() => setStatusTarget(null)} onConfirm={changeStatus} /> : null}
  </EnterpriseShell>;
}

function CustomerMetric({ label, value, note, icon: Icon, tone = 'neutral' }: { label: string; value: string; note: string; icon: typeof Users; tone?: 'neutral' | 'good' | 'warn' }) {
  return <article><div><Icon size={14} /><span>{label}</span></div><strong>{value}</strong><small className={`customer-metric-note customer-metric-note--${tone}`}>{note}</small></article>;
}

function CustomerInspector({ record, state, currency, canEdit, canEmail, canViewLedger, canCreateInvoice, onEdit, onStatus }: { record?: CustomerRecord; state: ReturnType<typeof useBusiness>['state']; currency: string; canEdit: boolean; canEmail: boolean; canViewLedger: boolean; canCreateInvoice: boolean; onEdit: (customer: Customer) => void; onStatus: (customer: Customer) => void }) {
  const [section, setSection] = useState<'activity' | 'statement'>('activity');
  if (!record) return <aside className="customer-inspector customer-inspector--empty"><UserRound size={24} /><strong>Select a customer</strong><span>Account, contact, invoice, and ledger details will appear here.</span></aside>;
  const { customer, sales, balance, lifetimeValue } = record;
  const ledger = selectCustomerLedgerEntries(state, customer.id);
  const statement = selectCustomerStatement(state, customer.id);
  const number = contactNumber(customer);
  const whatsappNumber = number.replace(/[^\d]/g, '');
  return <aside className="customer-inspector">
    <div className="customer-inspector-head"><i className="customer-avatar customer-avatar--large">{initials(customer.name)}</i><div><p className="eyebrow">{customer.clientId}</p><h2>{customer.name}</h2><span>{customer.customerType ?? 'Unclassified'} · {customer.channel || 'Direct'}</span></div><span className={`customer-account-status customer-account-status--${customer.status === 'terminated' ? 'inactive' : balance > 0 ? 'due' : 'clear'}`}>{customer.status === 'terminated' ? 'Inactive' : balance > 0 ? 'Balance due' : 'Account clear'}</span></div>
    <div className="customer-inspector-values"><div><span>Lifetime value</span><strong>{formatCurrency(lifetimeValue, currency)}</strong></div><div><span>Outstanding</span><strong className={balance > 0 ? 'customer-balance-due' : ''}>{formatCurrency(balance, currency)}</strong></div><div><span>Last payment</span><strong>{selectCustomerLastPaymentLabel(state, customer.id)}</strong></div></div>
    <div className="customer-contact-strip">
      <div><Phone size={13} /><span><small>Phone</small><strong>{number || 'Not provided'}</strong></span></div>
      <div><Mail size={13} /><span><small>Email</small><strong>{customer.email || 'Not provided'}</strong></span></div>
    </div>
    <div className="customer-quick-actions">
      {customer.status !== 'terminated' && canCreateInvoice ? <Link className="primary-button" href={`/sales?action=new&customer=${encodeURIComponent(customer.id)}`}><Plus size={14} /> New invoice</Link> : null}
      {canEmail && customer.email ? <a className="icon-button" title={`Email ${customer.name}`} href={`mailto:${customer.email}`}><Mail size={15} /></a> : null}
      {number ? <a className="icon-button" title={`Message ${customer.name} on WhatsApp`} href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /></a> : null}
      {canEdit ? <button className="icon-button" type="button" aria-label={`Edit ${customer.name}`} title={`Edit ${customer.name}`} onClick={() => onEdit(customer)}><Pencil size={15} /></button> : null}
      {canEdit ? <button className="icon-button" type="button" aria-label={customer.status === 'terminated' ? 'Reactivate account' : 'Deactivate account'} title={customer.status === 'terminated' ? 'Reactivate account' : 'Deactivate account'} onClick={() => onStatus(customer)}>{customer.status === 'terminated' ? <CheckCircle2 size={15} /> : <UserX size={15} />}</button> : null}
    </div>
    <div className="customer-inspector-tabs"><button type="button" className={section === 'activity' ? 'is-active' : ''} onClick={() => setSection('activity')}>Invoices</button>{canViewLedger ? <button type="button" className={section === 'statement' ? 'is-active' : ''} onClick={() => setSection('statement')}>Statement</button> : null}</div>
    {section === 'activity' ? <div className="customer-invoice-history">{sales.slice(0, 6).map((sale) => { const due = selectSaleBalanceRemaining(sale); return <Link href={`/sales/${sale.id}`} key={sale.id}><FileText size={14} /><span><strong>{sale.invoiceNumber}</strong><small>{formatRelativeDate(sale.createdAt)} · {sale.paymentMethod}</small></span><span><b>{formatCurrency(sale.totalAmount, currency)}</b><small className={due ? 'customer-balance-due' : ''}>{due ? `${formatCurrency(due, currency)} due` : 'Paid'}</small></span></Link>;})}{!sales.length ? <p className="customer-inspector-empty">No invoices have been recorded for this customer.</p> : null}</div> : <div className="customer-statement">
      <dl><div><dt>Opening balance</dt><dd>{formatCurrency(statement.openingBalance, currency)}</dd></div><div><dt>Invoice charges</dt><dd>{formatCurrency(statement.invoiceCharges, currency)}</dd></div><div><dt>Payments received</dt><dd>{formatCurrency(statement.paymentsReceived, currency)}</dd></div><div><dt>Closing balance</dt><dd>{formatCurrency(statement.closingBalance, currency)}</dd></div></dl>
      <div className="customer-ledger-list">{ledger.slice(0, 6).map((entry) => { const display = selectLedgerEntryDisplay(entry); return <div key={entry.id}><i className={`customer-ledger-dot customer-ledger-dot--${display.tone}`} /><span><strong>{display.label}</strong><small>{entry.referenceNumber || entry.note} · {formatRelativeDate(entry.createdAt)}</small></span><b>{formatCurrency(Math.abs(entry.amountDelta), currency)}</b></div>;})}</div>
    </div>}
    {customer.taxExempt ? <div className="customer-tax-note"><ShieldCheck size={14} /><span><strong>Tax exempt</strong><small>{customer.taxExemptionReason || 'No exemption reason recorded'}</small></span></div> : null}
  </aside>;
}

type CustomerFormInput = { name: string; clientId?: string; phone?: string; whatsapp?: string; email?: string; channel: string; customerType?: CustomerType; taxExempt?: boolean; taxExemptionReason?: string; creditLimit?: number };

function CustomerEditor({ state, classificationEnabled, taxEnabled, onClose, onSave }: { state: EditorState; classificationEnabled: boolean; taxEnabled: boolean; onClose: () => void; onSave: (input: CustomerFormInput) => boolean }) {
  const customer = state.mode === 'edit' ? state.customer : undefined;
  const [name, setName] = useState(customer?.name ?? '');
  const [clientId, setClientId] = useState('');
  const [phone, setPhone] = useState(customer?.phone ?? customer?.whatsapp ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [customerType, setCustomerType] = useState<CustomerType | ''>(customer?.customerType ?? '');
  const [taxExempt, setTaxExempt] = useState(customer?.taxExempt ?? false);
  const [taxReason, setTaxReason] = useState(customer?.taxExemptionReason ?? '');
  const [creditLimit, setCreditLimit] = useState(customer?.creditLimit != null ? String(customer.creditLimit) : '');
  const [error, setError] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); if (!name.trim()) { setError('Customer name is required.'); return; } if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; } if (taxExempt && !taxReason.trim()) { setError('Record the tax exemption reason.'); return; } const ok = onSave({ name: name.trim(), clientId: state.mode === 'create' ? clientId.trim() || undefined : undefined, phone: phone.trim() || undefined, whatsapp: phone.trim() || undefined, email: email.trim() || undefined, channel: customer?.channel || 'Direct', customerType: customerType || undefined, taxExempt, taxExemptionReason: taxExempt ? taxReason.trim() : undefined, creditLimit: creditLimit.trim() ? Number(creditLimit) : undefined }); if (!ok) setError('Customer could not be saved. Review the information and try again.'); }
  return <div className="composer-backdrop"><form className="customer-editor" onSubmit={submit}><div className="composer-heading"><div><p className="eyebrow">{state.mode === 'create' ? 'New relationship' : customer?.clientId}</p><h2>{state.mode === 'create' ? 'Create customer account' : 'Edit customer account'}</h2></div><button className="icon-button" type="button" aria-label="Close customer editor" title="Close customer editor" onClick={onClose}><X size={18} /></button></div><div className="customer-editor-body">
    <section><div className="customer-form-section"><UserRound size={16} /><div><strong>Account identity</strong><span>Core information used across sales, statements, and receipts.</span></div></div><label className="form-field"><span>Customer or business name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Customer name" /></label>{state.mode === 'create' ? <label className="form-field"><span>Customer ID <small>Optional</small></span><input value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="Generated automatically when blank" /></label> : null}{classificationEnabled ? <label className="form-field"><span>Customer type</span><select value={customerType} onChange={(event) => setCustomerType(event.target.value as CustomerType | '')}><option value="">Unclassified</option><option value="B2B">B2B business account</option><option value="B2C">B2C individual account</option></select></label> : null}</section>
    <section><div className="customer-form-section"><Phone size={16} /><div><strong>Contact details</strong><span>Keep these visible without forcing users to scroll through unrelated fields.</span></div></div><label className="form-field"><span>Phone and WhatsApp</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+233 ..." /></label><label className="form-field"><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="accounts@customer.com" /></label><label className="form-field"><span>Credit limit <small>Optional</small></span><input type="number" min="0" step="1" value={creditLimit} onChange={(event) => setCreditLimit(event.target.value)} placeholder="Blank = pay-as-you-go, no credit limit" /></label></section>
    {taxEnabled ? <section className="customer-tax-control"><label><input type="checkbox" checked={taxExempt} onChange={(event) => setTaxExempt(event.target.checked)} /><span><strong>Tax-exempt account</strong><small>Apply this treatment to future customer documents.</small></span></label>{taxExempt ? <label className="form-field"><span>Exemption reason</span><textarea value={taxReason} onChange={(event) => setTaxReason(event.target.value)} placeholder="Certificate, legislation, or approval reference" /></label> : null}</section> : null}
    {error ? <div className="settings-message customer-editor-error" role="alert">{error}</div> : null}
  </div><div className="composer-footer"><span>Changes update the shared customer record used by Sales, POS, and Accounting.</span><button className="primary-button" type="submit">{state.mode === 'create' ? 'Create customer' : 'Save changes'} <ArrowRight size={15} /></button></div></form></div>;
}

function CustomerStatusDialog({ customer, onClose, onConfirm }: { customer: Customer; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  const deactivating = customer.status !== 'terminated';
  return <div className="dialog-backdrop"><div className="customer-status-dialog" role="dialog" aria-modal="true"><i>{deactivating ? <UserX size={21} /> : <CheckCircle2 size={21} />}</i><h2>{deactivating ? 'Deactivate customer account?' : 'Reactivate customer account?'}</h2><p>{deactivating ? 'New invoices will be blocked while historical sales and ledger records remain available.' : 'The customer will become available again in Sales, POS, and customer selection lists.'}</p>{deactivating ? <label className="form-field"><span>Reason</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required for the account history" /></label> : null}<div><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className={deactivating ? 'secondary-button danger-button' : 'primary-button'} type="button" disabled={deactivating && !reason.trim()} onClick={() => onConfirm(reason.trim())}>{deactivating ? 'Deactivate' : 'Reactivate'}</button></div></div></div>;
}

function CustomerEmpty({ view, canCreate, onCreate }: { view: CustomerView; canCreate: boolean; onCreate: () => void }) {
  return <div className="customer-empty"><Building2 size={23} /><strong>{view === 'receivables' ? 'No outstanding customer balances' : view === 'inactive' ? 'No inactive customer accounts' : 'No customers found'}</strong><span>{view === 'receivables' ? 'Accounts requiring collection follow-up will appear here.' : 'Adjust the filters or create a customer relationship.'}</span>{view === 'directory' && canCreate ? <button className="secondary-button" type="button" onClick={onCreate}><Plus size={14} /> New customer</button> : null}</div>;
}
