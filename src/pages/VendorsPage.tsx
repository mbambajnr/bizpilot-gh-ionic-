import {
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonSearchbar,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import { createOutline } from 'ionicons/icons';
import { useMemo, useState } from 'react';

import EmptyState from '../components/EmptyState';
import SectionCard from '../components/SectionCard';
import { useBusiness } from '../context/BusinessContext';

const VendorsPage: React.FC = () => {
  const { state, createVendor, updateVendor, setVendorStatus, hasPermission } = useBusiness();
  const [vendorSearchTerm, setVendorSearchTerm] = useState('');
  const [vendorMessage, setVendorMessage] = useState('');
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorEmail, setNewVendorEmail] = useState('');
  const [newVendorLocation, setNewVendorLocation] = useState('');
  const [editingVendorId, setEditingVendorId] = useState('');
  const [editVendorCode, setEditVendorCode] = useState('');
  const [editVendorName, setEditVendorName] = useState('');
  const [editVendorEmail, setEditVendorEmail] = useState('');
  const [editVendorLocation, setEditVendorLocation] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successToastMessage, setSuccessToastMessage] = useState('');

  const canManageVendors = hasPermission('vendors.manage');
  const activeVendorCount = state.vendors.filter((vendor) => vendor.status === 'active').length;

  const filteredVendors = useMemo(() => {
    const search = vendorSearchTerm.trim().toLowerCase();
    return [...state.vendors]
      .sort((left, right) => left.name.localeCompare(right.name))
      .filter((vendor) => {
        if (!search) {
          return true;
        }

        return [vendor.vendorCode, vendor.name, vendor.contactEmail ?? '', vendor.location]
          .some((value) => value.toLowerCase().includes(search));
      });
  }, [state.vendors, vendorSearchTerm]);

  const handleCreateVendor = async () => {
    const result = await createVendor({
      name: newVendorName,
      contactEmail: newVendorEmail,
      location: newVendorLocation,
    });

    if (!result.ok) {
      setVendorMessage(result.message);
      return;
    }

    setNewVendorName('');
    setNewVendorEmail('');
    setNewVendorLocation('');
    setVendorMessage('');
    setSuccessToastMessage('Vendor created.');
    setShowSuccessToast(true);
  };

  const openEditVendor = (vendor: typeof state.vendors[number]) => {
    setEditingVendorId(vendor.id);
    setEditVendorCode(vendor.vendorCode);
    setEditVendorName(vendor.name);
    setEditVendorEmail(vendor.contactEmail ?? '');
    setEditVendorLocation(vendor.location);
    setVendorMessage('');
  };

  const closeEditVendor = () => {
    setEditingVendorId('');
    setEditVendorCode('');
    setEditVendorName('');
    setEditVendorEmail('');
    setEditVendorLocation('');
  };

  const handleSaveVendor = async () => {
    const result = await updateVendor({
      vendorId: editingVendorId,
      vendorCode: editVendorCode,
      name: editVendorName,
      contactEmail: editVendorEmail,
      location: editVendorLocation,
    });

    if (!result.ok) {
      setVendorMessage(result.message);
      return;
    }

    closeEditVendor();
    setVendorMessage('');
    setSuccessToastMessage('Vendor updated.');
    setShowSuccessToast(true);
  };

  const handleToggleVendorStatus = async (vendorId: string, status: 'active' | 'inactive') => {
    const result = await setVendorStatus({ vendorId, status });

    if (!result.ok) {
      setVendorMessage(result.message);
      return;
    }

    if (editingVendorId === vendorId) {
      closeEditVendor();
    }
    setVendorMessage('');
    setSuccessToastMessage(status === 'active' ? 'Vendor activated.' : 'Vendor deactivated.');
    setShowSuccessToast(true);
  };

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Vendors</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <div className="page-shell">
          <div className="dashboard-grid">
            <SectionCard
              title="Vendor Directory"
              subtitle="Manage suppliers before raising procurement drafts and payables."
            >
              <div className="form-grid">
                <div className="list-block">
                  <div className="list-row">
                    <div>
                      <strong>Supplier directory</strong>
                      <p>{state.vendors.length} supplier records, {activeVendorCount} active.</p>
                    </div>
                    <IonBadge color="primary">{filteredVendors.length}</IonBadge>
                  </div>
                  <IonSearchbar
                    value={vendorSearchTerm}
                    placeholder="Search by code, name, email, or location"
                    onIonInput={(event: CustomEvent<{ value?: string | null }>) => setVendorSearchTerm(event.detail.value ?? '')}
                  />
                  {filteredVendors.length === 0 ? (
                    <EmptyState
                      eyebrow="No vendors"
                      title="No vendors match this view."
                      message="Create a supplier or adjust the search to continue procurement setup."
                    />
                  ) : (
                    filteredVendors.map((vendor) => (
                      <div className="list-row" key={vendor.id}>
                        <div>
                          <strong>{vendor.name}</strong>
                          <p className="code-label">{vendor.vendorCode}</p>
                          <p>{vendor.contactEmail || 'No email on file'}</p>
                          <p>{vendor.location}</p>
                        </div>
                        <div className="right-meta">
                          <IonBadge color={vendor.status === 'active' ? 'success' : 'medium'}>
                            {vendor.status}
                          </IonBadge>
                          {canManageVendors ? (
                            <>
                              <IonButton fill="clear" size="small" onClick={() => openEditVendor(vendor)}>
                                <IonIcon slot="icon-only" icon={createOutline} />
                              </IonButton>
                              <IonButton
                                fill="clear"
                                size="small"
                                color={vendor.status === 'active' ? 'danger' : 'success'}
                                onClick={() => handleToggleVendorStatus(vendor.id, vendor.status === 'active' ? 'inactive' : 'active')}
                              >
                                {vendor.status === 'active' ? 'Deactivate' : 'Activate'}
                              </IonButton>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {canManageVendors ? (
                  <div className="list-block">
                    <div className="list-row">
                      <div>
                        <strong>Create vendor</strong>
                        <p>Add suppliers here so purchase drafts and payable records can reference them cleanly.</p>
                      </div>
                    </div>
                    <div className="form-grid">
                      <div className="dual-stat">
                        <IonItem lines="none" className="app-item">
                          <IonLabel position="stacked">Vendor name</IonLabel>
                          <IonInput
                            value={newVendorName}
                            placeholder="e.g. Asante Wholesale"
                            onIonInput={(event) => setNewVendorName(event.detail.value ?? '')}
                          />
                        </IonItem>
                        <IonItem lines="none" className="app-item">
                          <IonLabel position="stacked">Contact email</IonLabel>
                          <IonInput
                            value={newVendorEmail}
                            placeholder="accounts@vendor.com"
                            onIonInput={(event) => setNewVendorEmail(event.detail.value ?? '')}
                          />
                        </IonItem>
                      </div>
                      <IonItem lines="none" className="app-item">
                        <IonLabel position="stacked">Location</IonLabel>
                        <IonInput
                          value={newVendorLocation}
                          placeholder="Accra, Ghana"
                          onIonInput={(event) => setNewVendorLocation(event.detail.value ?? '')}
                        />
                      </IonItem>
                      <IonButton expand="block" onClick={handleCreateVendor}>
                        Create Vendor
                      </IonButton>
                    </div>
                  </div>
                ) : null}

                {canManageVendors && editingVendorId ? (
                  <div className="list-block">
                    <div className="list-row">
                      <div>
                        <strong>Edit vendor</strong>
                        <p>Keep supplier details current so procurement and payable records stay reliable.</p>
                      </div>
                    </div>
                    <div className="form-grid">
                      <div className="dual-stat">
                        <IonItem lines="none" className="app-item">
                          <IonLabel position="stacked">Vendor code</IonLabel>
                          <IonInput value={editVendorCode} onIonInput={(event) => setEditVendorCode(event.detail.value ?? '')} />
                        </IonItem>
                        <IonItem lines="none" className="app-item">
                          <IonLabel position="stacked">Vendor name</IonLabel>
                          <IonInput value={editVendorName} onIonInput={(event) => setEditVendorName(event.detail.value ?? '')} />
                        </IonItem>
                      </div>
                      <div className="dual-stat">
                        <IonItem lines="none" className="app-item">
                          <IonLabel position="stacked">Contact email</IonLabel>
                          <IonInput value={editVendorEmail} onIonInput={(event) => setEditVendorEmail(event.detail.value ?? '')} />
                        </IonItem>
                        <IonItem lines="none" className="app-item">
                          <IonLabel position="stacked">Location</IonLabel>
                          <IonInput value={editVendorLocation} onIonInput={(event) => setEditVendorLocation(event.detail.value ?? '')} />
                        </IonItem>
                      </div>
                      <div className="dual-stat">
                        <IonButton expand="block" onClick={handleSaveVendor}>
                          Save Vendor
                        </IonButton>
                        <IonButton expand="block" fill="outline" color="medium" onClick={closeEditVendor}>
                          Cancel
                        </IonButton>
                      </div>
                    </div>
                  </div>
                ) : null}

                {vendorMessage ? <p className="form-message">{vendorMessage}</p> : null}
              </div>
            </SectionCard>
          </div>
        </div>

        <IonToast
          isOpen={showSuccessToast}
          message={successToastMessage}
          duration={1800}
          color="success"
          onDidDismiss={() => setShowSuccessToast(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default VendorsPage;
