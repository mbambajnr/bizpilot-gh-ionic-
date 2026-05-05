import {
  IonBadge,
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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';

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
  const history = useHistory();
  const location = useLocation();
  const { state, addExpense, approvePayable, recordPayablePayment, currentUser, hasPermission } = useBusiness();
  const [activeSegment, setActiveSegment] = useState<'overview' | 'expenses' | 'payables'>('overview');
  
  // Expense Form State
  const [category, setCategory] = useState('General');
  const [amountInput, setAmountInput] = useState('');
  const [note, setNote] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [selectedPayableId, setSelectedPayableId] = useState('');
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'mobileMoney' | 'creditCard'>('bank');
  const [paymentReference, setPaymentReference] = useState('');
  const [payableMessage, setPayableMessage] = useState('');
  const [showPayableToast, setShowPayableToast] = useState(false);
  const paySupplierSectionRef = useRef<HTMLElement | null>(null);
  const arrivalParams = new URLSearchParams(location.search);
  const arrivalSegment = arrivalParams.get('segment');
  const arrivalAction = arrivalParams.get('action');

  const metrics = useMemo(() => selectDashboardMetrics(state), [state]);
  const currency = state.businessProfile.currency;
  const canViewExpenses = hasPermission('expenses.view');
  const canCreateExpenses = hasPermission('expenses.create');
  const canUseExpensesSegment = canViewExpenses || canCreateExpenses;
  const canViewPayables = hasPermission('payables.view') || hasPermission('payables.manage') || hasPermission('payables.pay');
  const canManagePayables = hasPermission('payables.manage') || hasPermission('payables.approve');
  const canPayPayables = hasPermission('payables.pay');
  const canUsePayablesSegment = canViewPayables || canManagePayables || canPayPayables;

  useEffect(() => {
    if (activeSegment === 'expenses' && !canUseExpensesSegment) {
      setActiveSegment('overview');
    }
    if (activeSegment === 'payables' && !canUsePayablesSegment) {
      setActiveSegment('overview');
    }
  }, [activeSegment, canUseExpensesSegment, canUsePayablesSegment]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const segment = params.get('segment');
    const action = params.get('action');

    if (segment === 'payables' && canUsePayablesSegment) {
      setActiveSegment('payables');
    }

    if (segment === 'payables' && action === 'payment' && paySupplierSectionRef.current) {
      window.requestAnimationFrame(() => {
        paySupplierSectionRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    }
  }, [location.search, canUsePayablesSegment]);

  const totalExpenses = useMemo(() => 
    state.expenses.reduce((sum, exp) => sum + exp.amount, 0),
  [state.expenses]);

  const receivables = metrics.receivables;
  const cashInFlow = metrics.cashInHand + metrics.mobileMoneyReceived;
  const payableViews = useMemo(
    () => state.accountsPayable.map((payable) => ({
      payable,
      vendorName: state.vendors.find((vendor) => vendor.id === payable.vendorId)?.name ?? payable.vendorCode,
      purchaseCode: state.purchases.find((purchase) => purchase.id === payable.purchaseId)?.purchaseCode ?? 'Unknown purchase',
    })),
    [state.accountsPayable, state.purchases, state.vendors]
  );
  const selectedPayable = useMemo(
    () => state.accountsPayable.find((payable) => payable.id === selectedPayableId) ?? state.accountsPayable[0] ?? null,
    [selectedPayableId, state.accountsPayable]
  );
  const pendingReviewPayables = state.accountsPayable.filter((payable) => payable.status === 'pendingReview').length;
  const unpaidPayables = state.accountsPayable.filter((payable) => !['paid', 'cancelled'].includes(payable.status));
  const openPayablesBalance = unpaidPayables.reduce((sum, payable) => sum + payable.balance, 0);

  useEffect(() => {
    if (!selectedPayableId && state.accountsPayable.length > 0) {
      setSelectedPayableId(state.accountsPayable[0].id);
      return;
    }

    if (selectedPayableId && !state.accountsPayable.some((payable) => payable.id === selectedPayableId)) {
      setSelectedPayableId(state.accountsPayable[0]?.id ?? '');
    }
  }, [selectedPayableId, state.accountsPayable]);

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

  const handleApprovePayable = async (payableId: string) => {
    const result = await approvePayable({
      payableId,
      approvedBy: currentUser.userId,
    });

    if (!result.ok) {
      setPayableMessage(result.message);
      return;
    }

    setPayableMessage('');
    setShowPayableToast(true);
  };

  const handleRecordPayablePayment = async () => {
    const amount = Number(paymentAmountInput);
    if (!selectedPayable || !Number.isFinite(amount)) {
      setPayableMessage('Choose a payable and enter a valid payment amount.');
      return;
    }

    const result = await recordPayablePayment({
      payableId: selectedPayable.id,
      amount,
      method: paymentMethod,
      reference: paymentReference,
      paidBy: currentUser.userId,
    });

    if (!result.ok) {
      setPayableMessage(result.message);
      return;
    }

    setPaymentAmountInput('');
    setPaymentReference('');
    setPayableMessage('');
    setShowPayableToast(true);
  };

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Accounting</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSegment value={activeSegment} onIonChange={(e) => setActiveSegment(e.detail.value as 'overview' | 'expenses' | 'payables')}>
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
            {canUsePayablesSegment ? (
              <IonSegmentButton value="payables">
                <IonIcon icon={cashOutline} />
                <IonLabel>Payables</IonLabel>
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

              {(canViewPayables || canManagePayables || canPayPayables) ? (
                <SectionCard title="ERP finance" subtitle="Make supplier obligations and settlements visible without hunting through menus.">
                  <div className="stats-row">
                    <div className="app-card stat-pill">
                      <p className="muted-label">Accounts Payable</p>
                      <h2>{unpaidPayables.length}</h2>
                      <p>{unpaidPayables.length > 0 ? 'Open supplier bills' : 'No unpaid supplier bills'}</p>
                    </div>
                    <div className="app-card stat-pill">
                      <p className="muted-label">Payments / Settlements</p>
                      <h2>{formatCurrency(openPayablesBalance, currency)}</h2>
                      <p>{canPayPayables ? 'Pay Supplier tools available' : 'Settlement actions restricted'}</p>
                    </div>
                  </div>
                  <div className="list-block" style={{ marginTop: '12px' }}>
                    <div className="list-row">
                      <div>
                        <strong>Vendor → Purchase → Approval → Payable → Warehouse Receipt → Store Transfer → Sale</strong>
                        <p>Payables and supplier settlements now sit alongside the rest of the operating cycle.</p>
                      </div>
                    </div>
                  </div>
                </SectionCard>
              ) : null}

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

          {activeSegment === 'payables' && (
            <>
              <SectionCard title="Accounts Payable Workflow" subtitle="Approved purchases become supplier bills, then move through approval and settlement.">
                <div className="list-block">
                  <div className="list-row">
                    <div>
                      <strong>Vendor → Purchase → Approval → Payable → Warehouse Receipt → Store Transfer → Sale</strong>
                      <p>Payables track what the business owes suppliers while warehouse receipts and transfers keep inventory aligned.</p>
                    </div>
                  </div>
                </div>
                <div className="stats-row" style={{ marginTop: '12px' }}>
                  <div className="app-card stat-pill">
                    <p className="muted-label">Open payables</p>
                    <h2>{unpaidPayables.length}</h2>
                  </div>
                  <div className="app-card stat-pill">
                    <p className="muted-label">Payables balance</p>
                    <h2 className={openPayablesBalance > 0 ? 'warning-text' : 'success-text'}>{formatCurrency(openPayablesBalance, currency)}</h2>
                  </div>
                  <div className="app-card stat-pill">
                    <p className="muted-label">Pending review</p>
                    <h2>{pendingReviewPayables}</h2>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Accounts Payable"
                subtitle="Track vendor obligations from approved purchases through settlement."
                highlighted={arrivalSegment === 'payables'}
                highlightLabel={arrivalSegment === 'payables' ? "You're managing Accounts Payable" : undefined}
                dataTestId="arrival-payables"
              >
                {!canViewPayables ? (
                  <EmptyState
                    eyebrow="View access disabled"
                    title="This role cannot view payables."
                    message="Ask an admin to grant payable access if this user should monitor procurement liabilities."
                  />
                ) : payableViews.length === 0 ? (
                  <EmptyState
                    eyebrow="No payables"
                    title="No unpaid supplier bills."
                    message="Once procurement is approved, the supplier balance and settlement trail will appear in this section."
                    actionLabel="Open Procurement"
                    onAction={() => history.push('/inventory?section=procurement')}
                  />
                ) : (
                  <div className="list-block">
                    {payableViews.map(({ payable, vendorName, purchaseCode }) => (
                      <div className="list-row" key={payable.id}>
                        <div>
                          <strong>{payable.payableCode}</strong>
                          <p>{vendorName} • {payable.vendorCode}</p>
                          <p>{purchaseCode}</p>
                          <p className="muted-label">{formatReceiptDate(payable.createdAt)}</p>
                          {canManagePayables && payable.status === 'pendingReview' ? (
                            <div className="button-group" style={{ marginTop: '8px' }}>
                              <IonButton size="small" onClick={() => handleApprovePayable(payable.id)}>
                                Approve
                              </IonButton>
                            </div>
                          ) : null}
                        </div>
                        <div className="right-meta">
                          <IonBadge color={payable.status === 'paid' ? 'success' : payable.status === 'partiallyPaid' ? 'warning' : payable.status === 'cancelled' ? 'medium' : 'primary'}>
                            {payable.status}
                          </IonBadge>
                          <strong>{formatCurrency(payable.balance, currency)}</strong>
                          <p>Due {formatCurrency(payable.amountDue, currency)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {canPayPayables ? (
                <section ref={paySupplierSectionRef}>
                  <SectionCard
                    title="Pay Supplier"
                    subtitle="Capture partial or full supplier settlements with method and reference."
                    highlighted={arrivalSegment === 'payables' && arrivalAction === 'payment'}
                    highlightLabel={arrivalSegment === 'payables' && arrivalAction === 'payment' ? 'Pay Supplier' : undefined}
                    dataTestId="arrival-pay-supplier"
                  >
                  {selectedPayable ? (
                    <div className="form-grid">
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Payable</IonLabel>
                        <IonSelect value={selectedPayable.id} interface="popover" onIonChange={(event) => setSelectedPayableId(event.detail.value)}>
                          {payableViews.map(({ payable, vendorName }) => (
                            <IonSelectOption key={payable.id} value={payable.id}>
                              {payable.payableCode} - {vendorName}
                            </IonSelectOption>
                          ))}
                        </IonSelect>
                      </IonItem>
                      <div className="stats-row">
                        <div className="app-card stat-pill">
                          <p className="muted-label">Amount Due</p>
                          <h2>{formatCurrency(selectedPayable.amountDue, currency)}</h2>
                        </div>
                        <div className="app-card stat-pill">
                          <p className="muted-label">Balance</p>
                          <h2 className={selectedPayable.balance > 0 ? 'warning-text' : 'success-text'}>{formatCurrency(selectedPayable.balance, currency)}</h2>
                        </div>
                      </div>
                      <div className="dual-stat">
                        <IonItem lines="none" className="app-item">
                          <IonLabel position="stacked">Payment amount ({currency})</IonLabel>
                          <IonInput type="number" value={paymentAmountInput} onIonInput={(event) => setPaymentAmountInput(event.detail.value ?? '')} />
                        </IonItem>
                        <IonItem lines="none" className="app-item">
                          <IonLabel position="stacked">Method</IonLabel>
                          <IonSelect value={paymentMethod} interface="popover" onIonChange={(event) => setPaymentMethod(event.detail.value)}>
                            <IonSelectOption value="cash">Cash</IonSelectOption>
                            <IonSelectOption value="bank">Bank</IonSelectOption>
                            <IonSelectOption value="mobileMoney">Mobile Money</IonSelectOption>
                            <IonSelectOption value="creditCard">Credit Card</IonSelectOption>
                          </IonSelect>
                        </IonItem>
                      </div>
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Payment reference</IonLabel>
                        <IonInput value={paymentReference} placeholder="Optional bank slip, MoMo ID, or cheque reference" onIonInput={(event) => setPaymentReference(event.detail.value ?? '')} />
                      </IonItem>
                      {payableMessage ? <p className="form-message danger-text">{payableMessage}</p> : null}
                      <IonButton expand="block" onClick={handleRecordPayablePayment}>
                        Record Payment
                      </IonButton>
                    </div>
                  ) : (
                    <EmptyState
                      eyebrow="No payable selected"
                      title="Create or approve a payable first."
                      message="Supplier payment recording becomes available as soon as there is an approved payable to settle."
                    />
                  )}
                  </SectionCard>
                </section>
              ) : null}
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
        <IonToast
          isOpen={showPayableToast}
          onDidDismiss={() => setShowPayableToast(false)}
          message="Payable updated successfully."
          duration={2000}
          color="success"
        />
      </IonContent>
    </IonPage>
  );
};

export default AccountingPage;
