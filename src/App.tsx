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
import { cart, documentText, grid, home, people, settings } from 'ionicons/icons';

import { AuthProvider, useAuth } from './context/AuthContext';
import { BusinessProvider } from './context/BusinessContext';
import AuthPage from './pages/AuthPage';
import CustomersPage from './pages/CustomersPage';
import DashboardPage from './pages/DashboardPage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import InventoryPage from './pages/InventoryPage';
import QuotationsPage from './pages/QuotationsPage';
import SalesPage from './pages/SalesPage';
import SettingsPage from './pages/SettingsPage';

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
import '@ionic/react/css/palettes/dark.system.css';

import './theme/variables.css';
import './theme/app.css';

setupIonicReact({
  mode: 'ios',
});

function LoadingScreen({ message }: { message: string }) {
  return (
    <IonPage>
      <IonContent fullscreen={true}>
        <div className="auth-loading">
          <IonSpinner name="crescent" />
          <p>{message}</p>
        </div>
      </IonContent>
    </IonPage>
  );
}

function AppShell() {
  return (
    <BusinessProvider>
      <IonTabs>
        <IonRouterOutlet>
          <Route exact path="/dashboard">
            <DashboardPage />
          </Route>
          <Route exact path="/sales">
            <SalesPage />
          </Route>
          <Route exact path="/sales/:saleId">
            <InvoiceDetailPage />
          </Route>
          <Route exact path="/inventory">
            <InventoryPage />
          </Route>
          <Route exact path="/customers">
            <CustomersPage />
          </Route>
          <Route exact path="/quotations">
            <QuotationsPage />
          </Route>
          <Route exact path="/settings">
            <SettingsPage />
          </Route>
          <Route exact path="/">
            <Redirect to="/dashboard" />
          </Route>
        </IonRouterOutlet>
        <IonTabBar slot="bottom">
          <IonTabButton tab="dashboard" href="/dashboard">
            <IonIcon aria-hidden="true" icon={home} />
            <IonLabel>Dashboard</IonLabel>
          </IonTabButton>
          <IonTabButton tab="sales" href="/sales">
            <IonIcon aria-hidden="true" icon={cart} />
            <IonLabel>Sales</IonLabel>
          </IonTabButton>
          <IonTabButton tab="inventory" href="/inventory">
            <IonIcon aria-hidden="true" icon={grid} />
            <IonLabel>Inventory</IonLabel>
          </IonTabButton>
          <IonTabButton tab="customers" href="/customers">
            <IonIcon aria-hidden="true" icon={people} />
            <IonLabel>Customers</IonLabel>
          </IonTabButton>
          <IonTabButton tab="quotations" href="/quotations">
            <IonIcon aria-hidden="true" icon={documentText} />
            <IonLabel>Quotations</IonLabel>
          </IonTabButton>
          <IonTabButton tab="settings" href="/settings">
            <IonIcon aria-hidden="true" icon={settings} />
            <IonLabel>Settings</IonLabel>
          </IonTabButton>
        </IonTabBar>
      </IonTabs>
    </BusinessProvider>
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

  return <AppShell />;
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
