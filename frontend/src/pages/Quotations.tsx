import { useMutation, useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { type FormEvent, useState } from 'react';
import { ErrorBanner, Field, Modal, PageHead, Pager, StatusBadge } from '../components/ui';
import { customersApi, plansApi, productsApi, quotationsApi } from '../lib/api';
import { formatDate } from '../lib/format';
import { usePaged } from '../lib/hooks';
import { queryClient } from '../lib/queryClient';

interface QuotationLineItem {
  id?: string;
  product: string;
  product_name?: string;
  qty: number;
  unit_price: string;
}

interface Quotation {
  id: string;
  quotation_number: string;
  customer: string;
  customer_name: string;
  plan: string;
  plan_name: string;
  status: 'draft' | 'sent' | 'confirmed' | 'cancelled' | 'expired';
  start_date: string;
  expiry_date: string;
  valid_until: string;
  payment_terms: string;
  notes: string;
  lines: QuotationLineItem[];
}

interface CustomerItem {
  id: string;
  customer_number: string;
  company_name: string;
  contact_name: string;
}

interface PlanItem {
  id: string;
  name: string;
  price: string;
}

interface ProductItem {
  id: string;
  name: string;
  sales_price: string;
}

function QuotationForm({
  onClose,
  customers,
  plans,
  products,
}: {
  onClose: () => void;
  customers: CustomerItem[];
  plans: PlanItem[];
  products: ProductItem[];
}) {
  const [customer, setCustomer] = useState(customers[0]?.id ?? '');
  const [plan, setPlan] = useState(plans[0]?.id ?? '');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  );
  const [paymentTerms, setPaymentTerms] = useState('net30');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<QuotationLineItem[]>(
    products.length > 0
      ? [{ product: products[0].id, qty: 1, unit_price: products[0].sales_price }]
      : [],
  );
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => quotationsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      onClose();
    },
    onError: (err) => {
      const e = err as AxiosError<{ detail?: string }>;
      setError(e.response?.data?.detail ?? e.message);
    },
  });

  const addLine = () => {
    if (products.length === 0) return;
    setLines([...lines, { product: products[0].id, qty: 1, unit_price: products[0].sales_price }]);
  };

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, patch: Partial<QuotationLineItem>) => {
    setLines(
      lines.map((l, i) => {
        if (i !== idx) return l;
        const updated = { ...l, ...patch };
        if (patch.product) {
          const prod = products.find((p) => p.id === patch.product);
          if (prod) updated.unit_price = prod.sales_price;
        }
        return updated;
      }),
    );
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!customer) {
      setError('Please select a customer.');
      return;
    }
    if (!plan) {
      setError('Please select a plan.');
      return;
    }
    setError('');
    const payload = {
      customer,
      plan,
      start_date: startDate,
      valid_until: validUntil,
      payment_terms: paymentTerms,
      notes,
      lines: lines.map((l) => ({
        product: l.product,
        qty: Number(l.qty),
        unit_price: l.unit_price,
      })),
    };
    createMutation.mutate(payload);
  };

  return (
    <Modal title="New quotation" onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Customer">
            <select value={customer} onChange={(e) => setCustomer(e.target.value)} required>
              <option value="">Select Customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || c.contact_name} ({c.customer_number})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Plan">
            <select value={plan} onChange={(e) => setPlan(e.target.value)} required>
              <option value="">Select Plan…</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Subscription Start Date">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </Field>

          <Field label="Quotation Valid Until">
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              required
            />
          </Field>

          <Field label="Payment Terms">
            <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>
              <option value="immediate">Immediate</option>
              <option value="net15">Net 15</option>
              <option value="net30">Net 30</option>
              <option value="net60">Net 60</option>
            </select>
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Special commercial terms or customer notes…"
          />
        </Field>

        <div
          style={{
            marginTop: '1rem',
            marginBottom: '0.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <strong>Product Lines & Quantities</strong>
          <button type="button" className="btn btn-ghost" onClick={addLine}>
            + Add line
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th style={{ width: '100px' }}>Quantity</th>
                <th style={{ width: '130px' }}>Unit Price</th>
                <th style={{ width: '50px' }} />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={idx}>
                  <td>
                    <select
                      value={l.product}
                      onChange={(e) => updateLine(idx, { product: e.target.value })}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={l.qty}
                      onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={l.unit_price}
                      onChange={(e) => updateLine(idx, { unit_price: e.target.value })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => removeLine(idx)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <ErrorBanner error={error} />}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating…' : 'Create quotation'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Quotations() {
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [actionError, setActionError] = useState('');

  const {
    data: quotations = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['quotations'],
    queryFn: () =>
      quotationsApi.list().then((r) => {
        const d = r.data;
        return (d.results ?? d) as Quotation[];
      }),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () =>
      customersApi.list().then((r) => {
        const d = r.data;
        return (d.results ?? d) as CustomerItem[];
      }),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: () =>
      plansApi.list().then((r) => {
        const d = r.data;
        return (d.results ?? d) as PlanItem[];
      }),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () =>
      productsApi.list().then((r) => {
        const d = r.data;
        return (d.results ?? d) as ProductItem[];
      }),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => quotationsApi.confirm(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      const subNum = res.data?.subscription_number ?? '';
      setActionMsg(`Quotation confirmed! Created Subscription ${subNum}.`);
    },
    onError: (err) => {
      const e = err as AxiosError<{ detail?: string }>;
      setActionError(e.response?.data?.detail ?? e.message);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      quotationsApi.cancel(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setActionMsg('Quotation cancelled.');
    },
    onError: (err) => {
      const e = err as AxiosError<{ detail?: string }>;
      setActionError(e.response?.data?.detail ?? e.message);
    },
  });

  const needle = q.trim().toLowerCase();
  const filtered = quotations.filter((item) => {
    if (status && item.status !== status) return false;
    if (!needle) return true;
    return (
      item.quotation_number.toLowerCase().includes(needle) ||
      (item.customer_name ?? '').toLowerCase().includes(needle)
    );
  });

  const pg = usePaged(filtered);

  const apiError = error
    ? ((error as AxiosError<{ detail?: string }>).response?.data?.detail ??
      (error as Error).message)
    : '';

  return (
    <>
      <PageHead
        title="Quotations"
        sub="Create commercial offers and convert them into live recurring subscriptions"
      >
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          + New quotation
        </button>
      </PageHead>

      {actionMsg && <p className="success">{actionMsg}</p>}
      {actionError && <ErrorBanner error={actionError} />}
      {apiError && <ErrorBanner error={apiError} />}

      <div className="toolbar">
        <input
          placeholder="Search quotation # or customer…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="card table-wrap">
        {isLoading ? (
          <p className="muted" style={{ padding: '1rem' }}>
            Loading quotations…
          </p>
        ) : filtered.length === 0 ? (
          <p className="empty">No quotations match.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Quotation #</th>
                <th>Customer</th>
                <th>Plan</th>
                <th>Valid Until</th>
                <th className="num">Lines</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pg.rows.map((quo) => (
                <tr key={quo.id}>
                  <td>
                    <strong>{quo.quotation_number}</strong>
                  </td>
                  <td>{quo.customer_name || '—'}</td>
                  <td>{quo.plan_name || '—'}</td>
                  <td>{formatDate(quo.valid_until)}</td>
                  <td className="num">{quo.lines?.length ?? 0}</td>
                  <td>
                    <StatusBadge status={quo.status} />
                  </td>
                  <td className="actions">
                    {(quo.status === 'draft' || quo.status === 'sent') && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={confirmMutation.isPending}
                        onClick={() => {
                          setActionMsg('');
                          setActionError('');
                          confirmMutation.mutate(quo.id);
                        }}
                      >
                        Confirm & Subscribe
                      </button>
                    )}
                    {quo.status !== 'confirmed' && quo.status !== 'cancelled' && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={cancelMutation.isPending}
                        onClick={() => {
                          const reason = prompt('Cancellation reason:');
                          if (reason) cancelMutation.mutate({ id: quo.id, reason });
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pager {...pg} />

      {creating && (
        <QuotationForm
          onClose={() => setCreating(false)}
          customers={customers}
          plans={plans}
          products={products}
        />
      )}
    </>
  );
}
