'use client';

import { Check, Handshake, KeyRound, Pencil, Plus, ShieldCheck, UserRoundCheck, UserRoundX, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { ROLE_DEFAULT_PERMISSIONS, ROLE_LABELS } from '../../src/authz/defaults';
import { getPermissionList, hasPermission } from '../../src/authz/permissions';
import type { AppPermission, AppRole, UserAccessProfile } from '../../src/authz/types';
import type { ApprovalDelegationCategory } from '../../src/data/seedBusiness';
import { formatCurrency } from '../../src/utils/format';
import { useAuth } from '../../src/context/AuthContext';
import { useBusiness } from '../../src/context/BusinessContext';

const roles = Object.keys(ROLE_LABELS) as AppRole[];
const permissionGroups: Array<{ title: string; items: Array<[AppPermission, string]> }> = [
  { title: 'Administration', items: [['business.view', 'View business'], ['business.edit', 'Edit business'], ['users.manage', 'Manage users'], ['roles.assign', 'Assign roles'], ['permissions.manage', 'Manage permissions'], ['branding.view', 'View branding'], ['branding.manage', 'Manage branding']] },
  { title: 'Sales and customers', items: [['sales.view', 'View sales'], ['sales.create', 'Create sales'], ['sales.reverse', 'Reverse sales'], ['quotations.view', 'View quotations'], ['quotations.create', 'Create quotations'], ['quotations.convert', 'Convert quotations'], ['invoices.view', 'View invoices'], ['customers.view', 'View customers'], ['customers.create', 'Create customers'], ['customers.edit', 'Edit customers'], ['customers.email.send', 'Send customer email'], ['customers.ledger.view', 'View customer ledger']] },
  { title: 'Inventory and procurement', items: [['inventory.view', 'View inventory'], ['inventory.create', 'Create products'], ['inventory.edit', 'Edit products'], ['inventory.adjust', 'Adjust stock'], ['inventory.restock', 'Restock inventory'], ['vendors.view', 'View vendors'], ['vendors.manage', 'Manage vendors'], ['purchases.view', 'View purchases'], ['purchases.create', 'Create purchases'], ['purchases.approve', 'Approve purchases'], ['purchases.receive', 'Receive purchases'], ['procurement.view', 'View procurement'], ['procurement.create', 'Create procurement'], ['procurement.approve', 'Approve procurement'], ['transfers.view', 'View transfers'], ['transfers.create', 'Create transfers'], ['transfers.approve', 'Approve transfers'], ['transfers.dispatch', 'Dispatch transfers'], ['transfers.receive', 'Receive transfers'], ['restockRequests.view', 'View restock requests'], ['restockRequests.create', 'Create restock requests'], ['restockRequests.manage', 'Manage restock requests']] },
  { title: 'Finance and reporting', items: [['accounting.access', 'Access accounting'], ['expenses.view', 'View expenses'], ['expenses.create', 'Create expenses'], ['expenses.edit', 'Edit expenses'], ['payables.view', 'View payables'], ['payables.manage', 'Manage payables'], ['payables.approve', 'Approve payables'], ['payables.pay', 'Pay suppliers'], ['payments.view', 'View payments'], ['payments.record', 'Record payments'], ['reports.dashboard.view', 'View dashboard'], ['reports.sales.view', 'View sales reports'], ['reports.inventory.view', 'View inventory reports'], ['reports.financial.view', 'View financial reports'], ['invoices.print', 'Print invoices'], ['invoices.export_pdf', 'Export invoices'], ['quotations.print', 'Print quotations'], ['quotations.export_pdf', 'Export quotations']] },
];

type EditorState = {
  mode: 'create' | 'edit';
  userId?: string;
  name: string;
  email: string;
  role: AppRole;
  roleLabel: string;
  accountStatus: 'active' | 'deactivated';
  permissions: AppPermission[];
};

const newEditor = (): EditorState => ({ mode: 'create', name: '', email: '', role: 'SalesManager', roleLabel: ROLE_LABELS.SalesManager, accountStatus: 'active', permissions: [...ROLE_DEFAULT_PERMISSIONS.SalesManager] });

export function EnterpriseTeamSettings() {
  const { state, currentUser, hasPermission, addUserAccount, updateEmployeeAccount, resetEmployeeTemporaryPassword } = useBusiness();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState<{ username: string; temporaryPassword: string } | null>(null);
  const canManage = hasPermission('permissions.manage');

  function openUser(user: UserAccessProfile) {
    setCredentials(null);
    setMessage('');
    setEditor({ mode: 'edit', userId: user.userId, name: user.name, email: user.email, role: user.role, roleLabel: user.roleLabel || ROLE_LABELS[user.role], accountStatus: user.accountStatus ?? 'active', permissions: getPermissionList(user) });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor || !editor.name.trim() || !editor.email.trim()) { setMessage('Name and email are required.'); return; }
    const defaults = new Set(ROLE_DEFAULT_PERMISSIONS[editor.role]);
    const selected = new Set(editor.permissions);
    const grantedPermissions = editor.permissions.filter((permission) => !defaults.has(permission));
    const revokedPermissions = [...defaults].filter((permission) => !selected.has(permission));
    setBusy(true);
    const result = editor.mode === 'create'
      ? await addUserAccount({ name: editor.name, email: editor.email, role: editor.role, roleLabel: editor.roleLabel, grantedPermissions, revokedPermissions })
      : updateEmployeeAccount({ userId: editor.userId!, name: editor.name, email: editor.email, role: editor.role, roleLabel: editor.roleLabel, grantedPermissions, revokedPermissions, accountStatus: editor.accountStatus });
    setBusy(false);
    setMessage(result.message ?? (result.ok ? 'Employee account saved.' : 'Employee account could not be saved.'));
    if (result.ok && editor.mode === 'create') setCredentials(result.data ?? null);
    if (result.ok && editor.mode === 'edit') setEditor(null);
  }

  async function resetPassword() {
    if (!editor?.userId) return;
    setBusy(true);
    const result = await resetEmployeeTemporaryPassword(editor.userId);
    setBusy(false);
    setMessage(result.message ?? (result.ok ? 'Temporary password created.' : 'Temporary password could not be created.'));
    if (result.ok) setCredentials(result.data ?? null);
  }

  return <><ApprovalDelegationPanel /><section className="settings-panel team-admin-panel">
    <div className="settings-panel-heading"><div><p className="eyebrow">Access control</p><h2>Team and roles</h2><p>Manage employee access, role baselines, permission overrides, and account recovery.</p></div>{canManage ? <button className="primary-button" type="button" onClick={() => { setEditor(newEditor()); setCredentials(null); setMessage(''); }}><Plus size={15} /> Add employee</button> : <span className="status-pill">Read only</span>}</div>
    {message && !editor ? <div className="settings-message" role="status">{message}</div> : null}
    <div className="team-admin-table"><div className="team-admin-head"><span>Employee</span><span>Role</span><span>Status</span><span>Access</span><span /></div>{state.users.map((user) => { const permissions = getPermissionList(user); const active = (user.accountStatus ?? 'active') === 'active'; return <article key={user.userId}><div className="team-avatar">{initials(user.name)}</div><div className="team-admin-identity"><strong>{user.name}</strong><span>{user.email || user.username}</span></div><div><strong>{user.roleLabel || ROLE_LABELS[user.role]}</strong><span>{ROLE_LABELS[user.role]}{user.userId === currentUser.userId ? ' · Current session' : ''}</span></div><span className={`status-pill status-pill--${active ? 'good' : 'warn'}`}>{active ? 'Active' : 'Deactivated'}</span><div className="team-permission-count"><ShieldCheck size={14} /><span>{permissions.length} permissions</span></div>{canManage ? <button className="icon-button" type="button" aria-label={`Edit ${user.name}`} title={`Edit ${user.name}`} onClick={() => openUser(user)}><Pencil size={14} /></button> : <span />}</article>;})}</div>
    {editor ? <div className="settings-drawer-backdrop"><form className="settings-drawer" onSubmit={(event) => void save(event)}><header><div><p className="eyebrow">{editor.mode === 'create' ? 'New employee' : 'Employee account'}</p><h2>{editor.mode === 'create' ? 'Create employee access' : editor.name}</h2></div><button className="icon-button" type="button" aria-label="Close employee editor" title="Close employee editor" onClick={() => setEditor(null)}><X size={17} /></button></header><div className="settings-drawer-body">
      <section className="settings-drawer-grid"><label className="form-field"><span>Full name</span><input autoFocus value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} /></label><label className="form-field"><span>Email address</span><input type="email" value={editor.email} onChange={(event) => setEditor({ ...editor, email: event.target.value })} /></label><label className="form-field"><span>Base role</span><select value={editor.role} onChange={(event) => { const role = event.target.value as AppRole; setEditor({ ...editor, role, roleLabel: ROLE_LABELS[role], permissions: [...ROLE_DEFAULT_PERMISSIONS[role]] }); }}>{roles.map((role) => <option value={role} key={role}>{ROLE_LABELS[role]}</option>)}</select></label><label className="form-field"><span>Role title</span><input value={editor.roleLabel} onChange={(event) => setEditor({ ...editor, roleLabel: event.target.value })} /></label></section>
      {editor.mode === 'edit' ? <section className="employee-account-controls"><div><span><strong>Account status</strong><small>{editor.accountStatus === 'active' ? 'Employee can sign in.' : 'Sign-in is blocked.'}</small></span><button className="secondary-button" type="button" disabled={editor.userId === currentUser.userId} onClick={() => setEditor({ ...editor, accountStatus: editor.accountStatus === 'active' ? 'deactivated' : 'active' })}>{editor.accountStatus === 'active' ? <UserRoundX size={14} /> : <UserRoundCheck size={14} />}{editor.accountStatus === 'active' ? 'Deactivate' : 'Reactivate'}</button></div><div><span><strong>Sign-in recovery</strong><small>Issue a temporary password that must be changed.</small></span><button className="secondary-button" type="button" disabled={busy || editor.accountStatus !== 'active'} onClick={() => void resetPassword()}><KeyRound size={14} /> Reset password</button></div></section> : null}
      <section className="permission-editor"><div className="permission-editor-heading"><div><strong>Effective permissions</strong><span>Role defaults with explicit grants and revocations.</span></div><b>{editor.permissions.length} enabled</b></div>{permissionGroups.map((group) => <details key={group.title}><summary>{group.title}<span>{group.items.filter(([permission]) => editor.permissions.includes(permission)).length}/{group.items.length}</span></summary><div>{group.items.map(([permission, label]) => <label key={permission}><input type="checkbox" checked={editor.permissions.includes(permission)} onChange={(event) => setEditor({ ...editor, permissions: event.target.checked ? [...editor.permissions, permission] : editor.permissions.filter((entry) => entry !== permission) })} /><i>{editor.permissions.includes(permission) ? <Check size={11} /> : null}</i><span>{label}</span></label>)}</div></details>)}</section>
      {credentials ? <section className="credential-result"><KeyRound size={18} /><div><strong>Temporary credentials</strong><span>Share these securely. They are shown only for this action.</span><code>Username: {credentials.username}</code><code>Password: {credentials.temporaryPassword}</code></div></section> : null}{message ? <div className="settings-message" role="status">{message}</div> : null}
    </div><footer><button className="secondary-button" type="button" onClick={() => setEditor(null)}>{credentials && editor.mode === 'create' ? 'Close' : 'Cancel'}</button>{credentials && editor.mode === 'create' ? <button className="primary-button" type="button" onClick={() => { setEditor(newEditor()); setCredentials(null); setMessage(''); }}><Plus size={14} /> Create another</button> : <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save employee'}</button>}</footer></form></div> : null}
  </section></>;
}

const DELEGATION_CATEGORIES: Array<[ApprovalDelegationCategory, string]> = [['payables', 'Payables'], ['purchases', 'Purchases'], ['transfers', 'Transfers'], ['expenses', 'Expenses']];

function ApprovalDelegationPanel() {
  const { state, currentUser, assignApprovalDelegate, revokeApprovalDelegate } = useBusiness();
  const [delegateUserId, setDelegateUserId] = useState('');
  const [categories, setCategories] = useState<ApprovalDelegationCategory[]>([]);
  const [amountLimit, setAmountLimit] = useState('');
  const [message, setMessage] = useState('');

  // Only the General Manager holds approval authority to delegate.
  if (currentUser.role !== 'GeneralManager') return null;

  const candidates = state.users.filter((user) => user.userId !== currentUser.userId && (user.accountStatus ?? 'active') !== 'deactivated');
  const selected = candidates.find((user) => user.userId === delegateUserId);
  const delegateCanPay = Boolean(selected && (hasPermission(selected, 'payables.pay') || hasPermission(selected, 'payments.record')));
  const toggle = (category: ApprovalDelegationCategory) => setCategories((current) => current.includes(category) ? current.filter((entry) => entry !== category) : [...current, category]);

  function assign() {
    const result = assignApprovalDelegate({ delegateUserId, categories, amountLimit: amountLimit.trim() ? Number(amountLimit) : undefined });
    setMessage(result.message ?? (result.ok ? 'Delegation assigned.' : 'Could not assign the delegation.'));
    if (result.ok) { setDelegateUserId(''); setCategories([]); setAmountLimit(''); }
  }
  function revoke(delegationId: string) {
    const result = revokeApprovalDelegate({ delegationId });
    setMessage(result.message ?? (result.ok ? 'Delegation revoked.' : 'Could not revoke the delegation.'));
  }

  return <section className="settings-panel">
    <div className="settings-panel-heading"><div><p className="eyebrow">Approval authority</p><h2>Approval delegation</h2><p>Assign an employee to approve on your behalf until you revoke it. The delegate approves in their own name; every approval stays in the audit trail.</p></div><Handshake size={20} /></div>
    {message ? <div className="settings-message" role="status">{message}</div> : null}
    {state.approvalDelegations.length ? <div className="delegation-list">{state.approvalDelegations.map((delegation) => { const user = state.users.find((entry) => entry.userId === delegation.delegateUserId); return <article key={delegation.id}><div><strong>{user?.name ?? delegation.delegateUserId}</strong><span>{delegation.categories.map((category) => DELEGATION_CATEGORIES.find(([value]) => value === category)?.[1] ?? category).join(' · ')}{delegation.amountLimit != null ? ` · up to ${formatCurrency(delegation.amountLimit, state.businessProfile.currency)}` : ''}</span></div><button className="secondary-button danger-button" type="button" onClick={() => revoke(delegation.id)}><UserRoundX size={14} /> Revoke</button></article>; })}</div> : <div className="delegation-empty"><ShieldCheck size={18} /><span>No active delegations. You are the only approver.</span></div>}
    <div className="delegation-assign">
      <label className="form-field"><span>Delegate to</span><select value={delegateUserId} onChange={(event) => setDelegateUserId(event.target.value)}><option value="">Choose an employee</option>{candidates.map((user) => <option value={user.userId} key={user.userId}>{user.name} · {ROLE_LABELS[user.role]}</option>)}</select></label>
      <fieldset className="delegation-categories"><legend>Approvals to delegate</legend>{DELEGATION_CATEGORIES.map(([value, label]) => <label key={value}><input type="checkbox" checked={categories.includes(value)} onChange={() => toggle(value)} /><span>{label}</span></label>)}</fieldset>
      <label className="form-field"><span>Approval limit <small>Optional</small></span><input type="number" min="0" step="1" value={amountLimit} onChange={(event) => setAmountLimit(event.target.value)} placeholder="Blank = no cap. Above this, only you approve." /></label>
      {delegateCanPay && categories.includes('payables') ? <div className="delegation-warning"><ShieldCheck size={15} /><span>{selected?.name} can also record payments. Delegating payable approval lets one person both approve and pay a bill, which breaks separation of duties. Delegate anyway?</span></div> : null}
      <button className="primary-button" type="button" disabled={!delegateUserId || !categories.length} onClick={assign}>Assign delegation</button>
    </div>
  </section>;
}

export function EmployeeSecuritySettings() {
  const { user } = useAuth();
  const { currentUser, changeEmployeePassword } = useBusiness();
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); if (nextPassword.length < 8) { setMessage('Use at least 8 characters for the new password.'); return; } if (nextPassword !== confirmation) { setMessage('The new password confirmation does not match.'); return; } setBusy(true); const result = await changeEmployeePassword({ currentPassword, nextPassword }); setBusy(false); setMessage(result.message ?? (result.ok ? 'Password updated.' : 'Password could not be updated.')); if (result.ok) { setCurrentPassword(''); setNextPassword(''); setConfirmation(''); } }
  const localEmployee = user?.user_metadata?.auth_mode === 'employee-local';
  return <section className="settings-panel security-settings-panel"><div className="settings-panel-heading"><div><p className="eyebrow">Account security</p><h2>Sign-in credentials</h2><p>{localEmployee ? `Change the password for ${currentUser.name}. Temporary passwords must be replaced before operational access.` : 'Authentication credentials for this owner account are managed by the configured identity provider.'}</p></div><KeyRound size={20} /></div>{localEmployee ? <form onSubmit={(event) => void submit(event)}><label className="form-field"><span>Current password</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label className="form-field"><span>New password</span><input type="password" autoComplete="new-password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} /></label><label className="form-field"><span>Confirm new password</span><input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>{message ? <div className="settings-message" role="status">{message}</div> : null}<button className="primary-button" type="submit" disabled={busy || !currentPassword || !nextPassword}>{busy ? 'Updating...' : 'Update password'}</button></form> : <div className="identity-provider-note"><ShieldCheck size={18} /><div><strong>Identity-provider managed</strong><span>Use your configured Supabase authentication recovery flow to change the owner password. Employee temporary passwords remain available under Team and roles.</span></div></div>}</section>;
}

function initials(name: string) { return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }
