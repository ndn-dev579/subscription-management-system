import { type FormEvent, useState } from 'react';
import { recordPayment } from '../lib/actions';
import { outstanding } from '../lib/billing';
import { formatMoney, todayISO } from '../lib/format';
import { useAction } from '../lib/hooks';
import { useStore } from '../store/store';
import { type Invoice, METHODS, type PaymentMethod } from '../types';
import { ErrorBanner, Field, Modal } from './ui';

export default function PaymentModal({
  invoice,
  onClose,
}: {
  invoice: Invoice;
  onClose: () => void;
}) {
  const { update } = useStore();
  const { error, run } = useAction();
  const due = outstanding(invoice);
  const [method, setMethod] = useState<PaymentMethod>('Bank transfer');
  const [amount, setAmount] = useState(due);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => {
      update((d) => recordPayment(d, { invoiceId: invoice.id, method, amount, date, note }));
      onClose();
    });
  };
  return (
    <Modal title={`Record payment · ${invoice.number}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="muted">
          Outstanding balance: <strong>{formatMoney(due)}</strong>
        </p>
        <div className="form-grid">
          <Field label="Method">
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </Field>
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Note">
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reference number, remarks…"
          />
        </Field>
        <ErrorBanner error={error} />
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Record payment
          </button>
        </div>
      </form>
    </Modal>
  );
}
