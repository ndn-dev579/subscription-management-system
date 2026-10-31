import { useMutation, useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Card, ErrorBanner, PageHead, StatusBadge } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { invoicesApi } from '../lib/api';
import { formatDate, formatMoney } from '../lib/format';
import { queryClient } from '../lib/queryClient';

interface InvoiceLineItem {
  id: string;
  description: string;
  qty: number;
  unit_price: string;
  discount_amount: string;
  tax_amount: string;
  line_total: string;
}

interface InvoiceDetailData {
  id: string;
  invoice_number: string;
  customer: string;
  customer_name: string;
  subscription: string | null;
  subscription_number: string;
  period_start: string;
  period_end: string;
  issue_date: string;
  due_date: string;
  status: 'draft' | 'confirmed' | 'paid' | 'cancelled';
  subtotal: string;
  tax_total: string;
  discount_total: string;
  total_amount: string;
  paid_amount: string;
  outstanding_amount: string;
  lines: InvoiceLineItem[];
}

export default function InvoiceDetail() {
  const { id = '' } = useParams();
  const { me } = useAuth();
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const {
    data: inv,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.get(id).then((r) => r.data as InvoiceDetailData),
  });

  const confirmMutation = useMutation({
    mutationFn: () => invoicesApi.confirm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      setNote('Invoice confirmed.');
    },
    onError: (err) => {
      const e = err as AxiosError<{ detail?: string }>;
      setErrorMsg(e.response?.data?.detail ?? e.message);
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => invoicesApi.send(id),
    onSuccess: () => {
      setNote('Invoice sent to customer.');
    },
    onError: (err) => {
      const e = err as AxiosError<{ detail?: string }>;
      setErrorMsg(e.response?.data?.detail ?? e.message);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => invoicesApi.cancel(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      setNote('Invoice cancelled.');
    },
    onError: (err) => {
      const e = err as AxiosError<{ detail?: string }>;
      setErrorMsg(e.response?.data?.detail ?? e.message);
    },
  });

  const downloadPdf = async () => {
    if (!inv) return;
    try {
      const res = await invoicesApi.downloadPdf(inv.id);
      const blob = new Blob([res.data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${inv.invoice_number}.txt`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download invoice');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <p className="muted">Loading invoice…</p>
      </Card>
    );
  }

  if (error || !inv) {
    return (
      <Card>
        <p>Invoice not found or access denied.</p>
        <Link to="/invoices">← Back to Invoices</Link>
      </Card>
    );
  }

  const isTeam = me?.role !== 'customer';
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue =
    inv.status === 'confirmed' && inv.due_date < today && Number(inv.outstanding_amount) > 0;

  return (
    <>
      <PageHead
        title={inv.invoice_number}
        sub={inv.subscription_number ? `Subscription ${inv.subscription_number}` : ''}
      >
        <button type="button" className="btn btn-ghost" onClick={downloadPdf}>
          Download PDF
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
          Print
        </button>
        {isTeam && inv.status === 'draft' && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={confirmMutation.isPending}
            onClick={() => confirmMutation.mutate()}
          >
            Confirm
          </button>
        )}
        {isTeam && (inv.status === 'confirmed' || inv.status === 'paid') && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
          >
            Send email
          </button>
        )}
        {isTeam && (inv.status === 'draft' || inv.status === 'confirmed') && (
          <button
            type="button"
            className="btn btn-danger"
            disabled={cancelMutation.isPending}
            onClick={() => {
              const reason = prompt('Cancellation reason:');
              if (reason) cancelMutation.mutate(reason);
            }}
          >
            Cancel
          </button>
        )}
      </PageHead>

      {note && <p className="success no-print">{note}</p>}
      {errorMsg && <ErrorBanner error={errorMsg} />}

      <Card className="invoice-doc">
        <div className="doc-head">
          <div>
            <div className="brand">
              <span className="brand-dot" /> Brightloop Software
            </div>
            <p className="muted small">Subscription billing</p>
          </div>
          <div className="doc-meta">
            <h2>Invoice {inv.invoice_number}</h2>
            <StatusBadge status={inv.status} />
            {isOverdue && (
              <>
                {' '}
                <Badge tone="red">overdue</Badge>
              </>
            )}
            <p className="small">
              Issued {formatDate(inv.issue_date)} · Due {formatDate(inv.due_date)}
            </p>
            <p className="small muted">
              Period {formatDate(inv.period_start)} → {formatDate(inv.period_end)}
            </p>
          </div>
        </div>

        <div className="bill-to">
          <span className="muted small">Bill to</span>
          <strong>{inv.customer_name || 'Customer'}</strong>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th className="num">Qty</th>
                <th className="num">Unit price</th>
                <th className="num">Discount</th>
                <th className="num">Tax</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l) => (
                <tr key={l.id}>
                  <td>{l.description || 'Subscription Line'}</td>
                  <td className="num">{l.qty}</td>
                  <td className="num">{formatMoney(Number(l.unit_price))}</td>
                  <td className="num">
                    {Number(l.discount_amount) > 0
                      ? `− ${formatMoney(Number(l.discount_amount))}`
                      : '—'}
                  </td>
                  <td className="num">
                    {Number(l.tax_amount) > 0 ? formatMoney(Number(l.tax_amount)) : '—'}
                  </td>
                  <td className="num">{formatMoney(Number(l.line_total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="totals">
          <div>
            <span>Subtotal</span>
            <span>{formatMoney(Number(inv.subtotal))}</span>
          </div>
          {Number(inv.discount_total) > 0 && (
            <div>
              <span>Discounts</span>
              <span>− {formatMoney(Number(inv.discount_total))}</span>
            </div>
          )}
          <div>
            <span>Taxes</span>
            <span>{formatMoney(Number(inv.tax_total))}</span>
          </div>
          <div className="grand">
            <span>Total</span>
            <span>{formatMoney(Number(inv.total_amount))}</span>
          </div>
          <div>
            <span>Paid</span>
            <span>{formatMoney(Number(inv.paid_amount))}</span>
          </div>
          <div className="grand">
            <span>Balance due</span>
            <span>{formatMoney(Number(inv.outstanding_amount))}</span>
          </div>
        </div>
      </Card>
    </>
  );
}
