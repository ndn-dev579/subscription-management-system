import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PaymentModal from '../components/PaymentModal';
import { Badge, Card, ErrorBanner, PageHead, StatusBadge } from '../components/ui';
import { markSent, setInvoiceStatus } from '../lib/actions';
import { isOverdue, outstanding } from '../lib/billing';
import { formatDate, formatMoney } from '../lib/format';
import { useAction } from '../lib/hooks';
import { useStore } from '../store/store';

export default function InvoiceDetail() {
  const { id = '' } = useParams();
  const { db, by, me, update } = useStore();
  const { error, run } = useAction();
  const [paying, setPaying] = useState(false);
  const [note, setNote] = useState('');
  const inv = by.invoice.get(id);
  const hidden = me?.role === 'customer' && inv && (inv.customerId !== me.id || inv.status === 'draft' || inv.status === 'cancelled');
  if (!inv || !me || hidden) return <Card><p>Invoice not found.</p><Link to="/invoices">← Back</Link></Card>;

  const isTeam = me.role !== 'customer';
  const customer = by.user.get(inv.customerId);
  const sub = by.sub.get(inv.subscriptionId);
  const payments = db.payments.filter((p) => p.invoiceId === inv.id);

  return (
    <>
      <PageHead title={inv.number} sub={sub ? `Subscription ${sub.number}` : ''}>
        <button className="btn btn-ghost" onClick={() => window.print()}>Print</button>
        {isTeam && inv.status === 'draft' && <button className="btn btn-primary" onClick={() => run(() => update((d) => setInvoiceStatus(d, inv.id, 'confirmed')))}>Confirm</button>}
        {isTeam && (inv.status === 'confirmed' || inv.status === 'paid') && (
          <button className="btn btn-ghost" onClick={() => run(() => { update((d) => markSent(d, inv.id)); setNote(`Invoice sent to ${customer?.email}.`); })}>
            {inv.sent ? 'Resend' : 'Send'}
          </button>
        )}
        {isTeam && inv.status === 'confirmed' && <button className="btn btn-primary" onClick={() => setPaying(true)}>Record payment</button>}
        {isTeam && (inv.status === 'draft' || (inv.status === 'confirmed' && inv.paid === 0)) && (
          <button className="btn btn-danger" onClick={() => window.confirm('Cancel this invoice?') && run(() => update((d) => setInvoiceStatus(d, inv.id, 'cancelled')))}>Cancel</button>
        )}
      </PageHead>
      {note && <p className="success no-print">{note}</p>}
      <ErrorBanner error={error} />

      <Card className="invoice-doc">
        <div className="doc-head">
          <div>
            <div className="brand"><span className="brand-dot" /> Brightloop Software</div>
            <p className="muted small">Subscription billing</p>
          </div>
          <div className="doc-meta">
            <h2>Invoice {inv.number}</h2>
            <StatusBadge status={inv.status} />{isOverdue(inv) && <> <Badge tone="red">overdue</Badge></>}
            <p className="small">Issued {formatDate(inv.issueDate)} · Due {formatDate(inv.dueDate)}</p>
            <p className="small muted">Period {formatDate(inv.periodStart)} → {formatDate(inv.periodEnd)}</p>
          </div>
        </div>
        <div className="bill-to">
          <span className="muted small">Bill to</span>
          <strong>{customer?.company || customer?.name}</strong>
          <span>{customer?.name} · {customer?.email}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Description</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Discount</th><th>Tax</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {inv.lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.description}</td><td className="num">{l.qty}</td><td className="num">{formatMoney(l.unitPrice)}</td>
                  <td className="num">{l.discount ? `− ${formatMoney(l.discount)}` : '—'}</td>
                  <td>{l.taxName ? `${l.taxName}` : '—'}</td><td className="num">{formatMoney(l.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {inv.discounts.length > 0 && <p className="small muted">Discounts applied: {inv.discounts.map((d) => `${d.name} (−${formatMoney(d.amount)})`).join(', ')}</p>}
        <div className="totals">
          <div><span>Subtotal</span><span>{formatMoney(inv.subtotal)}</span></div>
          {inv.discountTotal > 0 && <div><span>Discounts</span><span>− {formatMoney(inv.discountTotal)}</span></div>}
          <div><span>Taxes</span><span>{formatMoney(inv.taxTotal)}</span></div>
          <div className="grand"><span>Total</span><span>{formatMoney(inv.total)}</span></div>
          <div><span>Paid</span><span>{formatMoney(inv.paid)}</span></div>
          <div className="grand"><span>Balance due</span><span>{formatMoney(inv.status === 'cancelled' ? 0 : outstanding(inv))}</span></div>
        </div>
      </Card>

      <Card title="Payments" className="no-print">
        {payments.length === 0 ? <p className="muted">No payments recorded.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Method</th><th className="num">Amount</th><th>Note</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}><td>{formatDate(p.date)}</td><td>{p.method}</td><td className="num">{formatMoney(p.amount)}</td><td>{p.note || '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {paying && <PaymentModal invoice={inv} onClose={() => setPaying(false)} />}
    </>
  );
}