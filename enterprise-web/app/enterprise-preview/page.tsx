import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Building2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  ShoppingCart,
  Users,
  Warehouse,
} from 'lucide-react';

import { MagentoStatus } from '@/components/magento-status';

import './preview.css';

const navigation = [
  { label: 'Overview', icon: LayoutDashboard, active: true },
  { label: 'Sales', icon: ShoppingCart },
  { label: 'Inventory', icon: Boxes },
  { label: 'Procurement', icon: ClipboardList },
  { label: 'Accounting', icon: CircleDollarSign },
  { label: 'Customers', icon: Users },
  { label: 'Reports', icon: BarChart3 },
];

const metrics = [
  { label: 'Net sales', value: 'GH₵ 284,600', change: '+12.4%', trend: 'up', note: 'vs previous period' },
  { label: 'Gross margin', value: '31.8%', change: '+2.1%', trend: 'up', note: 'across all branches' },
  { label: 'Stock value', value: 'GH₵ 918,240', change: '-3.2%', trend: 'down', note: 'movement this month' },
  { label: 'Receivables', value: 'GH₵ 72,480', change: '18 due', trend: 'neutral', note: 'invoices outstanding' },
];

const branches = [
  { name: 'Accra Central', sales: 'GH₵ 116,820', orders: 342, stock: 'Healthy', health: 'good' },
  { name: 'East Legon', sales: 'GH₵ 89,440', orders: 258, stock: 'Healthy', health: 'good' },
  { name: 'Kumasi', sales: 'GH₵ 51,930', orders: 166, stock: 'Review', health: 'warn' },
  { name: 'Takoradi', sales: 'GH₵ 26,410', orders: 91, stock: 'Low', health: 'risk' },
];

export default function DashboardPage() {
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">BP</div>
          <div><strong>BizPilot</strong><span>Enterprise</span></div>
        </div>
        <div className="workspace-switcher">
          <Building2 size={17} />
          <div><span>Workspace</span><strong>Demo Holdings Ltd.</strong></div>
          <ChevronDown size={15} />
        </div>
        <nav aria-label="Main navigation">
          <p className="nav-label">Operations</p>
          {navigation.map(({ label, icon: Icon, active }) => (
            <a href="#" className={active ? 'nav-item nav-item--active' : 'nav-item'} key={label}>
              <Icon size={18} /><span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <a href="#" className="nav-item"><Settings size={18} /><span>Settings</span></a>
          <div className="user-block"><div className="avatar">KA</div><div><strong>Kwame Adu</strong><span>System administrator</span></div></div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="icon-button mobile-only" type="button" title="Open navigation"><Menu size={19} /></button>
          <div className="search-box"><Search size={17} /><input aria-label="Search" placeholder="Search orders, products, customers" /></div>
          <div className="topbar-actions">
            <button className="period-button" type="button">This month <ChevronDown size={15} /></button>
            <button className="primary-button" type="button"><FileText size={17} /> New report</button>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div><p className="eyebrow">Wednesday, 15 July</p><h1>Operating overview</h1><p>Consolidated performance across your business network.</p></div>
            <div className="sync-note"><span></span> Data refreshed 4 minutes ago</div>
          </section>

          <section className="metric-grid" aria-label="Business metrics">
            {metrics.map((metric) => {
              const TrendIcon = metric.trend === 'down' ? ArrowDownRight : ArrowUpRight;
              return (
                <article className="metric" key={metric.label}>
                  <span>{metric.label}</span><strong>{metric.value}</strong>
                  <div className={`metric-change metric-change--${metric.trend}`}>
                    {metric.trend !== 'neutral' && <TrendIcon size={15} />}<b>{metric.change}</b><span>{metric.note}</span>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="dashboard-grid">
            <div className="performance-panel">
              <div className="panel-heading"><div><p className="eyebrow">Branch network</p><h2>Operating performance</h2></div><button className="text-button" type="button">View full report</button></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Branch</th><th>Net sales</th><th>Orders</th><th>Inventory</th></tr></thead>
                  <tbody>{branches.map((branch) => <tr key={branch.name}><td><Warehouse size={16} />{branch.name}</td><td>{branch.sales}</td><td>{branch.orders}</td><td><span className={`health health--${branch.health}`}>{branch.stock}</span></td></tr>)}</tbody>
                </table>
              </div>
            </div>
            <MagentoStatus />
          </section>
        </div>
      </main>
    </div>
  );
}
