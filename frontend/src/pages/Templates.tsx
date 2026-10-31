import { type FormEvent, useState } from 'react';
import LinesEditor from '../components/LinesEditor';
import { ErrorBanner, Field, Modal, PageHead } from '../components/ui';
import { removeItem, saveTemplate } from '../lib/actions';
import { uid } from '../lib/format';
import { useAction } from '../lib/hooks';
import { useStore } from '../store/store';
import type { Template } from '../types';

function TemplateForm({ initial, onClose }: { initial: Template; onClose: () => void }) {
  const { db, by, update } = useStore();
  const { error, run } = useAction();
  const [f, setF] = useState<Template>(initial);
  const plan = by.plan.get(f.planId);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => {
      update((d) => saveTemplate(d, f));
      onClose();
    });
  };
  return (
    <Modal title={initial.name ? 'Edit template' : 'New quotation template'} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Name">
            <input
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              autoFocus
            />
          </Field>
          <Field label="Plan">
            <select value={f.planId} onChange={(e) => setF({ ...f, planId: e.target.value })}>
              <option value="">Select plan…</option>
              {db.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quotation valid for (days)">
            <input
              type="number"
              min="1"
              value={f.validityDays}
              onChange={(e) => setF({ ...f, validityDays: Number(e.target.value) })}
            />
          </Field>
        </div>
        <strong>Product lines</strong>
        <LinesEditor
          lines={f.lines}
          onChange={(lines) => setF({ ...f, lines })}
          minQty={plan?.minQty ?? 1}
        />
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

export default function Templates() {
  const { db, by, update } = useStore();
  const { error, run } = useAction();
  const [editing, setEditing] = useState<Template | null>(null);
  return (
    <>
      <PageHead title="Quotation templates" sub="Pre-built offers sales can start from">
        <button
          className="btn btn-primary"
          onClick={() =>
            setEditing({ id: uid(), name: '', planId: '', validityDays: 30, lines: [] })
          }
        >
          + New template
        </button>
      </PageHead>
      <ErrorBanner error={error} />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Plan</th>
              <th>Valid for</th>
              <th>Lines</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {db.templates.map((t) => (
              <tr key={t.id}>
                <td>
                  <strong>{t.name}</strong>
                </td>
                <td>{by.plan.get(t.planId)?.name ?? '—'}</td>
                <td>{t.validityDays} days</td>
                <td className="small">
                  {t.lines
                    .map((l) => `${l.qty} × ${by.product.get(l.productId)?.name ?? '?'}`)
                    .join(' · ')}
                </td>
                <td className="actions">
                  <button className="btn btn-ghost" onClick={() => setEditing(t)}>
                    Edit
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() =>
                      window.confirm(`Delete "${t.name}"?`) &&
                      run(() => update((d) => removeItem(d, 'templates', t.id)))
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
      {editing && <TemplateForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
