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
import { chevronDownCircleOutline } from 'ionicons/icons';

import EmptyState from '../components/EmptyState';
import SectionCard from '../components/SectionCard';
import RevenueChart from '../components/RevenueChart';
import StatCard from '../components/StatCard';
import { useBusiness } from '../context/BusinessContext';
import { formatCurrency, formatRelativeDate } from '../utils/format';
import {
  type RevenueTrendPoint,
  selectAccountsPayableWorklist,
  selectActivityFeed,
  selectCustomerClassificationBreakdown,
  selectDashboardMetrics,
  selectLocationDisplayLabel,
  selectOutstandingReceivables,
  selectProcurementWorklist,
  selectProductById,
  selectProductCategoryDisplayLabel,
  selectSaleBalanceRemaining,
  selectStockTransfers,
  selectStoreStockBalances,
  selectWarehouseStockBalances,
  selectWarehouseWorklist,
} from '../selectors/businessSelectors';

type TrendPeriod = 'weekly' | 'monthly' | 'annual';
type WorklistCueTone = 'success' | 'warning' | 'danger';

type WorklistItemProps = {
  title: string;
  count: number | string;
  helper: string;
  onClick: () => void;
  dataTestId?: string;
  cues?: Array<{ label: string; tone: WorklistCueTone }>;
};

const HIGH_BALANCE_THRESHOLD = 1000;

const WorklistItem: React.FC<WorklistItemProps> = ({ title, count, helper, onClick, dataTestId, cues = [] }) => (
  <button
    type="button"
    className="list-row dashboard-worklist-row"
    onClick={onClick}
    data-testid={dataTestId}
  >
    <div className="dashboard-worklist-copy">
      <strong>{title}</strong>
      <p>{helper}</p>
      {cues.length > 0 ? (
        <div className="dashboard-worklist-cues">
          {cues.map((cue) => (
            <span key={`${title}-${cue.label}`} className={`status-pill ${cue.tone}`}>
              {cue.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
    <div className="right-meta">
      <IonBadge color="primary">{count}</IonBadge>
    </div>
  </button>
);

const DashboardPage: React.FC = () => {
  const history = useHistory();
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('weekly');
  const { state, priorityQuestions, backendStatus, hasPermission } = useBusiness();
  const metrics = selectDashboardMetrics(state);
  const customerClassificationBreakdown = selectCustomerClassificationBreakdown(state);
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
  const topCategory = metrics.inventoryCategoryReport[0];
  const topLocation = metrics.inventoryLocationReport[0];
  const topTransferSource = metrics.transferSummaryBySource[0];
  const topTransferDestination = metrics.transferSummaryByDestination[0];
  const topTransferredProduct = metrics.transferSummaryByProduct[0];
  const stockTransferViews = selectStockTransfers(state);
  const warehouseStockBalances = selectWarehouseStockBalances(state);
  const storeStockBalances = selectStoreStockBalances(state);
  const procurementWorklist = selectProcurementWorklist(state);
  const warehouseWorklist = selectWarehouseWorklist(state);
  const accountsPayableWorklist = selectAccountsPayableWorklist(state);
  const outstandingReceivables = selectOutstandingReceivables(state, 5);
  const activeVendors = state.vendors.filter((vendor) => vendor.status === 'active').length;
  const draftPurchases = procurementWorklist.draftCount;
  const pendingApprovalPurchases = procurementWorklist.awaitingApprovalCount;
  const awaitingReceiptPurchases = warehouseWorklist.approvedPurchasesAwaitingReceiptCount;
  const openPayables = accountsPayableWorklist.openCount;
  const openPayablesBalance = accountsPayableWorklist.totalOutstandingBalance;
  const pendingTransfers = state.stockTransfers.filter((transfer) => !['received', 'cancelled'].includes(transfer.status)).length;
  const pendingIncomingTransfers = state.stockTransfers.filter((transfer) => transfer.status === 'approved' || transfer.status === 'dispatched').length;
  const draftQuotations = state.quotations.filter((quotation) => ['Draft', 'draft', 'open'].includes(quotation.status)).length;
  const storeReadyQuantity = storeStockBalances.reduce((sum, entry) => sum + entry.quantityAvailable, 0);
  const warehouseQuantity = warehouseStockBalances.reduce((sum, entry) => sum + entry.quantityAvailable, 0);
  const activeWarehouseCount = new Set(warehouseStockBalances.map((entry) => entry.warehouseId)).size;
  const activeStoreCount = new Set(storeStockBalances.map((entry) => entry.storeId)).size;
  const outgoingTransfers = stockTransferViews.filter((entry) => entry.transfer.status === 'approved' || entry.transfer.status === 'dispatched').length;
  const canSeeAdminOverview = hasPermission('business.edit') || hasPermission('users.manage') || hasPermission('permissions.manage');
  const canSeeProcurement = hasPermission('vendors.manage') || hasPermission('purchases.view') || hasPermission('purchases.create');
  const canSeeWarehouse = hasPermission('purchases.receive') || hasPermission('transfers.view') || hasPermission('transfers.dispatch') || hasPermission('transfers.approve');
  const canSeeStore = hasPermission('transfers.receive') || hasPermission('sales.create') || hasPermission('sales.view');
  const canSeeSales = hasPermission('sales.view') || hasPermission('sales.create') || hasPermission('customers.view') || hasPermission('quotations.view');
  const canSeeAccounting = hasPermission('accounting.access') || hasPermission('payables.view') || hasPermission('payables.manage') || hasPermission('payables.pay') || hasPermission('expenses.view');
  const canSeeOpsMetrics = hasPermission('reports.inventory.view') || canSeeWarehouse || canSeeStore || canSeeAdminOverview;
  const canSeeSalesMetrics = hasPermission('reports.sales.view') || canSeeSales || canSeeAdminOverview;
  const canSeeFinancialMetrics = hasPermission('reports.financial.view') || canSeeAccounting || canSeeAdminOverview;
  const canSeeDashboardMetrics = hasPermission('reports.dashboard.view') || canSeeAdminOverview;

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
            {(hasPermission('sales.view') || hasPermission('reports.sales.view') || canSeeAdminOverview) ? (
              <StatCard 
                label="Sales today" 
                value={formatCurrency(metrics.salesToday, currency)} 
                helper={`${metrics.salesTodayCount} ${metrics.salesTodayCount === 1 ? 'sale' : 'sales'}`}
                className="float-effect"
                onClick={() => history.push('/sales')}
              />
            ) : null}
            {(hasPermission('accounting.access') || hasPermission('reports.financial.view') || canSeeAdminOverview) ? (
              <StatCard 
                label="Vault (Cash)" 
                value={formatCurrency(metrics.cashInHand, currency)} 
                helper="Today's floor" 
                className="float-effect"
                onClick={() => history.push('/accounting')}
              />
            ) : null}
            {(hasPermission('accounting.access') || hasPermission('reports.financial.view') || canSeeAdminOverview) ? (
              <StatCard 
                label="MoMo Bank" 
                value={formatCurrency(metrics.mobileMoneyReceived, currency)} 
                helper="Digital total" 
                className="float-effect"
                onClick={() => history.push('/accounting')}
              />
            ) : null}
            {(hasPermission('customers.view') || hasPermission('customers.ledger.view') || hasPermission('reports.financial.view') || canSeeAdminOverview) ? (
              <StatCard
                label="To Collect"
                value={formatCurrency(metrics.receivables, currency)}
                helper={metrics.customersOwingCount > 0 ? `${metrics.customersOwingCount} clients owing` : 'Clear balance'}
                className="float-effect"
                onClick={() => history.push('/customers')}
              />
            ) : null}
          </section>

          {canSeeAdminOverview ? (
            <SectionCard
              title="Management Overview"
              subtitle="A connected command view of approvals, supplier flow, warehouse work, finance, and platform administration."
            >
              <div className="list-block">
                <div className="list-row">
                  <div>
                    <strong>Vendor → Purchase → Approval → Payable → Warehouse Receipt → Store Transfer → Sale</strong>
                    <p>Use this as the top-line operational map for the whole business.</p>
                  </div>
                </div>
              </div>
              <div className="stats-grid" style={{ marginTop: '12px' }}>
                {(hasPermission('vendors.view') || hasPermission('vendors.manage')) ? (
                  <StatCard
                    label="Vendors"
                    value={String(activeVendors)}
                    helper={activeVendors === 0 ? 'No active suppliers yet' : 'Active suppliers'}
                    onClick={() => history.push('/vendors')}
                  />
                ) : null}
                {(hasPermission('purchases.view') || hasPermission('purchases.create')) ? (
                  <StatCard
                    label="Procurement"
                    value={String(draftPurchases + pendingApprovalPurchases)}
                    helper={pendingApprovalPurchases > 0 ? `${pendingApprovalPurchases} awaiting approval` : 'Purchase queue ready'}
                    onClick={() => history.push('/inventory?section=procurement')}
                  />
                ) : null}
                {hasPermission('purchases.receive') ? (
                  <StatCard
                    label="Warehouse Receipts"
                    value={String(awaitingReceiptPurchases)}
                    helper={awaitingReceiptPurchases > 0 ? 'Approved purchases awaiting receipt' : 'No purchases awaiting receipt'}
                    onClick={() => history.push('/inventory?section=receipts')}
                  />
                ) : null}
                {hasPermission('transfers.view') ? (
                  <StatCard
                    label="Stock Transfers"
                    value={String(pendingTransfers)}
                    helper={pendingTransfers > 0 ? 'Pending stock transfers' : 'No pending transfers'}
                    onClick={() => history.push('/inventory?section=transfers')}
                  />
                ) : null}
                {(hasPermission('payables.view') || hasPermission('payables.manage')) ? (
                  <StatCard
                    label="Accounts Payable"
                    value={String(openPayables)}
                    helper={openPayables > 0 ? `${formatCurrency(openPayablesBalance, currency)} outstanding` : 'No unpaid supplier bills'}
                    onClick={() => history.push('/accounting?segment=payables')}
                  />
                ) : null}
                {hasPermission('payables.pay') ? (
                  <StatCard
                    label="Payments / Settlements"
                    value={formatCurrency(openPayablesBalance, currency)}
                    helper={openPayables > 0 ? 'Ready to pay suppliers' : 'No settlement pending'}
                    onClick={() => history.push('/accounting?segment=payables&action=payment')}
                  />
                ) : null}
                {(hasPermission('users.manage') || hasPermission('permissions.manage')) ? (
                  <StatCard
                    label="Users & Permissions"
                    value="Open"
                    helper="Manage team access and operational roles"
                    onClick={() => history.push('/settings')}
                  />
                ) : null}
              </div>
            </SectionCard>
          ) : null}

          {canSeeProcurement ? (
            <SectionCard
              title="Procurement Desk"
              subtitle="Supplier setup, purchase drafting, and approval work for the procurement team."
            >
              <div className="stats-grid">
                {(hasPermission('vendors.view') || hasPermission('vendors.manage')) ? (
                  <StatCard
                    label="Vendors"
                    value={String(activeVendors)}
                    helper={activeVendors > 0 ? 'Active vendor count' : 'Add your first supplier'}
                    onClick={() => history.push('/vendors')}
                  />
                ) : null}
                {hasPermission('purchases.create') ? (
                  <StatCard
                    label="Create Purchase"
                    value={String(draftPurchases)}
                    helper={draftPurchases > 0 ? 'Draft purchases in progress' : 'Start a new procurement draft'}
                    onClick={() => history.push('/inventory?section=procurement')}
                  />
                ) : null}
                {hasPermission('purchases.view') ? (
                  <StatCard
                    label="Pending approval"
                    value={String(pendingApprovalPurchases)}
                    helper={pendingApprovalPurchases > 0 ? 'Submitted purchases need review' : 'Nothing waiting for approval'}
                    onClick={() => history.push('/inventory?section=procurement')}
                  />
                ) : null}
              </div>
              {activeVendors === 0 ? (
                <EmptyState
                  eyebrow="Procurement setup"
                  title="No vendors yet."
                  message="Add your first supplier so purchase drafting can begin."
                  actionLabel="Add Vendor"
                  onAction={() => history.push('/vendors')}
                />
              ) : null}
              <div className="list-block" style={{ marginTop: '12px' }}>
                <IonText color="medium">
                  <strong>Pending tasks</strong>
                </IonText>
                <WorklistItem
                  title="Draft purchases"
                  count={procurementWorklist.draftCount}
                  helper={
                    procurementWorklist.draftCount > 0
                      ? 'Purchase drafts are waiting to be completed and submitted.'
                      : 'No draft purchases are waiting.'
                  }
                  onClick={() => history.push('/inventory?section=procurement')}
                  dataTestId="procurement-worklist-drafts"
                />
                <WorklistItem
                  title="Submitted purchases awaiting approval"
                  count={procurementWorklist.awaitingApprovalCount}
                  helper={
                    procurementWorklist.awaitingApprovalCount > 0
                      ? 'Submitted procurement requests need approval.'
                      : 'No submitted purchases are awaiting approval.'
                  }
                  onClick={() => history.push('/inventory?section=procurement')}
                  dataTestId="procurement-worklist-awaiting-approval"
                  cues={[{ label: 'Needs approval', tone: 'warning' }]}
                />
                {procurementWorklist.cancelledCount > 0 ? (
                  <WorklistItem
                    title="Cancelled purchases"
                    count={procurementWorklist.cancelledCount}
                    helper="Review cancelled requests if you need to restart procurement."
                    onClick={() => history.push('/inventory?section=procurement')}
                    dataTestId="procurement-worklist-cancelled"
                  />
                ) : null}
              </div>
            </SectionCard>
          ) : null}

          {canSeeWarehouse ? (
            <SectionCard
              title="Warehouse Desk"
              subtitle="Receive supplier stock, dispatch transfers, and keep warehouse operations moving."
            >
              <div className="stats-grid">
                {hasPermission('purchases.receive') ? (
                  <StatCard
                    label="Warehouse Receipts"
                    value={String(awaitingReceiptPurchases)}
                    helper={awaitingReceiptPurchases > 0 ? 'Approved purchases awaiting receipt' : 'No purchases awaiting receipt'}
                    onClick={() => history.push('/inventory?section=receipts')}
                  />
                ) : null}
                {hasPermission('transfers.view') ? (
                  <StatCard
                    label="Stock Transfers"
                    value={String(pendingTransfers)}
                    helper={outgoingTransfers > 0 ? `${outgoingTransfers} transfer${outgoingTransfers === 1 ? '' : 's'} moving out` : 'No transfer queue right now'}
                    onClick={() => history.push('/inventory?section=transfers')}
                  />
                ) : null}
                {hasPermission('inventory.view') || hasPermission('transfers.view') ? (
                  <StatCard
                    label="Warehouse stock"
                    value={String(warehouseQuantity)}
                    helper={activeWarehouseCount > 0 ? `${activeWarehouseCount} warehouse${activeWarehouseCount === 1 ? '' : 's'} carrying stock` : 'No warehouse stock yet'}
                    onClick={() => history.push('/inventory')}
                  />
                ) : null}
              </div>
              {awaitingReceiptPurchases === 0 && pendingTransfers === 0 ? (
                <EmptyState
                  eyebrow="Warehouse queue"
                  title="No warehouse actions waiting."
                  message="Approved purchases and transfer requests will appear here when warehouse work is ready."
                />
              ) : null}
              <div className="list-block" style={{ marginTop: '12px' }}>
                <IonText color="medium">
                  <strong>Pending tasks</strong>
                </IonText>
                {hasPermission('purchases.receive') ? (
                  <WorklistItem
                    title="Approved purchases awaiting receipt"
                    count={warehouseWorklist.approvedPurchasesAwaitingReceiptCount}
                    helper={
                      warehouseWorklist.approvedPurchasesAwaitingReceiptCount > 0
                        ? 'Receive approved supplier stock into the warehouse.'
                        : 'No approved purchases are awaiting receipt.'
                    }
                    onClick={() => history.push('/inventory?section=receipts')}
                    dataTestId="warehouse-worklist-receipts"
                    cues={[{ label: 'Ready to receive', tone: 'success' }]}
                  />
                ) : null}
                {hasPermission('transfers.view') ? (
                  <WorklistItem
                    title="Transfers awaiting dispatch"
                    count={warehouseWorklist.transfersAwaitingDispatchCount}
                    helper={
                      warehouseWorklist.transfersAwaitingDispatchCount > 0
                        ? 'Approved transfer requests are ready to dispatch.'
                        : 'No transfers are waiting for dispatch.'
                    }
                    onClick={() => history.push('/inventory?section=transfers')}
                    dataTestId="warehouse-worklist-dispatch"
                    cues={[{ label: 'Awaiting dispatch', tone: 'warning' }]}
                  />
                ) : null}
                {hasPermission('transfers.view') || hasPermission('transfers.receive') ? (
                  <WorklistItem
                    title="Transfers awaiting receipt"
                    count={warehouseWorklist.transfersAwaitingReceiptCount}
                    helper={
                      warehouseWorklist.transfersAwaitingReceiptCount > 0
                        ? 'Dispatched transfers need store-side receipt confirmation.'
                        : 'No transfers are awaiting receipt.'
                    }
                    onClick={() => history.push('/inventory?section=transfers')}
                    dataTestId="warehouse-worklist-receive"
                    cues={[{ label: 'Awaiting receipt', tone: 'warning' }]}
                  />
                ) : null}
              </div>
            </SectionCard>
          ) : null}

          {canSeeStore ? (
            <SectionCard
              title="Store Operations"
              subtitle="Track selling-location stock, incoming transfers, and shelf readiness for store teams."
            >
              <div className="stats-grid">
                {hasPermission('inventory.view') ? (
                  <StatCard
                    label="Store inventory"
                    value={String(activeStoreCount)}
                    helper={activeStoreCount > 0 ? `${storeReadyQuantity} units sales-ready` : 'No active stores carrying stock'}
                    onClick={() => history.push('/inventory')}
                  />
                ) : null}
                {(hasPermission('transfers.view') || hasPermission('transfers.receive')) ? (
                  <StatCard
                    label="Incoming transfers"
                    value={String(pendingIncomingTransfers)}
                    helper={pendingIncomingTransfers > 0 ? 'Transfers are on the way to stores' : 'No incoming transfers right now'}
                    onClick={() => history.push('/inventory?section=transfers')}
                  />
                ) : null}
                {hasPermission('inventory.view') ? (
                  <StatCard
                    label="Low stock"
                    value={String(metrics.lowStockByLocation.length)}
                    helper={metrics.lowStockByLocation.length > 0 ? 'Some store lines need replenishment' : 'Stock is in a healthy range'}
                    onClick={() => history.push('/inventory')}
                  />
                ) : null}
              </div>
            </SectionCard>
          ) : null}

          {(hasPermission('customers.ledger.view') || hasPermission('reports.financial.view')) ? (
            <SectionCard
              title="Collections Queue"
              subtitle="Customer balances needing follow-up from sales and finance."
            >
              {outstandingReceivables.length === 0 ? (
                <EmptyState
                  eyebrow="Collections"
                  title="No outstanding receivables."
                  message="Unpaid customer balances will appear here when follow-up is needed."
                />
              ) : (
                <div className="list-block">
                  {outstandingReceivables.map((entry) => (
                    <WorklistItem
                      key={entry.customerId}
                      title={entry.customerName}
                      count={formatCurrency(entry.balance, currency)}
                      helper={`Outstanding balance. ${entry.lastPayment}.`}
                      onClick={() => history.push('/customers')}
                      dataTestId={`receivables-worklist-${entry.customerId}`}
                      cues={[
                        { label: 'Outstanding', tone: 'warning' },
                        ...(entry.balance >= HIGH_BALANCE_THRESHOLD
                          ? [{ label: 'High balance', tone: 'danger' as const }]
                          : []),
                      ]}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          ) : null}

          {canSeeSales ? (
            <SectionCard
              title="Sales Desk"
              subtitle="Daily selling actions, customer follow-up, quotations, and receivable visibility in one place."
            >
              <div className="stats-grid">
                {hasPermission('sales.create') ? (
                  <StatCard
                    label="New sale"
                    value={String(metrics.salesTodayCount)}
                    helper="Open the sales desk"
                    onClick={() => history.push('/sales')}
                  />
                ) : null}
                {hasPermission('customers.view') ? (
                  <StatCard
                    label="Customers"
                    value={String(state.customers.length)}
                    helper={metrics.customersOwingCount > 0 ? `${metrics.customersOwingCount} customers owing` : 'Customer base is up to date'}
                    onClick={() => history.push('/customers')}
                  />
                ) : null}
                {hasPermission('quotations.view') || hasPermission('quotations.create') ? (
                  <StatCard
                    label="Quotations"
                    value={String(draftQuotations)}
                    helper={draftQuotations > 0 ? 'Open quotes waiting for follow-up' : 'No active quote queue'}
                    onClick={() => history.push('/quotations')}
                  />
                ) : null}
                {(hasPermission('customers.ledger.view') || hasPermission('reports.financial.view')) ? (
                  <StatCard
                    label="Receivables"
                    value={formatCurrency(metrics.receivables, currency)}
                    helper="Outstanding customer balances"
                    onClick={() => history.push('/customers')}
                  />
                ) : null}
              </div>
            </SectionCard>
          ) : null}

          {canSeeAccounting ? (
            <SectionCard
              title="Accounting Desk"
              subtitle="Supplier liabilities, collections, expenses, and payment visibility for the finance team."
            >
              <div className="stats-grid">
                {(hasPermission('payables.view') || hasPermission('payables.manage')) ? (
                  <StatCard
                    label="Accounts Payable"
                    value={String(openPayables)}
                    helper={openPayables > 0 ? `${formatCurrency(openPayablesBalance, currency)} outstanding` : 'No unpaid supplier bills'}
                    onClick={() => history.push('/accounting?segment=payables')}
                  />
                ) : null}
                {hasPermission('payables.pay') ? (
                  <StatCard
                    label="Pay Supplier"
                    value={formatCurrency(openPayablesBalance, currency)}
                    helper={openPayables > 0 ? 'Supplier settlements are waiting' : 'No supplier settlement due'}
                    onClick={() => history.push('/accounting?segment=payables&action=payment')}
                  />
                ) : null}
                {(hasPermission('customers.ledger.view') || hasPermission('reports.financial.view')) ? (
                  <StatCard
                    label="Receivables"
                    value={formatCurrency(metrics.receivables, currency)}
                    helper="Customer balances still to collect"
                    onClick={() => history.push('/customers')}
                  />
                ) : null}
                {(hasPermission('expenses.view') || hasPermission('expenses.create')) ? (
                  <StatCard
                    label="Expenses"
                    value={formatCurrency(state.expenses.reduce((sum, entry) => sum + entry.amount, 0), currency)}
                    helper={state.expenses.length > 0 ? `${state.expenses.length} recorded expense${state.expenses.length === 1 ? '' : 's'}` : 'No expenses recorded yet'}
                    onClick={() => history.push('/accounting')}
                  />
                ) : null}
                {(hasPermission('accounting.access') || hasPermission('payments.view') || hasPermission('reports.financial.view')) ? (
                  <StatCard
                    label="Cash / MoMo"
                    value={formatCurrency(metrics.cashInHand + metrics.mobileMoneyReceived, currency)}
                    helper="Today’s collections across cash and mobile money"
                    onClick={() => history.push('/accounting')}
                  />
                ) : null}
              </div>
              <div className="list-block" style={{ marginTop: '12px' }}>
                <IonText color="medium">
                  <strong>Pending tasks</strong>
                </IonText>
                {(hasPermission('payables.view') || hasPermission('payables.manage')) ? (
                  <WorklistItem
                    title="Open payables"
                    count={accountsPayableWorklist.openCount}
                    helper={
                      accountsPayableWorklist.openCount > 0
                        ? `${formatCurrency(accountsPayableWorklist.totalOutstandingBalance, currency)} is still unpaid to suppliers.`
                        : 'No unpaid supplier bills are open.'
                    }
                    onClick={() => history.push('/accounting?segment=payables')}
                    dataTestId="accounting-worklist-open-payables"
                    cues={[
                      { label: 'Open', tone: 'warning' },
                      ...(accountsPayableWorklist.totalOutstandingBalance >= HIGH_BALANCE_THRESHOLD
                        ? [{ label: 'High balance', tone: 'danger' as const }]
                        : []),
                    ]}
                  />
                ) : null}
                {hasPermission('payables.manage') ? (
                  <WorklistItem
                    title="Approved payables awaiting payment"
                    count={accountsPayableWorklist.approvedAwaitingPaymentCount}
                    helper={
                      accountsPayableWorklist.approvedAwaitingPaymentCount > 0
                        ? 'Approved supplier bills are waiting for settlement.'
                        : 'No approved supplier bills are awaiting payment.'
                    }
                    onClick={() => history.push('/accounting?segment=payables')}
                    dataTestId="accounting-worklist-awaiting-payment"
                    cues={[{ label: 'Awaiting payment', tone: 'warning' }]}
                  />
                ) : null}
                {hasPermission('payables.pay') ? (
                  <WorklistItem
                    title="Partially paid payables"
                    count={accountsPayableWorklist.partiallyPaidCount}
                    helper={
                      accountsPayableWorklist.partiallyPaidCount > 0
                        ? 'Some supplier bills still need balance settlement.'
                        : 'No supplier bills are partially paid.'
                    }
                    onClick={() => history.push('/accounting?segment=payables&action=payment')}
                    dataTestId="accounting-worklist-partially-paid"
                    cues={[{ label: 'Partially paid', tone: 'warning' }]}
                  />
                ) : null}
                {accountsPayableWorklist.overdueCount > 0 ? (
                  <WorklistItem
                    title="Overdue payables"
                    count={accountsPayableWorklist.overdueCount}
                    helper="Supplier bills have passed their due date and need attention."
                    onClick={() => history.push('/accounting?segment=payables')}
                    dataTestId="accounting-worklist-overdue"
                    cues={[{ label: 'Overdue', tone: 'danger' }]}
                  />
                ) : null}
              </div>
              {accountsPayableWorklist.openCount === 0 ? (
                <EmptyState
                  eyebrow="Finance queue"
                  title="No unpaid supplier bills."
                  message="Approved and unpaid payables will appear here when accounting action is needed."
                />
              ) : null}
            </SectionCard>
          ) : null}

          {canSeeFinancialMetrics || canSeeSalesMetrics ? (
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
          ) : null}

          {(canSeeDashboardMetrics || canSeeSalesMetrics || canSeeOpsMetrics) ? (
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
          ) : null}

          {state.businessProfile.customerClassificationEnabled && canSeeSalesMetrics ? (
            <SectionCard
              title="Customer mix"
              subtitle="Current customers use profile type; sales value uses historical invoice snapshots."
            >
              <div className="triple-grid">
                <div className="mini-stat">
                  <p className="muted-label">B2B customers</p>
                  <h3>{customerClassificationBreakdown.customers.B2B}</h3>
                  <p>{formatCurrency(customerClassificationBreakdown.sales.B2B, currency)} invoiced</p>
                </div>
                <div className="mini-stat">
                  <p className="muted-label">B2C customers</p>
                  <h3>{customerClassificationBreakdown.customers.B2C}</h3>
                  <p>{formatCurrency(customerClassificationBreakdown.sales.B2C, currency)} invoiced</p>
                </div>
                <div className="mini-stat">
                  <p className="muted-label">Unclassified</p>
                  <h3>{customerClassificationBreakdown.customers.unclassified}</h3>
                  <p>{formatCurrency(customerClassificationBreakdown.sales.unclassified, currency)} invoiced</p>
                </div>
              </div>
            </SectionCard>
          ) : null}

          {canSeeOpsMetrics ? (
            <div style={{ marginTop: '8px', marginBottom: '-4px' }}>
            <p className="eyebrow">Management reporting</p>
            <p className="muted-label">Operational summaries built from your current stock state and historical document snapshots.</p>
            </div>
          ) : null}

          {canSeeOpsMetrics ? (
          <SectionCard
            title="Inventory control"
            subtitle="Live category, location, and stock-pressure views built from current location-aware inventory."
          >
            <div className="stats-grid">
              <div className="mini-stat">
                <p className="muted-label">Top category</p>
                <h3>{topCategory?.label ?? 'Uncategorized'}</h3>
                <p>{topCategory ? `${topCategory.productCount} products • ${topCategory.quantityOnHand} units` : 'No inventory yet'}</p>
              </div>
              <div className="mini-stat">
                <p className="muted-label">Stock concentration</p>
                <h3>{topLocation?.label ?? 'Main Store'}</h3>
                <p>{topLocation ? `${topLocation.quantityOnHand} units • Operational stock estimate ${formatCurrency(topLocation.stockValue, currency)}` : 'No location data yet'}</p>
              </div>
              <div className="mini-stat">
                <p className="muted-label">Low stock by location</p>
                <h3>{metrics.lowStockByLocation.length}</h3>
                <p>{metrics.lowStockByLocation.length > 0 ? 'Items need replenishment attention' : 'No urgent stock pressure'}</p>
              </div>
            </div>
            <div className="list-block">
              {metrics.inventoryLocationReport.slice(0, 3).map((entry) => (
                <div className="list-row" key={entry.locationId}>
                  <div>
                    <strong>{entry.label}</strong>
                    <p>{entry.type === 'warehouse' ? 'Warehouse' : 'Store'} • {entry.productCount} stocked products</p>
                  </div>
                  <div className="right-meta">
                    <strong>{entry.quantityOnHand} units</strong>
                    <p>Estimate {formatCurrency(entry.stockValue, currency)}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
          ) : null}

          {canSeeWarehouse || canSeeDashboardMetrics ? (
          <SectionCard
            title="Supply pulse"
            subtitle="Transfer visibility for the warehouse-to-store network without the enterprise theatre."
          >
            <div className="triple-grid">
              <div className="mini-stat">
                <p className="muted-label">Recent transfers</p>
                <h3>{metrics.transferHistory.length}</h3>
                <p>{topTransferSource ? `Most active source: ${topTransferSource.label}` : 'No transfer activity yet'}</p>
              </div>
              <div className="mini-stat">
                <p className="muted-label">Top supplied store</p>
                <h3>{topTransferDestination?.label ?? 'None yet'}</h3>
                <p>{topTransferDestination ? `${topTransferDestination.quantityMoved} units moved` : 'Waiting on first transfer'}</p>
              </div>
              <div className="mini-stat">
                <p className="muted-label">Most moved product</p>
                <h3>{topTransferredProduct?.label ?? 'None yet'}</h3>
                <p>{topTransferredProduct ? `${topTransferredProduct.quantityMoved} units transferred` : 'No product movement yet'}</p>
              </div>
            </div>
            <div className="list-block">
              {metrics.transferHistory.slice(0, 4).map((entry) => {
                const product = selectProductById(state, entry.productId);

                return (
                  <div className="list-row" key={entry.transferId}>
                    <div>
                      <strong>{product?.name ?? 'Unknown product'}</strong>
                      <p>
                        {selectLocationDisplayLabel(state, entry.fromLocationId)} → {selectLocationDisplayLabel(state, entry.toLocationId)}
                      </p>
                      <p className="muted-label">{formatRelativeDate(entry.createdAt)}</p>
                    </div>
                    <div className="right-meta">
                      <strong>{entry.quantity} units</strong>
                      <p>{entry.referenceNumber ?? 'Transfer'}</p>
                    </div>
                  </div>
                );
              })}
              {metrics.transferHistory.length === 0 ? (
                <div className="list-row">
                  <div>
                    <strong>No transfers recorded yet</strong>
                    <p>Warehouse and store movements will appear here once stock starts moving between locations.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </SectionCard>
          ) : null}

          {canSeeSalesMetrics ? (
          <SectionCard
            title="Sales segmentation"
            subtitle="Historical sales mix uses document snapshots, so reporting stays correct even if customer profiles change later."
          >
            <div className="triple-grid">
              {metrics.salesSegmentation.map((segment) => (
                <div className="mini-stat" key={segment.label}>
                  <p className="muted-label">{segment.label}</p>
                  <h3>{formatCurrency(segment.totalAmount, currency)}</h3>
                  <p>{segment.transactionCount} transaction{segment.transactionCount === 1 ? '' : 's'}</p>
                </div>
              ))}
            </div>
          </SectionCard>
          ) : null}

          {canSeeOpsMetrics ? (
          <SectionCard
            title="Fast movers and risk"
            subtitle="Simple location-aware control views for what is moving quickly and what is running low, using lightweight heuristics rather than forecasting."
          >
            <div className="stats-grid">
              <div className="mini-stat">
                <p className="muted-label">Fast-moving items</p>
                <h3>{metrics.fastMovingByLocation.length}</h3>
                <p>30-day sales-movement heuristic by location</p>
              </div>
              <div className="mini-stat">
                <p className="muted-label">Immediate low-stock lines</p>
                <h3>{metrics.lowStockByLocation.length}</h3>
                <p>Uses each product&apos;s reorder level inside its current location context</p>
              </div>
            </div>
            <div className="list-block">
              {metrics.lowStockByLocation.slice(0, 4).map((entry) => (
                <div className="list-row" key={`${entry.locationId}:${entry.product.id}`}>
                  <div>
                    <strong>{entry.product.name}</strong>
                    <p>{entry.locationLabel} • {selectProductCategoryDisplayLabel(state, entry.product.categoryId)}</p>
                  </div>
                  <div className="right-meta">
                    <strong className="warning-text">{entry.quantityOnHand} left</strong>
                    <p>Reorder at {entry.reorderLevel}</p>
                  </div>
                </div>
              ))}
              {metrics.lowStockByLocation.length === 0 ? (
                <div className="list-row">
                  <div>
                    <strong>No low-stock alerts right now</strong>
                    <p>Location-level inventory is currently above reorder thresholds.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </SectionCard>
          ) : null}

          {(canSeeSalesMetrics || canSeeDashboardMetrics) ? (
          <div style={{ marginTop: '8px', marginBottom: '-4px' }}>
            <p className="eyebrow">Revenue and activity</p>
            <p className="muted-label">Trend and day-to-day workflow views stay separate from the management snapshots above.</p>
          </div>
          ) : null}

          {canSeeSalesMetrics ? (
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
          ) : null}

          {canSeeAdminOverview ? (
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
          ) : null}


          {(canSeeDashboardMetrics || canSeeSalesMetrics || canSeeFinancialMetrics || canSeeOpsMetrics) ? (
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
          ) : null}

          {(hasPermission('sales.create') || hasPermission('invoices.export_pdf') || canSeeAdminOverview) ? (
            <SectionCard title="Quick Actions" subtitle="Fast track the next task that belongs on this user’s desk.">
              <div className="stats-grid">
                {hasPermission('sales.create') ? (
                  <StatCard
                    label="New Sale"
                    value={String(metrics.salesTodayCount)}
                    helper="Process transaction"
                    onClick={() => history.push('/sales')}
                  />
                ) : null}
                {(hasPermission('invoices.export_pdf') || canSeeAdminOverview) ? (
                  <StatCard
                    label="Batch Export"
                    value="Ready"
                    helper="Document packs"
                    onClick={() => history.push('/export/batch')}
                  />
                ) : null}
              </div>
            </SectionCard>
          ) : null}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default DashboardPage;
