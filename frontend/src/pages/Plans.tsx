import { type FormEvent, useState } from 'react';
import { Badge, ErrorBanner, Field, Modal, PageHead, StatusBadge } from '../components/ui';
import { removeItem, renewPlan, savePlan, setPlanStatus } from '../lib/actions';
import { effectivePlanStatus } from '../lib/billing';
import { addPeriod, formatDate, formatMoney, todayISO, uid } from '../lib/format';
import { useAction } from '../lib/hooks';
import { useStore } from '../store/store';
import { PERIODS, type Period, type Plan } from '../types';

const OPTIONS = [
  ['autoClose', 'Close automatically at end date'],
  ['closable', 'Can be closed early'],
  ['pausable', 'Can be paused'],
  ['renewable', 'Can be renewed'],
] as const;

function PlanForm({ initial, onClose }: { initial: Plan; onClose: () => void }) {
  const { db, update } = useStore();
  const { error, run } = useAction();
  const [f, setF] = useState<Plan>(initial);
  const set = <K extends keyof Plan>(k: K, v: Plan[K]) => setF((x) => ({ ...x, [k]: v }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => {
      update((d) => savePlan(d, f));
      onClose();
    });
  };
  return (
    <Modal title={initial.name ? 'Edit plan' : 'New plan'} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Name">
            <input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </Field>
          <Field label="Price per period">
            <input
              type="number"
              min="0"
              step="0.01"
              value={f.price}
              onChange={(e) => set('price', Number(e.target.value))}
            />
          </Field>
          <Field label="Billing period">
            <select value={f.period} onChange={(e) => set('period', e.target.value as Period)}>
              {PERIODS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Minimum quantity">
            <input
              type="number"
              min="1"
              step="1"
              value={f.minQty}
              onChange={(e) => set('minQty', Number(e.target.value))}
            />
          </Field>
          <Field label="Available from">
            <input
              type="date"
              value={f.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </Field>
          <Field label="Available until">
            <input type="date" value={f.endDate} onChange={(e) => set('endDate', e.target.value)} />
          </Field>
          <Field label="Tax on plan fee">
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
        <div className="checks">
          {OPTIONS.map(([k, label]) => (
            <label key={k} className="check">
              <input type="checkbox" checked={f[k]} onChange={(e) => set(k, e.target.checked)} />{' '}
              {label}
            </label>
          ))}
        </div>
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

export default function Plans() {
  const { db, update } = useStore();
  const { error, run } = useAction();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [renewing, setRenewing] = useState<Plan | null>(null);
  const [newEnd, setNewEnd] = useState('');
  const today = todayISO();
  const blank = (): Plan => ({
    id: uid(),
    name: '',
    price: 0,
    period: 'monthly',
    minQty: 1,
    startDate: today,
    endDate: addPeriod(today, 'yearly', 1),
    taxId: '',
    autoClose: false,
    closable: true,
    pausable: true,
    renewable: true,
    status: 'active',
  });
  const act = (fn: Parameters<typeof update>[0]) => run(() => update(fn));

  return (
    <>
      <PageHead title="Plans" sub="Price, billing period and lifecycle rules, set plan by plan">
        <button className="btn btn-primary" onClick={() => setEditing(blank())}>
          + New plan
        </button>
      </PageHead>
      <ErrorBanner error={error} />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th className="num">Price</th>
              <th>Billing</th>
              <th className="num">Min qty</th>
              <th>Available</th>
              <th>Rules</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {db.plans.map((p) => {
              const eff = effectivePlanStatus(p, today);
              return (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                  </td>
                  <td className="num">{formatMoney(p.price)}</td>
                  <td>{p.period}</td>
                  <td className="num">{p.minQty}</td>
                  <td className="small">
                    {formatDate(p.startDate)} → {formatDate(p.endDate)}
                  </td>
                  <td className="chips">
                    {OPTIONS.filter(([k]) => p[k]).map(([k, l]) => (
                      <Badge key={k}>
                        {l
                          .replace('Close automatically at end date', 'Auto-close')
                          .replace('Can be ', '')}
                      </Badge>
                    ))}
                  </td>
                  <td>
                    <StatusBadge status={eff} />
                  </td>
                  <td className="actions">
                    {p.pausable && eff === 'active' && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => act((d) => setPlanStatus(d, p.id, 'paused'))}
                      >
                        Pause
                      </button>
                    )}
                    {p.status === 'paused' && eff !== 'closed' && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => act((d) => setPlanStatus(d, p.id, 'active'))}
                      >
                        Resume
                      </button>
                    )}
                    {p.closable && eff !== 'closed' && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => act((d) => setPlanStatus(d, p.id, 'closed'))}
                      >
                        Close
                      </button>
                    )}
                    {p.renewable && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          setRenewing(p);
                          setNewEnd(addPeriod(p.endDate > today ? p.endDate : today, 'yearly', 1));
                        }}
                      >
                        Renew
                      </button>
                    )}
                    <button className="btn btn-ghost" onClick={() => setEditing(p)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() =>
                        window.confirm(`Delete "${p.name}"?`) &&
                        act((d) => removeItem(d, 'plans', p.id))
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editing && <PlanForm initial={editing} onClose={() => setEditing(null)} />}
      {renewing && (
        <Modal title={`Renew ${renewing.name}`} onClose={() => setRenewing(null)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => {
                update((d) => renewPlan(d, renewing.id, newEnd));
                setRenewing(null);
              });
            }}
          >
            <Field label="New end date">
              <input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
            </Field>
            <p className="muted small">Renewing re-opens the plan if it was closed.</p>
            <ErrorBanner error={error} />
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setRenewing(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Renew
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
