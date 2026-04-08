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

const DashboardPage: React.FC = () => {
  const { state, priorityQuestions } = useBusiness();
  const now = new Date();
  const todayKey = new Date().toDateString();
  const todaySales = state.sales.filter((sale) => new Date(sale.createdAt).toDateString() === todayKey);
  const salesToday = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const cashInHand = todaySales
    .filter((sale) => sale.paymentMethod === 'Cash')
    .reduce((sum, sale) => sum + sale.paidAmount, 0);
  const mobileMoneyToday = todaySales
    .filter((sale) => sale.paymentMethod === 'Mobile Money')
    .reduce((sum, sale) => sum + sale.paidAmount, 0);
  const outstandingReceivables = state.customers.reduce((sum, customer) => sum + customer.balance, 0);
  const lowStockCount = state.products.filter((product) => product.quantity <= product.reorderLevel).length;
  const lastSync = state.sales[0]?.createdAt;
  const revenuePoints = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - offset));
    const label = new Intl.DateTimeFormat('en-GH', { weekday: 'short' }).format(date);
    const dayKey = date.toDateString();
    const value = state.sales
      .filter((sale) => new Date(sale.createdAt).toDateString() === dayKey)
      .reduce((sum, sale) => sum + sale.totalAmount, 0);

    return {
      label,
      shortLabel: label.slice(0, 2),
      value,
    };
  });
  const weekRevenue = revenuePoints.reduce((sum, point) => sum + point.value, 0);
  const bestDay = revenuePoints.reduce((current, point) => (point.value > current.value ? point : current), revenuePoints[0]);

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>BizPilot GH</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <div className="page-shell">
          <section className="hero-card">
            <p className="eyebrow">Business health</p>
            <h1>Run your shop with clarity.</h1>
            <p className="hero-copy">
              Your dashboard now updates from recorded sales, customer balances, and live stock levels stored in this app.
            </p>
            <div className="sync-line">
              <IonBadge color="success">Healthy</IonBadge>
              <IonText>
                Last activity {lastSync ? formatRelativeDate(lastSync) : 'waiting for first recorded sale'} • local-first state active
              </IonText>
            </div>
          </section>

          <section className="stats-grid">
            <StatCard label="Sales today" value={formatCurrency(salesToday)} helper={`${todaySales.length} transactions`} />
            <StatCard label="Cash in hand" value={formatCurrency(cashInHand)} helper="Collected today" />
            <StatCard label="MoMo received" value={formatCurrency(mobileMoneyToday)} helper="Mobile money collected" />
            <StatCard label="Customers owing" value={formatCurrency(outstandingReceivables)} helper={`${lowStockCount} low-stock products`} />
          </section>

          <SectionCard
            title="Revenue analytics"
            subtitle="A rolling seven-day view of sales value from recorded transactions."
          >
            <div className="analytics-headline">
              <div>
                <p className="muted-label">This week</p>
                <h3>{formatCurrency(weekRevenue)}</h3>
              </div>
              <div className="right-meta">
                <p className="muted-label">Best day</p>
                <h3>{bestDay ? `${bestDay.label} · ${formatCurrency(bestDay.value)}` : formatCurrency(0)}</h3>
              </div>
            </div>
            <RevenueChart points={revenuePoints} />
          </SectionCard>

          <SectionCard
            title="Owner priorities"
            subtitle="The working MVP is still centered on the questions Ghanaian SMEs ask every day."
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
            subtitle="New sales recorded from the Sales tab appear here immediately."
          >
            <div className="list-block">
              {state.sales.slice(0, 5).map((sale) => {
                const customer = state.customers.find((item) => item.id === sale.customerId);
                const product = state.products.find((item) => item.id === sale.productId);
                const outstanding = sale.totalAmount - sale.paidAmount;

                return (
                  <div className="list-row" key={sale.id}>
                    <div>
                      <strong>
                        {(customer?.name ?? 'A customer')} bought {(product?.name ?? 'an item')}
                      </strong>
                      <p>
                        {sale.quantity} units • {sale.paymentMethod} • {formatRelativeDate(sale.createdAt)}
                      </p>
                    </div>
                    <strong className={outstanding > 0 ? 'danger-text' : 'success-text'}>
                      {formatCurrency(sale.totalAmount)}
                    </strong>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default DashboardPage;
