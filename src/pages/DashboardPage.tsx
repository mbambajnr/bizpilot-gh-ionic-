import {
  IonBadge,
  IonContent,
  IonHeader,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonText,
  IonTitle,
  IonToolbar,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
} from '@ionic/react';
import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { 
  chevronDownCircleOutline, 
  cartOutline, 
  documentTextOutline 
} from 'ionicons/icons';
import { IonIcon } from '@ionic/react';

import SectionCard from '../components/SectionCard';
import RevenueChart from '../components/RevenueChart';
import StatCard from '../components/StatCard';
import { useBusiness } from '../context/BusinessContext';
import { formatCurrency, formatRelativeDate } from '../utils/format';
import {
  type RevenueTrendPoint,
  selectActivityFeed,
  selectDashboardMetrics,
  selectProductById,
  selectSaleBalanceRemaining,
} from '../selectors/businessSelectors';

type TrendPeriod = 'weekly' | 'monthly' | 'annual';

const DashboardPage: React.FC = () => {
  const history = useHistory();
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('weekly');
  const { state, priorityQuestions, backendStatus } = useBusiness();
  const metrics = selectDashboardMetrics(state);
  const trendPoints: RevenueTrendPoint[] =
    trendPeriod === 'annual'
      ? metrics.annualRevenueTrend
      : trendPeriod === 'monthly'
        ? metrics.monthlyRevenueTrend
        : metrics.weeklyRevenueTrend;
  const trendTotal = trendPoints.reduce((sum, point) => sum + point.value, 0);
  const averageTrendValue = trendPoints.length
    ? trendTotal / trendPoints.length
    : 0;
  const bestTrendPoint = trendPoints.reduce(
    (current, point) => (point.value > current.value ? point : current),
    trendPoints[0]
  );
  const lastActivity = selectActivityFeed(state)[0];
  const currency = state.businessProfile.currency;

  const handleRefresh = (event: CustomEvent) => {
    setTimeout(() => {
      event.detail.complete();
    }, 1500);
  };

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>{state.businessProfile.businessName}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent 
            pullingIcon={chevronDownCircleOutline}
            refreshingSpinner="circles"
          />
        </IonRefresher>
        <div className="page-shell" data-testid="dashboard-page">
          <section className="hero-card glass-surface">
            <div className="analytics-headline">
              <div>
                <p className="eyebrow">Business overview</p>
                <h1>Pulse of your operations.</h1>
                <p className="hero-copy">
                  Real-time metrics calculated from your secure local-first transaction history.
                </p>
              </div>
              <div className="status-pulse-wrap">
                <div className="pulse-dot"></div>
                <span>Active</span>
              </div>
            </div>
            
            <div className="sync-line">
              <IonBadge color="success" mode="ios">Local Secured</IonBadge>
              {backendStatus.loading ? (
                <IonBadge color="primary" mode="ios" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <IonSpinner name="dots" style={{ width: '14px', height: '14px' }} color="light" />
                  Syncing
                </IonBadge>
              ) : backendStatus.source === 'supabase' && (
                <IonBadge color="secondary" mode="ios">Cloud Active</IonBadge>
              )}
              <IonText color="medium">
                Last activity {lastActivity ? formatRelativeDate(lastActivity.createdAt) : 'Ready'}
              </IonText>
            </div>
          </section>

          <section className="stats-grid">
            <StatCard 
              label="Sales today" 
              value={formatCurrency(metrics.salesToday, currency)} 
              helper={(count => `${count} ${count === 1 ? 'sale' : 'sales'}`)(metrics.activeSales.filter((sale) => new Date(sale.createdAt).toDateString() === new Date().toDateString()).length)}
              className="float-effect"
              onClick={() => history.push('/sales')}
            />
            <StatCard 
              label="Vault (Cash)" 
              value={formatCurrency(metrics.cashInHand, currency)} 
              helper="Today's floor" 
              className="float-effect"
              onClick={() => history.push('/accounting')}
            />
            <StatCard 
              label="MoMo Bank" 
              value={formatCurrency(metrics.mobileMoneyReceived, currency)} 
              helper="Digital total" 
              className="float-effect"
              onClick={() => history.push('/accounting')}
            />
            <StatCard
              label="To Collect"
              value={formatCurrency(metrics.receivables, currency)}
              helper={metrics.customersOwingCount > 0 ? `${metrics.customersOwingCount} clients owing` : 'Clear balance'}
              className="float-effect"
              onClick={() => history.push('/customers')}
            />
          </section>

          <SectionCard
            title="Daily reconciliation"
            subtitle="A clear breakdown of today's operational performance and cash collection status."
          >
            <div className="list-block">
              <div className="list-row">
                <div>
                  <strong>Total sales volume</strong>
                  <p>Invoiced value today</p>
                </div>
                <div className="right-meta">
                  <strong>{formatCurrency(metrics.salesToday, currency)}</strong>
                </div>
              </div>
              <div className="list-row">
                <div>
                  <strong>Payments collected</strong>
                  <p>Total Cash + MoMo received</p>
                </div>
                <div className="right-meta">
                  <strong className="success-text">+{formatCurrency(metrics.cashInHand + metrics.mobileMoneyReceived, currency)}</strong>
                </div>
              </div>
              <div className="list-row">
                <div>
                  <strong>Added to receivables</strong>
                  <p>Outstanding from today's sales</p>
                </div>
                <div className="right-meta">
                  <strong className="danger-text">{formatCurrency(Math.max(0, metrics.salesToday - (metrics.cashInHand + metrics.mobileMoneyReceived)), currency)}</strong>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Attention needed"
            subtitle="A quick view of unpaid balances, stock pressure, and pending requests needing follow-up."
          >
            <div className={`stats-row ${metrics.customersOwingCount > 0 ? 'warning-bg' : ''}`} style={{ padding: '16px', borderRadius: '12px', background: metrics.customersOwingCount > 0 ? 'rgba(255, 196, 0, 0.05)' : 'rgba(0,0,0,0.03)' }}>
              <div>
                <p className="muted-label">Customers owing</p>
                <h3 className={metrics.customersOwingCount > 0 ? 'warning-text' : ''}>{metrics.customersOwingCount}</h3>
              </div>
            </div>
            {state.restockRequests && state.restockRequests.filter(r => r.status === 'Pending').length > 0 && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <p className="muted-label">Pending restock requests</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 className="warning-text">{state.restockRequests.filter(r => r.status === 'Pending').length}</h3>
                  <p className="muted-label">awaiting review</p>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Weekly sales"
            subtitle="A clean seven-day sales view built for quick comparisons and daily decision-making."
          >
            <IonSegment value={trendPeriod} onIonChange={(event) => setTrendPeriod(event.detail.value as TrendPeriod)}>
              <IonSegmentButton value="weekly">Weekly</IonSegmentButton>
              <IonSegmentButton value="monthly">Monthly</IonSegmentButton>
              <IonSegmentButton value="annual">Annual</IonSegmentButton>
            </IonSegment>
            <div className="revenue-summary-row">
              <div className="revenue-summary-card">
                <p className="muted-label">
                  {trendPeriod === 'weekly' ? 'Total sales this week' : trendPeriod === 'monthly' ? 'Total sales this month' : 'Total sales this year'}
                </p>
                <h3>{formatCurrency(trendTotal, currency)}</h3>
              </div>
              <div className="revenue-summary-card">
                <p className="muted-label">
                  {trendPeriod === 'annual' ? 'Best month' : trendPeriod === 'monthly' ? 'Best week' : 'Best day'}
                </p>
                <h3>{bestTrendPoint ? `${bestTrendPoint.label} · ${formatCurrency(bestTrendPoint.value, currency)}` : formatCurrency(0, currency)}</h3>
              </div>
              <div className="revenue-summary-card">
                <p className="muted-label">
                  {trendPeriod === 'annual' ? 'Average per month' : trendPeriod === 'monthly' ? 'Average per week' : 'Average per day'}
                </p>
                <h3>{formatCurrency(averageTrendValue, currency)}</h3>
              </div>
            </div>
            <RevenueChart points={trendPoints} currency={currency} />
          </SectionCard>

          <SectionCard
            title="Owner priorities"
            subtitle="The working MVP is still centered on the questions African SMEs ask every day."
          >
            <div className="bullet-list">
              {priorityQuestions.map((question) => (
                <div className="bullet-row" key={question}>
                  <span className="dot" />
                  <p>{question}</p>
                </div>
              ))}
            </div>
          </SectionCard>


          <SectionCard
            title="Recent activity"
            subtitle="The newest transactions and workflow events appear here immediately."
          >
            <div className="list-block">
              {metrics.activeSales.slice(0, 5).map((sale) => {
                const customer = state.customers.find((item) => item.id === sale.customerId);
                const product = selectProductById(state, sale.productId);
                const outstanding = selectSaleBalanceRemaining(sale);

                return (
                  <div className="list-row" key={sale.id}>
                    <div>
                      <strong>
                    {(customer?.name ?? 'A customer')} bought {(product?.name ?? 'an item')}
                      </strong>
                      <p>
                        {sale.quantity} units • {sale.paymentMethod} • {formatRelativeDate(sale.createdAt)}
                      </p>
                      <p className="sale-meta">
                        {outstanding > 0
                          ? `Paid ${formatCurrency(sale.paidAmount, currency)} so far • ${formatCurrency(outstanding, currency)} still outstanding`
                          : `Paid in full • ${formatCurrency(sale.paidAmount, currency)} received`}
                      </p>
                    </div>
                    <strong className={outstanding > 0 ? 'danger-text' : 'success-text'}>
                      {outstanding > 0 ? formatCurrency(outstanding, currency) : formatCurrency(sale.totalAmount, currency)}
                    </strong>
                  </div>
                );
              })}
              {metrics.activeSales.length === 0 ? (
                <div className="list-row">
                  <div>
                    <strong>No sales recorded yet</strong>
                    <p>The first sale will start shaping the dashboard as soon as it is saved.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="Quick Actions" subtitle="Fast track your routine business operations.">
            <div className="stats-grid">
               <div className="stat-card" onClick={() => history.push('/sales')} style={{ cursor: 'pointer', textAlign: 'center' }}>
                  <IonIcon icon={cartOutline} color="primary" style={{ fontSize: '2rem', marginBottom: '8px' }} />
                  <h3 style={{ fontSize: '1.2rem', margin: '4px 0' }}>New Sale</h3>
                  <p style={{ fontSize: '0.85rem' }}>Process transaction</p>
               </div>
               <div className="stat-card" onClick={() => history.push('/export/batch')} style={{ cursor: 'pointer', textAlign: 'center', border: '1px solid var(--ion-color-primary)' }}>
                  <IonIcon icon={documentTextOutline} color="primary" style={{ fontSize: '2rem', marginBottom: '8px' }} />
                  <h3 style={{ fontSize: '1.2rem', margin: '4px 0' }}>Batch Export</h3>
                  <p style={{ fontSize: '0.85rem' }}>Document packs</p>
               </div>
            </div>
          </SectionCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default DashboardPage;
