'use client';

import {
  BarChart3,
  Boxes,
  Building2,
  Calculator,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';

import { useAuth } from '../../src/context/AuthContext';
import { useBusiness } from '../../src/context/BusinessContext';
import { EnterpriseNotificationCentre } from './enterprise-notification-centre';

type NavigationItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  visible: boolean;
};

export function EnterpriseShell({ active, children }: { active: string; children: ReactNode }) {
  const router = useRouter();
  const { signOut } = useAuth();
  const { state, currentUser, backendStatus, hasPermission } = useBusiness();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navigation: NavigationItem[] = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, visible: true },
    { label: 'Sales', href: '/sales', icon: ShoppingCart, visible: hasPermission('sales.view') },
    { label: 'Quotations', href: '/quotations', icon: FileText, visible: hasPermission('quotations.view') },
    { label: 'POS', href: '/pos', icon: Calculator, visible: hasPermission('sales.create') },
    { label: 'Inventory', href: '/inventory', icon: Boxes, visible: hasPermission('inventory.view') },
    {
      label: 'Procurement',
      href: '/procurement',
      icon: ClipboardList,
      visible: hasPermission('purchases.view') || hasPermission('procurement.view') || hasPermission('payables.manage'),
    },
    { label: 'Vendors', href: '/vendors', icon: Truck, visible: hasPermission('vendors.view') || hasPermission('vendors.manage') },
    { label: 'Accounting', href: '/accounting', icon: CircleDollarSign, visible: hasPermission('accounting.access') },
    { label: 'Customers', href: '/customers', icon: Users, visible: hasPermission('customers.view') },
    { label: 'Reports', href: '/reports', icon: BarChart3, visible: hasPermission('reports.dashboard.view') || hasPermission('reports.financial.view') || hasPermission('reports.sales.view') || hasPermission('reports.inventory.view') || hasPermission('invoices.print') || hasPermission('invoices.export_pdf') || hasPermission('quotations.print') || hasPermission('quotations.export_pdf') },
  ];

  async function handleSignOut() {
    await signOut();
    router.replace('/auth');
  }

  return (
    <div className="app-frame enterprise-app">
      {mobileNavOpen ? <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} /> : null}
      <aside className={mobileNavOpen ? 'sidebar sidebar--open' : 'sidebar'}>
        <div className="brand-lockup">
          <div className="brand-mark">BP</div>
          <div><strong>BisaPilot</strong><span>Enterprise</span></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" title="Close navigation"><X size={18} /></button>
        </div>
        <div className="workspace-switcher">
          <Building2 size={17} />
          <div><span>Workspace</span><strong>{state.businessProfile.businessName || 'Business workspace'}</strong></div>
          <ChevronDown size={15} />
        </div>
        <nav aria-label="Main navigation">
          <p className="nav-label">Operations</p>
          {navigation.filter((item) => item.visible).map(({ label, href, icon: Icon }) => (
            <Link href={href} className={label === active ? 'nav-item nav-item--active' : 'nav-item'} key={label} onClick={() => setMobileNavOpen(false)}>
              <Icon size={18} /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          {hasPermission('business.view') ? (
            <Link href="/settings" className={active === 'Settings' ? 'nav-item nav-item--active' : 'nav-item'}>
              <Settings size={18} /><span>Settings</span>
            </Link>
          ) : null}
          <button className="nav-item sign-out-button" onClick={() => void handleSignOut()}><LogOut size={18} /><span>Sign out</span></button>
          <div className="user-block">
            <div className="avatar">{currentUser.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div>
            <div><strong>{currentUser.name}</strong><span>{currentUser.roleLabel || currentUser.role}</span></div>
          </div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="icon-button mobile-only" type="button" aria-label="Open navigation" title="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={19} /></button>
          <div className="topbar-context"><span>{backendStatus.label}</span><strong>{state.locations.filter((location) => location.isActive).length} active locations</strong></div>
          <div className="topbar-actions">
            <span className={`backend-indicator backend-indicator--${backendStatus.source}`}><i />{backendStatus.source === 'supabase' ? 'Cloud connected' : 'Local workspace'}</span>
            <EnterpriseNotificationCentre />
            {hasPermission('sales.create') ? <Link className="primary-button" href="/pos"><FileText size={17} /> New sale</Link> : null}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
