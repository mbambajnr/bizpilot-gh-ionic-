import type { BusinessState, Payment, PaymentChannel } from '../data/seedBusiness';

/**
 * Bank/cash reconciliation over the payment ledger.
 *
 * Every recorded payment is a money movement through one account (its `method`/channel): customer
 * receipts (sale, invoice) flow in, supplier settlements (payable) flow out. This builds a cashbook per
 * account, tracks which movements have been matched to a bank/cash statement (`reconciledAt`), and lets a
 * user compare the cleared balance to the statement balance. Pure and read-only — marking a movement
 * cleared happens through a context action; here we only derive the view.
 */

export type ReconciliationDirection = 'in' | 'out';

export type CashMovement = {
  paymentId: string;
  createdAt: string;
  direction: ReconciliationDirection;
  /** Always positive; `direction` carries the sign. */
  amount: number;
  sourceType: Payment['sourceType'];
  reference?: string;
  reconciled: boolean;
};

export type CashAccount = {
  channel: PaymentChannel;
  label: string;
  movements: CashMovement[];
  /** Net of every movement, cleared or not. */
  bookBalance: number;
  /** Net of only the reconciled movements — what should agree with the statement. */
  clearedBalance: number;
  unreconciledCount: number;
  /** Net value of movements not yet matched to the statement. */
  unreconciledTotal: number;
};

export const PAYMENT_CHANNEL_LABELS: Record<PaymentChannel, string> = {
  cash: 'Cash box',
  bank: 'Bank account',
  mobileMoney: 'Mobile money',
  creditCard: 'Card',
};

const CHANNEL_ORDER: PaymentChannel[] = ['bank', 'mobileMoney', 'cash', 'creditCard'];

function directionOf(sourceType: Payment['sourceType']): ReconciliationDirection {
  return sourceType === 'payable' || sourceType === 'expense' ? 'out' : 'in';
}

function signed(movement: CashMovement): number {
  return movement.direction === 'in' ? movement.amount : -movement.amount;
}

/** Build a cashbook per payment channel that has at least one movement, ordered bank-first. */
export function buildBankReconciliation(state: BusinessState): CashAccount[] {
  const byChannel = new Map<PaymentChannel, CashMovement[]>();
  for (const payment of state.payments ?? []) {
    const list = byChannel.get(payment.method) ?? [];
    list.push({
      paymentId: payment.id,
      createdAt: payment.createdAt,
      direction: directionOf(payment.sourceType),
      amount: Math.abs(payment.amount),
      sourceType: payment.sourceType,
      reference: payment.reference,
      reconciled: Boolean(payment.reconciledAt),
    });
    byChannel.set(payment.method, list);
  }

  const accounts: CashAccount[] = [];
  for (const channel of CHANNEL_ORDER) {
    const movements = byChannel.get(channel);
    if (!movements || !movements.length) continue;
    movements.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    const bookBalance = movements.reduce((sum, movement) => sum + signed(movement), 0);
    const clearedBalance = movements.filter((movement) => movement.reconciled).reduce((sum, movement) => sum + signed(movement), 0);
    const unreconciled = movements.filter((movement) => !movement.reconciled);
    accounts.push({
      channel,
      label: PAYMENT_CHANNEL_LABELS[channel],
      movements,
      bookBalance: Number(bookBalance.toFixed(2)),
      clearedBalance: Number(clearedBalance.toFixed(2)),
      unreconciledCount: unreconciled.length,
      unreconciledTotal: Number(unreconciled.reduce((sum, movement) => sum + signed(movement), 0).toFixed(2)),
    });
  }
  return accounts;
}

/**
 * Difference between the bank statement balance and the cleared book balance.
 * Zero means the account reconciles. `statementBalance` of undefined returns null (nothing to compare yet).
 */
export function reconciliationDifference(clearedBalance: number, statementBalance: number | undefined): number | null {
  if (statementBalance == null || Number.isNaN(statementBalance)) return null;
  return Number((statementBalance - clearedBalance).toFixed(2));
}
