import { useMutation, useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, ErrorBanner, PageHead, Pager, StatusBadge } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { invoicesApi } from '../lib/api';
import { formatDate, formatMoney } from '../lib/format';
import { usePaged } from '../lib/hooks';
import { queryClient } from '../lib/queryClient';

interface Invoice {
  id: string;
  invoice_number: string;
  customer: string;
  customer_name: string;
  subscription: string | null;
  subscription_number: string;
  issue_date: string;
  due_date: string;
  status: 'draft' | 'confirmed' | 'paid' | 'cancelled';
  total_amount: string;
  outstanding_amount: string;
}

export default function Invoices() {
  const { me } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const isTeam = me?.role !== 'customer';
  const today = new Date().toISOString().slice(0, 10);

  const {
    data: invoices,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['invoices'],
    queryFn: () =>
      invoicesApi.list().then((r) => {
        const d = r.data;
        return (d.results ?? d) as Invoice[];
      }),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.confirm(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => invoicesApi.cancel(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const rows = useMemo(() => {
    const all = invoices ?? [];
    const needle = q.trim().toLowerCase();
    return all.filter((i) => {
      const isOverdue =
        i.status === 'confirmed' && i.due_date < today && Number(i.outstanding_amount) > 0;
      if (status === 'overdue' ? !isOverdue : status && i.status !== status) {
        return false;
      }
      if (!needle) return true;
      return (
        i.invoice_number.toLowerCase().includes(needle) ||
        (i.customer_name ?? '').toLowerCase().includes(needle) ||
        (i.subscription_number ?? '').toLowerCase().includes(needle)
      );
    });
  }, [invoices, q, status, today]);

  const pg = usePaged(rows);

  const downloadPdf = async (id: string, num: string) => {
    try {
      const res = await invoicesApi.downloadPdf(id);
      const blob = new Blob([res.data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${num}.txt`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed to download invoice');
    }
  };

  const apiError = error
    ? ((error as AxiosError<{ detail?: string }>).response?.data?.detail ??
      (error as Error).message)
    : '';

  return (
    <>
      <PageHead
        title={isTeam ? 'Invoices' : 'My invoices'}
        sub={`${(invoices ?? []).length.toLocaleString()} total`}
      />

      {apiError && <ErrorBanner error={apiError} />}

      <div className="toolbar">
        <input
          placeholder="Search invoice number or customer…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {(isTeam ? ['draft', 'confirmed', 'paid', 'cancelled'] : ['confirmed', 'paid']).map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ),
          )}
          <option value="overdue">Overdue</option>
        </select>
      </div>

      <div className="card table-wrap">
        {isLoading ? (
          <p className="muted" style={{ padding: '1rem' }}>
            Loading…
          </p>
        ) : rows.length === 0 ? (
          <p className="empty">No invoices match.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                {isTeam && <th>Customer</th>}
                <th>Subscription</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th className="num">Total</th>
                <th className="num">Balance</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pg.rows.map((i) => {
                const isOverdue =
                  i.status === 'confirmed' &&
                  i.due_date < today &&
                  Number(i.outstanding_amount) > 0;
                return (
                  <tr key={i.id}>
                    <td>
                      <Link to={`/invoices/${i.id}`}>
                        <strong>{i.invoice_number}</strong>
                      </Link>
                    </td>
                    {isTeam && <td>{i.customer_name || '—'}</td>}
                    <td>{i.subscription_number || 'One-off'}</td>
                    <td>{formatDate(i.issue_date)}</td>
                    <td>{formatDate(i.due_date)}</td>
                    <td className="num">{formatMoney(Number(i.total_amount))}</td>
                    <td className="num">
                      {i.status === 'confirmed' ? formatMoney(Number(i.outstanding_amount)) : '—'}
                    </td>
                    <td>
                      <StatusBadge status={i.status} />
                      {isOverdue && (
                        <>
                          {' '}
                          <Badge tone="red">overdue</Badge>
                        </>
                      )}
                    </td>
                    <td className="actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => downloadPdf(i.id, i.invoice_number)}
                      >
                        PDF
                      </button>
                      {isTeam && i.status === 'draft' && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={confirmMutation.isPending}
                          onClick={() => confirmMutation.mutate(i.id)}
                        >
                          Confirm
                        </button>
                      )}
                      {isTeam && (i.status === 'draft' || i.status === 'confirmed') && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={cancelMutation.isPending}
                          onClick={() => {
                            const reason = prompt('Cancellation reason:');
                            if (reason) cancelMutation.mutate({ id: i.id, reason });
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Pager {...pg} />
    </>
  );
}
