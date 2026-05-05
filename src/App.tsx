import { type ReactNode, Suspense, lazy, useEffect } from 'react';
import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonButton,
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
import { cart, cubeOutline, documentText, grid, home, people, settings, wallet } from 'ionicons/icons';

import { AuthProvider, useAuth } from './context/AuthContext';
import { BusinessProvider, useBusiness } from './context/BusinessContext';
import { getBusinessLaunchState, isBusinessWorkspaceLive } from './utils/businessLogic';
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

const AuthPage = lazy(() => import('./pages/AuthPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const InvoiceDetailPage = lazy(() => import('./pages/InvoiceDetailPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const QuotationsPage = lazy(() => import('./pages/QuotationsPage'));
const SalesPage = lazy(() => import('./pages/SalesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AccountingPage = lazy(() => import('./pages/AccountingPage'));
const QuotationDetailPage = lazy(() => import('./pages/QuotationDetailPage'));
const WaybillPage = lazy(() => import('./pages/WaybillPage'));
const BatchExportPage = lazy(() => import('./pages/BatchExportPage'));
const VendorsPage = lazy(() => import('./pages/VendorsPage'));

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

function SetupRequiredPage({ canManageSetup, isReadyToLaunch }: { canManageSetup: boolean; isReadyToLaunch: boolean }) {
  return (
    <IonPage>
      <IonContent>
        <div className="auth-loading">
          <h2>{canManageSetup ? (isReadyToLaunch ? 'Launch Business Workspace' : 'Complete Business Setup') : 'Workspace Setup Pending'}</h2>
          <p>
            {canManageSetup
              ? isReadyToLaunch
                ? 'Your business setup is saved. Go to Settings and click Launch Business to officially open the workspace for your team.'
                : 'Finish the business setup in Settings before the workspace officially opens for your team.'
              : 'An admin needs to complete the business setup before this role can access dashboards and operational pages.'}
          </p>
          <p>
            Once setup is complete, each assigned role will only see the interfaces and dashboards they are authorized to use.
          </p>
          {canManageSetup ? (
            <IonButton routerLink="/settings" fill="solid">
              Open Settings
            </IonButton>
          ) : null}
        </div>
      </IonContent>
    </IonPage>
  );
}

function RouteLoadingScreen() {
  return (
    <IonPage>
      <IonContent fullscreen={true}>
        <div className="auth-loading" data-testid="route-loading-screen">
          <div className="loading-content">
            <IonSpinner name="crescent" color="primary" />
            <p className="loading-message">Loading section...</p>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoadingScreen />}>{children}</Suspense>;
}

function PublicShell() {
  return (
    <IonRouterOutlet>
      <Route exact path="/">
        <LandingPage />
      </Route>
      <Route exact path="/auth">
        <LazyRoute>
          <AuthPage />
        </LazyRoute>
      </Route>
      <Route>
        <Redirect to="/" />
      </Route>
    </IonRouterOutlet>
  );
}

function AppShell() {
  const { state, hasPermission } = useBusiness();
  const businessLaunchState = getBusinessLaunchState(state.businessProfile);
  const businessSetupComplete = isBusinessWorkspaceLive(state.businessProfile);
  const canViewDashboard = hasPermission('reports.dashboard.view');
  const canViewSettings = hasPermission('business.view');
  const canManageSetup = hasPermission('business.edit');
  const canUseDocumentPack =
    hasPermission('invoices.print') ||
    hasPermission('invoices.export_pdf') ||
    hasPermission('quotations.print') ||
    hasPermission('quotations.export_pdf');
  const defaultRoute = !businessSetupComplete
    ? canManageSetup
      ? '/settings'
      : '/dashboard'
    : canViewDashboard
            ? '/dashboard'
            : hasPermission('sales.view')
              ? '/sales'
              : hasPermission('inventory.view')
                ? '/inventory'
                : hasPermission('vendors.view') || hasPermission('vendors.manage')
                  ? '/vendors'
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
          {!businessSetupComplete ? <SetupRequiredPage canManageSetup={canManageSetup} isReadyToLaunch={businessLaunchState === 'readyToLaunch'} /> : canViewDashboard ? <LazyRoute><DashboardPage /></LazyRoute> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/sales">
          {!businessSetupComplete ? <SetupRequiredPage canManageSetup={canManageSetup} isReadyToLaunch={businessLaunchState === 'readyToLaunch'} /> : hasPermission('sales.view') ? <LazyRoute><SalesPage /></LazyRoute> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/sales/:saleId">
          {!businessSetupComplete ? <SetupRequiredPage canManageSetup={canManageSetup} isReadyToLaunch={businessLaunchState === 'readyToLaunch'} /> : hasPermission('invoices.view') ? <LazyRoute><InvoiceDetailPage /></LazyRoute> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/sales/:saleId/waybill">
          {!businessSetupComplete ? <SetupRequiredPage canManageSetup={canManageSetup} isReadyToLaunch={businessLaunchState === 'readyToLaunch'} /> : hasPermission('invoices.view') ? <LazyRoute><WaybillPage /></LazyRoute> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/inventory">
          {!businessSetupComplete ? <SetupRequiredPage canManageSetup={canManageSetup} isReadyToLaunch={businessLaunchState === 'readyToLaunch'} /> : hasPermission('inventory.view') ? <LazyRoute><InventoryPage /></LazyRoute> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/vendors">
          {!businessSetupComplete ? <SetupRequiredPage canManageSetup={canManageSetup} isReadyToLaunch={businessLaunchState === 'readyToLaunch'} /> : (hasPermission('vendors.view') || hasPermission('vendors.manage')) ? <LazyRoute><VendorsPage /></LazyRoute> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/customers">
          {!businessSetupComplete ? <SetupRequiredPage canManageSetup={canManageSetup} isReadyToLaunch={businessLaunchState === 'readyToLaunch'} /> : hasPermission('customers.view') ? <LazyRoute><CustomersPage /></LazyRoute> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/quotations">
          {!businessSetupComplete ? <SetupRequiredPage canManageSetup={canManageSetup} isReadyToLaunch={businessLaunchState === 'readyToLaunch'} /> : hasPermission('quotations.view') ? <LazyRoute><QuotationsPage /></LazyRoute> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/quotations/:quotationId">
          {!businessSetupComplete ? <SetupRequiredPage canManageSetup={canManageSetup} isReadyToLaunch={businessLaunchState === 'readyToLaunch'} /> : hasPermission('quotations.view') ? <LazyRoute><QuotationDetailPage /></LazyRoute> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/accounting">
          {!businessSetupComplete ? <SetupRequiredPage canManageSetup={canManageSetup} isReadyToLaunch={businessLaunchState === 'readyToLaunch'} /> : hasPermission('accounting.access') ? <LazyRoute><AccountingPage /></LazyRoute> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/settings">
          {canViewSettings ? (!businessSetupComplete && !canManageSetup ? <SetupRequiredPage canManageSetup={false} isReadyToLaunch={false} /> : <LazyRoute><SettingsPage /></LazyRoute>) : <UnauthorizedPage />}
        </Route>
        <Route exact path="/export/batch">
          {!businessSetupComplete ? <SetupRequiredPage canManageSetup={canManageSetup} isReadyToLaunch={businessLaunchState === 'readyToLaunch'} /> : canUseDocumentPack ? <LazyRoute><BatchExportPage /></LazyRoute> : <UnauthorizedPage />}
        </Route>
        <Route exact path="/">
          <Redirect to={defaultRoute} />
        </Route>
      </IonRouterOutlet>
      <IonTabBar slot="bottom">
        {businessSetupComplete && canViewDashboard && (
          <IonTabButton tab="dashboard" href="/dashboard" data-testid="tab-dashboard">
            <IonIcon aria-hidden="true" icon={home} />
            <IonLabel>Dashboard</IonLabel>
          </IonTabButton>
        )}
        {businessSetupComplete && hasPermission('sales.view') && (
          <IonTabButton tab="sales" href="/sales" data-testid="tab-sales">
            <IonIcon aria-hidden="true" icon={cart} />
            <IonLabel>Sales</IonLabel>
          </IonTabButton>
        )}
        {businessSetupComplete && hasPermission('inventory.view') && (
          <IonTabButton tab="inventory" href="/inventory" data-testid="tab-inventory">
            <IonIcon aria-hidden="true" icon={grid} />
            <IonLabel>Inventory</IonLabel>
          </IonTabButton>
        )}
        {businessSetupComplete && (hasPermission('vendors.view') || hasPermission('vendors.manage')) && (
          <IonTabButton tab="vendors" href="/vendors" data-testid="tab-vendors">
            <IonIcon aria-hidden="true" icon={cubeOutline} />
            <IonLabel>Vendors</IonLabel>
          </IonTabButton>
        )}
        {businessSetupComplete && hasPermission('customers.view') && (
          <IonTabButton tab="customers" href="/customers" data-testid="tab-customers">
            <IonIcon aria-hidden="true" icon={people} />
            <IonLabel>Customers</IonLabel>
          </IonTabButton>
        )}
        {businessSetupComplete && hasPermission('quotations.view') && (
          <IonTabButton tab="quotations" href="/quotations" data-testid="tab-quotations">
            <IonIcon aria-hidden="true" icon={documentText} />
            <IonLabel>Quotations</IonLabel>
          </IonTabButton>
        )}
        {businessSetupComplete && hasPermission('accounting.access') && (
          <IonTabButton tab="accounting" href="/accounting" data-testid="tab-accounting">
            <IonIcon aria-hidden="true" icon={wallet} />
            <IonLabel>Accounting</IonLabel>
          </IonTabButton>
        )}
        {(businessSetupComplete || canManageSetup) && canViewSettings && (
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

  if (loading) {
    return <LoadingScreen message="Checking owner session..." />;
  }

  if (!session) {
    return <PublicShell />;
  }

  // NON-BLOCKING BOOTSTRAP:
  // Persisted business data may exist locally, but identity still comes only from the
  // active authenticated session handled above.
  const hasLocalState = !!window.localStorage.getItem('bizpilot-gh-state-v1');
  const needsBlockingBootstrap = businessBootstrapStatus.loading && !hasLocalState;

  if (needsBlockingBootstrap) {
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
