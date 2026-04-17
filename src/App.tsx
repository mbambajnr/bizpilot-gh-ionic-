import { useEffect } from 'react';
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

function LoadingScreen({ message }: { message: string }) {
  return (
    <IonPage>
      <IonContent fullscreen={true}>
        <div className="auth-loading" data-testid="loading-screen">
          <IonSpinner name="crescent" />
          <p>{message}</p>
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

function AppShell() {
  const { hasPermission } = useBusiness();

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/dashboard">
          <DashboardPage />
        </Route>
        <Route exact path="/sales">
          {hasPermission('sales.view') ? <SalesPage /> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/sales/:saleId">
          {hasPermission('sales.view') ? <InvoiceDetailPage /> : <UnauthorizedPage />}
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
          <SettingsPage />
        </Route>
        <Route exact path="/">
          <Redirect to="/dashboard" />
        </Route>
      </IonRouterOutlet>
      <IonTabBar slot="bottom">
        <IonTabButton tab="dashboard" href="/dashboard" data-testid="tab-dashboard">
          <IonIcon aria-hidden="true" icon={home} />
          <IonLabel>Dashboard</IonLabel>
        </IonTabButton>
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
        <IonTabButton tab="settings" href="/settings" data-testid="tab-settings">
          <IonIcon aria-hidden="true" icon={settings} />
          <IonLabel>Settings</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}

function AuthGate() {
  const { session, loading, businessBootstrapStatus } = useAuth();

  if (loading) {
    return <LoadingScreen message="Checking owner session..." />;
  }

  if (!session) {
    return <AuthPage />;
  }

  if (businessBootstrapStatus.loading) {
    return <LoadingScreen message={businessBootstrapStatus.message} />;
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
