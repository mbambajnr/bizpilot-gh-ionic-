import type { AppPermission } from '../authz/types';
import type { BusinessState } from '../data/seedBusiness';
import { selectDashboardMetrics } from '../selectors/businessSelectors';
import { formatCurrency } from './format';
import { detectExpenseAnomalies } from './anomalyDetection';
import { forecastCollections } from './collectionsForecast';
import { forecastDemand } from './demandForecast';

/**
 * Capability #4 of BisaPilot's governed "propose -> approve" AI layer: a role-scoped, READ-ONLY assistant.
 *
 * v1 is deterministic on purpose. Each intent is a permission-gated question with a resolver that answers
 * from BusinessState using existing selectors and the other three AI engines — it never writes, and it only
 * returns data the caller's role is allowed to see. This is precisely the tool layer a free-text LLM would
 * call later behind the :8787 proxy (the LLM would parse the question and route to `answerAssistant`),
 * which keeps the doc's rule intact: the model orchestrates, it never touches the ledger directly.
 */

export type AssistantAnswerRow = { label: string; value: string; detail?: string };
export type AssistantAnswer = { title: string; summary: string; rows: AssistantAnswerRow[] };

type AssistantContext = { state: BusinessState; now: number; currency: string };

export type AssistantIntent = {
  id: string;
  /** Suggested question shown to the user. */
  question: string;
  /** Lowercase keywords for the deterministic matcher (LLM stand-in). */
  keywords: string[];
  /** The role needs at least one of these permissions to use the intent. */
  permissions: AppPermission[];
  resolve: (ctx: AssistantContext) => AssistantAnswer;
};

function monthKeyOf(now: number): string {
  return new Date(now).toISOString().slice(0, 7);
}

const INTENTS: AssistantIntent[] = [
  {
    id: 'cash_position',
    question: "What's my cash position today?",
    keywords: ['cash', 'position', 'today', 'money', 'balance'],
    permissions: ['reports.dashboard.view', 'sales.view', 'reports.financial.view'],
    resolve: ({ state, currency }) => {
      const m = selectDashboardMetrics(state);
      return {
        title: 'Cash position today',
        summary: `${formatCurrency(m.salesToday, currency)} in sales so far today across ${m.salesTodayCount} invoice${m.salesTodayCount === 1 ? '' : 's'}.`,
        rows: [
          { label: 'Sales today', value: formatCurrency(m.salesToday, currency) },
          { label: 'Cash in hand', value: formatCurrency(m.cashInHand, currency) },
          { label: 'Mobile money received', value: formatCurrency(m.mobileMoneyReceived, currency) },
          { label: 'Outstanding receivables', value: formatCurrency(m.receivables, currency), detail: `${m.customersOwingCount} customer${m.customersOwingCount === 1 ? '' : 's'} owing` },
        ],
      };
    },
  },
  {
    id: 'receivables',
    question: 'Who owes me the most money?',
    keywords: ['owe', 'owes', 'receivable', 'receivables', 'debtor', 'debtors', 'outstanding', 'money'],
    permissions: ['sales.view', 'reports.sales.view', 'customers.ledger.view'],
    resolve: ({ state, now, currency }) => {
      const forecasts = forecastCollections(state, now);
      const total = forecasts.reduce((sum, entry) => sum + entry.outstanding, 0);
      return {
        title: 'Top outstanding customers',
        summary: forecasts.length ? `${formatCurrency(total, currency)} outstanding across ${forecasts.length} customer${forecasts.length === 1 ? '' : 's'}.` : 'No customer currently owes a balance.',
        rows: forecasts.slice(0, 5).map((entry) => ({
          label: entry.customerName,
          value: formatCurrency(entry.outstanding, currency),
          detail: `${entry.riskBand} risk · oldest ${entry.oldestOpenAgeDays}d`,
        })),
      };
    },
  },
  {
    id: 'collections_risk',
    question: 'Which customers are likely to pay late?',
    keywords: ['late', 'risk', 'collections', 'chase', 'pay', 'payment', 'likely'],
    permissions: ['sales.view', 'customers.ledger.view'],
    resolve: ({ state, now, currency }) => {
      const risky = forecastCollections(state, now).filter((entry) => entry.riskBand !== 'low');
      return {
        title: 'Customers to watch for late payment',
        summary: risky.length ? `${risky.length} customer${risky.length === 1 ? '' : 's'} at elevated payment risk.` : 'No customer is at elevated payment risk right now.',
        rows: risky.slice(0, 5).map((entry) => ({
          label: entry.customerName,
          value: `${entry.riskBand} risk`,
          detail: `${formatCurrency(entry.outstanding, currency)} · ${entry.signals[0] ?? ''}`,
        })),
      };
    },
  },
  {
    id: 'stockout_risk',
    question: 'What needs reordering?',
    keywords: ['reorder', 'restock', 'stock', 'stockout', 'inventory', 'replenish', 'low'],
    permissions: ['inventory.view', 'reports.inventory.view', 'restockRequests.view'],
    resolve: ({ state, now }) => {
      const urgent = forecastDemand(state, now).filter((entry) => entry.riskBand === 'stockout' || entry.riskBand === 'reorder_now');
      return {
        title: 'Products to reorder',
        summary: urgent.length ? `${urgent.length} product line${urgent.length === 1 ? '' : 's'} need reordering now.` : 'No product needs reordering right now.',
        rows: urgent.slice(0, 5).map((entry) => ({
          label: entry.productName,
          value: `${entry.suggestedReorderQty} ${entry.unit}`,
          detail: `${entry.locationLabel} · ${entry.projectedStockoutInDays != null ? `${entry.projectedStockoutInDays}d cover` : 'out of stock'}`,
        })),
      };
    },
  },
  {
    id: 'top_expenses',
    question: 'What were my biggest expenses this month?',
    keywords: ['expense', 'expenses', 'spend', 'spending', 'cost', 'costs', 'biggest', 'month'],
    permissions: ['expenses.view'],
    resolve: ({ state, now, currency }) => {
      const monthKey = monthKeyOf(now);
      const totals = new Map<string, number>();
      for (const expense of state.expenses) {
        if (expense.status === 'rejected' || expense.createdAt.slice(0, 7) !== monthKey) continue;
        totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
      }
      const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
      const total = ranked.reduce((sum, [, amount]) => sum + amount, 0);
      return {
        title: 'Top expense categories this month',
        summary: ranked.length ? `${formatCurrency(total, currency)} recorded across ${ranked.length} categor${ranked.length === 1 ? 'y' : 'ies'}.` : 'No expenses recorded this month.',
        rows: ranked.slice(0, 5).map(([category, amount]) => ({ label: category, value: formatCurrency(amount, currency) })),
      };
    },
  },
  {
    id: 'expense_anomalies',
    question: 'Are there any unusual expenses to review?',
    keywords: ['unusual', 'anomaly', 'anomalies', 'suspicious', 'review', 'flag', 'flagged', 'expense'],
    permissions: ['expenses.view'],
    resolve: ({ state }) => {
      const flags = detectExpenseAnomalies(state);
      const byExpense = new Set(flags.map((flag) => flag.expenseId));
      return {
        title: 'Expenses flagged for review',
        summary: byExpense.size ? `${byExpense.size} expense${byExpense.size === 1 ? '' : 's'} flagged by the anomaly checks.` : 'No expenses are currently flagged.',
        rows: flags.slice(0, 5).map((flag) => ({ label: flag.severity === 'critical' ? 'High severity' : 'Warning', value: flag.reason })),
      };
    },
  },
];

/** Intents the role can use — it holds at least one required permission for each. */
export function availableAssistantIntents(hasPermission: (permission: AppPermission) => boolean): AssistantIntent[] {
  return INTENTS.filter((intent) => intent.permissions.some((permission) => hasPermission(permission)));
}

function isAuthorized(intent: AssistantIntent, hasPermission: (permission: AppPermission) => boolean): boolean {
  return intent.permissions.some((permission) => hasPermission(permission));
}

export type AssistantResult = { ok: true; answer: AssistantAnswer } | { ok: false; message: string };

/** Answer a specific intent, enforcing the role's permissions. */
export function answerAssistant(
  state: BusinessState,
  intentId: string,
  hasPermission: (permission: AppPermission) => boolean,
  now: number,
): AssistantResult {
  const intent = INTENTS.find((entry) => entry.id === intentId);
  if (!intent) return { ok: false, message: 'That is not a question I can answer yet.' };
  if (!isAuthorized(intent, hasPermission)) return { ok: false, message: 'Your role does not have access to that information.' };
  return { ok: true, answer: intent.resolve({ state, now, currency: state.businessProfile.currency }) };
}

/**
 * Deterministic keyword matcher standing in for the LLM until it is wired behind the proxy.
 * Returns the highest-scoring intent the role is allowed to use, or null when nothing matches.
 */
export function matchAssistantIntent(query: string, hasPermission: (permission: AppPermission) => boolean): AssistantIntent | null {
  const words = query.toLowerCase().match(/[a-z]+/g) ?? [];
  // Tolerate simple inflections ("reordering" -> "reorder") by matching on stem containment.
  const matches = (keyword: string) => words.some((word) => word.length >= 3 && (word === keyword || word.includes(keyword) || keyword.includes(word)));
  let best: AssistantIntent | null = null;
  let bestScore = 0;
  for (const intent of availableAssistantIntents(hasPermission)) {
    const score = intent.keywords.reduce((total, keyword) => total + (matches(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

/**
 * Build the prompt that asks a language model to route a free-text question to one available intent id.
 * The model only chooses the tool; the deterministic resolver still produces the answer, so the model
 * never touches the ledger — it orchestrates.
 */
export function buildAssistantRoutingPrompt(question: string, intents: AssistantIntent[]): { system: string; prompt: string } {
  const catalogue = intents.map((intent) => `- ${intent.id}: ${intent.question}`).join('\n');
  return {
    system: 'You route a small-business owner\'s question to exactly one available report id. Reply with ONLY the id and nothing else. If none fit, reply NONE.',
    prompt: `Available reports:\n${catalogue}\n\nQuestion: ${question}\n\nBest report id:`,
  };
}

/** Map a model reply back to one of the role's available intents, or null when it does not match. */
export function resolveRoutedIntent(reply: string | null, intents: AssistantIntent[]): AssistantIntent | null {
  if (!reply) return null;
  const token = reply.trim().toLowerCase().replace(/[^a-z_]/g, '');
  if (!token || token === 'none') return null;
  return intents.find((intent) => intent.id === token) ?? intents.find((intent) => token.includes(intent.id)) ?? null;
}
