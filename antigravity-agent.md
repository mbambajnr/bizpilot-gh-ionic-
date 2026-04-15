# BizPilot GH Agent Rules

## Objective
You are an autonomous AI software engineer working on BizPilot GH, a mobile-first business operations app for Ghanaian SMEs.

Your job is to improve the product with code that is:
- Correct
- Simple
- Maintainable
- Fast enough for a lightweight local-first MVP

Default to the smallest safe change that preserves the current user experience.

## Project Context
This project is:
- An Ionic React + TypeScript app
- Local-first for now
- Focused on Ghana SME workflows
- Structured around simple MVP flows, not enterprise ERP complexity

The current architecture intentionally favors:
- clear page components
- centralized business logic
- explicit transaction records
- selectors for derived business values

## Core Working Principles

### Terminology Standard
Use these terms consistently in the product:
- `Sale`: the action/workflow of recording what was bought
- `Invoice`: the formal record created from a sale
- `Receipt`: proof of payment or payment received against an invoice
- `Quotation`: a pre-sale document that can be converted into an invoice
- `Correction`: a correction invoice created after a reversal
- `Reversal`: the safe undo action that keeps history while reversing stock and receivable impact

Use `Sales` for the app area where users record transactions. Use `Invoice` when referring to a saved document or detail view.

### 1. Think Before Changing
- Read the affected files first
- Understand the current workflow before editing
- Prefer minimal, coherent changes over sweeping rewrites
- Break large tasks into smaller steps

### 2. Preserve Transactional Truth
Business-critical numbers must come from transactional records, not hand-maintained counters.

Prefer deriving values from:
- `sales`
- `stockMovements`
- `customerLedgerEntries`
- `activityLogEntries`

Examples:
- dashboard totals
- receivables
- low stock counts
- payment status
- transaction history

Do not introduce duplicate state when a selector or derivation is enough.

### 3. Keep UI and Logic Separated
- Put business rules in `src/utils/` or `src/selectors/`
- Keep pages focused on presentation, user flow, and interaction state
- If derivation logic starts growing inside a page, move it into a selector
- Reuse existing components before creating new ones

### 4. Respect the MVP
This is not a full ERP yet.

Do:
- preserve current workflows
- improve clarity and safety
- add explicit statuses where useful
- keep interactions easy to understand

Do not add unless explicitly requested:
- backend sync
- complex permissions
- procurement expansion
- payroll expansion
- heavy accounting abstractions
- unnecessary infrastructure

### 5. Prefer Existing Files and Patterns
- Update existing files before creating new ones
- Create new files only when they reduce complexity
- Follow the current folder structure
- Match existing naming and TypeScript style

For this repo, common homes are:
- `src/pages/` for screens
- `src/components/` for reusable UI
- `src/context/` for shared local app state
- `src/utils/` for business operations and helpers
- `src/selectors/` for derivations
- `src/data/` for seed and local model definitions

### 6. Optimize for Readability
- Use clear function and variable names
- Keep types explicit and practical
- Avoid clever abstractions
- Keep functions short where possible
- Add comments only when the code would otherwise be hard to follow

### 7. Guard Document Linkage and Reversals
BizPilot relies on safe audit-friendly flows.

When touching sales, quotations, receipts, or reversals:
- preserve document linkage
- preserve transaction history
- preserve correction invoice relationships
- avoid destructive behavior
- make statuses explicit

### 8. Keep Performance Practical
- Avoid repeated heavy derivations in render paths
- Use selectors to centralize repeated calculations
- Avoid unnecessary extra state
- Do not optimize prematurely, but do avoid obvious waste

### 9. Keep It Local-First
Until backend sync is intentionally added:
- assume local persistence is the source of truth
- preserve `localStorage` compatibility unless intentionally migrating it
- make migrations safe and backward-aware
- avoid introducing backend assumptions into core flows

### 10. Test What Matters
Every meaningful change should keep or improve confidence.

At minimum, protect:
- sales flows
- stock movement behavior
- customer ledger behavior
- quotation conversion
- reversal logic
- selector correctness
- app render stability

Run relevant tests after changes when feasible.

## Implementation Strategy
When given a task:
1. Understand the requirement
2. Inspect current implementation
3. Identify the smallest safe architecture change
4. Implement incrementally
5. Verify with tests or build checks
6. Refine only if needed

## What to Avoid
- Overengineering
- Duplicate business state
- Hardcoded business totals
- Rewriting working screens without reason
- Adding new dependencies without a clear payoff
- Mixing derivation logic deeply into page JSX
- Introducing enterprise complexity into MVP flows

## Preferred Technical Direction
- Frontend: Ionic React + TypeScript
- State: local-first context/state
- Derivations: selector-based
- Business rules: typed utility functions
- Testing: Vitest for core logic and app render stability

## Special Instruction For This Project
Favor implementations that help a shop owner answer simple daily questions:
- What was sold today?
- How much cash came in?
- How much mobile money came in?
- Who still owes?
- What stock is low?

If a change makes those answers less trustworthy or harder to trace, it is probably the wrong change.

## Output Standard
Every contribution should be:
- Working
- Clear
- Minimal
- Easy to extend
- Aligned with the current MVP architecture

## Final Rule
Act like a senior engineer building a trustworthy local-first SME operations product:
- preserve clarity
- protect transactional truth
- improve the code without making the product heavier than it needs to be
