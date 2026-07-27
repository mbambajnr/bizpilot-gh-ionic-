# Security Control Summary

Last updated: 2026-05-20

This document maps current BisaPilot controls to the security topics commonly requested during vendor due diligence.

## Identity And Access

| Control | Current implementation | Evidence |
| --- | --- | --- |
| Role-based access control | Users are assigned one of seven roles. Default permissions are centralized in `ROLE_DEFAULT_PERMISSIONS`. | `src/authz/defaults.ts` |
| Permission overrides | Users can have explicit granted and revoked permissions. Revoked permissions override grants and role defaults. | `src/authz/permissions.ts` |
| Least privilege defaults | Admin is limited to system administration by default. Operational rights are assigned to business roles. | `docs/role-matrix.md` |
| Sensitive settings restriction | Business setup, role/permission management, branding, and employee management are limited to Admin/system permissions. | `src/pages/SettingsPage.tsx` |
| Temporary password rotation | Employees with admin-issued temporary credentials are routed to security settings until the password is changed. | `src/App.tsx`, `src/pages/SettingsPage.tsx` |
| Hashed employee credentials | Employee credentials use `password_hash` and `crypt(..., gen_salt('bf'))`; plaintext temporary passwords are cleared in the hardening migration. | `supabase/migrations/202605191930_harden_employee_credentials.sql` |

## Authorization And Workflow Enforcement

| Control | Current implementation | Evidence |
| --- | --- | --- |
| Client-side action gating | Pages and actions check permissions before exposing or executing workflows. | `src/context/BusinessContext.tsx`, page components |
| Server-side employee purchase enforcement | Employee purchase writes use `sync_employee_purchase`, which validates credentials, role, business, and allowed purchase state transitions. | `supabase/migrations/202605191930_harden_employee_credentials.sql` |
| Server-side employee workflow enforcement | Payments, payables, expenses, stock transfers, stock movements, and restock requests use `sync_employee_workflow`. | `supabase/migrations/202605192230_enforce_employee_workflows.sql` |
| Tenant-bound owner writes | Owner-authenticated writes are constrained by Supabase RLS policies using `user_owns_business(business_id)`. | `supabase/migrations/*` |
| High-risk role exclusions | Admin does not execute business operations by default; General Manager approves but does not pay/dispatch/receive by default. | `docs/role-matrix.md` |

## Data Protection

| Control | Current implementation | Evidence |
| --- | --- | --- |
| Tenant isolation | Business-scoped tables include `business_id` and RLS policies. | Supabase migrations |
| Credential protection | Employee password verification and rotation use hashed comparison in the active hardening migration. | `202605191930_harden_employee_credentials.sql` |
| Sensitive credential hydration prevention | Cloud employee loading does not hydrate plaintext temporary passwords into app state. | `src/data/supabaseDataLoader.ts` |
| Local fallback caution | Some app state can be cached in browser local storage for offline/local behavior. Treat shared browsers/devices as a risk. | `src/context/BusinessContext.tsx` |

## Auditability

| Control | Current implementation | Evidence |
| --- | --- | --- |
| Business audit trail | Workflow actions create activity log entries and sync to `business_audit_events`. | `src/utils/businessLogic.ts`, `src/data/supabaseSync.ts` |
| Workflow notifications | Approval and follow-up events create cloud notifications and read receipts. | `src/data/supabaseSync.ts`, `202605192130_cloud_audit_notifications.sql` |
| Actor tracking | Employee workflow RPCs write employee-controlled actor fields for protected workflows where supported by schema. | `202605192230_enforce_employee_workflows.sql` |

## Secure Development

| Control | Current implementation | Evidence |
| --- | --- | --- |
| Automated unit tests | Unit tests cover RBAC, auth, workflow logic, sync behavior, and page behavior. | `npm run test.unit -- --run` |
| TypeScript build gate | Production build uses `tsc` and Vite. | `npm run build` |
| Security migrations | Security-sensitive database changes are versioned as Supabase migrations. | `supabase/migrations/` |

## Residual Risks

| Risk | Impact | Recommended action |
| --- | --- | --- |
| No independent penetration test yet | Enterprise buyers may not accept self-attestation only. | Schedule external web/API penetration test before enterprise launch. |
| No formal SOC 2/ISO 27001 certification | Cannot answer "certified" affirmatively. | Start policy/evidence program if enterprise sales require it. |
| No SSO/SAML/SCIM | Larger enterprises may require centralized IAM. | Add roadmap item for enterprise tier. |
| Browser local storage fallback | Shared devices may expose cached business state. | Add explicit session/device policy, timeout controls, and secure storage review. |
| Formal incident response not documented | Questionnaire and operational gap. | Add incident response and breach notification policy. |
| Data retention/deletion policy not documented | Contracting and privacy gap. | Define retention periods, deletion workflow, and backup retention. |
