import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonPage,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonTextarea,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import { addOutline, closeOutline, createOutline, logoWhatsapp, powerOutline, refreshOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';

import EmptyState from '../components/EmptyState';
import PhoneInputField from '../components/PhoneInputField';
import SectionCard from '../components/SectionCard';
import { useBusiness } from '../context/BusinessContext';
import { BusinessEmailConfig, loadBusinessEmailConfig } from '../lib/businessEmailConfigClient';
import { sendEmail } from '../lib/emailClient';
import {
  selectCustomerBalance,
  selectCustomerLastPaymentLabel,
  selectCustomerLedgerEntries,
  selectCustomerStatement,
  selectCustomerSummaries,
  selectLedgerEntryDisplay,
  selectProductById,
  selectSaleBalanceRemaining,
  selectSaleStatusDisplay,
} from '../selectors/businessSelectors';
import { formatCurrency, formatReceiptDate } from '../utils/format';

const resolveCustomerContactNumber = (customer?: { phone?: string; whatsapp?: string } | null) =>
  customer?.whatsapp?.trim() || customer?.phone?.trim() || '';

const getCustomerStatusBadgeColor = (status: 'active' | 'terminated') => (status === 'terminated' ? 'medium' : 'success');

const CustomersPage: React.FC = () => {
  const { state, currentUser, addCustomer, updateCustomer, updateCustomerStatus, hasPermission } = useBusiness();

  const [selectedCustomerId, setSelectedCustomerId] = useState(state.customers[0]?.id ?? '');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'active' | 'terminated' | 'all'>('active');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [savedCustomerName, setSavedCustomerName] = useState('');

  const [addName, setAddName] = useState('');
  const [addClientId, setAddClientId] = useState('');
  const [addContactNumber, setAddContactNumber] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addMessage, setAddMessage] = useState('');
  const [isAddContactNumberValid, setIsAddContactNumberValid] = useState(true);

  const [editName, setEditName] = useState('');
  const [editContactNumber, setEditContactNumber] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [isEditContactNumberValid, setIsEditContactNumberValid] = useState(true);
  const [terminationReason, setTerminationReason] = useState('');
  const [terminationMessage, setTerminationMessage] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailRecipientName, setEmailRecipientName] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSendMessage, setEmailSendMessage] = useState('');
  const [showEmailToast, setShowEmailToast] = useState(false);
  const [businessEmailConfig, setBusinessEmailConfig] = useState<BusinessEmailConfig | null>(null);
  const [isBusinessEmailConfigLoading, setIsBusinessEmailConfigLoading] = useState(false);
  const [businessEmailConfigMessage, setBusinessEmailConfigMessage] = useState('');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppRecipientNumber, setWhatsAppRecipientNumber] = useState('');
  const [whatsAppRecipientName, setWhatsAppRecipientName] = useState('');
  const [whatsAppMessage, setWhatsAppMessage] = useState('');

  const currency = state.businessProfile.currency;
  const canSendCustomerEmail = hasPermission('customers.email.send');
  const canViewCustomerLedger = hasPermission('customers.ledger.view');
  const assignedSenderName = currentUser.customerEmailSenderName?.trim() || businessEmailConfig?.fromName || state.businessProfile.businessName || 'BisaPilot';
  const assignedSenderEmail = currentUser.customerEmailSenderEmail?.trim() || businessEmailConfig?.fromEmail || state.businessProfile.email || '';

  const customerSummaries = useMemo(() => {
    const all = selectCustomerSummaries(state);
    const filteredByStatus = all.filter(({ customer }) =>
      customerFilter === 'all'
        ? true
        : customerFilter === 'terminated'
          ? customer.status === 'terminated'
          : customer.status !== 'terminated'
    );

    if (!searchTerm.trim()) {
      return filteredByStatus;
    }

    const lower = searchTerm.toLowerCase();
    return filteredByStatus.filter(({ customer }) =>
      customer.name.toLowerCase().includes(lower) ||
      customer.clientId.toLowerCase().includes(lower) ||
      (customer.email && customer.email.toLowerCase().includes(lower)) ||
      resolveCustomerContactNumber(customer).toLowerCase().includes(lower)
    );
  }, [customerFilter, searchTerm, state]);

  useEffect(() => {
    if (!selectedCustomerId) {
      return;
    }

    if (!customerSummaries.some(({ customer }) => customer.id === selectedCustomerId)) {
      setSelectedCustomerId(customerSummaries[0]?.customer.id ?? '');
    }
  }, [customerSummaries, selectedCustomerId]);

  const selectedCustomer = useMemo(
    () => state.customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [selectedCustomerId, state.customers]
  );

  const selectedCustomerSales = useMemo(() => {
    if (!selectedCustomer) {
      return [];
    }

    return state.sales
      .filter((sale) => sale.customerId === selectedCustomer.id)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [selectedCustomer, state.sales]);

  const selectedCustomerLedger = useMemo(() => {
    if (!selectedCustomer) {
      return [];
    }

    return selectCustomerLedgerEntries(state, selectedCustomer.id);
  }, [selectedCustomer, state]);

  const selectedCustomerStatement = useMemo(() => {
    if (!selectedCustomer) {
      return null;
    }

    return selectCustomerStatement(state, selectedCustomer.id);
  }, [selectedCustomer, state]);

  useEffect(() => {
    setEditName(selectedCustomer?.name ?? '');
    setEditContactNumber(resolveCustomerContactNumber(selectedCustomer));
    setEditEmail(selectedCustomer?.email ?? '');
    setEditMessage('');
  }, [selectedCustomer]);

  useEffect(() => {
    const businessId = state.businessProfile.id?.trim();

    if (!businessId) {
      setBusinessEmailConfig(null);
      setBusinessEmailConfigMessage('');
      return;
    }

    let cancelled = false;
    setIsBusinessEmailConfigLoading(true);

    loadBusinessEmailConfig(businessId)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setBusinessEmailConfig(result.config);
        setBusinessEmailConfigMessage('');
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setBusinessEmailConfig(null);
        setBusinessEmailConfigMessage(error instanceof Error ? error.message : 'Business email system could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsBusinessEmailConfigLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [state.businessProfile.id]);

  const resetAddForm = () => {
    setAddName('');
    setAddClientId('');
    setAddContactNumber('');
    setAddEmail('');
    setAddMessage('');
    setIsAddContactNumberValid(true);
  };

  const openAddModal = () => {
    resetAddForm();
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setAddMessage('');
  };

  const openEditModal = (customerId: string) => {
    const customer = state.customers.find((item) => item.id === customerId);

    if (!customer) {
      return;
    }

    setSelectedCustomerId(customer.id);
    setEditName(customer.name);
    setEditContactNumber(resolveCustomerContactNumber(customer));
    setEditEmail(customer.email ?? '');
    setEditMessage('');
    setIsEditContactNumberValid(true);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditMessage('');
  };

  const closeTerminateModal = () => {
    setShowTerminateModal(false);
    setTerminationReason('');
    setTerminationMessage('');
  };

  const buildCustomerChannel = (contactNumber: string, fallback?: string) => {
    if (fallback?.trim()) {
      return fallback;
    }

    return contactNumber.trim() ? 'WhatsApp follow-up' : 'No action needed';
  };

  const handleAddCustomer = () => {
    const customerName = addName.trim();
    const contactNumber = addContactNumber.trim();

    if (!customerName) {
      setAddMessage('Enter a customer name before saving.');
      return;
    }

    if (!isAddContactNumberValid) {
      setAddMessage('The WhatsApp / follow-up number entered has an invalid length for the selected country. Please correct it.');
      return;
    }

    const result = addCustomer({
      name: customerName,
      clientId: addClientId,
      phone: contactNumber,
      whatsapp: contactNumber,
      email: addEmail.trim(),
      channel: buildCustomerChannel(contactNumber),
    });

    if (!result.ok) {
      setAddMessage(result.message);
      return;
    }

    setSavedCustomerName(customerName);
    setShowSuccessToast(true);
    closeAddModal();
  };

  const handleUpdateCustomer = () => {
    if (!selectedCustomer) {
      setEditMessage('Choose a customer before updating details.');
      return;
    }

    const customerName = editName.trim();
    const contactNumber = editContactNumber.trim();

    if (!customerName) {
      setEditMessage('Enter a customer name before saving changes.');
      return;
    }

    if (!isEditContactNumberValid) {
      setEditMessage('The WhatsApp / follow-up number entered has an invalid length for the selected country. Please correct it.');
      return;
    }

    const result = updateCustomer({
      customerId: selectedCustomer.id,
      name: customerName,
      phone: contactNumber,
      whatsapp: contactNumber,
      email: editEmail.trim(),
      channel: buildCustomerChannel(contactNumber, selectedCustomer.channel),
    });

    if (!result.ok) {
      setEditMessage(result.message);
      return;
    }

    setSavedCustomerName(customerName);
    setShowSuccessToast(true);
    closeEditModal();
  };

  const handleWhatsAppFollowUp = () => {
    if (!selectedCustomer) {
      return;
    }

    const contactNumber = resolveCustomerContactNumber(selectedCustomer);
    if (!contactNumber) {
      return;
    }

    const balance = selectCustomerBalance(state, selectedCustomer.id);
    const businessName = state.businessProfile.businessName;
    const cleanPhone = contactNumber.replace(/\D/g, '');

    const message = `Hello ${selectedCustomer.name}, this is ${businessName}. Just sending a friendly reminder regarding your outstanding balance of ${formatCurrency(balance, currency)}. Thank you!`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const openCustomerWhatsApp = (contactNumber: string) => {
    const normalizedNumber = contactNumber.trim();
    if (!normalizedNumber) {
      return;
    }

    const customerName = selectedCustomer && resolveCustomerContactNumber(selectedCustomer) === normalizedNumber
      ? selectedCustomer.name
      : state.customers.find((customer) => resolveCustomerContactNumber(customer) === normalizedNumber)?.name ?? 'Customer';
    const businessName = state.businessProfile.businessName || 'BisaPilot';
    const defaultMessage = [
      `Hello ${customerName},`,
      '',
      '',
      `Kind regards,`,
      businessName,
    ].join('\n');

    setWhatsAppRecipientNumber(normalizedNumber);
    setWhatsAppRecipientName(customerName);
    setWhatsAppMessage(defaultMessage);
    setShowWhatsAppModal(true);
  };

  const openCustomerEmail = (email: string) => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      return;
    }

    const customerName = selectedCustomer?.email === normalizedEmail
      ? selectedCustomer.name
      : state.customers.find((customer) => customer.email?.trim() === normalizedEmail)?.name ?? 'Customer';
    const businessName = state.businessProfile.businessName || 'BisaPilot';
    const defaultSubject = `${businessName} update for ${customerName}`;
    const defaultBody = [
      `Hello ${customerName},`,
      '',
      '',
      'Kind regards,',
      businessName,
    ].join('\n');

    setEmailRecipient(normalizedEmail);
    setEmailRecipientName(customerName);
    setEmailSubject(defaultSubject);
    setEmailBody(defaultBody);
    setEmailSendMessage('');
    setShowEmailModal(true);
  };

  const handleSendEmail = async () => {
    if (!state.businessProfile.id) {
      setEmailSendMessage('This workspace is missing its business identity. Reload Settings and try again.');
      return;
    }

    if (!businessEmailConfig) {
      setEmailSendMessage('This business email system has not been configured yet. Ask an owner or admin to set it up in Settings.');
      return;
    }

    if (!emailRecipient.trim()) {
      setEmailSendMessage('Recipient email is required.');
      return;
    }

    if (!emailSubject.trim()) {
      setEmailSendMessage('Subject is required.');
      return;
    }

    if (!emailBody.trim()) {
      setEmailSendMessage('Message body is required.');
      return;
    }

    try {
      setIsSendingEmail(true);
      setEmailSendMessage('');
      await sendEmail({
        businessId: state.businessProfile.id,
        recipient: emailRecipient.trim(),
        subject: emailSubject.trim(),
        message: emailBody.trim(),
        businessName: state.businessProfile.businessName,
        logoUrl: state.businessProfile.logoUrl,
        fromName: currentUser.customerEmailSenderName?.trim() || undefined,
        fromEmail: currentUser.customerEmailSenderEmail?.trim() || undefined,
      });
      setShowEmailToast(true);
      closeEmailModal();
    } catch (error) {
      setEmailSendMessage(error instanceof Error ? error.message : 'Email could not be sent.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const closeEmailModal = () => {
    setShowEmailModal(false);
    setEmailRecipient('');
    setEmailRecipientName('');
    setEmailSubject('');
    setEmailBody('');
    setEmailSendMessage('');
  };

  const handleOpenInWhatsApp = () => {
    const cleanPhone = whatsAppRecipientNumber.replace(/\D/g, '');
    if (!cleanPhone) {
      return;
    }

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsAppMessage)}`, '_blank');
  };

  const closeWhatsAppModal = () => {
    setShowWhatsAppModal(false);
    setWhatsAppRecipientNumber('');
    setWhatsAppRecipientName('');
    setWhatsAppMessage('');
  };

  const handleOpenTerminateModal = () => {
    if (!selectedCustomer) {
      return;
    }

    setTerminationReason(selectedCustomer.terminationReason ?? '');
    setTerminationMessage('');
    setShowTerminateModal(true);
  };

  const handleTerminateCustomer = () => {
    if (!selectedCustomer) {
      setTerminationMessage('Choose a customer before terminating the account.');
      return;
    }

    const result = updateCustomerStatus({
      customerId: selectedCustomer.id,
      status: 'terminated',
      terminationReason,
    });

    if (!result.ok) {
      setTerminationMessage(result.message);
      return;
    }

    setSavedCustomerName(selectedCustomer.name);
    setShowSuccessToast(true);
    closeTerminateModal();
  };

  const handleReactivateCustomer = () => {
    if (!selectedCustomer) {
      return;
    }

    const result = updateCustomerStatus({
      customerId: selectedCustomer.id,
      status: 'active',
    });

    if (!result.ok) {
      setTerminationMessage(result.message);
      return;
    }

    setSavedCustomerName(selectedCustomer.name);
    setShowSuccessToast(true);
  };

  const toggleSelectedCustomer = (customerId: string) => {
    setSelectedCustomerId((current) => (current === customerId ? '' : customerId));
  };

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Customers</IonTitle>
          {hasPermission('customers.create') ? (
            <IonButtons slot="end" className="toolbar-action-group">
              <IonButton onClick={openAddModal} className="toolbar-action-button" aria-label="Add Customer">
                <IonIcon slot="start" icon={addOutline} />
                <span className="toolbar-action-label">Add Customer</span>
              </IonButton>
            </IonButtons>
          ) : null}
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen={true}>
        <div className="page-shell">
          <SectionCard
            title="Customer Directory"
            subtitle="Keep the main view lean. Select a customer to reveal private details, balances, and history."
          >
            <div style={{ display: 'grid', gap: '12px' }}>
              <IonSearchbar
                placeholder="Search by customer name, client ID, email, or saved contact number..."
                value={searchTerm}
                onIonInput={(event) => setSearchTerm(event.detail.value ?? '')}
              />

              <IonSegment value={customerFilter} onIonChange={(event) => setCustomerFilter(event.detail.value as 'active' | 'terminated' | 'all')}>
                <IonSegmentButton value="active">Active</IonSegmentButton>
                <IonSegmentButton value="terminated">Terminated</IonSegmentButton>
                <IonSegmentButton value="all">All</IonSegmentButton>
              </IonSegment>

              {customerSummaries.length === 0 ? (
                <EmptyState
                  eyebrow={customerFilter === 'terminated' ? 'No terminated accounts' : 'No customers yet'}
                  title={customerFilter === 'terminated' ? 'No terminated customers in this view' : 'Your customer list will appear here'}
                  message={
                    customerFilter === 'terminated'
                      ? 'Terminated customer accounts stay preserved here for audit and history review.'
                      : 'Add a customer to start tracking invoices, balances, and follow-up reminders without exposing full details in the main view.'
                  }
                />
              ) : (
                <div className="list-block">
                  {customerSummaries.map(({ customer, balance, accountStatus }) => (
                    <div key={customer.id} className="customer-list-entry">
                      <div
                        className={`list-row customer-list-row${selectedCustomerId === customer.id ? ' is-selected' : ''}`}
                        onClick={() => toggleSelectedCustomer(customer.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            toggleSelectedCustomer(customer.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div>
                          <strong>{customer.name}</strong>
                          <p className="code-label">{customer.clientId}</p>
                          <IonBadge color={getCustomerStatusBadgeColor(customer.status)}>{customer.status === 'terminated' ? 'Terminated' : 'Active'}</IonBadge>
                          <p>{selectedCustomerId === customer.id ? 'Private details and history opened below' : 'Tap to open private details'}</p>
                        </div>

                        <div className="right-meta">
                          <strong className={customer.status === 'terminated' ? 'warning-text' : accountStatus.tone === 'success' ? 'success-text' : 'warning-text'}>
                            {customer.status === 'terminated' ? 'Terminated' : accountStatus.label}
                          </strong>
                          <p>{balance === 0 ? accountStatus.helper : `${formatCurrency(balance, currency)} due`}</p>
                          {hasPermission('customers.edit') ? (
                            <IonButton
                              fill="clear"
                              size="small"
                              aria-label={`Edit ${customer.name}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditModal(customer.id);
                              }}
                            >
                              <IonIcon slot="icon-only" icon={createOutline} />
                            </IonButton>
                          ) : null}
                        </div>
                      </div>

                      {selectedCustomerId === customer.id ? (
                        <div className="customer-inline-panel">
                          <div className="customer-inline-grid">
                            <div className="customer-inline-card">
                              <p className="muted-label">Private details</p>
                              {resolveCustomerContactNumber(customer) ? (
                                <p>
                                  WhatsApp / follow-up:{' '}
                                  <button
                                    type="button"
                                    className="inline-contact-button"
                                    onClick={() => openCustomerWhatsApp(resolveCustomerContactNumber(customer))}
                                  >
                                    {resolveCustomerContactNumber(customer)}
                                  </button>
                                </p>
                              ) : (
                                <p>No WhatsApp / follow-up number saved.</p>
                              )}
                              {customer.email ? (
                                <p>
                                  Email:{' '}
                                  <button
                                    type="button"
                                    className="inline-contact-button"
                                    disabled={!canSendCustomerEmail}
                                    onClick={() => openCustomerEmail(customer.email ?? '')}
                                  >
                                    {customer.email}
                                  </button>
                                </p>
                              ) : <p>No email saved.</p>}
                              <p>Last payment: {selectCustomerLastPaymentLabel(state, customer.id)}</p>
                            </div>

                            <div className="customer-inline-card">
                              <p className="muted-label">Account snapshot</p>
                              <p><strong>{balance === 0 ? 'Paid' : `${formatCurrency(balance, currency)} due`}</strong></p>
                              <p>{customer.status === 'terminated' ? 'Account is terminated for new activity.' : accountStatus.helper}</p>
                              {customer.status === 'terminated' && customer.terminationReason ? (
                                <p>Reason: {customer.terminationReason}</p>
                              ) : null}
                            </div>
                          </div>

                          <div className="customer-inline-history">
                            <p className="muted-label">Recent transaction history</p>
                            {!canViewCustomerLedger ? (
                              <p>This role cannot open customer transaction history.</p>
                            ) : state.sales.filter((sale) => sale.customerId === customer.id).length === 0 ? (
                              <p>No transactions recorded yet for this customer.</p>
                            ) : (
                              state.sales
                                .filter((sale) => sale.customerId === customer.id)
                                .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
                                .slice(0, 3)
                                .map((sale) => {
                                  const invoiceStatus = selectSaleStatusDisplay(sale);
                                  return (
                                    <div className="customer-inline-history-row" key={sale.id}>
                                      <div>
                                        <strong>{sale.invoiceNumber}</strong>
                                        <p>{formatReceiptDate(sale.createdAt)}</p>
                                      </div>
                                      <div className="right-meta">
                                        <strong>{formatCurrency(sale.totalAmount, currency)}</strong>
                                        <p>{invoiceStatus.label}</p>
                                      </div>
                                    </div>
                                  );
                                })
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          {selectedCustomer ? (
            <>
              <SectionCard
                title="Selected Customer"
                subtitle="Private contact details and account activity are shown only after a customer is selected."
              >
                <div className="list-block">
                  <div className="list-row">
                    <div>
                      <strong>{selectedCustomer.name}</strong>
                      <p className="code-label">{selectedCustomer.clientId}</p>
                      <IonBadge color={getCustomerStatusBadgeColor(selectedCustomer.status)}>
                        {selectedCustomer.status === 'terminated' ? 'Terminated account' : 'Active account'}
                      </IonBadge>
                      {resolveCustomerContactNumber(selectedCustomer) ? (
                        <p>
                          WhatsApp / follow-up number:{' '}
                          <button
                            type="button"
                            className="inline-contact-button"
                            onClick={() => openCustomerWhatsApp(resolveCustomerContactNumber(selectedCustomer))}
                          >
                            {resolveCustomerContactNumber(selectedCustomer)}
                          </button>
                        </p>
                      ) : (
                        <p>No WhatsApp / follow-up number saved yet.</p>
                      )}
                      {selectedCustomer.email ? (
                        <p>
                          Email:{' '}
                          <button
                            type="button"
                            className="inline-contact-button"
                            disabled={!canSendCustomerEmail}
                            onClick={() => openCustomerEmail(selectedCustomer.email ?? '')}
                          >
                            {selectedCustomer.email}
                          </button>
                        </p>
                      ) : <p>No email saved yet.</p>}
                      {selectedCustomer.status === 'terminated' && selectedCustomer.terminatedAt ? (
                        <p>Terminated on: {formatReceiptDate(selectedCustomer.terminatedAt)}</p>
                      ) : null}
                      {selectedCustomer.status === 'terminated' && selectedCustomer.terminationReason ? (
                        <p>Reason: {selectedCustomer.terminationReason}</p>
                      ) : null}
                      <p>Last payment: {selectCustomerLastPaymentLabel(state, selectedCustomer.id)}</p>
                    </div>

                    <div className="right-meta">
                      <strong className={selectCustomerBalance(state, selectedCustomer.id) === 0 ? 'success-text' : 'danger-text'}>
                        {selectCustomerBalance(state, selectedCustomer.id) === 0
                          ? 'Paid'
                          : `${formatCurrency(selectCustomerBalance(state, selectedCustomer.id), currency)} due`}
                      </strong>
                      <p>Current balance</p>
                      {resolveCustomerContactNumber(selectedCustomer) && selectCustomerBalance(state, selectedCustomer.id) > 0 ? (
                        <IonButton fill="outline" size="small" color="success" onClick={handleWhatsAppFollowUp}>
                          <IonIcon slot="start" icon={logoWhatsapp} />
                          WhatsApp
                        </IonButton>
                      ) : null}
                      {hasPermission('customers.edit') ? (
                        selectedCustomer.status === 'terminated' ? (
                          <IonButton fill="outline" size="small" color="success" onClick={handleReactivateCustomer}>
                            <IonIcon slot="start" icon={refreshOutline} />
                            Reactivate
                          </IonButton>
                        ) : (
                          <IonButton fill="outline" size="small" color="danger" onClick={handleOpenTerminateModal}>
                            <IonIcon slot="start" icon={powerOutline} />
                            Terminate Account
                          </IonButton>
                        )
                      ) : null}
                    </div>
                  </div>
                </div>
              </SectionCard>

              {canViewCustomerLedger ? (
                <>
                  <SectionCard
                    title="Customer Invoice History"
                    subtitle="Invoice activity appears only for the customer you have selected."
                  >
                    <div className="list-block">
                      {selectedCustomerSales.length === 0 ? (
                        <EmptyState
                          eyebrow="No transactions yet"
                          title="No transactions recorded yet for this customer."
                          message="Once a sale is recorded for this customer, the invoice history will appear here with payment and balance details."
                        />
                      ) : (
                        selectedCustomerSales.map((sale) => {
                          const product = selectProductById(state, sale.productId);
                          const invoiceStatus = selectSaleStatusDisplay(sale);
                          const balanceRemaining = selectSaleBalanceRemaining(sale);

                          return (
                            <div className="list-row" key={sale.id}>
                              <div>
                                <strong>{product?.name ?? 'Recorded item'}</strong>
                                <p className="code-label">{sale.invoiceNumber} • {sale.receiptId}</p>
                                <p>
                                  {sale.quantity} units • {sale.paymentMethod} • {invoiceStatus.label}
                                </p>
                                <p>Recorded: {formatReceiptDate(sale.createdAt)}</p>
                                {sale.status === 'Reversed' && sale.reversalReason ? <p>Reason: {sale.reversalReason}</p> : null}
                              </div>

                              <div className="right-meta">
                                <strong
                                  className={
                                    invoiceStatus.tone === 'success'
                                      ? 'success-text'
                                      : invoiceStatus.tone === 'warning'
                                        ? 'warning-text'
                                        : 'danger-text'
                                  }
                                >
                                  {invoiceStatus.label}
                                </strong>
                                <p>Total: {formatCurrency(sale.totalAmount, currency)}</p>
                                <p>
                                  {invoiceStatus.label === 'Reversed'
                                    ? 'No longer active'
                                    : balanceRemaining > 0
                                      ? `${formatCurrency(balanceRemaining, currency)} left`
                                      : 'Paid in full'}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Customer Statement"
                    subtitle="Receivables and ledger movement stay scoped to the selected customer."
                  >
                    <div className="list-block">
                      {selectedCustomerStatement ? (
                        <>
                          <div className="dual-stat">
                            <div>
                              <p className="muted-label">Opening balance</p>
                              <h3>{formatCurrency(selectedCustomerStatement.openingBalance, currency)}</h3>
                            </div>
                            <div>
                              <p className="muted-label">Closing balance</p>
                              <h3>{formatCurrency(selectedCustomerStatement.closingBalance, currency)}</h3>
                            </div>
                          </div>

                          <div className="triple-grid">
                            <div className="mini-stat">
                              <p className="muted-label">Invoices</p>
                              <h3>{formatCurrency(selectedCustomerStatement.invoiceCharges, currency)}</h3>
                            </div>
                            <div className="mini-stat">
                              <p className="muted-label">Payments</p>
                              <h3>{formatCurrency(selectedCustomerStatement.paymentsReceived, currency)}</h3>
                            </div>
                            <div className="mini-stat">
                              <p className="muted-label">Reversals</p>
                              <h3>{formatCurrency(selectedCustomerStatement.reversals, currency)}</h3>
                            </div>
                          </div>
                        </>
                      ) : null}

                      {selectedCustomerLedger.length === 0 ? (
                        <EmptyState
                          eyebrow="No ledger entries"
                          title="No receivables activity recorded yet."
                          message="Ledger entries appear automatically whenever an invoice is raised, money is received, or an invoice is reversed."
                        />
                      ) : (
                        selectedCustomerLedger.map((entry) => {
                          const entryDisplay = selectLedgerEntryDisplay(entry);
                          const relatedSale = entry.relatedSaleId
                            ? state.sales.find((sale) => sale.id === entry.relatedSaleId)
                            : null;
                          const relatedProduct = relatedSale ? selectProductById(state, relatedSale.productId) : null;

                          return (
                            <div className="list-row" key={entry.id}>
                              <div>
                                <strong>{entryDisplay.label}</strong>
                                <p className="code-label">
                                  {entry.entryNumber}
                                  {entry.referenceNumber ? ` • ${entry.referenceNumber}` : ''}
                                </p>
                                <p>{entryDisplay.helper}</p>
                                {relatedProduct ? <p>Item: {relatedProduct.name}</p> : null}
                                <p>{formatReceiptDate(entry.createdAt)}</p>
                              </div>

                              <div className="right-meta">
                                <strong className={entryDisplay.tone === 'warning' ? 'warning-text' : 'success-text'}>
                                  {entry.amountDelta > 0 ? '+' : '-'}
                                  {formatCurrency(Math.abs(entry.amountDelta), currency)}
                                </strong>
                                <p>{entryDisplay.amountLabel}</p>
                                <p>{entry.paymentMethod ?? 'Statement entry'}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </SectionCard>
                </>
              ) : (
                <SectionCard
                  title="Customer Statement"
                  subtitle="Receivables and ledger movement stay scoped to the selected customer."
                >
                  <EmptyState
                    eyebrow="Ledger access disabled"
                    title="This role cannot view customer statements."
                    message="An admin can grant customer ledger access if this employee should review balances, invoices, and statement history."
                  />
                </SectionCard>
              )}
            </>
          ) : null}
        </div>
      </IonContent>

      <IonModal isOpen={showAddModal} onDidDismiss={closeAddModal}>
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonTitle>Add Customer</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={closeAddModal} aria-label="Close add customer form">
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="page-shell">
            <SectionCard
              title="New Customer"
              subtitle="Save only what you need for invoices, follow-up, and future PDF sharing."
            >
              <div className="form-grid">
                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Customer name</IonLabel>
                  <IonInput
                    value={addName}
                    placeholder="e.g. Adom Provision Store"
                    onIonInput={(event) => setAddName(event.detail.value ?? '')}
                  />
                </IonItem>

                <div className="dual-stat">
                  <PhoneInputField
                    label="WhatsApp / follow-up number (optional)"
                    value={addContactNumber}
                    placeholder="e.g. 0XXXXXXXXX"
                    helperText="This number can be reused for reminders and WhatsApp invoice sharing."
                    onPhoneChange={setAddContactNumber}
                    onValidityChange={setIsAddContactNumberValid}
                  />

                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">Client ID (optional)</IonLabel>
                    <IonInput
                      value={addClientId}
                      helperText="Leave blank to auto-generate one."
                      onIonInput={(event) => setAddClientId(event.detail.value ?? '')}
                    />
                  </IonItem>
                </div>

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Email address (optional)</IonLabel>
                  <IonInput
                    type="email"
                    value={addEmail}
                    placeholder="e.g. buyer@example.com"
                    onIonInput={(event) => setAddEmail(event.detail.value ?? '')}
                  />
                </IonItem>

                <IonButton expand="block" onClick={handleAddCustomer}>
                  Save Customer
                </IonButton>
                {addMessage ? <p className="form-message">{addMessage}</p> : null}
              </div>
            </SectionCard>
          </div>
        </IonContent>
      </IonModal>

      <IonModal isOpen={showEditModal} onDidDismiss={closeEditModal}>
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonTitle>Edit Customer</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={closeEditModal} aria-label="Close edit customer form">
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="page-shell">
            <SectionCard
              title={selectedCustomer?.name ?? 'Customer'}
              subtitle="Update contact details discreetly without exposing them in the main list."
            >
              <div className="form-grid">
                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Customer name</IonLabel>
                  <IonInput
                    value={editName}
                    placeholder="e.g. Adom Provision Store"
                    onIonInput={(event) => setEditName(event.detail.value ?? '')}
                  />
                </IonItem>

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Client ID</IonLabel>
                  <IonInput value={selectedCustomer?.clientId ?? ''} readonly={true} />
                </IonItem>

                <PhoneInputField
                  label="WhatsApp / follow-up number (optional)"
                  value={editContactNumber}
                  placeholder="e.g. 0XXXXXXXXX"
                  helperText="This single number is used for WhatsApp invoice sharing and reminder follow-up."
                  onPhoneChange={setEditContactNumber}
                  onValidityChange={setIsEditContactNumberValid}
                />

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Email address (optional)</IonLabel>
                  <IonInput
                    type="email"
                    value={editEmail}
                    placeholder="e.g. buyer@example.com"
                    onIonInput={(event) => setEditEmail(event.detail.value ?? '')}
                  />
                </IonItem>

                <IonButton expand="block" onClick={handleUpdateCustomer}>
                  Save Changes
                </IonButton>
                {editMessage ? <p className="form-message">{editMessage}</p> : null}
              </div>
            </SectionCard>
          </div>
        </IonContent>
      </IonModal>

      <IonModal isOpen={showTerminateModal} onDidDismiss={closeTerminateModal}>
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonTitle>Terminate Customer Account</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={closeTerminateModal} aria-label="Close terminate customer form">
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="page-shell">
            <SectionCard
              title={selectedCustomer?.name ?? 'Customer'}
              subtitle="This does not delete invoices, ledger history, or past sales. It only deactivates the customer for new activity."
            >
              <div className="form-grid">
                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Termination reason</IonLabel>
                  <IonTextarea
                    value={terminationReason}
                    rows={4}
                    placeholder="e.g. Account closed, duplicate customer profile, no longer active."
                    onIonInput={(event) => setTerminationReason(event.detail.value ?? '')}
                  />
                </IonItem>

                <IonButton expand="block" color="danger" onClick={handleTerminateCustomer}>
                  Confirm Termination
                </IonButton>
                {terminationMessage ? <p className="form-message">{terminationMessage}</p> : null}
              </div>
            </SectionCard>
          </div>
        </IonContent>
      </IonModal>

      <IonModal isOpen={showEmailModal} onDidDismiss={closeEmailModal}>
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonTitle>Email Customer</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={closeEmailModal} aria-label="Close email composer">
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="page-shell">
            <div className="email-composer-shell">
              <div className="email-composer-hero">
                <div className="email-composer-brand">
                  {state.businessProfile.logoUrl ? (
                    <img
                      src={state.businessProfile.logoUrl}
                      alt={`${state.businessProfile.businessName || 'Business'} logo`}
                      className="email-composer-logo"
                    />
                  ) : null}
                  <div>
                    <p className="eyebrow">Branded email</p>
                    <h2>{state.businessProfile.businessName || 'BisaPilot'}</h2>
                    <p>Prepare and send a polished customer email directly from BisaPilot.</p>
                  </div>
                </div>

                <div className="email-recipient-pill">
                  <strong>To</strong>
                  <span>{emailRecipientName || 'Customer'}</span>
                  <p>{emailRecipient}</p>
                </div>
              </div>

              <SectionCard
                title="Compose message"
                subtitle="Review the branded header, adjust your subject, and type whatever message you want before sending it."
              >
                <div className="form-grid">
                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">Subject</IonLabel>
                    <IonInput
                      value={emailSubject}
                      placeholder="Enter your email subject"
                      onIonInput={(event) => setEmailSubject(event.detail.value ?? '')}
                    />
                  </IonItem>

                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">Message</IonLabel>
                    <IonTextarea
                      value={emailBody}
                      rows={10}
                      placeholder="Type your message here"
                      onIonInput={(event) => setEmailBody(event.detail.value ?? '')}
                    />
                  </IonItem>

                  <div className="email-preview-card">
                    <div className="email-preview-header">
                      {state.businessProfile.logoUrl ? (
                        <img
                          src={state.businessProfile.logoUrl}
                          alt={`${state.businessProfile.businessName || 'Business'} logo`}
                          className="email-preview-logo"
                        />
                      ) : null}
                      <div>
                        <strong>{assignedSenderName}</strong>
                        <p>{assignedSenderEmail || state.businessProfile.phone || 'Customer communication'}</p>
                      </div>
                    </div>
                    <div className="email-preview-body">
                      <p className="muted-label">Preview</p>
                      <h3>{emailSubject || 'No subject yet'}</h3>
                      {emailBody.split('\n').map((line, index) => (
                        <p key={`${line}-${index}`}>{line || '\u00A0'}</p>
                      ))}
                    </div>
                  </div>

                  <div className="email-recipient-pill">
                    <strong>Sender</strong>
                    <span>{assignedSenderName || 'Not configured yet'}</span>
                    <p>
                      {isBusinessEmailConfigLoading
                        ? 'Loading business email system...'
                        : businessEmailConfig
                          ? `${assignedSenderEmail || businessEmailConfig.fromEmail} via ${businessEmailConfig.smtpHost}:${businessEmailConfig.smtpPort}`
                          : 'Ask an owner or admin to configure the business mailing system in Settings.'}
                    </p>
                  </div>

                  {!canSendCustomerEmail ? (
                    <p className="form-message">You do not have permission to send customer emails from this workspace.</p>
                  ) : null}
                  {!isBusinessEmailConfigLoading && !businessEmailConfig ? (
                    <p className="form-message">
                      {businessEmailConfigMessage || 'This business has not configured its mailing system yet. An owner or admin should set it up in Settings before staff can send emails.'}
                    </p>
                  ) : null}

                  <IonButton
                    expand="block"
                    onClick={handleSendEmail}
                    disabled={isSendingEmail || isBusinessEmailConfigLoading || !businessEmailConfig || !canSendCustomerEmail}
                  >
                    {isSendingEmail ? 'Sending Email...' : 'Send Email'}
                  </IonButton>
                  {emailSendMessage ? <p className="form-message">{emailSendMessage}</p> : null}
                </div>
              </SectionCard>
            </div>
          </div>
        </IonContent>
      </IonModal>

      <IonModal isOpen={showWhatsAppModal} onDidDismiss={closeWhatsAppModal}>
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonTitle>WhatsApp Customer</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={closeWhatsAppModal} aria-label="Close WhatsApp composer">
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="page-shell">
            <div className="email-composer-shell">
              <div className="email-composer-hero whatsapp-composer-hero">
                <div className="email-composer-brand">
                  {state.businessProfile.logoUrl ? (
                    <img
                      src={state.businessProfile.logoUrl}
                      alt={`${state.businessProfile.businessName || 'Business'} logo`}
                      className="email-composer-logo"
                    />
                  ) : null}
                  <div>
                    <p className="eyebrow">Branded WhatsApp</p>
                    <h2>{state.businessProfile.businessName || 'BisaPilot'}</h2>
                    <p>Prepare a polished WhatsApp message before opening the chat.</p>
                  </div>
                </div>

                <div className="email-recipient-pill">
                  <strong>To</strong>
                  <span>{whatsAppRecipientName || 'Customer'}</span>
                  <p>{whatsAppRecipientNumber}</p>
                </div>
              </div>

              <SectionCard
                title="Compose WhatsApp Message"
                subtitle="Review the branded header, adjust your message, and then hand it off to WhatsApp."
              >
                <div className="form-grid">
                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">Message</IonLabel>
                    <IonTextarea
                      value={whatsAppMessage}
                      rows={10}
                      placeholder="Type your WhatsApp message here"
                      onIonInput={(event) => setWhatsAppMessage(event.detail.value ?? '')}
                    />
                  </IonItem>

                  <div className="email-preview-card whatsapp-preview-card">
                    <div className="email-preview-header">
                      {state.businessProfile.logoUrl ? (
                        <img
                          src={state.businessProfile.logoUrl}
                          alt={`${state.businessProfile.businessName || 'Business'} logo`}
                          className="email-preview-logo"
                        />
                      ) : null}
                      <div>
                        <strong>{state.businessProfile.businessName || 'BisaPilot'}</strong>
                        <p>{state.businessProfile.phone || state.businessProfile.email || 'WhatsApp communication'}</p>
                      </div>
                    </div>
                    <div className="email-preview-body">
                      <p className="muted-label">Preview</p>
                      {whatsAppMessage.split('\n').map((line, index) => (
                        <p key={`${line}-${index}`}>{line || '\u00A0'}</p>
                      ))}
                    </div>
                  </div>

                  <IonButton expand="block" color="success" onClick={handleOpenInWhatsApp}>
                    Open in WhatsApp
                  </IonButton>
                </div>
              </SectionCard>
            </div>
          </div>
        </IonContent>
      </IonModal>

      <IonToast
        isOpen={showSuccessToast}
        message={`${savedCustomerName} updated successfully.`}
        duration={1800}
        color="success"
        position="top"
        onDidDismiss={() => setShowSuccessToast(false)}
      />
      <IonToast
        isOpen={showEmailToast}
        message="Email sent successfully."
        duration={1800}
        color="success"
        position="top"
        onDidDismiss={() => setShowEmailToast(false)}
      />
    </IonPage>
  );
};

export default CustomersPage;
