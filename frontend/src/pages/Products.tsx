import { type FormEvent, useState } from 'react';
import { ErrorBanner, Field, Modal, PageHead } from '../components/ui';
import { removeItem, saveProduct } from '../lib/actions';
import { formatMoney, uid } from '../lib/format';
import { useAction } from '../lib/hooks';
import { useStore } from '../store/store';
import { PRODUCT_TYPES, type Product, type ProductType, type Variant } from '../types';

function ProductForm({ initial, onClose }: { initial: Product; onClose: () => void }) {
  const { db, update } = useStore();
  const { error, run } = useAction();
  const [f, setF] = useState<Product>(initial);
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setF((x) => ({ ...x, [k]: v }));
  const setVariant = (i: number, p: Partial<Variant>) =>
    set(
      'variants',
      f.variants.map((v, k) => (k === i ? { ...v, ...p } : v)),
    );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => {
      update((d) => saveProduct(d, f));
      onClose();
    });
  };
  return (
    <Modal title={initial.name ? 'Edit product' : 'New product'} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Name">
            <input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </Field>
          <Field label="Type">
            <select value={f.type} onChange={(e) => set('type', e.target.value as ProductType)}>
              {PRODUCT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Sales price">
            <input
              type="number"
              min="0"
              step="0.01"
              value={f.salesPrice}
              onChange={(e) => set('salesPrice', Number(e.target.value))}
            />
          </Field>
          <Field label="Cost price">
            <input
              type="number"
              min="0"
              step="0.01"
              value={f.costPrice}
              onChange={(e) => set('costPrice', Number(e.target.value))}
            />
          </Field>
          <Field label="Tax">
            <select value={f.taxId} onChange={(e) => set('taxId', e.target.value)}>
              <option value="">No tax</option>
              {db.taxes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        <div className="subhead">
          <strong>Variants</strong>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              set('variants', [
                ...f.variants,
                { id: uid(), attribute: 'Brand', value: '', extraPrice: 0 },
              ])
            }
          >
            + Add variant
          </button>
        </div>
        {f.variants.map((v, i) => (
          <div className="row4" key={v.id}>
            <input
              placeholder="Attribute (e.g. Brand)"
              value={v.attribute}
              onChange={(e) => setVariant(i, { attribute: e.target.value })}
            />
            <input
              placeholder="Value (e.g. Odoo)"
              value={v.value}
              onChange={(e) => setVariant(i, { value: e.target.value })}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Adds to price"
              value={v.extraPrice}
              onChange={(e) => setVariant(i, { extraPrice: Number(e.target.value) })}
            />
            <button
              type="button"
              className="btn btn-danger"
              onClick={() =>
                set(
                  'variants',
                  f.variants.filter((_, k) => k !== i),
                )
              }
            >
              ✕
            </button>
          </div>
        ))}
        <ErrorBanner error={error} />
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Products() {
  const { db, by, update } = useStore();
  const { error, run } = useAction();
  const [editing, setEditing] = useState<Product | null>(null);
  const blank = (): Product => ({
    id: uid(),
    name: '',
    type: 'Software',
    salesPrice: 0,
    costPrice: 0,
    notes: '',
    taxId: '',
    variants: [],
  });
  return (
    <>
      <PageHead title="Products" sub="What Brightloop sells, with optional variants">
        <button className="btn btn-primary" onClick={() => setEditing(blank())}>
          + New product
        </button>
      </PageHead>
      <ErrorBanner error={error} />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th className="num">Sales</th>
              <th className="num">Cost</th>
              <th>Tax</th>
              <th>Variants</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {db.products.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.name}</strong>
                  {p.notes && <div className="muted small">{p.notes}</div>}
                </td>
                <td>{p.type}</td>
                <td className="num">{formatMoney(p.salesPrice)}</td>
                <td className="num">{formatMoney(p.costPrice)}</td>
                <td>{by.tax.get(p.taxId)?.name ?? '—'}</td>
                <td className="small">
                  {p.variants.length
                    ? p.variants
                        .map((v) => `${v.attribute}: ${v.value} (+${formatMoney(v.extraPrice)})`)
                        .join(' · ')
                    : '—'}
                </td>
                <td className="actions">
                  <button className="btn btn-ghost" onClick={() => setEditing(p)}>
                    Edit
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() =>
                      window.confirm(`Delete "${p.name}"?`) &&
                      run(() => update((d) => removeItem(d, 'products', p.id)))
                    }
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <ProductForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
