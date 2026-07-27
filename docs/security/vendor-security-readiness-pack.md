# BisaPilot Vendor Security Readiness Pack

Last updated: 2026-05-20

This pack summarizes the security posture, evidence, and open readiness items for BisaPilot. It is intended for vendor security questionnaires, buyer due diligence, and internal release review.

## Pack Contents

- [Security control summary](./security-controls.md)
- [Standard questionnaire responses](./questionnaire-responses.md)
- [Role matrix](../role-matrix.md)

## Product Scope

BisaPilot is a mobile-first business operations application for SME sales, inventory, procurement, accounting workflows, role-based staff access, document generation, and cloud sync through Supabase.

The application currently includes:

- React/Ionic frontend.
- Supabase-backed business data storage.
- Supabase row-level security for owner-authenticated business records.
- Custom employee-local sessions backed by credential verification RPCs.
- Role-based access control and workflow-specific server-side enforcement.
- Audit event and notification persistence.

## Current Readiness Status

| Area | Status | Notes |
| --- | --- | --- |
| Role-based access control | Implemented | Formal role matrix exists and default permissions are tested. |
| Least privilege defaults | Implemented | Admin is system administrator only by default; business execution is assigned to operational roles. |
| Temporary password handling | Implemented | Temporary credentials are hashed in Supabase and employees are forced to change password after first sign-in. |
| Server-side workflow enforcement | Implemented | Employee purchase, payment, payable, transfer, expense, inventory movement, and restock workflows use RPC enforcement. |
| Tenant data isolation | Implemented for owner sessions | Supabase RLS uses `user_owns_business(business_id)` policies. |
| Audit trail | Implemented | Business audit events and notifications are persisted in cloud tables. |
| Sensitive settings segregation | Implemented | Sensitive settings are restricted to System Administrator with `permissions.manage`. |
| Automated tests | Implemented | Unit tests cover RBAC, auth, business workflows, and sync behavior. |
| Independent penetration test | Not completed | Required before enterprise production claims. |
| SOC 2 / ISO 27001 certification | Not completed | Do not claim certification until an external audit is completed. |
| Formal incident response program | Draft needed | A lightweight policy can be added next. |
| Formal data retention/deletion policy | Draft needed | Product behavior and customer commitments should be documented before enterprise rollout. |
| SSO/SAML/SCIM | Not implemented | Not required for current SME target, but common in enterprise questionnaires. |

## Security Evidence Index

| Evidence | Location |
| --- | --- |
| Role labels and default permissions | `src/authz/defaults.ts` |
| Permission resolution and deny-wins behavior | `src/authz/permissions.ts` |
| RBAC tests | `src/authz/rbac.test.ts`, `src/authz/phase2_rbac.test.ts` |
| Employee auth and password-change tests | `src/context/AuthContext.test.tsx`, `src/pages/SettingsPage.test.tsx`, `src/App.test.tsx` |
| Hashed employee credentials migration | `supabase/migrations/202605191930_harden_employee_credentials.sql` |
| Employee workflow enforcement migration | `supabase/migrations/202605192230_enforce_employee_workflows.sql` |
| Cloud audit/notification migration | `supabase/migrations/202605192130_cloud_audit_notifications.sql` |
| RLS owner policies | `supabase/migrations/*` |
| Role matrix documentation | `docs/role-matrix.md` |

## Recommended Enterprise Readiness Sequence

1. Complete formal security policies: incident response, access review, data retention, backup/restore, and vulnerability management.
2. Run dependency and vulnerability review as a release gate.
3. Add production logging/monitoring expectations for authentication failures, workflow RPC failures, and privilege changes.
4. Document deployment architecture, backup posture, regions, and subprocessors.
5. Run an independent penetration test.
6. Prepare evidence exports for common questionnaire categories.

## Important Claim Boundaries

Use precise language in vendor questionnaires:

- Say "role-based access control is implemented" instead of "enterprise IAM is fully certified."
- Say "employee passwords are hashed in Supabase using `pgcrypto`" instead of "we operate a mature enterprise identity platform."
- Say "audit events are persisted for business workflows" instead of "full SIEM-grade audit logging is implemented."
- Say "SOC 2/ISO 27001 not yet completed" unless certification work has actually been completed.
