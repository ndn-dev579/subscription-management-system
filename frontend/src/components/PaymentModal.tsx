import { useMutation } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { type FormEvent, useState } from 'react';
import { paymentsApi } from '../lib/api';
import { formatMoney } from '../lib/format';
import { queryClient } from '../lib/queryClient';
import { ErrorBanner, Field, Modal } from './ui';

export interface PaymentInvoiceTarget {
  id: string;
  invoice_number: string;
  customer: string;
  outstanding_amount: string | number;
}

const METHODS = ['Bank Transfer', 'Credit Card', 'UPI', 'Cash', 'Cheque'] as const;

export default function PaymentModal({
  invoice,
  onClose,
}: {
  invoice: PaymentInvoiceTarget;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const due = Number(invoice.outstanding_amount);
  const [method, setMethod] = useState<string>('Bank Transfer');
  const [amount, setAmount] = useState<number>(due);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const createPaymentMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => paymentsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoice.id] });
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
    setError('');
    const payload = {
      customer: invoice.customer,
      amount,
      method,
      payment_date: date,
      note,
      allocations: [
        {
          invoice: invoice.id,
          amount,
        },
      ],
    };
    createPaymentMutation.mutate(payload);
  };

  return (
    <Modal title={`Record payment · ${invoice.invoice_number}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="muted">
          Outstanding balance: <strong>{formatMoney(due)}</strong>
        </p>
        <div className="form-grid">
          <Field label="Method">
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={due}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
            />
          </Field>
          <Field label="Payment Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
        </div>
        <Field label="Note">
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Transaction ID / reference notes"
          />
        </Field>
        {error && <ErrorBanner error={error} />}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={createPaymentMutation.isPending}
          >
            {createPaymentMutation.isPending ? 'Recording…' : 'Record payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
