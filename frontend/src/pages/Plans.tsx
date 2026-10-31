import { useMutation, useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { type FormEvent, useState } from 'react';
import { Badge, ErrorBanner, Field, Modal, PageHead } from '../components/ui';
import { plansApi, taxesApi } from '../lib/api';
import { formatDate, formatMoney } from '../lib/format';
import { queryClient } from '../lib/queryClient';

interface Plan {
  id: string;
  name: string;
  price: string | number;
  billing_interval: 'daily' | 'weekly' | 'monthly' | 'yearly';
  minimum_quantity: number;
  start_date: string;
  end_date: string | null;
  tax: string | null;
  auto_close_on_end: boolean;
  allow_early_close: boolean;
  allow_pause: boolean;
  allow_renewal: boolean;
  is_active: boolean;
}

interface TaxRule {
  id: string;
  name: string;
  rate: number;
}

const INTERVALS = ['daily', 'weekly', 'monthly', 'yearly'] as const;

function PlanForm({
  initial,
  onClose,
  taxes,
}: {
  initial: Plan | null;
  onClose: () => void;
  taxes: TaxRule[];
}) {
  const [f, setF] = useState({
    name: initial?.name ?? '',
    price: initial ? Number(initial.price) : 0,
    billing_interval: initial?.billing_interval ?? 'monthly',
    minimum_quantity: initial?.minimum_quantity ?? 1,
    start_date: initial?.start_date ?? new Date().toISOString().slice(0, 10),
    end_date: initial?.end_date ?? '',
    tax: initial?.tax ?? '',
    auto_close_on_end: initial?.auto_close_on_end ?? false,
    allow_early_close: initial?.allow_early_close ?? true,
    allow_pause: initial?.allow_pause ?? true,
    allow_renewal: initial?.allow_renewal ?? true,
  });
  const [error, setError] = useState('');

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
      if (initial?.id) {
        return plansApi.update(initial.id, payload);
      }
      return plansApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      onClose();
    },
    onError: (err) => {
      const e = err as AxiosError<{ detail?: string }>;
      setError(e.response?.data?.detail ?? e.message);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = {
      ...f,
      tax: f.tax || null,
      end_date: f.end_date || null,
    };
    saveMutation.mutate(payload);
  };

  return (
    <Modal title={initial ? 'Edit plan' : 'New plan'} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Plan Name">
            <input
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              autoFocus
              required
            />
          </Field>
          <Field label="Price per Period">
            <input
              type="number"
              min="0"
              step="0.01"
              value={f.price}
              onChange={(e) => setF({ ...f, price: Number(e.target.value) })}
              required
            />
          </Field>
          <Field label="Billing Interval">
            <select
              value={f.billing_interval}
              onChange={(e) =>
                setF({
                  ...f,
                  billing_interval: e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly',
                })
              }
            >
              {INTERVALS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Minimum Quantity">
            <input
              type="number"
              min="1"
              value={f.minimum_quantity}
              onChange={(e) => setF({ ...f, minimum_quantity: Number(e.target.value) })}
              required
            />
          </Field>
          <Field label="Available From">
            <input
              type="date"
              value={f.start_date}
              onChange={(e) => setF({ ...f, start_date: e.target.value })}
              required
            />
          </Field>
          <Field label="Available Until (Optional)">
            <input
              type="date"
              value={f.end_date}
              onChange={(e) => setF({ ...f, end_date: e.target.value })}
            />
          </Field>
          <Field label="Tax Rule">
            <select value={f.tax} onChange={(e) => setF({ ...f, tax: e.target.value })}>
              <option value="">No tax</option>
              {taxes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.rate}%)
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="checks" style={{ marginTop: '1rem' }}>
          <label className="check">
            <input
              type="checkbox"
              checked={f.allow_pause}
              onChange={(e) => setF({ ...f, allow_pause: e.target.checked })}
            />{' '}
            Allow Pause
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={f.allow_early_close}
              onChange={(e) => setF({ ...f, allow_early_close: e.target.checked })}
            />{' '}
            Allow Early Close
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={f.allow_renewal}
              onChange={(e) => setF({ ...f, allow_renewal: e.target.checked })}
            />{' '}
            Allow Renewal
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={f.auto_close_on_end}
              onChange={(e) => setF({ ...f, auto_close_on_end: e.target.checked })}
            />{' '}
            Auto-close at End Date
          </label>
        </div>

        {error && <ErrorBanner error={error} />}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Plans() {
  const [editing, setEditing] = useState<Plan | null | 'new'>(null);

  const {
    data: plans,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['plans'],
    queryFn: () =>
      plansApi.list().then((r) => {
        const d = r.data;
        return (d.results ?? d) as Plan[];
      }),
  });

  const { data: taxes = [] } = useQuery({
    queryKey: ['taxes'],
    queryFn: () => taxesApi.list().then((r) => r.data as TaxRule[]),
  });

  const apiError = error
    ? ((error as AxiosError<{ detail?: string }>).response?.data?.detail ??
      (error as Error).message)
    : '';

  return (
    <>
      <PageHead title="Plans" sub="Subscription billing frequencies, prices, and lifecycle rules">
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          + New plan
        </button>
      </PageHead>

      {apiError && <ErrorBanner error={apiError} />}

      <div className="card table-wrap">
        {isLoading ? (
          <p className="muted" style={{ padding: '1rem' }}>
            Loading…
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Plan Name</th>
                <th className="num">Price</th>
                <th>Billing</th>
                <th className="num">Min Qty</th>
                <th>Validity</th>
                <th>Lifecycle Rules</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(plans ?? []).map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                  </td>
                  <td className="num">{formatMoney(Number(p.price))}</td>
                  <td>{p.billing_interval}</td>
                  <td className="num">{p.minimum_quantity}</td>
                  <td className="small">
                    {formatDate(p.start_date)} → {p.end_date ? formatDate(p.end_date) : 'Ongoing'}
                  </td>
                  <td className="chips">
                    {p.allow_pause && <Badge>Pausable</Badge>}
                    {p.allow_early_close && <Badge>Closable</Badge>}
                    {p.allow_renewal && <Badge>Renewable</Badge>}
                    {p.auto_close_on_end && <Badge>Auto-close</Badge>}
                  </td>
                  <td>
                    <Badge tone={p.is_active ? 'green' : 'gray'}>
                      {p.is_active ? 'active' : 'inactive'}
                    </Badge>
                  </td>
                  <td className="actions">
                    <button type="button" className="btn btn-ghost" onClick={() => setEditing(p)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing !== null && (
        <PlanForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          taxes={taxes}
        />
      )}
    </>
  );
}
