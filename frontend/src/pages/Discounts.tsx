import { useMutation, useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { type FormEvent, useState } from 'react';
import { Badge, ErrorBanner, Field, Modal, PageHead } from '../components/ui';
import { discountsApi } from '../lib/api';
import { formatDate, formatMoney } from '../lib/format';
import { queryClient } from '../lib/queryClient';

interface DiscountRule {
  id: string;
  name: string;
  discount_type: 'percent' | 'fixed';
  value: string;
  min_amount: string;
  min_quantity: number;
  start_date: string | null;
  end_date: string | null;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  is_available: boolean;
}

interface DiscountFormData {
  name: string;
  discount_type: 'percent' | 'fixed';
  value: number;
  min_amount: number;
  min_quantity: number;
  max_uses: number;
  start_date: string;
  end_date: string;
}

function DiscountForm({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState<DiscountFormData>({
    name: '',
    discount_type: 'percent',
    value: 10,
    min_amount: 0,
    min_quantity: 0,
    max_uses: 0,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
  });
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => discountsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
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
    const payload: Record<string, unknown> = {
      name: f.name,
      discount_type: f.discount_type,
      value: f.value,
      min_amount: f.min_amount,
      min_quantity: f.min_quantity,
      max_uses: f.max_uses,
      start_date: f.start_date || null,
      end_date: f.end_date || null,
    };
    createMutation.mutate(payload);
  };

  return (
    <Modal title="New discount rule" onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Name">
            <input
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              autoFocus
              required
            />
          </Field>
          <Field label="Type">
            <select
              value={f.discount_type}
              onChange={(e) => setF({ ...f, discount_type: e.target.value as 'percent' | 'fixed' })}
            >
              <option value="percent">Percentage</option>
              <option value="fixed">Fixed amount</option>
            </select>
          </Field>
          <Field label={f.discount_type === 'percent' ? 'Percentage (%)' : 'Amount'}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={f.value}
              onChange={(e) => setF({ ...f, value: Number(e.target.value) })}
              required
            />
          </Field>
          <Field label="Minimum purchase amount">
            <input
              type="number"
              min="0"
              value={f.min_amount}
              onChange={(e) => setF({ ...f, min_amount: Number(e.target.value) })}
            />
          </Field>
          <Field label="Minimum quantity">
            <input
              type="number"
              min="0"
              value={f.min_quantity}
              onChange={(e) => setF({ ...f, min_quantity: Number(e.target.value) })}
            />
          </Field>
          <Field label="Usage limit (0 = unlimited)">
            <input
              type="number"
              min="0"
              value={f.max_uses}
              onChange={(e) => setF({ ...f, max_uses: Number(e.target.value) })}
            />
          </Field>
          <Field label="Starts">
            <input
              type="date"
              value={f.start_date}
              onChange={(e) => setF({ ...f, start_date: e.target.value })}
            />
          </Field>
          <Field label="Ends">
            <input
              type="date"
              value={f.end_date}
              onChange={(e) => setF({ ...f, end_date: e.target.value })}
            />
          </Field>
        </div>

        {error && <ErrorBanner error={error} />}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Discounts() {
  const [creating, setCreating] = useState(false);

  const {
    data: discounts,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ['discounts'],
    queryFn: () =>
      discountsApi.list().then((r) => {
        const d = r.data;
        return (d.results ?? d) as DiscountRule[];
      }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => discountsApi.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discounts'] }),
  });

  const apiError = queryError
    ? ((queryError as AxiosError<{ detail?: string }>).response?.data?.detail ??
      (queryError as Error).message)
    : '';

  return (
    <>
      <PageHead
        title="Discounts"
        sub="Automatic and manual discount rules for subscriptions and invoices"
      >
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          + New discount
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
                <th>Name</th>
                <th>Value</th>
                <th>Min purchase</th>
                <th>Min qty</th>
                <th>Valid dates</th>
                <th>Uses</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(discounts ?? []).map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.name}</strong>
                  </td>
                  <td>
                    {d.discount_type === 'percent' ? `${d.value}%` : formatMoney(Number(d.value))}
                  </td>
                  <td>{Number(d.min_amount) > 0 ? formatMoney(Number(d.min_amount)) : '—'}</td>
                  <td>{d.min_quantity > 0 ? d.min_quantity : '—'}</td>
                  <td className="small">
                    {d.start_date ? formatDate(d.start_date) : 'Any'} →{' '}
                    {d.end_date ? formatDate(d.end_date) : 'Indefinite'}
                  </td>
                  <td>
                    {d.current_uses}
                    {d.max_uses > 0 ? ` / ${d.max_uses}` : ''}
                  </td>
                  <td>
                    <Badge tone={d.is_active ? 'green' : 'gray'}>
                      {d.is_active ? 'active' : 'inactive'}
                    </Badge>
                  </td>
                  <td className="actions">
                    {d.is_active && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={deactivateMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Deactivate discount "${d.name}"?`)) {
                            deactivateMutation.mutate(d.id);
                          }
                        }}
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && <DiscountForm onClose={() => setCreating(false)} />}
    </>
  );
}
