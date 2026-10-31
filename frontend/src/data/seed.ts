import { runBilling } from '../lib/billing';
import { addDays, defaultExpiry, minISO, todayISO, uid } from '../lib/format';
import type { Db, Discount, Payment, Plan, Product, Subscription, TermsKey, User } from '../types';
import { METHODS } from '../types';

const user = (
  id: string,
  name: string,
  email: string,
  password: string,
  role: User['role'],
  company: string,
): User => ({
  id,
  name,
  email,
  password,
  role,
  company,
  createdAt: addDays(todayISO(), -120),
});

export function seedDb(): Db {
  const today = todayISO();
  const flags = { autoClose: false, closable: true, pausable: true, renewable: true };
  const plans: Plan[] = [
    {
      id: 'pl-month',
      name: 'Business Monthly',
      price: 999,
      period: 'monthly',
      minQty: 1,
      startDate: addDays(today, -200),
      endDate: addDays(today, 400),
      taxId: 't-gst18',
      status: 'active',
      ...flags,
    },
    {
      id: 'pl-year',
      name: 'Enterprise Yearly',
      price: 9999,
      period: 'yearly',
      minQty: 5,
      startDate: addDays(today, -200),
      endDate: addDays(today, 600),
      taxId: 't-gst18',
      status: 'active',
      autoClose: true,
      closable: true,
      pausable: false,
      renewable: true,
    },
    {
      id: 'pl-week',
      name: 'Weekly Pilot',
      price: 199,
      period: 'weekly',
      minQty: 1,
      startDate: addDays(today, -100),
      endDate: addDays(today, 60),
      taxId: 't-gst5',
      status: 'active',
      autoClose: true,
      closable: true,
      pausable: true,
      renewable: false,
    },
  ];
  const products: Product[] = [
    {
      id: 'p-crm',
      name: 'Brightloop CRM',
      type: 'Software',
      salesPrice: 1200,
      costPrice: 400,
      notes: 'Core CRM licence, per seat',
      taxId: 't-gst18',
      variants: [
        { id: 'v-odoo', attribute: 'Brand', value: 'Odoo', extraPrice: 560 },
        { id: 'v-sf', attribute: 'Brand', value: 'Salesforce', extraPrice: 900 },
      ],
    },
    {
      id: 'p-seat',
      name: 'Extra Seat Pack',
      type: 'Add-on',
      salesPrice: 300,
      costPrice: 90,
      notes: '',
      taxId: 't-gst18',
      variants: [],
    },
    {
      id: 'p-support',
      name: 'Priority Support',
      type: 'Service',
      salesPrice: 800,
      costPrice: 350,
      notes: '24x7 support line',
      taxId: 't-gst18',
      variants: [],
    },
    {
      id: 'p-analytics',
      name: 'Analytics Add-on',
      type: 'Add-on',
      salesPrice: 450,
      costPrice: 120,
      notes: '',
      taxId: 't-gst18',
      variants: [],
    },
  ];
  const discounts: Discount[] = [
    {
      id: 'd-vol',
      name: 'Volume 10% (10+ seats)',
      type: 'percent',
      value: 10,
      minPurchase: 0,
      minQty: 10,
      startDate: addDays(today, -120),
      endDate: addDays(today, 240),
      usageLimit: 100,
      used: 0,
      scope: 'subscription',
      productIds: [],
      subscriptionIds: [],
    },
    {
      id: 'd-ana',
      name: 'Analytics promo ₹100 off',
      type: 'fixed',
      value: 100,
      minPurchase: 0,
      minQty: 0,
      startDate: addDays(today, -60),
      endDate: addDays(today, 120),
      usageLimit: 20,
      used: 0,
      scope: 'products',
      productIds: ['p-analytics'],
      subscriptionIds: [],
    },
  ];
  const db: Db = {
    users: [
      user(
        'u-admin',
        'Asha Menon',
        'admin@brightloop.com',
        'Admin@1234',
        'admin',
        'Brightloop Software',
      ),
      user(
        'u-staff',
        'Ravi Nair',
        'staff@brightloop.com',
        'Staff@1234',
        'staff',
        'Brightloop Software',
      ),
      user(
        'u-c1',
        'Priya Kurian',
        'priya@acmetraders.in',
        'Customer@123',
        'customer',
        'Acme Traders',
      ),
      user(
        'u-c2',
        'Joseph Thomas',
        'joseph@greenmart.in',
        'Customer@123',
        'customer',
        'GreenMart Retail',
      ),
      user(
        'u-c3',
        'Meera Das',
        'meera@northwind.in',
        'Customer@123',
        'customer',
        'Northwind Logistics',
      ),
      user(
        'u-c4',
        'Arun Pillai',
        'arun@coastalfoods.in',
        'Customer@123',
        'customer',
        'Coastal Foods',
      ),
    ],
    taxes: [
      { id: 't-gst18', name: 'GST 18%', rate: 18 },
      { id: 't-gst5', name: 'GST 5%', rate: 5 },
    ],
    products,
    plans,
    discounts,
    templates: [
      {
        id: 'tp-1',
        name: 'Starter Monthly Bundle',
        planId: 'pl-month',
        validityDays: 15,
        lines: [
          { productId: 'p-crm', variantId: '', qty: 1, unitPrice: 1200 },
          { productId: 'p-support', variantId: '', qty: 1, unitPrice: 800 },
        ],
      },
      {
        id: 'tp-2',
        name: 'Enterprise Yearly Bundle',
        planId: 'pl-year',
        validityDays: 30,
        lines: [
          { productId: 'p-crm', variantId: 'v-odoo', qty: 10, unitPrice: 1760 },
          { productId: 'p-analytics', variantId: '', qty: 10, unitPrice: 450 },
          { productId: 'p-support', variantId: '', qty: 5, unitPrice: 800 },
        ],
      },
    ],
    subscriptions: [],
    invoices: [],
    payments: [],
    resetTokens: [],
    counters: { subscription: 0, invoice: 0 },
    sessionUserId: null,
  };
  const pipeline: Subscription[] = [
    {
      id: 's-quote',
      number: 'SUB-0001',
      customerId: 'u-c1',
      planId: 'pl-month',
      startDate: addDays(today, 5),
      expiryDate: defaultExpiry(addDays(today, 5), 'monthly'),
      terms: 'net30',
      status: 'quotation',
      lines: db.templates[0].lines,
      quoteValidUntil: addDays(today, 10),
      createdAt: today,
    },
    {
      id: 's-draft',
      number: 'SUB-0002',
      customerId: 'u-c3',
      planId: 'pl-year',
      startDate: addDays(today, 14),
      expiryDate: defaultExpiry(addDays(today, 14), 'yearly'),
      terms: 'net15',
      status: 'draft',
      lines: db.templates[1].lines,
      quoteValidUntil: addDays(today, 30),
      createdAt: today,
    },
  ];
  return addDemoSubscriptions(
    { ...db, subscriptions: pipeline, counters: { subscription: 2, invoice: 0 } },
    14,
  );
}

/** Creates active subscriptions, bills them, and settles some invoices so every screen has data. */
export function addDemoSubscriptions(db: Db, count: number): Db {
  const today = todayISO();
  let users = db.users;
  if (count > 100) {
    const extra: User[] = Array.from({ length: 40 }, (_, i) =>
      user(
        uid(),
        `Contact ${i + 1}`,
        `bulk${i}.${uid()}@example.com`,
        'Customer@123',
        'customer',
        `Demo Company ${i + 1}`,
      ),
    );
    users = [...users, ...extra];
  }
  const customers = users.filter((u) => u.role === 'customer');
  const terms: TermsKey[] = ['immediate', 'net15', 'net30'];
  let n = db.counters.subscription;
  const subs: Subscription[] = Array.from({ length: count }, (_, i) => {
    const plan = db.plans[i % db.plans.length];
    const start = addDays(today, -Math.floor(Math.random() * 75));
    const lines = Array.from({ length: 1 + (i % 2) }, (_, k) => {
      const p = db.products[(i + k) % db.products.length];
      return {
        productId: p.id,
        variantId: '',
        qty: plan.minQty + Math.floor(Math.random() * 4),
        unitPrice: p.salesPrice,
      };
    });
    n += 1;
    return {
      id: uid(),
      number: `SUB-${String(n).padStart(4, '0')}`,
      customerId: customers[Math.floor(Math.random() * customers.length)].id,
      planId: plan.id,
      startDate: start,
      expiryDate: defaultExpiry(start, plan.period),
      terms: terms[i % 3],
      status: 'active',
      lines,
      quoteValidUntil: '',
      createdAt: start,
    };
  });
  const billed = runBilling(
    {
      ...db,
      users,
      subscriptions: [...subs, ...db.subscriptions],
      counters: { ...db.counters, subscription: n },
    },
    today,
  ).db;

  const fresh = new Set(subs.map((s) => s.id));
  const payments: Payment[] = [];
  let idx = 0;
  const invoices = billed.invoices.map((inv) => {
    if (!fresh.has(inv.subscriptionId)) return inv;
    const m = idx++ % 5; // 0,1 paid · 2 unpaid · 3 part-paid · 4 left as draft
    const pay = (amount: number) =>
      payments.push({
        id: uid(),
        invoiceId: inv.id,
        method: METHODS[idx % METHODS.length],
        amount,
        date: minISO(addDays(inv.issueDate, 2), today),
        note: '',
      });
    if (m <= 1) {
      pay(inv.total);
      return { ...inv, status: 'paid' as const, paid: inv.total, sent: true };
    }
    if (m === 2) return { ...inv, status: 'confirmed' as const, sent: true };
    if (m === 3) {
      const half = Math.round(inv.total / 2);
      pay(half);
      return { ...inv, status: 'confirmed' as const, paid: half, sent: true };
    }
    return inv;
  });
  return { ...billed, invoices, payments: [...payments, ...billed.payments] };
}
