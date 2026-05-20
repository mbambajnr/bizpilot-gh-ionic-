# BisaPilot Role Matrix

Last updated: 2026-05-20

This document defines the default role model for BisaPilot. The source of truth for default permissions is `src/authz/defaults.ts`; this document explains the intent, workflow boundaries, and high-risk exclusions behind those defaults.

## Access Model

BisaPilot uses role-based access control with optional per-user permission overrides.

- Default permissions come from the user's role.
- Explicitly granted permissions add to the role default.
- Explicitly revoked permissions remove access even if the role grants it.
- Deny wins when a permission appears in both granted and revoked lists.
- Employee-local cloud writes must pass server-side workflow RPC checks for protected workflows.

## Role Responsibilities

| Role | Primary responsibility | Default scope |
| --- | --- | --- |
| System Administrator | Configure the system, users, roles, permissions, business profile, and branding. | System administration only. No default business operation execution. |
| General Manager | Supervise operations, review reports, approve procurement, approve payables, approve/cancel transfers, and manage high-level supply decisions. | Oversight and approval. Limited execution. |
| Sales Manager | Manage sales, quotations, customers, invoices, sales reporting, and sales-driven stock requests/transfers. | Sales operations and sales reporting. |
| Accountant | Manage payables, supplier payments, expenses, payment records, customer ledgers, and financial reporting. | Finance execution and financial visibility. |
| Warehouse Manager | Receive approved purchases, manage warehouse inventory, manage restock requests, approve/dispatch/receive transfers, and view inventory reports. | Warehouse operations and stock movement control. |
| Store Manager | Run store sales, customers, quotations, payment capture, store transfer receipt, and restock requests to warehouse. | Store operations. No vendor or procurement management. |
| Purchase Manager | Create purchase/procurement drafts and submit them for approval. Manage vendor records by default. | Procurement initiation. No purchase approval, receipt, or payment. |

## Default Permission Matrix

| Permission | Admin | General Manager | Sales Manager | Accountant | Warehouse Manager | Store Manager | Purchase Manager |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `users.manage` | Yes | No | No | No | No | No | No |
| `roles.assign` | Yes | No | No | No | No | No | No |
| `permissions.manage` | Yes | No | No | No | No | No | No |
| `business.view` | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `business.edit` | Yes | No | No | No | No | No | No |
| `branding.view` | Yes | Yes | No | No | No | No | No |
| `branding.manage` | Yes | No | No | No | No | No | No |
| `sales.view` | No | Yes | Yes | No | No | Yes | No |
| `sales.create` | No | Yes | Yes | No | No | Yes | No |
| `sales.reverse` | No | Yes | No | No | No | No | No |
| `quotations.view` | No | Yes | Yes | No | No | Yes | No |
| `quotations.create` | No | Yes | Yes | No | No | Yes | No |
| `quotations.convert` | No | Yes | Yes | No | No | Yes | No |
| `invoices.view` | No | Yes | Yes | No | No | Yes | No |
| `invoices.print` | No | Yes | Yes | No | No | Yes | No |
| `invoices.export_pdf` | No | Yes | Yes | No | No | Yes | No |
| `customers.view` | No | Yes | Yes | Yes | No | Yes | No |
| `customers.create` | No | Yes | Yes | No | No | Yes | No |
| `customers.edit` | No | Yes | Yes | No | No | Yes | No |
| `customers.email.send` | No | Yes | No | No | No | No | No |
| `customers.ledger.view` | No | Yes | Yes | Yes | No | Yes | No |
| `inventory.view` | No | Yes | Yes | No | Yes | Yes | Yes |
| `inventory.create` | No | Yes | No | No | No | No | Yes |
| `inventory.edit` | No | Yes | No | No | No | No | No |
| `inventory.adjust` | No | No | No | No | Yes | No | No |
| `inventory.restock` | No | Yes | No | No | No | No | No |
| `vendors.view` | No | Yes | Yes | Yes | No | No | Yes |
| `vendors.manage` | No | Yes | No | No | No | No | Yes |
| `vendors.create` | No | Yes | No | No | No | No | Yes |
| `vendors.edit` | No | Yes | No | No | No | No | Yes |
| `purchases.view` | No | Yes | Yes | No | Yes | No | Yes |
| `purchases.create` | No | Yes | Yes | No | No | No | Yes |
| `purchases.approve` | No | Yes | No | No | No | No | No |
| `purchases.receive` | No | No | No | No | Yes | No | No |
| `procurement.view` | No | Yes | Yes | No | No | No | Yes |
| `procurement.create` | No | Yes | Yes | No | No | No | Yes |
| `procurement.approve` | No | Yes | No | No | No | No | No |
| `payables.view` | No | Yes | No | Yes | No | No | No |
| `payables.manage` | No | Yes | No | Yes | No | No | No |
| `payables.approve` | No | Yes | No | No | No | No | No |
| `payables.pay` | No | No | No | Yes | No | No | No |
| `payments.view` | No | Yes | No | Yes | No | Yes | No |
| `payments.record` | No | Yes | No | Yes | No | Yes | No |
| `accounting.access` | No | Yes | No | Yes | No | Yes | No |
| `expenses.view` | No | Yes | No | Yes | No | No | No |
| `expenses.create` | No | No | No | Yes | No | No | No |
| `expenses.edit` | No | No | No | No | No | No | No |
| `transfers.view` | No | Yes | Yes | No | Yes | Yes | No |
| `transfers.create` | No | Yes | Yes | No | Yes | Yes | No |
| `transfers.approve` | No | Yes | No | No | Yes | No | No |
| `transfers.dispatch` | No | No | No | No | Yes | No | No |
| `transfers.receive` | No | No | No | No | Yes | Yes | No |
| `restockRequests.view` | No | Yes | Yes | No | Yes | Yes | No |
| `restockRequests.create` | No | Yes | Yes | No | No | Yes | No |
| `restockRequests.manage` | No | Yes | No | No | Yes | No | No |
| `reports.dashboard.view` | No | Yes | Yes | Yes | Yes | Yes | Yes |
| `reports.sales.view` | No | Yes | Yes | No | No | Yes | No |
| `reports.financial.view` | No | Yes | No | Yes | No | No | No |
| `reports.inventory.view` | No | Yes | Yes | No | Yes | Yes | Yes |
| `quotations.print` | No | Yes | Yes | No | No | Yes | No |
| `quotations.export_pdf` | No | Yes | Yes | No | No | Yes | No |

## Workflow Ownership

| Workflow | Initiates | Approves/reviews | Executes | Notes |
| --- | --- | --- | --- | --- |
| Purchase/procurement | Purchase Manager, Sales Manager, General Manager | General Manager | Warehouse Manager receives approved purchases | Purchase Manager cannot receive purchases. |
| Supplier payable | Accountant or General Manager creates/manages payable record | General Manager approves payable | Accountant records supplier payment | General Manager does not pay by default. |
| Store restock | Store Manager, Sales Manager, General Manager | Warehouse Manager or General Manager | Warehouse fulfills through transfer process | Store Manager requests from warehouse, not vendors/procurement. |
| Stock transfer | Store Manager, Sales Manager, Warehouse Manager, General Manager | General Manager or Warehouse Manager | Warehouse Manager dispatches; Store Manager or Warehouse Manager receives | General Manager approves but does not dispatch/receive by default. |
| Expenses | Accountant | Not separately approved in current default model | Accountant records expenses | General Manager views expenses but does not create/edit them by default. |
| Customer payments | Store Manager, Accountant, General Manager | N/A | Store/accounting records payment references | Supplier payments remain Accountant-only by server-side workflow enforcement. |

## Sensitive Exclusions

These exclusions are intentional and should not be changed without an architecture review.

- System Administrator does not receive default sales, procurement, inventory, accounting, payment, transfer, payable, or reporting execution permissions.
- System Administrator should not receive operational workflow notifications by default.
- Store Manager cannot manage vendors, create purchases, approve procurement, receive purchases, pay payables, or manage sensitive settings.
- Purchase Manager cannot approve purchases, receive purchases, dispatch/receive transfers, approve/pay payables, or record expenses.
- General Manager cannot dispatch/receive transfers, receive purchases, pay payables, create expenses, edit expenses, or adjust inventory by default.
- Accountant cannot approve purchases, approve payables, create/receive transfers, receive purchases, or manage vendors by default.
- Warehouse Manager cannot pay payables, create expenses, manage vendors, or manage business settings by default.

## Server-Side Enforcement Notes

The client-side permission matrix controls navigation and visible actions. Protected employee-local writes are also checked server-side:

- Purchase workflows use `sync_employee_purchase`.
- Payments, payables, expenses, stock transfers, stock movements, and restock requests use `sync_employee_workflow`.
- These RPCs verify the employee credential, role, business ownership, and allowed status transition before writing.

Owner sessions continue to use Supabase RLS policies. Any future employee workflow should add both a client permission and an RPC rule before launch.
