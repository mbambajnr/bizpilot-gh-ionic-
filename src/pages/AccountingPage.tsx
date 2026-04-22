import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  IonSegment,
  IonSegmentButton,
  IonIcon,
  IonToast,
} from '@ionic/react';
import { cashOutline, trendingUpOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';

import SectionCard from '../components/SectionCard';
import EmptyState from '../components/EmptyState';
import { useBusiness } from '../context/BusinessContext';
import { selectDashboardMetrics } from '../selectors/businessSelectors';
import { formatCurrency, formatReceiptDate } from '../utils/format';

const EXPENSE_CATEGORIES = [
  'General',
  'Rent',
  'Utility',
  'Staff Wages',
  'Transportation',
  'Stock Purchase',
  'Repairs',
  'Marketing',
];

const AccountingPage: React.FC = () => {
  const { state, addExpense, currentUser, hasPermission } = useBusiness();
  const [activeSegment, setActiveSegment] = useState<'overview' | 'expenses'>('overview');
  
  // Expense Form State
  const [category, setCategory] = useState('General');
  const [amountInput, setAmountInput] = useState('');
  const [note, setNote] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const metrics = useMemo(() => selectDashboardMetrics(state), [state]);
  const currency = state.businessProfile.currency;
  const canViewExpenses = hasPermission('expenses.view');
  const canCreateExpenses = hasPermission('expenses.create');
  const canUseExpensesSegment = canViewExpenses || canCreateExpenses;

  useEffect(() => {
    if (activeSegment === 'expenses' && !canUseExpensesSegment) {
      setActiveSegment('overview');
    }
  }, [activeSegment, canUseExpensesSegment]);

  const totalExpenses = useMemo(() => 
    state.expenses.reduce((sum, exp) => sum + exp.amount, 0),
  [state.expenses]);

  const receivables = metrics.receivables;
  const cashInFlow = metrics.cashInHand + metrics.mobileMoneyReceived;

  const handleAddExpense = () => {
    const amount = parseFloat(amountInput);
    const result = addExpense({
      category,
      amount,
      note,
      recordedByUserId: currentUser.userId,
      recordedByName: currentUser.name,
    });

    if (result.ok) {
      setAmountInput('');
      setNote('');
      setFormMessage('');
      setShowSuccessToast(true);
    } else {
      setFormMessage(result.message);
    }
  };

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Accounting</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSegment value={activeSegment} onIonChange={(e) => setActiveSegment(e.detail.value as 'overview' | 'expenses')}>
            <IonSegmentButton value="overview">
              <IonIcon icon={trendingUpOutline} />
              <IonLabel>Overview</IonLabel>
            </IonSegmentButton>
            {canUseExpensesSegment ? (
              <IonSegmentButton value="expenses">
                <IonIcon icon={cashOutline} />
                <IonLabel>Expenses</IonLabel>
              </IonSegmentButton>
            ) : null}
          </IonSegment>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <div className="page-shell">
          {activeSegment === 'overview' && (
            <>
              <SectionCard title="Financial Snapshot" subtitle="Summary of cash flow, receivables, and estimated profit.">
                <div className="stats-row">
                  <div className="app-card stat-pill">
                    <p className="muted-label">Cash In (Today)</p>
                    <h2 className="success-text">{formatCurrency(cashInFlow, currency)}</h2>
                  </div>
                  <div className="app-card stat-pill">
                    <p className="muted-label">Receivables</p>
                    <h2 className="warning-text">{formatCurrency(receivables, currency)}</h2>
                  </div>
                </div>

                <div className="stats-row" style={{ marginTop: '12px' }}>
                  <div className="app-card stat-pill">
                    <p className="muted-label">Total Expenses</p>
                    <h2 className="danger-text">{formatCurrency(totalExpenses, currency)}</h2>
                  </div>
                   <div className="app-card stat-pill">
                    <p className="muted-label">Estimated Position</p>
                    <h2>{formatCurrency(metrics.salesToday - totalExpenses, currency)}</h2>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Reporting Suite" subtitle="Track business growth over time.">
                 <div className="list-block">
                    <div className="list-row">
                        <div>
                            <strong>Daily Revenue</strong>
                            <p>Gross sales recorded today</p>
                        </div>
                        <div className="right-meta">
                            <strong>{formatCurrency(metrics.salesToday, currency)}</strong>
                        </div>
                    </div>
                    <div className="list-row">
                        <div>
                            <strong>Mobile Money Share</strong>
                            <p>Percentage of today's payments via MoMo</p>
                        </div>
                        <div className="right-meta">
                            <strong>{ (metrics.cashInHand + metrics.mobileMoneyReceived) > 0 ? Math.round((metrics.mobileMoneyReceived / (metrics.cashInHand + metrics.mobileMoneyReceived)) * 100) : 0}%</strong>
                        </div>
                    </div>
                    <div className="list-row">
                        <div>
                            <strong>Inventory Value</strong>
                            <p>Total cost of current stock on hand</p>
                        </div>
                        <div className="right-meta">
                            <strong>{formatCurrency(state.products.reduce((sum, p) => sum + (p.cost * (metrics.inventorySummaries.find(s => s.product.id === p.id)?.quantityOnHand ?? 0)), 0), currency)}</strong>
                        </div>
                    </div>
                 </div>
              </SectionCard>
            </>
          )}

          {activeSegment === 'expenses' && (
            <>
              {canCreateExpenses ? (
                <SectionCard title="Record Expense" subtitle="Log cash outflows to maintain accurate profit records.">
                  <div className="form-grid">
                    <IonItem lines="none" className="app-item">
                      <IonLabel position="stacked">Category</IonLabel>
                      <IonSelect value={category} onIonChange={(e) => setCategory(e.detail.value)} interface="popover">
                        {EXPENSE_CATEGORIES.map(cat => (
                          <IonSelectOption key={cat} value={cat}>{cat}</IonSelectOption>
                        ))}
                      </IonSelect>
                    </IonItem>

                    <IonItem lines="none" className="app-item">
                      <IonLabel position="stacked">Amount ({currency})</IonLabel>
                      <IonInput 
                        type="number" 
                        placeholder="0.00" 
                        value={amountInput} 
                        onIonInput={(e) => setAmountInput(e.detail.value ?? '')}
                      />
                    </IonItem>

                    <IonItem lines="none" className="app-item">
                      <IonLabel position="stacked">Notes</IonLabel>
                      <IonInput 
                        placeholder="What was this for?" 
                        value={note} 
                        onIonInput={(e) => setNote(e.detail.value ?? '')}
                      />
                    </IonItem>

                    {formMessage ? <p className="form-message danger-text">{formMessage}</p> : null}

                    <IonButton expand="block" onClick={handleAddExpense}>
                      Record Expense
                    </IonButton>
                  </div>
                </SectionCard>
              ) : (
                <SectionCard title="Record Expense" subtitle="Only authorized users can create new expense records.">
                  <EmptyState
                    eyebrow="Create access disabled"
                    title="This role cannot record new expenses."
                    message="Ask an admin to grant the expense creation permission if this user should be able to log business costs."
                  />
                </SectionCard>
              )}

              <SectionCard title="Recent Expenses" subtitle="History of recorded business costs.">
                {!canViewExpenses ? (
                  <EmptyState
                    eyebrow="View access disabled"
                    title="This role cannot view expense history."
                    message="An admin can grant expense viewing access without also allowing new expenses to be created."
                  />
                ) : state.expenses.length === 0 ? (
                  <EmptyState 
                    eyebrow="No expenses"
                    title="Clean record"
                    message="You haven't logged any expenses yet. Use the form above to start tracking."
                  />
                ) : (
                  <div className="list-block">
                    {state.expenses.map(exp => (
                      <div className="list-row" key={exp.id}>
                        <div>
                          <strong>{exp.category}</strong>
                          <p>{exp.note || 'No description'}</p>
                          <p className="muted-label">{formatReceiptDate(exp.createdAt)}</p>
                        </div>
                        <div className="right-meta">
                          <strong className="danger-text">-{formatCurrency(exp.amount, currency)}</strong>
                          <p className="code-label">{exp.recordedByName}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </div>

        <IonToast
          isOpen={showSuccessToast}
          onDidDismiss={() => setShowSuccessToast(false)}
          message="Expense recorded successfully."
          duration={2000}
          color="success"
        />
      </IonContent>
    </IonPage>
  );
};

export default AccountingPage;
