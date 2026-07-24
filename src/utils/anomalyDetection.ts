import type { BusinessState, Expense } from '../data/seedBusiness';

/**
 * Deterministic, explainable anomaly signals for expenses.
 *
 * This is the first capability of BizPilot's governed "propose -> approve" AI layer. It is intentionally
 * rule/statistics based rather than generative: every flag carries a plain-language `reason`, the output
 * is stable for the same input, and it never mutates state. Flags are advisory only — a human still
 * approves or rejects each expense through the existing approval gates.
 *
 * It is structured so a server-side LLM scorer (behind the BizPilot proxy) can later contribute an
 * additional `ExpenseAnomaly` for the same expense without changing this contract or the UI.
 */

export type AnomalySeverity = 'warning' | 'critical';

export type AnomalyCode = 'category_outlier' | 'threshold_proximity' | 'possible_duplicate' | 'velocity_spike';

export type ExpenseAnomaly = {
  expenseId: string;
  code: AnomalyCode;
  severity: AnomalySeverity;
  /** Human-readable explanation shown in the UI and retained for audit. */
  reason: string;
};

/** How close (fraction under) an expense must sit to the approval threshold to look like structuring. */
const THRESHOLD_PROXIMITY_BAND = 0.1; // within 10% under the line
/** Minimum number of OTHER same-category expenses before category outlier scoring is trustworthy. */
const MIN_CATEGORY_PEERS = 4;
const OUTLIER_WARNING_Z = 2.5;
const OUTLIER_CRITICAL_Z = 3.5;
/** Window for duplicate detection (same category + amount + recorder). */
const DUPLICATE_WINDOW_MS = 48 * 60 * 60 * 1000;
/** Velocity: this many expenses by one recorder inside the window trips the flag. */
const VELOCITY_WINDOW_MS = 60 * 60 * 1000;
const VELOCITY_COUNT = 5;

type CategoryAggregate = { sum: number; sumSq: number; count: number };

/** Running sum / sum-of-squares / count of amounts per category, over expenses that were not rejected. */
function buildCategoryAggregates(expenses: Expense[]): Map<string, CategoryAggregate> {
  const aggregates = new Map<string, CategoryAggregate>();
  for (const expense of expenses) {
    if (expense.status === 'rejected') continue;
    const current = aggregates.get(expense.category) ?? { sum: 0, sumSq: 0, count: 0 };
    current.sum += expense.amount;
    current.sumSq += expense.amount ** 2;
    current.count += 1;
    aggregates.set(expense.category, current);
  }
  return aggregates;
}

/**
 * Leave-one-out mean/std for a category, excluding `amount` (the expense being scored) so that a single
 * large value can't inflate its own category's spread and mask itself. Returns null without enough peers.
 */
function peerStats(aggregate: CategoryAggregate, amount: number): { mean: number; std: number } | null {
  const count = aggregate.count - 1;
  if (count < MIN_CATEGORY_PEERS) return null;
  const mean = (aggregate.sum - amount) / count;
  const variance = Math.max(0, (aggregate.sumSq - amount ** 2) / count - mean ** 2);
  return { mean, std: Math.sqrt(variance) };
}

function formatAmount(value: number, currency: string): string {
  return `${currency} ${Math.round(value).toLocaleString('en-US')}`;
}

/**
 * Score every non-rejected expense in `state`, returning at most one flag per (expense, code).
 * Sorted by severity (critical first) then most recent expense, so the UI can show the worst first.
 */
export function detectExpenseAnomalies(state: BusinessState): ExpenseAnomaly[] {
  const expenses = state.expenses ?? [];
  const currency = state.businessProfile.currency;
  const threshold = state.businessProfile.expenseApprovalThreshold;
  const aggregates = buildCategoryAggregates(expenses);
  const flags: ExpenseAnomaly[] = [];

  for (const expense of expenses) {
    if (expense.status === 'rejected') continue;
    const createdMs = Date.parse(expense.createdAt);

    // 1. Category outlier — amount far above the category's usual spend (judged against its peers only).
    const aggregate = aggregates.get(expense.category);
    const stats = aggregate ? peerStats(aggregate, expense.amount) : null;
    if (stats && stats.std > 0) {
      const z = (expense.amount - stats.mean) / stats.std;
      if (z >= OUTLIER_WARNING_Z) {
        const multiple = stats.mean > 0 ? expense.amount / stats.mean : 0;
        flags.push({
          expenseId: expense.id,
          code: 'category_outlier',
          severity: z >= OUTLIER_CRITICAL_Z ? 'critical' : 'warning',
          reason: `${formatAmount(expense.amount, currency)} is ${multiple.toFixed(1)}× the usual ${expense.category} spend (typically ≈ ${formatAmount(stats.mean, currency)}).`,
        });
      }
    }

    // 2. Threshold proximity — sits just under the approval line, a classic structuring pattern.
    if (threshold != null && threshold > 0 && expense.amount < threshold && expense.amount >= threshold * (1 - THRESHOLD_PROXIMITY_BAND)) {
      flags.push({
        expenseId: expense.id,
        code: 'threshold_proximity',
        severity: 'warning',
        reason: `${formatAmount(expense.amount, currency)} sits just under the ${formatAmount(threshold, currency)} approval line, avoiding approval by a narrow margin.`,
      });
    }

    // 3. Possible duplicate — same category, amount, and recorder within the window.
    const duplicate = expenses.find((other) =>
      other.id !== expense.id &&
      other.status !== 'rejected' &&
      other.category === expense.category &&
      other.amount === expense.amount &&
      other.recordedByUserId === expense.recordedByUserId &&
      Math.abs(Date.parse(other.createdAt) - createdMs) <= DUPLICATE_WINDOW_MS,
    );
    if (duplicate) {
      flags.push({
        expenseId: expense.id,
        code: 'possible_duplicate',
        severity: 'warning',
        reason: `Matches another ${expense.category} expense of ${formatAmount(expense.amount, currency)} by ${expense.recordedByName} within 48 hours — possible duplicate entry.`,
      });
    }

    // 4. Velocity spike — a burst of entries by one recorder in a short window.
    const burst = expenses.filter((other) =>
      other.status !== 'rejected' &&
      other.recordedByUserId === expense.recordedByUserId &&
      Math.abs(Date.parse(other.createdAt) - createdMs) <= VELOCITY_WINDOW_MS,
    ).length;
    if (burst >= VELOCITY_COUNT) {
      flags.push({
        expenseId: expense.id,
        code: 'velocity_spike',
        severity: 'warning',
        reason: `${expense.recordedByName} logged ${burst} expenses within an hour — unusually rapid entry.`,
      });
    }
  }

  const rank: Record<AnomalySeverity, number> = { critical: 0, warning: 1 };
  const createdAtOf = (id: string) => Date.parse(expenses.find((expense) => expense.id === id)?.createdAt ?? '') || 0;
  return flags.sort((left, right) => rank[left.severity] - rank[right.severity] || createdAtOf(right.expenseId) - createdAtOf(left.expenseId));
}

/** Group flags by expense id for O(1) lookup while rendering rows. */
export function groupAnomaliesByExpense(flags: ExpenseAnomaly[]): Map<string, ExpenseAnomaly[]> {
  const map = new Map<string, ExpenseAnomaly[]>();
  for (const flag of flags) {
    const list = map.get(flag.expenseId) ?? [];
    list.push(flag);
    map.set(flag.expenseId, list);
  }
  return map;
}
