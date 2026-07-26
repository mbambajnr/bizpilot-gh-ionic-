# BisaPilot workflow gap register

This register tracks end-to-end enterprise workflows across the Next.js web application, Ionic mobile applications, shared business engine, Supabase persistence, and external commerce integrations.

| Priority | Workflow | Current state | Required outcome |
| --- | --- | --- | --- |
| Complete | Invoice-to-cash collection | Partial and unpaid invoices now accept follow-up payments with balance validation, payment records, customer ledger entries, activity, notifications, and Accounting visibility. | Maintain regression coverage while cloud transaction boundaries are strengthened. |
| P0 | Server-authoritative transactions | Invoice payment now uses one idempotent, serialized database command for invoice balance, payment, customer ledger, audit, and notification writes. Sale, stock, and reversal mutations still synchronize related records independently. | Extend the command pattern to sale posting, stock mutation, and reversal workflows. |
| P0 | Employee cloud parity | Owner and authorized employee invoice payments now share the same server-validated command and credential-safe offline replay. Sales and quotation persistence still relies on owner-oriented table synchronization. | Give the remaining employee workflows a server-validated cloud command and consistent offline replay behavior. |
| P0 | Returns, refunds, and credit notes | Partial quantity returns, stock disposition, immutable credit notes, customer credits, refunds, ledger evidence, and atomic owner/employee cloud posting are implemented. | Add configurable value thresholds, a separate approval queue, printable credit-note documents, and payment-gateway refund confirmation. |
| P1 | Fulfilment lifecycle | A per-sale fulfilment state machine (picking → packed → dispatched → delivered, with failed-delivery + retry), proof-of-delivery capture, ownership, and an event timeline are implemented on the invoice, alongside the printable waybill. | Add fulfilment-specific stock reservation, partial/split shipments, and a standalone dispatch queue across invoices. |
| P1 | Financial control | Period close with locked periods, per-channel cashbooks, and bank/cash reconciliation (mark payments cleared, compare cleared balance to statement) are implemented. | Add controlled period adjustments and support for reconciling expenses once they carry a payment channel. |
| P1 | Procurement exceptions | Approval, GRN arrival, inspection, accepted-only put-away, receipt exceptions, supplier invoice, three-way match, and settlement exist. | Add purchase amendments, configurable over/under-delivery tolerances, supplier return authorization, disputed invoices, and formal backorder close. |
| P1 | Inventory control depth | Locations, movements, dispatch-before-receipt transfers, replenishment, source-neutral inventory, and receipt quarantine decisions exist. | Add quarantine release locations, reservations, cycle counts, batches, expiry dates, serial numbers, and valuation methods where enabled. |
| P1 | Commerce event ingestion | Magento status and activity can be queried; connector-neutral operating mode is supported. | Add signed webhooks, cursor-based incremental sync, retries, reconciliation queues, and additional connector adapters. |
| P2 | Evidence and approvals | Procurement documents are supported; expense and payment evidence is mostly reference-based. | Add private attachments, reviewer comments, approval delegation, escalation timers, and retention policies. |
| P2 | Cross-platform workflow tests | Shared unit coverage is broad, but browser role journeys are not fully automated. | Add role-by-role Next.js E2E journeys and mobile smoke tests for every critical state transition. |

## Delivery order

1. Server-authoritative invoice payment command and employee cloud parity.
2. Credit notes, partial returns, and refunds.
3. Fulfilment lifecycle and proof of delivery.
4. Reconciliation and period close.
5. Procurement and inventory exception handling.
6. Connector reliability and cross-platform E2E coverage.
