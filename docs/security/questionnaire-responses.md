# Standard Vendor Security Questionnaire Responses

Last updated: 2026-05-20

These are draft responses for common vendor security questionnaires. They should be reviewed before being sent externally and updated whenever deployment architecture or operating policies change.

## Company And Product

| Question | Draft response |
| --- | --- |
| What does the product do? | BisaPilot is a business operations application for sales, inventory, procurement, accounting workflows, staff access control, document generation, and cloud-backed business records. |
| Is the product multi-tenant? | The application stores business records with `business_id` scoping. Supabase row-level security policies enforce owner access to business-scoped records. |
| Is this production certified under SOC 2, ISO 27001, or similar? | Not yet. Security controls are being implemented and documented, but no external certification is currently claimed. |

## Authentication

| Question | Draft response |
| --- | --- |
| Does the application support role-based access control? | Yes. BisaPilot has role-based access control with default permissions per role and explicit grant/revoke overrides per user. |
| Are users forced to change temporary passwords? | Yes. Employees signing in with admin-issued temporary credentials are routed to security settings and must replace the temporary password before normal work. |
| Are employee passwords stored in plaintext? | No for the current hardened schema. Employee credentials use a password hash column and Supabase `pgcrypto` hashing. Legacy plaintext temporary values are cleared by the hardening migration. |
| Does the product support SSO/SAML? | Not currently. SSO/SAML should be treated as a future enterprise capability. |
| Does the product support MFA? | Not currently documented in the application layer. If Supabase Auth MFA is enabled at deployment, document it separately. |

## Authorization

| Question | Draft response |
| --- | --- |
| How is access restricted by role? | Access is controlled through a centralized permission list and default role matrix. See `docs/role-matrix.md`. |
| Can system administrators perform business operations by default? | No. The System Administrator role is limited to users, roles, permissions, business settings, and branding by default. |
| Can Store Managers manage vendors or procurement? | No. Store Managers can create restock requests to the warehouse and receive store transfers, but they cannot manage vendors, create purchases, approve procurement, or receive purchases. |
| Can Purchase Managers receive stock? | No. Purchase Managers create and submit purchase/procurement records. Purchase receipt is assigned to Warehouse Manager. |
| Are critical workflows enforced server-side? | Yes for employee-local sessions. Purchases use `sync_employee_purchase`; payments, payables, expenses, transfers, inventory movements, and restock requests use `sync_employee_workflow`. |

## Data Protection

| Question | Draft response |
| --- | --- |
| How is tenant data isolated? | Business records include a `business_id`; Supabase RLS policies use `user_owns_business(business_id)` to restrict owner-authenticated access. |
| Is sensitive credential data returned to the client? | Plaintext temporary passwords are not hydrated from cloud employee credential loads. New temporary passwords are shown only during admin reset/create flow. |
| Is data encrypted at rest? | This depends on the configured Supabase infrastructure. Confirm the production Supabase project settings before answering externally. |
| Is data encrypted in transit? | Supabase and hosted web deployments should use HTTPS/TLS. Confirm the production hosting configuration before answering externally. |
| Is customer data cached locally? | The app uses browser local storage for workspace continuity/offline-like fallback. This should be documented as a device security consideration. |

## Audit And Logging

| Question | Draft response |
| --- | --- |
| Are business actions logged? | Yes. Business workflow events are recorded as activity log entries and synced to `business_audit_events`. |
| Are approval actions traceable? | Yes. Purchases, payables, transfer actions, and related notifications record actor/status fields where supported by schema. |
| Are notifications persisted? | Yes. App notifications and read receipts are backed by Supabase tables. |
| Is there a SIEM integration? | Not currently. Audit data is available in the application database, but SIEM forwarding is not implemented. |

## Secure Development And Testing

| Question | Draft response |
| --- | --- |
| Are security-related changes tested? | Yes. Unit tests cover RBAC, employee auth, password-change routing, workflow logic, and sync behavior. |
| What verification commands are used? | `npm run test.unit -- --run` and `npm run build`. |
| Are dependencies scanned? | Not yet documented as a formal release gate. Add dependency scanning before enterprise production rollout. |
| Has an independent penetration test been completed? | Not yet. This is a recommended next step before claiming enterprise-grade security readiness. |

## Operations And Governance

| Question | Draft response |
| --- | --- |
| Is there a formal incident response plan? | Not yet documented. A policy should be added before enterprise customer onboarding. |
| Is there a data retention and deletion policy? | Not yet documented. Define retention/deletion commitments before signing enterprise agreements. |
| Are backups documented? | Not yet in this repository. Confirm production Supabase backup settings and document RPO/RTO. |
| Are subprocessors documented? | Not yet. At minimum, Supabase and hosting/email providers should be listed once deployment is finalized. |

## Recommended Safe Questionnaire Language

Use:

- "Implemented in product code and database migrations."
- "Supported by automated tests."
- "Not currently certified."
- "Pending production deployment confirmation."

Avoid:

- "SOC 2 compliant" unless a SOC 2 report exists.
- "Enterprise-ready" without noting gaps such as pen test, incident response, retention, and SSO.
- "No local data storage" because the app uses browser local storage.
