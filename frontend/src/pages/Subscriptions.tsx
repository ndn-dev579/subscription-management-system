import { useMutation, useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SubscriptionForm from '../components/SubscriptionForm';
import { ErrorBanner, PageHead, Pager, StatusBadge } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionsApi } from '../lib/api';
import { formatDate, formatMoney } from '../lib/format';
import { usePaged } from '../lib/hooks';
import { queryClient } from '../lib/queryClient';

interface SubLine {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: string;
}

interface Subscription {
  id: string;
  number: string;
  customer_name: string;
  customer_id: string;
  plan_name: string;
  plan_id: string;
  billing_interval: string;
  status: string;
  start_date: string;
  end_date: string | null;
  next_billing_date: string | null;
  total_per_period: string;
  lines: SubLine[];
}

const SUB_STATUSES = ['active', 'paused', 'closed', 'draft'];

function apiErr(err: unknown): string {
  const e = err as AxiosError<{ detail?: string }>;
  return e.response?.data?.detail ?? (err as Error).message;
}

export default function Subscriptions() {
  const { me } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const isCustomer = me?.role === 'customer';

  const { data, isLoading, error } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () =>
      subscriptionsApi.list().then((r) => {
        const d = r.data;
        return (d.results ?? d) as Subscription[];
      }),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => subscriptionsApi.pause(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
  });
  const resumeMutation = useMutation({
    mutationFn: (id: string) => subscriptionsApi.resume(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
  });
  const closeMutation = useMutation({
    mutationFn: (id: string) => subscriptionsApi.close(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
  });

  const [actionError, setActionError] = useState('');

  const rows = useMemo(() => {
    const all = data ?? [];
    const needle = q.trim().toLowerCase();
    return all
      .filter((s) => {
        if (status && s.status !== status) return false;
        if (!needle) return true;
        return (
          s.number.toLowerCase().includes(needle) || s.customer_name.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => b.number.localeCompare(a.number));
  }, [data, q, status]);

  const pg = usePaged(rows);

  const act = async (fn: () => Promise<unknown>) => {
    setActionError('');
    try {
      await fn();
    } catch (err) {
      setActionError(apiErr(err));
    }
  };

  return (
    <>
      <PageHead
        title={isCustomer ? 'My subscriptions' : 'Subscriptions'}
        sub={`${(data ?? []).length.toLocaleString()} total`}
      >
        {!isCustomer && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            + New subscription
          </button>
        )}
      </PageHead>

      {actionError && <ErrorBanner error={actionError} />}

      <div className="toolbar">
        <input
          placeholder="Search number or customer…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {SUB_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="card table-wrap">
        {isLoading ? (
          <p className="muted" style={{ padding: '1rem' }}>
            Loading…
          </p>
        ) : error ? (
          <ErrorBanner error={(error as Error).message} />
        ) : rows.length === 0 ? (
          <p className="empty">No subscriptions match.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Number</th>
                {!isCustomer && <th>Customer</th>}
                <th>Plan</th>
                <th>Start</th>
                <th>Next billing</th>
                <th className="num">Per period</th>
                <th>Status</th>
                {!isCustomer && <th />}
              </tr>
            </thead>
            <tbody>
              {pg.rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link to={`/subscriptions/${s.id}`}>
                      <strong>{s.number}</strong>
                    </Link>
                  </td>
                  {!isCustomer && <td>{s.customer_name}</td>}
                  <td>{s.plan_name}</td>
                  <td>{formatDate(s.start_date)}</td>
                  <td>{s.next_billing_date ? formatDate(s.next_billing_date) : '—'}</td>
                  <td className="num">
                    {formatMoney(Number(s.total_per_period))}{' '}
                    <span className="muted small">/ {s.billing_interval}</span>
                  </td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  {!isCustomer && (
                    <td className="actions">
                      {s.status === 'active' && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => act(() => pauseMutation.mutateAsync(s.id))}
                        >
                          Pause
                        </button>
                      )}
                      {s.status === 'paused' && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => act(() => resumeMutation.mutateAsync(s.id))}
                        >
                          Resume
                        </button>
                      )}
                      {s.status !== 'closed' && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() =>
                            window.confirm(`Close subscription ${s.number}?`) &&
                            act(() => closeMutation.mutateAsync(s.id))
                          }
                        >
                          Close
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pager {...pg} />

      {creating && <SubscriptionForm onClose={() => setCreating(false)} />}
    </>
  );
}
