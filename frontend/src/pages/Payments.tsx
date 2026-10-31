import { useMutation, useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PaymentModal from '../components/PaymentModal';
import { Badge, ErrorBanner, PageHead, Pager } from '../components/ui';
import { invoicesApi, paymentsApi } from '../lib/api';
import { formatDate, formatMoney } from '../lib/format';
import { usePaged } from '../lib/hooks';
import { queryClient } from '../lib/queryClient';

type Tab = 'outstanding' | 'paid' | 'history';

interface InvoiceRow {
  id: string;
  invoice_number: string;
  customer: string;
  customer_name: string;
  due_date: string;
  issue_date: string;
  total_amount: string;
  outstanding_amount: string;
  status: 'draft' | 'confirmed' | 'paid' | 'cancelled';
}

interface PaymentRow {
  id: string;
  payment_number: string;
  customer_name: string;
  amount: string;
  method: string;
  payment_date: string;
  transaction_reference: string;
  is_reversed: boolean;
  allocations: Array<{ id: string; invoice: string; invoice_number: string; amount: string }>;
}

export default function Payments() {
  const [tab, setTab] = useState<Tab>('outstanding');
  const [q, setQ] = useState('');
  const [paying, setPaying] = useState<InvoiceRow | null>(null);
  const [actionError, setActionError] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const needle = q.trim().toLowerCase();

  const {
    data: invoices = [],
    isLoading: loadingInvoices,
    error: invErr,
  } = useQuery({
    queryKey: ['invoices'],
    queryFn: () =>
      invoicesApi.list().then((r) => {
        const d = r.data;
        return (d.results ?? d) as InvoiceRow[];
      }),
  });

  const {
    data: payments = [],
    isLoading: loadingPayments,
    error: payErr,
  } = useQuery({
    queryKey: ['payments'],
    queryFn: () =>
      paymentsApi.list().then((r) => {
        const d = r.data;
        return (d.results ?? d) as PaymentRow[];
      }),
  });

  const reverseMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => paymentsApi.reverse(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      const e = err as AxiosError<{ detail?: string }>;
      setActionError(e.response?.data?.detail ?? e.message);
    },
  });

  const filteredInvoices = useMemo(() => {
    if (tab === 'history') return [];
    return invoices
      .filter((i) => {
        const matchTab =
          tab === 'paid'
            ? i.status === 'paid'
            : i.status === 'confirmed' && Number(i.outstanding_amount) > 0;
        if (!matchTab) return false;
        if (!needle) return true;
        return (
          i.invoice_number.toLowerCase().includes(needle) ||
          (i.customer_name ?? '').toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [invoices, tab, needle]);

  const filteredHistory = useMemo(() => {
    if (tab !== 'history') return [];
    return payments
      .filter((p) => {
        if (!needle) return true;
        return (
          p.payment_number.toLowerCase().includes(needle) ||
          (p.customer_name ?? '').toLowerCase().includes(needle) ||
          (p.method ?? '').toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  }, [payments, tab, needle]);

  const pgInv = usePaged(filteredInvoices);
  const pgHis = usePaged(filteredHistory);

  const currentError = tab === 'history' ? payErr : invErr;
  const apiError = currentError
    ? ((currentError as AxiosError<{ detail?: string }>).response?.data?.detail ??
      (currentError as Error).message)
    : '';

  return (
    <>
      <PageHead
        title="Payments"
        sub="Track invoice collections, outstanding balances, and payment allocations"
      />

      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === 'outstanding' ? 'active' : ''}`}
          onClick={() => setTab('outstanding')}
        >
          Outstanding
        </button>
        <button
          type="button"
          className={`tab ${tab === 'paid' ? 'active' : ''}`}
          onClick={() => setTab('paid')}
        >
          Fully Paid
        </button>
        <button
          type="button"
          className={`tab ${tab === 'history' ? 'active' : ''}`}
          onClick={() => setTab('history')}
        >
          Payment Ledger
        </button>
      </div>

      <div className="toolbar">
        <input
          placeholder="Filter invoice, customer, or reference…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {apiError && <ErrorBanner error={apiError} />}
      {actionError && <ErrorBanner error={actionError} />}

      <div className="card table-wrap">
        {tab !== 'history' ? (
          loadingInvoices ? (
            <p className="muted" style={{ padding: '1rem' }}>
              Loading invoices…
            </p>
          ) : filteredInvoices.length === 0 ? (
            <p className="empty">No invoices found.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Due Date</th>
                  <th className="num">Total</th>
                  <th className="num">Balance Due</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pgInv.rows.map((i) => {
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
                      <td>{i.customer_name || '—'}</td>
                      <td>
                        {formatDate(i.due_date)}
                        {isOverdue && (
                          <>
                            {' '}
                            <Badge tone="red">overdue</Badge>
                          </>
                        )}
                      </td>
                      <td className="num">{formatMoney(Number(i.total_amount))}</td>
                      <td className="num">
                        <strong>{formatMoney(Number(i.outstanding_amount))}</strong>
                      </td>
                      <td className="actions">
                        {Number(i.outstanding_amount) > 0 && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => setPaying(i)}
                          >
                            Record payment
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : loadingPayments ? (
          <p className="muted" style={{ padding: '1rem' }}>
            Loading payments ledger…
          </p>
        ) : filteredHistory.length === 0 ? (
          <p className="empty">No payments recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Method</th>
                <th className="num">Amount</th>
                <th>Invoices Covered</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pgHis.rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.payment_number}</strong>
                  </td>
                  <td>{formatDate(p.payment_date)}</td>
                  <td>{p.customer_name || '—'}</td>
                  <td>{p.method}</td>
                  <td className="num">{formatMoney(Number(p.amount))}</td>
                  <td className="small">
                    {p.allocations?.map((a) => a.invoice_number).join(', ') || '—'}
                  </td>
                  <td>
                    <Badge tone={p.is_reversed ? 'red' : 'green'}>
                      {p.is_reversed ? 'reversed' : 'settled'}
                    </Badge>
                  </td>
                  <td className="actions">
                    {!p.is_reversed && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={reverseMutation.isPending}
                        onClick={() => {
                          const reason = prompt('Reversal reason:');
                          if (reason) reverseMutation.mutate({ id: p.id, reason });
                        }}
                      >
                        Reverse
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pager {...(tab === 'history' ? pgHis : pgInv)} />

      {paying && (
        <PaymentModal
          invoice={{
            id: paying.id,
            invoice_number: paying.invoice_number,
            customer: paying.customer,
            outstanding_amount: paying.outstanding_amount,
          }}
          onClose={() => setPaying(null)}
        />
      )}
    </>
  );
}
