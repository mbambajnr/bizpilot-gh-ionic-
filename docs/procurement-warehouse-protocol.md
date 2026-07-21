# Procurement and Warehouse Lifecycle Protocol

## Objective

Control the movement of demand, supplier commitments, physical goods, inventory availability, invoices, and cash through one auditable chain. No goods may become available stock before inspection and put-away, and no supplier payable may be approved before the purchase order, accepted receipt, and supplier invoice agree.

## Roles and separation of duties

| Role | Primary responsibility | Must not self-approve |
| --- | --- | --- |
| Requester / Department lead | Raise demand and business justification | Purchase approval or receipt |
| Procurement officer | Source supplier, prepare PO, maintain supplier documents | Own PO above approval threshold |
| General Manager / Approver | Approve budget, supplier, quantity, and commercial terms | Receipt or invoice evidence |
| Warehouse Manager | Record arrival, inspect, quarantine, reject, put away, and dispatch approved internal transfers | PO approval, supplier invoice approval, or destination receipt |
| Store Manager / Destination custodian | Receive dispatched transfers into the destination store | Transfer approval or dispatch |
| Accountant | Record supplier invoice, run three-way match, prepare payment | Goods inspection |
| Payment approver | Release matched and approved payable | Supplier invoice entry where avoidable |

Emergency access must be time-bound, documented, and reviewed in the audit log.

## Standard lifecycle

| Stage | System state | Owner | Required evidence | Exit control |
| --- | --- | --- | --- | --- |
| Demand | Reorder signal or request | Requester | Need, location, quantity, required date | Valid stock need and budget owner |
| Sourcing | Draft PO | Procurement | Approved vendor, quote, price, lead time, terms | Complete PO lines and supplier documents |
| Approval | Submitted / under review | General Manager | Budget and authority decision | Named approver and timestamp |
| Commitment | Approved | Procurement | Released PO and expected delivery date | Supplier acknowledgement |
| Arrival | Arrived pending inspection | Warehouse | GRN, delivery note, warehouse, carrier, delivered quantities | Every delivered line captured; stock remains unavailable |
| Inspection | Accepted or exception receipt | Warehouse | Accepted, quarantined, and rejected quantities; condition note | Quantities reconcile exactly to delivery |
| Put-away | Partial or received to warehouse | Warehouse | Accepted quantity and stock movement reference | Only accepted stock posted as available |
| Invoice matching | Pending, matched, or variance | Accountant | PO, accepted GRN, supplier invoice | Three-way match or approved exception |
| Settlement | Approved payable / paid | Accountant and approver | Payment method and bank/reference evidence | Dual control and immutable audit trail |
| Close | Closed and retained | System owner | Full document pack and activity history | Retention policy satisfied |

## Warehouse receiving protocol

1. Confirm the supplier, PO, delivery note, receiving warehouse, and physical seal or vehicle reference.
2. Count delivered quantities at the dock and issue a system GRN. Do not post these quantities to available inventory.
3. Inspect condition, specification, batch or serial data where applicable, and shelf life for controlled products.
4. Reconcile each line so `accepted + quarantined + rejected = delivered`.
5. Put accepted units away in the correct warehouse location. The system posts stock only at this point.
6. Hold quarantined units outside saleable stock until a documented release or rejection decision.
7. Keep rejected units outside saleable stock and open supplier replacement, return, or credit-note follow-up.
8. Escalate shortages, over-deliveries, damage, wrong items, and missing documents through the exception worklist.

## Three-way match protocol

The payable remains blocked unless:

- The purchase order was approved by an authorized role.
- All quantities being invoiced were accepted through warehouse inspection.
- The supplier invoice number is unique for that supplier.
- Invoice value agrees with the approved PO, subject to configured tolerance policy.
- No receipt remains pending inspection.

Variances require an identified owner, reason, supporting document, and approval before payment.

## Internal transfer protocol

Internal stock follows `request -> General Manager approval -> Warehouse Manager dispatch -> Store Manager destination receipt`. Destination receipt is prohibited before dispatch. The requester cannot approve the transfer, the approver cannot dispatch it, and the dispatcher or approver cannot also confirm destination receipt.

## Exception ownership

| Exception | Immediate owner | Resolution |
| --- | --- | --- |
| Short delivery | Procurement | Backorder, revised commitment, or PO close approval |
| Over-delivery | Warehouse and procurement | Reject or approve PO amendment before acceptance |
| Damage / quality failure | Warehouse | Quarantine, evidence, supplier return or replacement |
| Wrong item | Warehouse | Reject and prevent stock posting |
| Price or tax variance | Accountant and procurement | Correct invoice, PO amendment, or approved variance |
| Duplicate invoice | Accountant | Block and investigate |
| Missing delivery note | Warehouse | Hold inspection completion until evidence is supplied |

## Operating metrics

- Requisition-to-approval cycle time
- PO-to-delivery lead time and supplier on-time rate
- Dock-to-inspection and inspection-to-put-away time
- Receipt accuracy and rejection rate by supplier
- Open quarantine age
- Backorder age and fill rate
- Three-way match first-pass rate
- Invoice-to-payment cycle time
- Inventory adjustment rate after receipt

## Current implementation

BizPilot now enforces dock arrival, GRN creation, pending inspection, reconciled inspection quantities, accepted-only stock posting, receipt exceptions, three-way matching, transfer role separation, and dispatch-before-receipt for internal transfers. The next control increments are configurable delivery tolerances, quarantine release, supplier return authorization, PO amendment approval, and supplier scorecards.
