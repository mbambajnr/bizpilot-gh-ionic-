'use client';

import {
  ArrowRight,
  CircleDollarSign,
  ClipboardList,
  FileText,
  PackageSearch,
  Send,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import type { AppRole } from '../../src/authz/types';
import { useBusiness } from '../../src/context/BusinessContext';
import type { ActivityLogEntry } from '../../src/data/seedBusiness';
import { selectRecentSales } from '../../src/selectors/businessSelectors';
import { formatCurrency, formatRelativeDate } from '../../src/utils/format';
import { answerAssistant, availableAssistantIntents, buildAssistantRoutingPrompt, matchAssistantIntent, resolveRoutedIntent, type AssistantAnswer } from '../../src/utils/assistant';
import { aiComplete, fetchAiStatus, type AiStatus } from '../../src/lib/aiClient';
import { buildRoleDashboardModel, type DashboardIconKey, type DashboardTone } from '../lib/role-dashboard';
import { EnterpriseApp } from './enterprise-app';
import { EnterpriseShell } from './enterprise-shell';
import { MagentoStatus } from './magento-status';

const QUEUE_ICONS: Record<DashboardIconKey, typeof Warehouse> = {
  access: ShieldCheck,
  accounting: CircleDollarSign,
  customers: Users,
  inventory: PackageSearch,
  procurement: ClipboardList,
  quotations: FileText,
  sales: ShoppingCart,
  transfers: Truck,
};

export function EnterpriseDashboard() {
  return <EnterpriseApp><EnterpriseDashboardView /></EnterpriseApp>;
}

function EnterpriseDashboardView() {
  const { state, currentUser, backendStatus, hasPermission } = useBusiness();
  const model = useMemo(() => buildRoleDashboardModel({ state, user: currentUser, hasPermission }), [currentUser, hasPermission, state]);
  const recentSales = useMemo(() => selectRecentSales(state).slice(0, 6), [state]);
  const recentActivity = useMemo(() => selectRoleActivity(state.activityLogEntries, currentUser.role).slice(0, 6), [currentUser.role, state.activityLogEntries]);
  const currency = state.businessProfile.currency;
  const attentionCount = model.queues.reduce((total, queue) => total + (queue.tone === 'warn' || queue.tone === 'risk' ? queue.value : 0), 0);

  // Only surface the commerce widget when an external commerce platform is
  // actually connected. Otherwise a tenant that never chose Magento would see a
  // Magento card telling them to configure Magento. Role permission alone is not
  // enough — connection is the gate.
  const [commerceConnected, setCommerceConnected] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/bizpilot/magento/health', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => { if (!cancelled) setCommerceConnected(Boolean(payload?.ok && payload.integration?.configured)); })
      .catch(() => { if (!cancelled) setCommerceConnected(false); });
    return () => { cancelled = true; };
  }, []);
  const showCommerce = model.showCommerce && commerceConnected;

  return <EnterpriseShell active="Overview">
    <div className="page-content role-dashboard-page">
      <section className="page-heading role-dashboard-heading">
        <div>
          <p className="eyebrow">{model.eyebrow} · {new Intl.DateTimeFormat('en-GH', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p>
          <h1>{model.title}</h1>
          <p>{model.description}</p>
        </div>
        <div className="role-dashboard-heading-actions">
          <div className="sync-note"><span />{backendStatus.detail}</div>
          {model.primaryAction ? <Link className="primary-button" href={model.primaryAction.href}>{model.primaryAction.label}<ArrowRight size={14} /></Link> : null}
        </div>
      </section>

      <section className={`metric-grid role-metric-grid${model.metrics.length > 4 ? ' metric-grid--wide' : ''}`} aria-label={`${currentUser.roleLabel || currentUser.role} metrics`}>
        {model.metrics.map((metric) => <Metric {...metric} key={metric.label} />)}
      </section>

      <section className="role-focus-strip" aria-label={model.focusLabel}>
        <div className="role-focus-intro"><span>{attentionCount}</span><div><p className="eyebrow">{model.focusLabel}</p><strong>{attentionCount ? 'Items need attention' : 'No urgent exceptions'}</strong></div></div>
        {model.queues.slice(0, 3).map((queue) => {
          const Icon = QUEUE_ICONS[queue.icon];
          return <Link href={queue.href} key={queue.label}><i className={`role-focus-icon role-focus-icon--${queue.tone}`}><Icon size={15} /></i><span><strong>{queue.label}</strong><small>{queue.detail}</small></span><b>{queue.value}</b><ArrowRight size={13} /></Link>;
        })}
      </section>

      <RoleAssistant />

      <section className={showCommerce ? 'dashboard-grid' : 'dashboard-grid dashboard-grid--balanced'}>
        <div className="performance-panel role-queue-panel">
          <div className="panel-heading"><div><p className="eyebrow">Role worklist</p><h2>Priority queues</h2></div><span>{model.queues.length} monitored workflows</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Workflow</th><th>Items</th><th>Status</th><th /></tr></thead>
              <tbody>{model.queues.map((queue) => {
                const Icon = QUEUE_ICONS[queue.icon];
                return <tr key={queue.label}><td><Icon size={16} /><span><strong>{queue.label}</strong><small>{queue.detail}</small></span></td><td>{queue.value}</td><td><span className={`health health--${queue.tone === 'neutral' ? 'good' : queue.tone}`}>{queue.status}</span></td><td><Link className="row-link" href={queue.href}>Open</Link></td></tr>;
              })}</tbody>
            </table>
            {!model.queues.length ? <div className="role-dashboard-empty"><ShieldCheck size={20} /><strong>No assigned queues</strong><span>This profile has dashboard access but no operational modules assigned.</span></div> : null}
          </div>
        </div>
        {showCommerce ? <MagentoStatus /> : <RoleBrief role={currentUser.role} queueCount={model.queues.length} attentionCount={attentionCount} locationCount={state.locations.filter((location) => location.isActive).length} />}
      </section>

      {model.recentMode === 'sales' ? <section className="recent-panel">
        <div className="panel-heading"><div><p className="eyebrow">Commercial activity</p><h2>Recent sales</h2></div><Link className="text-button" href="/sales">View sales</Link></div>
        {recentSales.length ? <div className="recent-sales-list">{recentSales.map((sale) => {
          const customer = state.customers.find((entry) => entry.id === sale.customerId);
          return <Link href={`/sales/${sale.id}`} className="recent-sale" key={sale.id}><div><strong>{sale.invoiceNumber}</strong><span>{customer?.name || 'Walk-in customer'} · {formatRelativeDate(sale.createdAt)}</span></div><b>{formatCurrency(sale.totalAmount, currency)}</b></Link>;
        })}</div> : <p className="empty-copy">No sales have been recorded yet.</p>}
      </section> : <RecentActivity entries={recentActivity} />}
    </div>
  </EnterpriseShell>;
}

function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone: DashboardTone }) {
  const stateLabel = tone === 'good' ? 'Live' : tone === 'risk' ? 'Action' : tone === 'warn' ? 'Review' : 'Current';
  return <article className="metric"><span>{label}</span><strong>{value}</strong><div className={`metric-change metric-change--${tone}`}><b>{stateLabel}</b><span>{note}</span></div></article>;
}

function RoleAssistant() {
  const { state, hasPermission } = useBusiness();
  const [now] = useState(() => Date.now());
  const intents = useMemo(() => availableAssistantIntents(hasPermission), [hasPermission]);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [thinking, setThinking] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchAiStatus().then((status) => { if (!cancelled) setAiStatus(status); });
    return () => { cancelled = true; };
  }, []);

  if (!intents.length) return null;
  const aiOn = Boolean(aiStatus?.configured);

  function ask(intentId: string) {
    const result = answerAssistant(state, intentId, hasPermission, now);
    if (result.ok) { setAnswer(result.answer); setActiveId(intentId); setNotice(''); }
    else { setAnswer(null); setActiveId(null); setNotice(result.message); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    // The model only routes the free-text question to a permission-scoped intent; the deterministic
    // resolver still produces the answer. Fall back to the keyword matcher whenever AI is unavailable.
    if (aiOn) {
      setThinking(true);
      const { system, prompt } = buildAssistantRoutingPrompt(trimmed, intents);
      const reply = await aiComplete({ system, prompt });
      setThinking(false);
      const routed = resolveRoutedIntent(reply, intents);
      if (routed) { ask(routed.id); return; }
    }
    const intent = matchAssistantIntent(trimmed, hasPermission);
    if (intent) ask(intent.id);
    else { setAnswer(null); setActiveId(null); setNotice("I can't answer that one yet — try a suggested question below."); }
  }

  return <section className="assistant-panel">
    <div className="panel-heading"><div><p className="eyebrow assistant-eyebrow"><Sparkles size={13} /> Ask BisaPilot</p><h2>Your assistant</h2></div><span>{aiOn ? `${aiStatus?.model} · read-only` : 'Read-only · respects your role'}</span></div>
    <form className="assistant-ask" onSubmit={(event) => void submit(event)}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask about cash, receivables, stock, or expenses…" aria-label="Ask BisaPilot" /><button className="primary-button" type="submit" disabled={thinking}><Send size={14} /> {thinking ? 'Thinking…' : 'Ask'}</button></form>
    <div className="assistant-suggestions">{intents.map((intent) => <button key={intent.id} type="button" className={activeId === intent.id ? 'assistant-chip assistant-chip--active' : 'assistant-chip'} onClick={() => { setQuery(''); ask(intent.id); }}>{intent.question}</button>)}</div>
    {notice ? <p className="assistant-notice">{notice}</p> : null}
    {answer ? <div className="assistant-answer"><div className="assistant-answer-head"><strong>{answer.title}</strong><span>{answer.summary}</span></div>{answer.rows.length ? <ul className="assistant-answer-rows">{answer.rows.map((row, index) => <li key={index}><span>{row.label}</span><b>{row.value}</b>{row.detail ? <small>{row.detail}</small> : null}</li>)}</ul> : null}<p className="assistant-disclaimer">Generated from your live data. Advisory only — the assistant never makes changes.</p></div> : null}
  </section>;
}

function RoleBrief({ role, queueCount, attentionCount, locationCount }: { role: AppRole; queueCount: number; attentionCount: number; locationCount: number }) {
  return <aside className="role-brief-panel"><div className="panel-heading"><div><p className="eyebrow">Operating scope</p><h2>Role brief</h2></div><ShieldCheck size={18} /></div><div className="role-brief-score"><span>{attentionCount}</span><div><strong>{attentionCount ? 'Open attention items' : 'Queues are clear'}</strong><small>Calculated from workflows assigned to this profile.</small></div></div><dl><div><dt>Profile</dt><dd>{role}</dd></div><div><dt>Queues</dt><dd>{queueCount}</dd></div><div><dt>Locations</dt><dd>{locationCount}</dd></div></dl><p>Information on this dashboard follows the employee’s effective permissions, including custom grants and revocations.</p></aside>;
}

function RecentActivity({ entries }: { entries: ActivityLogEntry[] }) {
  return <section className="recent-panel role-activity-panel"><div className="panel-heading"><div><p className="eyebrow">Workflow history</p><h2>Recent activity</h2></div><span>{entries.length} relevant events</span></div>{entries.length ? <div className="role-activity-list">{entries.map((entry) => <article key={entry.id}><i className={`activity-dot activity-dot--${entry.status}`} /><span><strong>{entry.title}</strong><small>{entry.detail}</small></span><b>{entry.referenceNumber || formatRelativeDate(entry.createdAt)}</b><time>{formatRelativeDate(entry.createdAt)}</time></article>)}</div> : <div className="role-dashboard-empty"><ShieldCheck size={20} /><strong>No recent role activity</strong><span>Events from this role’s assigned workflows will appear here.</span></div>}</section>;
}

function selectRoleActivity(entries: ActivityLogEntry[], role: AppRole) {
  const prefixes: Record<AppRole, string[]> = {
    Admin: ['business_profile_'],
    GeneralManager: [''],
    SalesManager: ['quotation_', 'invoice_', 'receipt_', 'customer_', 'corrected_copy_'],
    Accountant: ['payable_', 'expense_', 'receipt_', 'invoice_'],
    WarehouseManager: ['purchase_received', 'purchase_partially_received', 'stock_', 'transfer_', 'restock_'],
    StoreManager: ['quotation_', 'invoice_', 'receipt_', 'customer_', 'transfer_received'],
    PurchaseManager: ['purchase_', 'vendor_'],
  };
  const allowed = prefixes[role];
  return [...entries].filter((entry) => allowed.some((prefix) => entry.actionType.startsWith(prefix))).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}
