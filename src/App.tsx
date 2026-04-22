import { useEffect, useState } from 'react';
import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonContent,
  IonIcon,
  IonLabel,
  IonPage,
  IonRouterOutlet,
  IonSpinner,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { cart, documentText, grid, home, people, settings, wallet } from 'ionicons/icons';

import { AuthProvider, useAuth } from './context/AuthContext';
import { BusinessProvider, useBusiness } from './context/BusinessContext';
import AuthPage from './pages/AuthPage';
import CustomersPage from './pages/CustomersPage';
import DashboardPage from './pages/DashboardPage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import InventoryPage from './pages/InventoryPage';
import QuotationsPage from './pages/QuotationsPage';
import SalesPage from './pages/SalesPage';
import SettingsPage from './pages/SettingsPage';
import AccountingPage from './pages/AccountingPage';
import QuotationDetailPage from './pages/QuotationDetailPage';
import WaybillPage from './pages/WaybillPage';
import BatchExportPage from './pages/BatchExportPage';
import LandingPage from './pages/LandingPage';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import './theme/variables.css';
import './theme/app.css';

setupIonicReact({
  mode: 'ios',
});

function ThemeManager() {
  const { state } = useBusiness();
  const theme = state.themePreference;

  useEffect(() => {
    const applyTheme = (resolved: 'light' | 'dark') => {
      document.body.classList.remove('light', 'dark');
      document.body.classList.add(resolved);
      document.body.setAttribute('data-theme', resolved);
    };

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(prefersDark.matches ? 'dark' : 'light');

      const handler = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light');
      };
      prefersDark.addEventListener('change', handler);
      return () => prefersDark.removeEventListener('change', handler);
    } else {
      applyTheme(theme);
    }
  }, [theme]);

  return null;
}

function LoadingScreen({ message, onSkip }: { message: string, onSkip?: () => void }) {
  useEffect(() => {
    // Bootstrap/Checking session should be in light mode
    document.body.classList.remove('dark');
    document.body.classList.add('light');
    document.body.setAttribute('data-theme', 'light');
  }, []);

  return (
    <IonPage>
      <IonContent fullscreen={true}>
        <div className="auth-loading" data-testid="loading-screen">
          <div className="loading-content">
            <IonSpinner name="crescent" color="primary" />
            <p className="loading-message">{message}</p>
            {onSkip && (
              <div className="loading-actions">
                <button 
                  className="retry-button" 
                  onClick={onSkip}
                  style={{ 
                    marginTop: '24px', 
                    padding: '10px 16px', 
                    background: 'rgba(255,255,255,0.05)', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem'
                  }}
                >
                  Skip and use local data
                </button>
              </div>
            )}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}

function UnauthorizedPage() {
  return (
    <IonPage>
      <IonContent>
        <div className="auth-loading">
          <h2>Not Authorized</h2>
          <p>You do not have permission to access this section.</p>
        </div>
      </IonContent>
    </IonPage>
  );
}

function PublicShell() {
  return (
    <IonRouterOutlet>
      <Route exact path="/">
        <LandingPage />
      </Route>
      <Route exact path="/auth">
        <AuthPage />
      </Route>
      <Route>
        <Redirect to="/" />
      </Route>
    </IonRouterOutlet>
  );
}

function AppShell() {
  const { hasPermission } = useBusiness();
  const canViewDashboard = hasPermission('reports.dashboard.view');
  const canViewSettings = hasPermission('business.view');
  const canUseDocumentPack =
    hasPermission('invoices.print') ||
    hasPermission('invoices.export_pdf') ||
    hasPermission('quotations.print') ||
    hasPermission('quotations.export_pdf');
  const defaultRoute = canViewDashboard
    ? '/dashboard'
    : hasPermission('sales.view')
      ? '/sales'
      : hasPermission('inventory.view')
        ? '/inventory'
        : hasPermission('customers.view')
          ? '/customers'
          : hasPermission('quotations.view')
            ? '/quotations'
            : hasPermission('accounting.access')
              ? '/accounting'
              : canViewSettings
                ? '/settings'
                : '/dashboard';

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/dashboard">
          {canViewDashboard ? <DashboardPage /> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/sales">
          {hasPermission('sales.view') ? <SalesPage /> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/sales/:saleId">
          {hasPermission('invoices.view') ? <InvoiceDetailPage /> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/sales/:saleId/waybill">
          {hasPermission('invoices.view') ? <WaybillPage /> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/inventory">
          {hasPermission('inventory.view') ? <InventoryPage /> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/customers">
          {hasPermission('customers.view') ? <CustomersPage /> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/quotations">
          {hasPermission('quotations.view') ? <QuotationsPage /> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/quotations/:quotationId">
          {hasPermission('quotations.view') ? <QuotationDetailPage /> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/accounting">
          {hasPermission('accounting.access') ? <AccountingPage /> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/settings">
          {canViewSettings ? <SettingsPage /> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/export/batch">
          {canUseDocumentPack ? <BatchExportPage /> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/">
          <Redirect to={defaultRoute} />
        </Route>
      </IonRouterOutlet>
      <IonTabBar slot="bottom">
        {canViewDashboard && (
          <IonTabButton tab="dashboard" href="/dashboard" data-testid="tab-dashboard">
            <IonIcon aria-hidden="true" icon={home} />
            <IonLabel>Dashboard</IonLabel>
          </IonTabButton>
        )}
        {hasPermission('sales.view') && (
          <IonTabButton tab="sales" href="/sales" data-testid="tab-sales">
            <IonIcon aria-hidden="true" icon={cart} />
            <IonLabel>Sales</IonLabel>
          </IonTabButton>
        )}
        {hasPermission('inventory.view') && (
          <IonTabButton tab="inventory" href="/inventory" data-testid="tab-inventory">
            <IonIcon aria-hidden="true" icon={grid} />
            <IonLabel>Inventory</IonLabel>
          </IonTabButton>
        )}
        {hasPermission('customers.view') && (
          <IonTabButton tab="customers" href="/customers" data-testid="tab-customers">
            <IonIcon aria-hidden="true" icon={people} />
            <IonLabel>Customers</IonLabel>
          </IonTabButton>
        )}
        {hasPermission('quotations.view') && (
          <IonTabButton tab="quotations" href="/quotations" data-testid="tab-quotations">
            <IonIcon aria-hidden="true" icon={documentText} />
            <IonLabel>Quotations</IonLabel>
          </IonTabButton>
        )}
        {hasPermission('accounting.access') && (
          <IonTabButton tab="accounting" href="/accounting" data-testid="tab-accounting">
            <IonIcon aria-hidden="true" icon={wallet} />
            <IonLabel>Accounting</IonLabel>
          </IonTabButton>
        )}
        {canViewSettings && (
          <IonTabButton tab="settings" href="/settings" data-testid="tab-settings">
            <IonIcon aria-hidden="true" icon={settings} />
            <IonLabel>Settings</IonLabel>
          </IonTabButton>
        )}
      </IonTabBar>
    </IonTabs>
  );
}

function AuthGate() {
  const { session, loading, businessBootstrapStatus } = useAuth();
  const [forceReady, setForceReady] = useState(false);

  if (loading && !forceReady) {
    return <LoadingScreen message="Checking owner session..." onSkip={() => setForceReady(true)} />;
  }

  if (!session && !forceReady) {
    return <PublicShell />;
  }

  // NON-BLOCKING BOOTSTRAP:
  // If we have local state, enter the app immediately. Only block if this is a fresh install
  // with no local data yet.
  const hasLocalState = !!window.localStorage.getItem('bizpilot-gh-state-v1');
  const needsBlockingBootstrap = businessBootstrapStatus.loading && !hasLocalState;

  if (needsBlockingBootstrap && !forceReady) {
    return <LoadingScreen message={businessBootstrapStatus.message} onSkip={() => setForceReady(true)} />;
  }

  return (
    <BusinessProvider>
      <ThemeManager />
      <AppShell />
    </BusinessProvider>
  );
}

const App: React.FC = () => (
  <IonApp>
    <AuthProvider>
      <IonReactRouter>
        <AuthGate />
      </IonReactRouter>
    </AuthProvider>
  </IonApp>
);

export default App;
