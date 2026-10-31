import { useState, type FormEvent } from 'react';
import { saveSubscription } from '../lib/actions';
import { planBookable, recurringAmount } from '../lib/billing';
import { addDays, defaultExpiry, formatMoney, todayISO, uid } from '../lib/format';
import { useAction } from '../lib/hooks';
import { useStore } from '../store/store';
import { TERMS, type Subscription, type TermsKey } from '../types';
import LinesEditor from './LinesEditor';
import { ErrorBanner, Field, Modal } from './ui';

export default function SubscriptionForm({ initial, onClose }: { initial?: Subscription; onClose: () => void }) {
  const { db, by, update } = useStore();
  const { error, run } = useAction();
  const today = todayISO();
  const [f, setF] = useState<Subscription>(
    initial ?? {
      id: uid(), number: '', customerId: '', planId: '', startDate: today, expiryDate: defaultExpiry(today, 'monthly'),
      terms: 'net30', status: 'draft', lines: [], quoteValidUntil: addDays(today, 30), createdAt: today,
    },
  );
  const set = <K extends keyof Subscription>(k: K, v: Subscription[K]) => setF((x) => ({ ...x, [k]: v }));
  const plan = by.plan.get(f.planId);
  const plans = db.plans.filter((p) => p.id === f.planId || planBookable(p, today));

  const useTemplate = (id: string) => {
    const t = db.templates.find((x) => x.id === id);
    if (!t) return;
    const p = by.plan.get(t.planId);
    setF((x) => ({
      ...x, planId: t.planId, lines: t.lines.map((l) => ({ ...l })),
      quoteValidUntil: addDays(today, t.validityDays),
      expiryDate: p ? defaultExpiry(x.startDate, p.period) : x.expiryDate,
    }));
  };
  const usePlan = (id: string) => {
    const p = by.plan.get(id);
    setF((x) => ({ ...x, planId: id, expiryDate: p ? defaultExpiry(x.startDate, p.period) : x.expiryDate }));
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => { update((d) => saveSubscription(d, f)); onClose(); });
  };

  return (
    <Modal title={initial ? `Edit ${initial.number}` : 'New subscription'} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        {!initial && (
          <Field label="Start from a quotation template (optional)">
            <select defaultValue="" onChange={(e) => useTemplate(e.target.value)}>
              <option value="">— build from scratch —</option>
              {db.templates.map((t) => <option key={t.id} value={t.id}>{t.name} · valid {t.validityDays} days</option>)}
            </select>
          </Field>
        )}
        <div className="form-grid">
          <Field label="Customer">
            <select value={f.customerId} onChange={(e) => set('customerId', e.target.value)}>
              <option value="">Select customer…</option>
              {db.users.filter((u) => u.role === 'customer').map((u) => <option key={u.id} value={u.id}>{u.company || u.name} ({u.email})</option>)}
            </select>
          </Field>
          <Field label="Plan" hint={plan ? `Billed ${plan.period} · minimum quantity ${plan.minQty}` : undefined}>
            <select value={f.planId} onChange={(e) => usePlan(e.target.value)}>
              <option value="">Select plan…</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({formatMoney(p.price)} / {p.period})</option>)}
            </select>
          </Field>
          <Field label="Start date"><input type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
          <Field label="Expiry date"><input type="date" value={f.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} /></Field>
          <Field label="Payment terms">
            <select value={f.terms} onChange={(e) => set('terms', e.target.value as TermsKey)}>
              {Object.entries(TERMS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Quotation valid until"><input type="date" value={f.quoteValidUntil} onChange={(e) => set('quoteValidUntil', e.target.value)} /></Field>
        </div>
        <strong>Product lines</strong>
        <LinesEditor lines={f.lines} onChange={(l) => set('lines', l)} minQty={plan?.minQty ?? 1} />
        {plan && f.lines.length > 0 && <p className="muted small">Recurring amount per {plan.period.replace('ly', '')} period, excl. tax: <strong>{formatMoney(recurringAmount(f, plan))}</strong> (includes plan fee)</p>}
        <ErrorBanner error={error} />
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}