import { useMutation, useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, ErrorBanner, PageHead, StatusBadge } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionsApi } from '../lib/api';
import { formatDate, formatMoney } from '../lib/format';
import { queryClient } from '../lib/queryClient';

interface SubLine {
  id: string;
  product_name: string;
  qty: number;
  unit_price: string;
}

interface SubscriptionData {
  id: string;
  subscription_number: string;
  customer: string;
  customer_name: string;
  plan: string;
  plan_name: string;
  billing_interval: string;
  status: 'draft' | 'confirmed' | 'active' | 'paused' | 'closed';
  start_date: string;
  expiry_date: string;
  payment_terms: string;
  allow_pause: boolean;
  allow_early_close: boolean;
  allow_renewal: boolean;
  last_billed_date: string | null;
  next_billing_date: string | null;
  close_reason?: string;
  lines: SubLine[];
}

export default function SubscriptionDetail() {
  const { id = '' } = useParams();
  const { me } = useAuth();
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const {
    data: sub,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['subscription', id],
    queryFn: () => subscriptionsApi.get(id).then((r) => r.data as SubscriptionData),
  });

  const pauseMutation = useMutation({
    mutationFn: () => subscriptionsApi.pause(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', id] });
      setNote('Subscription paused.');
    },
    onError: (err) => {
      const e = err as AxiosError<{ detail?: string }>;
      setErrorMsg(e.response?.data?.detail ?? e.message);
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => subscriptionsApi.resume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', id] });
      setNote('Subscription resumed.');
    },
    onError: (err) => {
      const e = err as AxiosError<{ detail?: string }>;
      setErrorMsg(e.response?.data?.detail ?? e.message);
    },
  });

  const closeMutation = useMutation({
    mutationFn: (reason: string) => subscriptionsApi.close(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', id] });
      setNote('Subscription closed.');
    },
    onError: (err) => {
      const e = err as AxiosError<{ detail?: string }>;
      setErrorMsg(e.response?.data?.detail ?? e.message);
    },
  });

  const renewMutation = useMutation({
    mutationFn: (endDate: string) => subscriptionsApi.renew(id, { expiry_date: endDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', id] });
      setNote('Subscription renewed.');
    },
    onError: (err) => {
      const e = err as AxiosError<{ detail?: string }>;
      setErrorMsg(e.response?.data?.detail ?? e.message);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <p className="muted">Loading subscription…</p>
      </Card>
    );
  }

  if (error || !sub) {
    return (
      <Card>
        <p>Subscription not found or access denied.</p>
        <Link to="/subscriptions">← Back to Subscriptions</Link>
      </Card>
    );
  }

  const isTeam = me?.role !== 'customer';
  const totalPeriod = sub.lines.reduce((acc, l) => acc + l.qty * Number(l.unit_price), 0);

  return (
    <>
      <PageHead
        title={sub.subscription_number}
        sub={`Customer: ${sub.customer_name} · Plan: ${sub.plan_name}`}
      >
        {isTeam && sub.status === 'active' && sub.allow_pause && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pauseMutation.isPending}
            onClick={() => pauseMutation.mutate()}
          >
            Pause
          </button>
        )}
        {isTeam && sub.status === 'paused' && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={resumeMutation.isPending}
            onClick={() => resumeMutation.mutate()}
          >
            Resume
          </button>
        )}
        {isTeam && sub.status !== 'closed' && (
          <button
            type="button"
            className="btn btn-danger"
            disabled={closeMutation.isPending}
            onClick={() => {
              const reason = prompt('Closing reason:');
              if (reason) closeMutation.mutate(reason);
            }}
          >
            Close
          </button>
        )}
        {isTeam && sub.allow_renewal && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={renewMutation.isPending}
            onClick={() => {
              const newEnd = prompt('Enter new expiry date (YYYY-MM-DD):');
              if (newEnd) renewMutation.mutate(newEnd);
            }}
          >
            Renew
          </button>
        )}
      </PageHead>

      {note && <p className="success no-print">{note}</p>}
      {errorMsg && <ErrorBanner error={errorMsg} />}

      <section className="grid-2">
        <Card title="Subscription Details">
          <ul className="list">
            <li>
              <span>Status</span>
              <strong>
                <StatusBadge status={sub.status} />
              </strong>
            </li>
            <li>
              <span>Billing Interval</span>
              <strong>{sub.billing_interval}</strong>
            </li>
            <li>
              <span>Start Date</span>
              <strong>{formatDate(sub.start_date)}</strong>
            </li>
            <li>
              <span>Expiry Date</span>
              <strong>{formatDate(sub.expiry_date)}</strong>
            </li>
            <li>
              <span>Next Billing Date</span>
              <strong>{sub.next_billing_date ? formatDate(sub.next_billing_date) : '—'}</strong>
            </li>
            <li>
              <span>Payment Terms</span>
              <strong>{sub.payment_terms}</strong>
            </li>
          </ul>
        </Card>

        <Card title="Recurring Pricing">
          <ul className="list">
            <li>
              <span>Total per period</span>
              <strong>
                {formatMoney(totalPeriod)} / {sub.billing_interval}
              </strong>
            </li>
            {sub.close_reason && (
              <li>
                <span>Close Reason</span>
                <span className="muted">{sub.close_reason}</span>
              </li>
            )}
          </ul>
        </Card>
      </section>

      <Card title="Subscription Products & Licenses">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">Quantity</th>
                <th className="num">Unit Price</th>
                <th className="num">Recurring Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {sub.lines.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.product_name || 'Software License'}</strong>
                  </td>
                  <td className="num">{l.qty}</td>
                  <td className="num">{formatMoney(Number(l.unit_price))}</td>
                  <td className="num">{formatMoney(l.qty * Number(l.unit_price))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
