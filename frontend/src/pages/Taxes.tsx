import { type FormEvent, useState } from 'react';
import { ErrorBanner, Field, Modal, PageHead } from '../components/ui';
import { removeItem, saveTax } from '../lib/actions';
import { uid } from '../lib/format';
import { useAction } from '../lib/hooks';
import { useStore } from '../store/store';
import type { Tax } from '../types';

function TaxForm({ initial, onClose }: { initial: Tax; onClose: () => void }) {
  const { update } = useStore();
  const { error, run } = useAction();
  const [f, setF] = useState(initial);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => {
      update((d) => saveTax(d, f));
      onClose();
    });
  };
  return (
    <Modal title={initial.name ? 'Edit tax' : 'New tax'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Name">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </Field>
        <Field label="Rate (%)">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={f.rate}
            onChange={(e) => setF({ ...f, rate: Number(e.target.value) })}
          />
        </Field>
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

export default function Taxes() {
  const { db, update } = useStore();
  const { error, run } = useAction();
  const [editing, setEditing] = useState<Tax | null>(null);
  return (
    <>
      <PageHead title="Taxes" sub="Rules used to calculate tax on every invoice automatically">
        <button
          className="btn btn-primary"
          onClick={() => setEditing({ id: uid(), name: '', rate: 0 })}
        >
          + New tax
        </button>
      </PageHead>
      <ErrorBanner error={error} />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th className="num">Rate</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {db.taxes.map((t) => (
              <tr key={t.id}>
                <td>
                  <strong>{t.name}</strong>
                </td>
                <td className="num">{t.rate}%</td>
                <td className="actions">
                  <button className="btn btn-ghost" onClick={() => setEditing(t)}>
                    Edit
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() =>
                      window.confirm(`Delete "${t.name}"?`) &&
                      run(() => update((d) => removeItem(d, 'taxes', t.id)))
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
      {editing && <TaxForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
