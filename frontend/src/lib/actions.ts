import type {
  Db,
  Discount,
  Invoice,
  PaymentMethod,
  Plan,
  PlanStatus,
  Product,
  Role,
  SubStatus,
  Subscription,
  Tax,
  Template,
} from '../types';
import { SUB_FLOW } from '../types';
import { outstanding, round2 } from './billing';
import { todayISO, uid } from './format';
import { isEmail, passwordIssues } from './validation';

function need(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}
const upsert = <T extends { id: string }>(arr: T[], item: T): T[] =>
  arr.some((x) => x.id === item.id)
    ? arr.map((x) => (x.id === item.id ? item : x))
    : [item, ...arr];

/* ---- users ---- */
export function addUser(
  db: Db,
  u: { name: string; email: string; password: string; role: Role; company?: string },
): Db {
  need(u.name.trim(), 'Name is required.');
  need(isEmail(u.email), 'Enter a valid email address.');
  need(
    !db.users.some((x) => x.email.toLowerCase() === u.email.trim().toLowerCase()),
    'This email already belongs to an account.',
  );
  const issues = passwordIssues(u.password);
  need(issues.length === 0, `Password needs: ${issues.join(', ').toLowerCase()}.`);
  return {
    ...db,
    users: [
      ...db.users,
      {
        id: uid(),
        name: u.name.trim(),
        email: u.email.trim(),
        password: u.password,
        role: u.role,
        company: u.company?.trim() ?? '',
        createdAt: todayISO(),
      },
    ],
  };
}

/* ---- catalogue ---- */
export function saveTax(db: Db, t: Tax): Db {
  need(t.name.trim(), 'Tax name is required.');
  need(t.rate >= 0 && t.rate <= 100, 'Rate must be between 0 and 100.');
  return { ...db, taxes: upsert(db.taxes, t) };
}

export function saveProduct(db: Db, p: Product): Db {
  need(p.name.trim(), 'Product name is required.');
  need(p.salesPrice >= 0 && p.costPrice >= 0, 'Prices cannot be negative.');
  need(
    p.variants.every((v) => v.attribute.trim() && v.value.trim()),
    'Every variant needs an attribute and a value.',
  );
  return { ...db, products: upsert(db.products, p) };
}

export function savePlan(db: Db, p: Plan): Db {
  need(p.name.trim(), 'Plan name is required.');
  need(p.price >= 0, 'Price cannot be negative.');
  need(
    Number.isInteger(p.minQty) && p.minQty >= 1,
    'Minimum quantity must be a whole number, at least 1.',
  );
  need(
    p.startDate && p.endDate && p.endDate >= p.startDate,
    'End date must be on or after the start date.',
  );
  return { ...db, plans: upsert(db.plans, p) };
}

export function setPlanStatus(db: Db, id: string, status: PlanStatus): Db {
  const p = db.plans.find((x) => x.id === id);
  if (!p) throw new Error('Plan not found.');
  need(status !== 'paused' || p.pausable, 'This plan cannot be paused.');
  need(status !== 'closed' || p.closable, 'This plan cannot be closed early.');
  return { ...db, plans: db.plans.map((x): Plan => (x.id === id ? { ...x, status } : x)) };
}

export function renewPlan(db: Db, id: string, endDate: string): Db {
  const p = db.plans.find((x) => x.id === id);
  if (!p) throw new Error('Plan not found.');
  need(p.renewable, 'This plan cannot be renewed.');
  need(endDate > todayISO(), 'Choose a new end date in the future.');
  return {
    ...db,
    plans: db.plans.map((x): Plan => (x.id === id ? { ...x, endDate, status: 'active' } : x)),
  };
}

export function saveTemplate(db: Db, t: Template): Db {
  need(t.name.trim(), 'Template name is required.');
  const plan = db.plans.find((p) => p.id === t.planId);
  if (!plan) throw new Error('Choose a plan.');
  need(t.validityDays >= 1, 'Validity must be at least 1 day.');
  need(t.lines.length > 0 && t.lines.every((l) => l.productId), 'Add at least one product line.');
  need(
    t.lines.every((l) => l.qty >= plan.minQty),
    `Quantities must be at least ${plan.minQty} for this plan.`,
  );
  return { ...db, templates: upsert(db.templates, t) };
}

export function saveDiscount(db: Db, d: Discount): Db {
  need(d.name.trim(), 'Discount name is required.');
  need(d.value > 0, 'Discount value must be greater than 0.');
  need(d.type !== 'percent' || d.value <= 100, 'A percentage cannot exceed 100.');
  need(
    d.startDate && d.endDate && d.endDate >= d.startDate,
    'End date must be on or after the start date.',
  );
  need(d.scope === 'subscription' || d.productIds.length > 0, 'Pick at least one product.');
  need(d.minPurchase >= 0 && d.minQty >= 0 && d.usageLimit >= 0, 'Limits cannot be negative.');
  return { ...db, discounts: upsert(db.discounts, d) };
}

type Kind = 'products' | 'plans' | 'templates' | 'discounts' | 'taxes';
export function removeItem(db: Db, kind: Kind, id: string): Db {
  const used =
    kind === 'products'
      ? db.subscriptions.some((s) => s.lines.some((l) => l.productId === id)) ||
        db.templates.some((t) => t.lines.some((l) => l.productId === id))
      : kind === 'plans'
        ? db.subscriptions.some((s) => s.planId === id) || db.templates.some((t) => t.planId === id)
        : kind === 'taxes'
          ? db.products.some((p) => p.taxId === id) || db.plans.some((p) => p.taxId === id)
          : false;
  need(!used, 'This item is in use and cannot be deleted.');
  return { ...db, [kind]: (db[kind] as { id: string }[]).filter((x) => x.id !== id) } as Db;
}

/* ---- subscriptions ---- */
export function saveSubscription(db: Db, s: Subscription): Db {
  const plan = db.plans.find((p) => p.id === s.planId);
  need(s.customerId, 'Choose a customer.');
  if (!plan) throw new Error('Choose a plan.');
  need(
    s.startDate && s.expiryDate && s.expiryDate >= s.startDate,
    'Expiry date must be on or after the start date.',
  );
  need(s.lines.length > 0, 'Add at least one product line.');
  need(
    s.lines.every((l) => l.productId),
    'Every line needs a product.',
  );
  need(
    s.lines.every((l) => Number.isInteger(l.qty) && l.qty >= plan.minQty),
    `Each line needs a whole quantity of at least ${plan.minQty} for this plan.`,
  );
  need(
    s.lines.every((l) => l.unitPrice >= 0),
    'Unit price cannot be negative.',
  );
  const existing = db.subscriptions.find((x) => x.id === s.id);
  if (existing) {
    need(
      existing.status === 'draft' || existing.status === 'quotation',
      'Only draft or quotation subscriptions can be edited.',
    );
    return {
      ...db,
      subscriptions: upsert(db.subscriptions, {
        ...s,
        number: existing.number,
        status: existing.status,
      }),
    };
  }
  const n = db.counters.subscription + 1;
  const created: Subscription = {
    ...s,
    number: `SUB-${String(n).padStart(4, '0')}`,
    status: 'draft',
    createdAt: todayISO(),
  };
  return {
    ...db,
    counters: { ...db.counters, subscription: n },
    subscriptions: [created, ...db.subscriptions],
  };
}

export function setSubscriptionStatus(db: Db, id: string, to: SubStatus): Db {
  const s = db.subscriptions.find((x) => x.id === id);
  if (!s) throw new Error('Subscription not found.');
  const i = SUB_FLOW.indexOf(s.status);
  const ok = to === 'closed' ? s.status !== 'closed' : SUB_FLOW.indexOf(to) === i + 1; // Draft → Quotation → Confirmed → Active → Closed
  need(ok, `A ${s.status} subscription cannot move to ${to}.`);
  if (to === 'confirmed' && s.quoteValidUntil && s.quoteValidUntil < todayISO())
    throw new Error('This quotation has expired. Edit it and set a new validity date first.');
  return {
    ...db,
    subscriptions: db.subscriptions.map(
      (x): Subscription => (x.id === id ? { ...x, status: to } : x),
    ),
  };
}

/* ---- invoices & payments ---- */
export function setInvoiceStatus(db: Db, id: string, to: 'confirmed' | 'cancelled'): Db {
  const inv = db.invoices.find((i) => i.id === id);
  if (!inv) throw new Error('Invoice not found.');
  if (to === 'confirmed') need(inv.status === 'draft', 'Only draft invoices can be confirmed.');
  else {
    need(
      inv.status === 'draft' || inv.status === 'confirmed',
      `A ${inv.status} invoice cannot be cancelled.`,
    );
    need(inv.paid === 0, 'Invoices with payments cannot be cancelled.');
  }
  const refund = to === 'cancelled' ? new Set(inv.discounts.map((d) => d.discountId)) : null; // hand the discount use back
  return {
    ...db,
    invoices: db.invoices.map((i): Invoice => (i.id === id ? { ...i, status: to } : i)),
    discounts: refund
      ? db.discounts.map((d) => (refund.has(d.id) ? { ...d, used: Math.max(0, d.used - 1) } : d))
      : db.discounts,
  };
}

export function markSent(db: Db, id: string): Db {
  const inv = db.invoices.find((i) => i.id === id);
  need(
    inv && (inv.status === 'confirmed' || inv.status === 'paid'),
    'Confirm the invoice before sending it.',
  );
  return {
    ...db,
    invoices: db.invoices.map((i): Invoice => (i.id === id ? { ...i, sent: true } : i)),
  };
}

export function recordPayment(
  db: Db,
  p: { invoiceId: string; method: PaymentMethod; amount: number; date: string; note: string },
): Db {
  const inv = db.invoices.find((i) => i.id === p.invoiceId);
  if (!inv) throw new Error('Invoice not found.');
  need(
    inv.status === 'confirmed',
    inv.status === 'draft'
      ? 'Confirm the invoice before recording payments.'
      : `A ${inv.status} invoice cannot take payments.`,
  );
  const due = outstanding(inv);
  need(p.amount > 0, 'Amount must be greater than 0.');
  need(p.amount <= due + 0.001, `Amount exceeds the outstanding balance of ${due.toFixed(2)}.`);
  need(p.date, 'Choose the payment date.');
  const paid = round2(inv.paid + p.amount);
  const done = round2(inv.total - paid) <= 0;
  return {
    ...db,
    payments: [{ id: uid(), ...p }, ...db.payments],
    invoices: db.invoices.map(
      (i): Invoice => (i.id === inv.id ? { ...i, paid, status: done ? 'paid' : 'confirmed' } : i),
    ),
  };
}
