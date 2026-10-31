import { useState, type FormEvent } from 'react';
import { Badge, ErrorBanner, Field, Modal, PageHead } from '../components/ui';
import { removeItem, saveDiscount } from '../lib/actions';
import { addDays, formatDate, formatMoney, todayISO, uid } from '../lib/format';
import { useAction } from '../lib/hooks';
import { useStore } from '../store/store';
import type { Discount } from '../types';

function DiscountForm({ initial, onClose }: { initial: Discount; onClose: () => void }) {
  const { db, update } = useStore();
  const { error, run } = useAction();
  const [f, setF] = useState<Discount>(initial);
  const [subsText, setSubsText] = useState(initial.subscriptionIds.map((id) => db.subscriptions.find((s) => s.id === id)?.number ?? '').filter(Boolean).join(', '));
  const set = <K extends keyof Discount>(k: K, v: Discount[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (id: string) => set('productIds', f.productIds.includes(id) ? f.productIds.filter((x) => x !== id) : [...f.productIds, id]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => {
      const numbers = subsText.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
      const ids = numbers.map((n) => {
        const s = db.subscriptions.find((x) => x.number === n);
        if (!s) throw new Error(`Unknown subscription: ${n}`);
        return s.id;
      });
      update((d) => saveDiscount(d, { ...f, subscriptionIds: ids }));
      onClose();
    });
  };
  return (
    <Modal title={initial.name ? 'Edit discount' : 'New discount rule'} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Name"><input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
          <Field label="Type">
            <select value={f.type} onChange={(e) => set('type', e.target.value as Discount['type'])}>
              <option value="percent">Percentage</option><option value="fixed">Fixed amount</option>
            </select>
          </Field>
          <Field label={f.type === 'percent' ? 'Percentage (%)' : 'Amount'}><input type="number" min="0" step="0.01" value={f.value} onChange={(e) => set('value', Number(e.target.value))} /></Field>
          <Field label="Minimum purchase"><input type="number" min="0" value={f.minPurchase} onChange={(e) => set('minPurchase', Number(e.target.value))} /></Field>
          <Field label="Minimum quantity"><input type="number" min="0" value={f.minQty} onChange={(e) => set('minQty', Number(e.target.value))} /></Field>
          <Field label="Usage limit" hint="0 = unlimited"><input type="number" min="0" value={f.usageLimit} onChange={(e) => set('usageLimit', Number(e.target.value))} /></Field>
          <Field label="Starts"><input type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
          <Field label="Ends"><input type="date" value={f.endDate} onChange={(e) => set('endDate', e.target.value)} /></Field>
          <Field label="Applies to">
            <select value={f.scope} onChange={(e) => set('scope', e.target.value as Discount['scope'])}>
              <option value="subscription">Whole subscription</option><option value="products">Specific products</option>
            </select>
          </Field>
        </div>
        {f.scope === 'products' && (
          <div className="checks">
            {db.products.map((p) => <label key={p.id} className="check"><input type="checkbox" checked={f.productIds.includes(p.id)} onChange={() => toggle(p.id)} /> {p.name}</label>)}
          </div>
        )}
        <Field label="Limit to subscriptions (optional)" hint="Comma-separated numbers, e.g. SUB-0003, SUB-0007. Blank = any subscription.">
          <input value={subsText} onChange={(e) => setSubsText(e.target.value)} />
        </Field>
        <ErrorBanner error={error} />
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Discounts() {
  const { db, by, update } = useStore();
  const { error, run } = useAction();
  const [editing, setEditing] = useState<Discount | null>(null);
  const today = todayISO();
  const state = (d: Discount) =>
    d.endDate < today ? 'expired' : d.startDate > today ? 'scheduled' : d.usageLimit > 0 && d.used >= d.usageLimit ? 'used up' : 'active';
  const blank = (): Discount => ({ id: uid(), name: '', type: 'percent', value: 10, minPurchase: 0, minQty: 0, startDate: today, endDate: addDays(today, 90), usageLimit: 0, used: 0, scope: 'subscription', productIds: [], subscriptionIds: [] });

  return (
    <>
      <PageHead title="Discounts" sub="Applied automatically to the next invoice, and stop when they expire or run out">
        <button className="btn btn-primary" onClick={() => setEditing(blank())}>+ New discount</button>
      </PageHead>
      <ErrorBanner error={error} />
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Value</th><th>Applies to</th><th>Conditions</th><th>Valid</th><th>Used</th><th>State</th><th /></tr></thead>
          <tbody>
            {db.discounts.map((d) => {
              const s = state(d);
              return (
                <tr key={d.id}>
                  <td><strong>{d.name}</strong></td>
                  <td>{d.type === 'percent' ? `${d.value}%` : formatMoney(d.value)}</td>
                  <td className="small">{d.scope === 'subscription' ? 'Whole subscription' : d.productIds.map((id) => by.product.get(id)?.name).join(', ')}{d.subscriptionIds.length > 0 && ` · ${d.subscriptionIds.length} subscription(s) only`}</td>
                  <td className="small">{d.minPurchase ? `Min ${formatMoney(d.minPurchase)}` : ''} {d.minQty ? `Min qty ${d.minQty}` : ''}{!d.minPurchase && !d.minQty && '—'}</td>
                  <td className="small">{formatDate(d.startDate)} → {formatDate(d.endDate)}</td>
                  <td>{d.used}{d.usageLimit ? ` / ${d.usageLimit}` : ''}</td>
                  <td><Badge tone={s === 'active' ? 'green' : s === 'scheduled' ? 'blue' : 'gray'}>{s}</Badge></td>
                  <td className="actions">
                    <button className="btn btn-ghost" onClick={() => setEditing(d)}>Edit</button>
                    <button className="btn btn-danger" onClick={() => window.confirm(`Delete "${d.name}"?`) && run(() => update((x) => removeItem(x, 'discounts', d.id)))}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editing && <DiscountForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}