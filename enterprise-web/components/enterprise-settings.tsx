'use client';

import { Building2, CheckCircle2, Cloud, LockKeyhole, Store, Users } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';

import { useBusiness } from '../../src/context/BusinessContext';
import { getBusinessLaunchState } from '../../src/utils/businessLogic';
import { EnterpriseApp } from './enterprise-app';
import { EnterpriseShell } from './enterprise-shell';
import { EmployeeSecuritySettings, EnterpriseTeamSettings } from './enterprise-team-settings';
import { EnterpriseOperationsSettings } from './enterprise-operations-settings';
import { MagentoStatus } from './magento-status';

type SettingsSection = 'overview' | 'business' | 'team' | 'operations' | 'connections' | 'security';

export function EnterpriseSettings() {
  return (
    <EnterpriseApp>
      <EnterpriseSettingsView />
    </EnterpriseApp>
  );
}

function EnterpriseSettingsView() {
  const { state, backendStatus, hasPermission, updateBusinessProfile, launchBusinessWorkspace } = useBusiness();
  const [section, setSection] = useState<SettingsSection>('overview');
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(() => profileToForm(state.businessProfile));
  const [edited, setEdited] = useState(false);
  const canEdit = hasPermission('business.edit');
  const canManageTeam = hasPermission('permissions.manage');
  const launchState = getBusinessLaunchState(state.businessProfile);
  // The profile hydrates from Supabase after mount, so an untouched form has to
  // track it rather than keep the seed values captured at mount. Once the admin
  // types, their draft wins until it is saved.
  const savedForm = useMemo(() => profileToForm(state.businessProfile), [state.businessProfile]);
  const activeForm = edited ? form : savedForm;

  function updateForm(patch: Partial<typeof form>) {
    setForm({ ...activeForm, ...patch });
    setEdited(true);
  }

  if (!hasPermission('business.view')) {
    return (
      <EnterpriseShell active="Settings">
        <div className="page-content"><section className="access-denied"><LockKeyhole size={24} /><h1>Settings access is restricted</h1><p>Your assigned role does not include workspace governance.</p></section></div>
      </EnterpriseShell>
    );
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    const result = await updateBusinessProfile({ ...activeForm, website: activeForm.website.trim() || undefined });
    if (result.ok) setEdited(false);
    setMessage(result.message ?? (result.ok ? 'Business profile saved.' : 'The business profile could not be saved.'));
    setSaving(false);
  }

  async function handleLaunch() {
    setLaunching(true);
    setMessage('');
    const result = await launchBusinessWorkspace();
    setMessage(result.message ?? (result.ok ? 'Workspace launched.' : 'The workspace could not be launched.'));
    setLaunching(false);
  }

  return (
    <EnterpriseShell active="Settings">
      <div className="page-content settings-page">
        <section className="page-heading settings-heading">
          <div><p className="eyebrow">Administration</p><h1>Workspace settings</h1><p>Manage operating details, access, integrations, and launch readiness.</p></div>
          <div className="settings-facts" aria-label="Workspace status">
            <StatusFact label="Workspace" value={launchState === 'live' ? 'Live' : 'Setup'} />
            <StatusFact label="Team" value={`${state.users.filter((user) => user.accountStatus !== 'deactivated').length} active`} />
            <StatusFact label="Data" value={backendStatus.source === 'supabase' ? 'Cloud' : 'Local'} />
          </div>
        </section>

        <nav className="settings-tabs" aria-label="Settings sections">
          {([
            ['overview', 'Overview'],
            ['business', 'Business details'],
            ['team', 'Team and roles'],
            ['operations', 'Operating model'],
            ['connections', 'Connections'],
            ['security', 'Security'],
          ] as const).map(([value, label]) => <button type="button" className={section === value ? 'settings-tab settings-tab--active' : 'settings-tab'} onClick={() => { setSection(value); setMessage(''); }} key={value}>{label}</button>)}
        </nav>

        {message ? <div className="settings-message" role="status">{message}</div> : null}

        {section === 'overview' ? (
          <div className="settings-stack">
            <section className="settings-panel launch-panel">
              <div className="settings-panel-heading"><div><p className="eyebrow">Business launch status</p><h2>{launchState === 'live' ? 'Your workspace is officially open.' : launchState === 'readyToLaunch' ? 'Your workspace is ready to launch.' : 'Complete the business profile to launch.'}</h2></div><span className={`status-pill status-pill--${launchState === 'live' ? 'good' : 'warn'}`}>{launchState === 'live' ? 'Business live' : 'Setup in progress'}</span></div>
              <p>Assigned users enter role-based dashboards and worklists according to their permissions.</p>
              <div className="launch-checks">
                <LaunchCheck label="Business setup details saved" complete={launchState !== 'setupIncomplete'} />
                <LaunchCheck label="Business officially launched" complete={launchState === 'live'} />
                <LaunchCheck label="Brand identity uploaded" complete={Boolean(state.businessProfile.logoUrl?.trim())} />
              </div>
              {launchState === 'readyToLaunch' && canEdit ? <button type="button" className="primary-button launch-button" disabled={launching} onClick={() => void handleLaunch()}>{launching ? 'Launching...' : 'Launch workspace'}</button> : null}
              {state.businessProfile.launchedAt ? <small>Launched {new Intl.DateTimeFormat('en-GH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(state.businessProfile.launchedAt))}</small> : null}
            </section>

            <section className="settings-overview-grid">
              <OverviewCard icon={Cloud} title="Cloud integrity" value={backendStatus.label} detail={backendStatus.detail} />
              <OverviewCard icon={Store} title="Locations" value={`${state.locations.filter((location) => location.isActive).length} active`} detail="Stores and warehouses available to operational workflows." />
              <OverviewCard icon={Users} title="Team access" value={`${state.users.length} profiles`} detail={canManageTeam ? 'Role and permission administration is available.' : 'Your role has read-only access to the team directory.'} />
            </section>
          </div>
        ) : null}

        {section === 'business' ? (
          <form className="settings-panel business-form" onSubmit={(event) => void handleSave(event)}>
            <div className="settings-panel-heading"><div><p className="eyebrow">Business identity</p><h2>Operating details</h2></div>{!canEdit ? <span className="status-pill">Read only</span> : null}</div>
            <div className="form-grid">
              <Field label="Business name" value={activeForm.businessName} disabled={!canEdit} onChange={(value) => updateForm({ businessName: value })} />
              <Field label="Business type" value={activeForm.businessType} disabled={!canEdit} onChange={(value) => updateForm({ businessType: value })} />
              <Field label="Country" value={activeForm.country} disabled={!canEdit} onChange={(value) => updateForm({ country: value })} />
              <Field label="Currency" value={activeForm.currency} disabled={!canEdit} onChange={(value) => updateForm({ currency: value })} />
              <Field label="Phone" type="tel" value={activeForm.phone} disabled={!canEdit} onChange={(value) => updateForm({ phone: value })} />
              <Field label="Business email" type="email" value={activeForm.email} disabled={!canEdit} onChange={(value) => updateForm({ email: value })} />
              <Field label="Receipt prefix" value={activeForm.receiptPrefix} disabled={!canEdit} onChange={(value) => updateForm({ receiptPrefix: value })} />
              <Field label="Invoice prefix" value={activeForm.invoicePrefix} disabled={!canEdit} onChange={(value) => updateForm({ invoicePrefix: value })} />
              <Field label="Waybill prefix" value={activeForm.waybillPrefix} disabled={!canEdit} onChange={(value) => updateForm({ waybillPrefix: value })} />
              <Field label="Website" type="url" value={activeForm.website} disabled={!canEdit} onChange={(value) => updateForm({ website: value })} />
              <label className="form-field form-field--wide"><span>Business address</span><textarea value={activeForm.address} disabled={!canEdit} onChange={(event) => updateForm({ address: event.target.value })} /></label>
            </div>
            {canEdit ? <div className="form-actions"><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving...' : 'Save business details'}</button></div> : null}
          </form>
        ) : null}

        {section === 'team' ? <EnterpriseTeamSettings /> : null}
        {section === 'operations' ? <EnterpriseOperationsSettings /> : null}

        {section === 'connections' ? (
          <div className="connections-grid">
            <section className="settings-panel connection-summary"><div className="settings-panel-heading"><div><p className="eyebrow">Data platform</p><h2>Supabase connection</h2></div><Cloud size={20} /></div><div className="connection-detail"><span className={`status-dot status-dot--${backendStatus.source}`} /><div><strong>{backendStatus.label}</strong><p>{backendStatus.detail}</p></div></div></section>
            <MagentoStatus />
          </div>
        ) : null}
        {section === 'security' ? <EmployeeSecuritySettings /> : null}
      </div>
    </EnterpriseShell>
  );
}

function profileToForm(profile: ReturnType<typeof useBusiness>['state']['businessProfile']) {
  return {
    businessName: profile.businessName,
    businessType: profile.businessType,
    currency: profile.currency,
    country: profile.country,
    receiptPrefix: profile.receiptPrefix,
    invoicePrefix: profile.invoicePrefix,
    phone: profile.phone,
    email: profile.email,
    address: profile.address,
    website: profile.website ?? '',
    waybillPrefix: profile.waybillPrefix,
  };
}

function StatusFact({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function LaunchCheck({ label, complete }: { label: string; complete: boolean }) { return <div className={complete ? 'launch-check launch-check--complete' : 'launch-check'}><CheckCircle2 size={17} /><span>{label}</span></div>; }
function OverviewCard({ icon: Icon, title, value, detail }: { icon: typeof Building2; title: string; value: string; detail: string }) { return <article className="overview-card"><Icon size={20} /><div><span>{title}</span><strong>{value}</strong><p>{detail}</p></div></article>; }
function Field({ label, value, onChange, disabled, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; type?: string }) { return <label className="form-field"><span>{label}</span><input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>; }
