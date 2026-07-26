import type { BusinessState, Customer, CustomerLedgerEntry, Sale } from '../data/seedBusiness';

/**
 * Deterministic, explainable accounts-receivable collections forecast.
 *
 * Capability #2 of BizPilot's governed "propose -> approve" AI layer. Like the anomaly engine it is
 * rule/statistics based rather than generative: it predicts payment behaviour from each customer's own
 * history, every risk carries plain-language `signals`, and it never mutates state or takes an action.
 * Suggested actions are advisory — a human still sends the reminder or applies a credit hold through the
 * existing gates. Structured so a server-side model behind the BizPilot proxy can later refine the score
 * without changing this contract or the UI.
 */

export type PaymentRiskBand = 'low' | 'medium' | 'high';
export type CollectionAction = 'monitor' | 'send_reminder' | 'review_credit_hold';

export type CollectionForecast = {
  customerId: string;
  customerName: string;
  /** Current unpaid receivable balance across the customer's open invoices. */
  outstanding: number;
  /** Age in days of the customer's oldest still-open invoice. */
  oldestOpenAgeDays: number;
  openInvoiceCount: number;
  onCreditHold: boolean;
  overLimit: boolean;
  riskBand: PaymentRiskBand;
  /** 0–100. Higher = more likely to pay late or not at all. */
  riskScore: number;
  /** Average days this customer has historically taken to settle, when there is history. */
  expectedDaysToPay?: number;
  /** Fraction (0–1) of settled invoices paid after the net terms, when there is history. */
  historicalLateRate?: number;
  /** Human-readable drivers of the score, retained for audit. */
  signals: string[];
  suggestedAction: CollectionAction;
};

/** Typical SME net terms. An open invoice older than this is treated as overdue. */
export const NET_TERMS_DAYS = 30;
const MS_PER_DAY = 86_400_000;
const LOW_MAX = 30;
const MEDIUM_MAX = 60;

function balanceRemaining(sale: Sale): number {
  if (sale.status === 'Reversed') return 0;
  const receivable = sale.netReceivableAmount ?? sale.totalAmount;
  return Math.max(0, receivable - (sale.creditedAmount ?? 0) - sale.paidAmount);
}

/** Days from invoice date to its last received payment; 0 for invoices settled at point of sale. */
function daysToSettle(sale: Sale, payments: CustomerLedgerEntry[]): number {
  const paymentDates = payments
    .filter((entry) => entry.type === 'payment_received' && entry.relatedSaleId === sale.id)
    .map((entry) => Date.parse(entry.createdAt));
  if (!paymentDates.length) return 0;
  return Math.max(0, Math.round((Math.max(...paymentDates) - Date.parse(sale.createdAt)) / MS_PER_DAY));
}

type History = { settledCount: number; avgDaysToPay: number; lateRate: number };

function customerHistory(customerSales: Sale[], ledger: CustomerLedgerEntry[]): History | null {
  const settled = customerSales.filter((sale) => sale.status !== 'Reversed' && balanceRemaining(sale) <= 0.0001);
  if (!settled.length) return null;
  const daysList = settled.map((sale) => daysToSettle(sale, ledger));
  const avgDaysToPay = daysList.reduce((sum, days) => sum + days, 0) / daysList.length;
  const lateRate = daysList.filter((days) => days > NET_TERMS_DAYS).length / daysList.length;
  return { settledCount: settled.length, avgDaysToPay, lateRate };
}

function bandFor(score: number): PaymentRiskBand {
  if (score < LOW_MAX) return 'low';
  if (score < MEDIUM_MAX) return 'medium';
  return 'high';
}

/**
 * Forecast collection risk for every customer that currently owes money, most-exposed first
 * (exposure = outstanding balance weighted by risk). `now` is epoch ms so callers stay pure/testable.
 */
export function forecastCollections(state: BusinessState, now: number): CollectionForecast[] {
  const ledger = state.customerLedgerEntries ?? [];
  const salesByCustomer = new Map<string, Sale[]>();
  for (const sale of state.sales) {
    if (!sale.customerId) continue; // walk-in / cash sales carry no receivable to chase
    const list = salesByCustomer.get(sale.customerId) ?? [];
    list.push(sale);
    salesByCustomer.set(sale.customerId, list);
  }

  const forecasts: CollectionForecast[] = [];
  for (const [customerId, customerSales] of salesByCustomer) {
    const openSales = customerSales.filter((sale) => sale.status !== 'Reversed' && balanceRemaining(sale) > 0.0001);
    const outstanding = openSales.reduce((sum, sale) => sum + balanceRemaining(sale), 0);
    if (outstanding <= 0.0001) continue;

    const customer: Customer | undefined = state.customers.find((entry) => entry.id === customerId);
    const customerLedger = ledger.filter((entry) => entry.customerId === customerId);
    const history = customerHistory(customerSales, customerLedger);
    const oldestOpenAgeDays = Math.max(...openSales.map((sale) => Math.floor((now - Date.parse(sale.createdAt)) / MS_PER_DAY)), 0);
    const creditLimit = customer?.creditLimit;
    const overLimit = creditLimit != null && creditLimit > 0 && outstanding > creditLimit;
    const onCreditHold = Boolean(creditLimit != null && creditLimit > 0 && outstanding > creditLimit && !customer?.creditHoldOverride);

    let score = 0;
    const signals: string[] = [];

    if (history) {
      if (history.lateRate > 0) {
        score += history.lateRate * 40;
        signals.push(`Paid late on ${Math.round(history.lateRate * 100)}% of ${history.settledCount} settled invoice${history.settledCount === 1 ? '' : 's'}.`);
      } else {
        signals.push(`Settled all ${history.settledCount} past invoice${history.settledCount === 1 ? '' : 's'} on time.`);
      }
      if (history.avgDaysToPay > NET_TERMS_DAYS) {
        score += Math.min(20, ((history.avgDaysToPay - NET_TERMS_DAYS) / NET_TERMS_DAYS) * 20);
        signals.push(`Typically takes ${Math.round(history.avgDaysToPay)} days to pay (terms are ${NET_TERMS_DAYS}).`);
      }
    } else {
      score += 10; // no track record yet — mild uncertainty
      signals.push('No settled-invoice history yet — payment behaviour is unproven.');
    }

    if (oldestOpenAgeDays > NET_TERMS_DAYS) {
      score += Math.min(30, ((oldestOpenAgeDays - NET_TERMS_DAYS) / NET_TERMS_DAYS) * 30);
      signals.push(`Oldest unpaid invoice is ${oldestOpenAgeDays} days old — past the ${NET_TERMS_DAYS}-day terms.`);
    }

    if (overLimit) {
      score += 15;
      signals.push(`Owes ${outstanding.toFixed(0)} against a ${creditLimit?.toFixed(0)} credit limit.`);
    }

    const riskScore = Math.round(Math.min(100, score));
    const riskBand = bandFor(riskScore);
    const overdue = oldestOpenAgeDays > NET_TERMS_DAYS;
    const suggestedAction: CollectionAction =
      overLimit || (riskBand === 'high' && overdue) ? 'review_credit_hold' : overdue ? 'send_reminder' : 'monitor';

    forecasts.push({
      customerId,
      customerName: customer?.name ?? openSales[0]?.customerSnapshot?.name ?? 'Customer',
      outstanding,
      oldestOpenAgeDays,
      openInvoiceCount: openSales.length,
      onCreditHold,
      overLimit,
      riskBand,
      riskScore,
      expectedDaysToPay: history ? Math.round(history.avgDaysToPay) : undefined,
      historicalLateRate: history?.lateRate,
      signals,
      suggestedAction,
    });
  }

  // Prioritise by expected exposure: how much is owed, weighted by how risky it is.
  return forecasts.sort((left, right) => right.outstanding * (1 + right.riskScore / 100) - left.outstanding * (1 + left.riskScore / 100));
}
