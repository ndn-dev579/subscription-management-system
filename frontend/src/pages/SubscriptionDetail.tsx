import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SubscriptionForm from '../components/SubscriptionForm';
import { Card, ErrorBanner, PageHead, StatusBadge } from '../components/ui';
import { setSubscriptionStatus } from '../lib/actions';
import { generateInvoice, nextBillingDate } from '../lib/billing';
import { formatDate, formatMoney, todayISO, who } from '../lib/format';
import { useAction } from '../lib/hooks';
import { useStore } from '../store/store';
import { SUB_FLOW, type SubStatus, TERMS } from '../types';

const NEXT: Partial<Record<SubStatus, { to: SubStatus; label: string }>> = {
  draft: { to: 'quotation', label: 'Send quotation' },
  quotation: { to: 'confirmed', label: 'Confirm' },
  confirmed: { to: 'active', label: 'Activate' },
};

export default function SubscriptionDetail() {
  const { id = '' } = useParams();
  const { db, by, me, update } = useStore();
  const { error, run } = useAction();
  const [editing, setEditing] = useState(false);
  const s = by.sub.get(id);
  if (!s || !me || (me.role === 'customer' && s.customerId !== me.id)) {
    return (
      <Card>
        <p>Subscription not found.</p>
        <Link to="/subscriptions">← Back</Link>
      </Card>
    );
  }

  const isTeam = me.role !== 'customer';
  const plan = by.plan.get(s.planId);
  const step = NEXT[s.status];
  const canClose = s.status !== 'closed' && (isTeam || (s.status === 'active' && plan?.closable));
  const invoices = db.invoices.filter(
    (i) => i.subscriptionId === s.id && (isTeam || i.status === 'confirmed' || i.status === 'paid'),
  );
  const rows = [
    ...(plan && plan.price > 0
      ? [{ name: `Plan fee: ${plan.name}`, qty: 1, unit: plan.price, tax: by.tax.get(plan.taxId) }]
      : []),
    ...s.lines.map((l) => {
      const p = by.product.get(l.productId);
      const v = p?.variants.find((x) => x.id === l.variantId);
      return {
        name: p ? (v ? `${p.name} (${v.attribute}: ${v.value})` : p.name) : 'Unknown product',
        qty: l.qty,
        unit: l.unitPrice,
        tax: by.tax.get(p?.taxId ?? ''),
      };
    }),
  ];
  const untaxed = rows.reduce((a, r) => a + r.qty * r.unit, 0);
  const taxes = rows.reduce((a, r) => a + (r.qty * r.unit * (r.tax?.rate ?? 0)) / 100, 0);
  const expired = s.status === 'quotation' && s.quoteValidUntil < todayISO();

  return (
    <>
      <PageHead title={s.number} sub={who(by.user.get(s.customerId))}>
        {isTeam && (s.status === 'draft' || s.status === 'quotation') && (
          <button className="btn btn-ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
        {isTeam && s.status === 'active' && (
          <button
            className="btn btn-ghost"
            onClick={() => run(() => update((d) => generateInvoice(d, s.id)))}
          >
            Generate next invoice
          </button>
        )}
        {isTeam && step && (
          <button
            className="btn btn-primary"
            onClick={() => run(() => update((d) => setSubscriptionStatus(d, s.id, step.to)))}
          >
            {step.label}
          </button>
        )}
        {canClose && (
          <button
            className="btn btn-danger"
            onClick={() =>
              window.confirm('Close this subscription?') &&
              run(() => update((d) => setSubscriptionStatus(d, s.id, 'closed')))
            }
          >
            Close subscription
          </button>
        )}
      </PageHead>
      <ErrorBanner error={error} />

      <div className="stepper">
        {SUB_FLOW.map((st, i) => (
          <span
            key={st}
            className={`step ${i < SUB_FLOW.indexOf(s.status) ? 'done' : ''} ${st === s.status ? 'current' : ''}`}
          >
            {st}
          </span>
        ))}
      </div>

      <Card>
        <dl className="kv">
          <div>
            <dt>Status</dt>
            <dd>
              <StatusBadge status={s.status} />
              {expired && <span className="error small"> quote expired</span>}
            </dd>
          </div>
          <div>
            <dt>Plan</dt>
            <dd>{plan ? `${plan.name} · ${plan.period}` : '—'}</dd>
          </div>
          <div>
            <dt>Start date</dt>
            <dd>{formatDate(s.startDate)}</dd>
          </div>
          <div>
            <dt>Expiry date</dt>
            <dd>{formatDate(s.expiryDate)}</dd>
          </div>
          <div>
            <dt>Payment terms</dt>
            <dd>{TERMS[s.terms].label}</dd>
          </div>
          <div>
            <dt>{s.status === 'active' ? 'Next invoice' : 'Quotation valid until'}</dt>
            <dd>
              {formatDate(
                s.status === 'active' ? nextBillingDate(s, plan, db.invoices) : s.quoteValidUntil,
              )}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Lines (per billing period)">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">Qty</th>
                <th className="num">Unit price</th>
                <th>Tax</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.name}</td>
                  <td className="num">{r.qty}</td>
                  <td className="num">{formatMoney(r.unit)}</td>
                  <td>{r.tax ? r.tax.name : '—'}</td>
                  <td className="num">{formatMoney(r.qty * r.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="totals">
          <div>
            <span>Untaxed</span>
            <span>{formatMoney(untaxed)}</span>
          </div>
          <div>
            <span>Taxes</span>
            <span>{formatMoney(taxes)}</span>
          </div>
          <div className="grand">
            <span>Total before discounts</span>
            <span>{formatMoney(untaxed + taxes)}</span>
          </div>
        </div>
      </Card>

      <Card title="Invoices">
        {invoices.length === 0 ? (
          <p className="muted">No invoices yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Period</th>
                  <th>Due</th>
                  <th className="num">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link to={`/invoices/${i.id}`}>{i.number}</Link>
                    </td>
                    <td>
                      {formatDate(i.periodStart)} → {formatDate(i.periodEnd)}
                    </td>
                    <td>{formatDate(i.dueDate)}</td>
                    <td className="num">{formatMoney(i.total)}</td>
                    <td>
                      <StatusBadge status={i.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {editing && <SubscriptionForm initial={s} onClose={() => setEditing(false)} />}
    </>
  );
}
