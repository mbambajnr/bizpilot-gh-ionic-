import {
  IonBadge,
  IonContent,
  IonHeader,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react';

import SectionCard from '../components/SectionCard';
import RevenueChart from '../components/RevenueChart';
import StatCard from '../components/StatCard';
import { useBusiness } from '../context/BusinessContext';
import { formatCurrency, formatRelativeDate } from '../utils/format';
import {
  selectActivityFeed,
  selectDashboardMetrics,
  selectProductById,
  selectSaleBalanceRemaining,
} from '../selectors/businessSelectors';

const DashboardPage: React.FC = () => {
  const { state, priorityQuestions } = useBusiness();
  const metrics = selectDashboardMetrics(state);
  const weekRevenue = metrics.weeklyRevenueTrend.reduce((sum, point) => sum + point.value, 0);
  const bestDay = metrics.weeklyRevenueTrend.reduce(
    (current, point) => (point.value > current.value ? point : current),
    metrics.weeklyRevenueTrend[0]
  );
  const lastActivity = selectActivityFeed(state)[0];
  const currency = state.businessProfile.currency;

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>{state.businessProfile.businessName}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <div className="page-shell" data-testid="dashboard-page">
          <section className="hero-card">
            <p className="eyebrow">Business health</p>
            <h1>Run your shop with clarity.</h1>
            <p className="hero-copy">
              Dashboard totals now come from recorded sales, customer ledger entries, and stock movement history stored in this app.
            </p>
            <div className="sync-line">
              <IonBadge color="success">Local-first</IonBadge>
              <IonText>
                Last activity {lastActivity ? formatRelativeDate(lastActivity.createdAt) : 'waiting for first business event'}
              </IonText>
            </div>
          </section>

          <section className="stats-grid">
            <StatCard label="Sales today" value={formatCurrency(metrics.salesToday, currency)} helper={`${metrics.activeSales.filter((sale) => new Date(sale.createdAt).toDateString() === new Date().toDateString()).length} transactions`} />
            <StatCard label="Cash in hand" value={formatCurrency(metrics.cashInHand, currency)} helper="Received today" />
            <StatCard label="MoMo received" value={formatCurrency(metrics.mobileMoneyReceived, currency)} helper="Received today" />
            <StatCard
              label="Receivables"
              value={formatCurrency(metrics.receivables, currency)}
              helper={metrics.customersOwingCount > 0 ? `${metrics.customersOwingCount} customers still owe` : 'All tracked customers are settled'}
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
            <div className="dual-stat">
              <div>
                <p className="muted-label">Customers owing</p>
                <h3>{metrics.customersOwingCount}</h3>
              </div>
              <div>
                <p className="muted-label">Low-stock items</p>
                <h3>{metrics.lowStockCount}</h3>
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
            title="Revenue analytics"
            subtitle="A rolling seven-day view of revenue from active invoice records."
          >
            <div className="analytics-headline">
              <div>
                <p className="muted-label">This week</p>
                <h3>{formatCurrency(weekRevenue, currency)}</h3>
              </div>
              <div className="right-meta">
                <p className="muted-label">Best day</p>
                <h3>{bestDay ? `${bestDay.label} · ${formatCurrency(bestDay.value, currency)}` : formatCurrency(0, currency)}</h3>
              </div>
            </div>
            <RevenueChart points={metrics.weeklyRevenueTrend} />
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
            title="Products to restock"
            subtitle="Items at or below their reorder point based on movement history, not manual counters."
          >
            {metrics.inventorySummaries.filter((item) => item.lowStock).length > 0 ? (
              <div className="list-block">
                {metrics.inventorySummaries
                  .filter((item) => item.lowStock)
                  .map((item) => (
                    <div className="list-row" key={item.product.id}>
                      <div>
                        <strong>{item.product.name}</strong>
                        <p className="code-label">{item.product.inventoryId}</p>
                        <p>Reorder level {item.product.reorderLevel}</p>
                      </div>
                      <div className="right-meta">
                        <strong className="warning-text">{item.stockStatusDisplay.label}</strong>
                        <p>{item.quantityOnHand} left</p>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="list-block">
                <div className="list-row">
                  <div>
                    <strong>Stock levels look healthy</strong>
                    <p>No products are currently at or below their reorder level.</p>
                  </div>
                </div>
              </div>
            )}
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
        </div>
      </IonContent>
    </IonPage>
  );
};

export default DashboardPage;
