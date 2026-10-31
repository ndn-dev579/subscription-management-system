import { useMutation, useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { type FormEvent, useState } from 'react';
import { customersApi, plansApi, subscriptionsApi } from '../lib/api';
import { queryClient } from '../lib/queryClient';
import LinesEditor, { type LineDraft } from './LinesEditor';
import { ErrorBanner, Field, Modal } from './ui';

interface CustomerItem {
  id: string;
  customer_number: string;
  company_name: string;
  contact_name: string;
}

interface PlanItem {
  id: string;
  name: string;
  minimum_quantity: number;
}

export default function SubscriptionForm({ onClose }: { onClose: () => void }) {
  const [customer, setCustomer] = useState('');
  const [plan, setPlan] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState(
    new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  );
  const [paymentTerms, setPaymentTerms] = useState('net30');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [error, setError] = useState('');

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

  const selectedPlan = plans.find((p) => p.id === plan);

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => subscriptionsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (err) => {
      const e = err as AxiosError<{ detail?: string }>;
      setError(e.response?.data?.detail ?? e.message);
    },
  });

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
      expiry_date: expiryDate,
      payment_terms: paymentTerms,
      lines: lines.map((l) => ({
        product: l.product,
        variant: l.variant || null,
        qty: Number(l.qty),
        unit_price: String(l.unit_price),
      })),
    };
    createMutation.mutate(payload);
  };

  return (
    <Modal title="New Subscription" onClose={onClose} wide>
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

          <Field label="Start Date">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </Field>

          <Field label="Expiry Date">
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
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

        <LinesEditor
          lines={lines}
          onChange={setLines}
          minQty={selectedPlan?.minimum_quantity ?? 1}
        />

        {error && <ErrorBanner error={error} />}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating…' : 'Create Subscription'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
