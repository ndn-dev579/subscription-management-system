import type {
  Db,
  Discount,
  Invoice,
  InvoiceLine,
  Period,
  Plan,
  PlanStatus,
  Product,
  Subscription,
  Tax,
} from '../types';
import { TERMS } from '../types';
import { addDays, addPeriod, formatDate, todayISO, uid } from './format';

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function effectivePlanStatus(plan: Plan, today = todayISO()): PlanStatus {
  return plan.autoClose && plan.endDate < today ? 'closed' : plan.status; // auto-close on end date
}
export const planBookable = (plan: Plan, today = todayISO()) =>
  effectivePlanStatus(plan, today) === 'active' && plan.startDate <= today;

export const variantPrice = (p: Product, variantId: string) =>
  round2(p.salesPrice + (p.variants.find((v) => v.id === variantId)?.extraPrice ?? 0));

export const outstanding = (i: Invoice) => round2(i.total - i.paid);
export const isOverdue = (i: Invoice, today = todayISO()) =>
  i.status === 'confirmed' && outstanding(i) > 0 && i.dueDate < today;

const MONTHLY: Record<Period, number> = { daily: 30, weekly: 52 / 12, monthly: 1, yearly: 1 / 12 };
export const recurringAmount = (s: Subscription, plan?: Plan) =>
  plan ? round2(plan.price + sum(s.lines.map((l) => l.qty * l.unitPrice))) : 0;
export const monthlyRecurring = (s: Subscription, plan?: Plan) =>
  plan ? round2(recurringAmount(s, plan) * MONTHLY[plan.period]) : 0;

/* ---------- invoice generation ---------- */

interface Row {
  description: string;
  productId: string;
  qty: number;
  unitPrice: number;
  gross: number;
  discount: number;
  taxId: string;
}
interface Ctx {
  products: Map<string, Product>;
  taxes: Map<string, Tax>;
  plans: Map<string, Plan>;
  discounts: Discount[];
  keys: Set<string>;
  counter: number;
  out: Invoice[];
}

const key = (subId: string, start: string) => `${subId}|${start}`;

function makeCtx(db: Db): Ctx {
  return {
    products: new Map(db.products.map((p): [string, Product] => [p.id, p])),
    taxes: new Map(db.taxes.map((t): [string, Tax] => [t.id, t])),
    plans: new Map(db.plans.map((p): [string, Plan] => [p.id, p])),
    discounts: db.discounts
      .map((d) => ({ ...d }))
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    // One invoice per (subscription, period). Cancelled invoices free their period again,
    // so a period is never billed twice and never silently skipped.
    keys: new Set(
      db.invoices
        .filter((i) => i.status !== 'cancelled')
        .map((i) => key(i.subscriptionId, i.periodStart)),
    ),
    counter: db.counters.invoice,
    out: [],
  };
}

function nextPeriod(ctx: Ctx, sub: Subscription, plan: Plan): string {
  for (let k = 0; k < 5000; k++) {
    const start = addPeriod(sub.startDate, plan.period, k); // from the start date, so no month-end drift
    if (!ctx.keys.has(key(sub.id, start))) return start;
  }
  return '9999-12-31';
}

export function nextBillingDate(sub: Subscription, plan: Plan | undefined, invoices: Invoice[]) {
  if (!plan) return '';
  const taken = new Set(
    invoices
      .filter((i) => i.subscriptionId === sub.id && i.status !== 'cancelled')
      .map((i) => i.periodStart),
  );
  for (let k = 0; k < 5000; k++) {
    const start = addPeriod(sub.startDate, plan.period, k);
    if (!taken.has(start)) return start;
  }
  return '';
}

const discountUsable = (d: Discount, subId: string, date: string) =>
  d.startDate <= date &&
  (!d.endDate || date <= d.endDate) &&
  (d.usageLimit === 0 || d.used < d.usageLimit) &&
  (d.subscriptionIds.length === 0 || d.subscriptionIds.includes(subId));

function billPeriod(ctx: Ctx, sub: Subscription, plan: Plan, periodStart: string): Invoice {
  const issueDate = periodStart;
  const rows: Row[] = [];
  if (plan.price > 0)
    rows.push({
      description: `Plan: ${plan.name}`,
      productId: '',
      qty: 1,
      unitPrice: plan.price,
      gross: plan.price,
      discount: 0,
      taxId: plan.taxId,
    });
  for (const l of sub.lines) {
    const p = ctx.products.get(l.productId);
    if (!p) continue;
    const v = p.variants.find((x) => x.id === l.variantId);
    rows.push({
      description: v ? `${p.name} (${v.attribute}: ${v.value})` : p.name,
      productId: p.id,
      qty: l.qty,
      unitPrice: l.unitPrice,
      gross: round2(l.qty * l.unitPrice),
      discount: 0,
      taxId: p.taxId,
    });
  }

  // Discounts apply by themselves: no one has to remember them, and they stop at expiry / usage limit.
  const applied: Invoice['discounts'] = [];
  for (const d of ctx.discounts) {
    if (!discountUsable(d, sub.id, issueDate)) continue;
    const targets = rows.filter(
      (r) =>
        d.scope === 'subscription' || (r.productId !== '' && d.productIds.includes(r.productId)),
    );
    const base = sum(targets.map((r) => r.gross - r.discount));
    const qty = sum(targets.map((r) => r.qty));
    if (base <= 0 || base < d.minPurchase || qty < d.minQty) continue;
    const total = round2(Math.min(base, d.type === 'percent' ? (base * d.value) / 100 : d.value));
    let given = 0;
    targets.forEach((r, i) => {
      const room = r.gross - r.discount;
      const share =
        i === targets.length - 1
          ? Math.min(room, round2(total - given))
          : round2((total * room) / base);
      r.discount = round2(r.discount + share);
      given = round2(given + share);
    });
    d.used += 1;
    applied.push({ discountId: d.id, name: d.name, amount: given });
  }

  const lines: InvoiceLine[] = rows.map((r) => {
    const tax = ctx.taxes.get(r.taxId); // taxes come from the admin's rules
    const net = round2(r.gross - r.discount);
    const rate = tax?.rate ?? 0;
    return {
      description: r.description,
      productId: r.productId,
      qty: r.qty,
      unitPrice: r.unitPrice,
      discount: r.discount,
      taxName: tax?.name ?? '',
      taxRate: rate,
      net,
      tax: round2((net * rate) / 100),
    };
  });
  const subtotal = round2(sum(rows.map((r) => r.gross)));
  const discountTotal = round2(sum(rows.map((r) => r.discount)));
  const taxTotal = round2(sum(lines.map((l) => l.tax)));
  ctx.counter += 1;
  const inv: Invoice = {
    id: uid(),
    number: `INV-${String(ctx.counter).padStart(5, '0')}`,
    subscriptionId: sub.id,
    customerId: sub.customerId,
    periodStart,
    periodEnd: addDays(addPeriod(periodStart, plan.period, 1), -1),
    issueDate,
    dueDate: addDays(issueDate, TERMS[sub.terms].days),
    status: 'draft',
    lines,
    discounts: applied,
    subtotal,
    discountTotal,
    taxTotal,
    total: round2(subtotal - discountTotal + taxTotal),
    paid: 0,
    sent: false,
  };
  ctx.keys.add(key(sub.id, periodStart));
  ctx.out.push(inv);
  return inv;
}

const finish = (db: Db, ctx: Ctx, extra: Partial<Db> = {}): Db => ({
  ...db,
  invoices: [...ctx.out, ...db.invoices],
  discounts: ctx.discounts,
  counters: { ...db.counters, invoice: ctx.counter },
  ...extra,
});

/** Billing day: every active subscription gets an invoice for each period that is due. */
export function runBilling(db: Db, today = todayISO()): { db: Db; created: number } {
  const ctx = makeCtx(db);
  let created = 0;
  const closed = new Set<string>();
  for (const sub of db.subscriptions) {
    if (sub.status !== 'active') continue;
    const plan = ctx.plans.get(sub.planId);
    if (!plan) continue;
    let start = nextPeriod(ctx, sub, plan);
    for (let guard = 0; guard < 60 && start <= today && start <= sub.expiryDate; guard++) {
      billPeriod(ctx, sub, plan, start);
      created++;
      start = nextPeriod(ctx, sub, plan);
    }
    if (sub.expiryDate < today && start > sub.expiryDate) closed.add(sub.id); // fully billed and expired
  }
  const subscriptions = closed.size
    ? db.subscriptions.map((s): Subscription => (closed.has(s.id) ? { ...s, status: 'closed' } : s))
    : db.subscriptions;
  return { db: finish(db, ctx, { subscriptions }), created };
}

/** Manually invoice the next due period of one subscription. */
export function generateInvoice(db: Db, subId: string, today = todayISO()): Db {
  const sub = db.subscriptions.find((s) => s.id === subId);
  if (!sub) throw new Error('Subscription not found.');
  if (sub.status !== 'active') throw new Error('Only active subscriptions can be invoiced.');
  const ctx = makeCtx(db);
  const plan = ctx.plans.get(sub.planId);
  if (!plan) throw new Error('Plan not found.');
  const start = nextPeriod(ctx, sub, plan);
  if (start > sub.expiryDate)
    throw new Error('Every period up to the expiry date is already invoiced.');
  if (start > today)
    throw new Error(`The next period starts on ${formatDate(start)}; nothing is due yet.`);
  billPeriod(ctx, sub, plan, start);
  return finish(db, ctx);
}
