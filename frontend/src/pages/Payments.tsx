import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PaymentModal from '../components/PaymentModal';
import { Badge, PageHead, Pager } from '../components/ui';
import { isOverdue, outstanding } from '../lib/billing';
import { formatDate, formatMoney, todayISO, who } from '../lib/format';
import { usePaged } from '../lib/hooks';
import { useStore } from '../store/store';
import { type Invoice, METHODS } from '../types';

type Tab = 'outstanding' | 'paid' | 'history';

export default function Payments() {
  const { db, by } = useStore();
  const [tab, setTab] = useState<Tab>('outstanding');
  const [q, setQ] = useState('');
  const [method, setMethod] = useState('');
  const [paying, setPaying] = useState<Invoice | null>(null);
  const today = todayISO();
  const needle = q.trim().toLowerCase();
  const invoices = useMemo(() => {
    if (tab === 'history') return [];
    return db.invoices
      .filter((i) => {
        const statusMatch =
          tab === 'paid' ? i.status === 'paid' : i.status === 'confirmed' && outstanding(i) > 0;
        if (!statusMatch) return false;
        if (!needle) return true;
        const u = by.user.get(i.customerId);
        return (
          i.number.toLowerCase().includes(needle) ||
          (u?.company ?? '').toLowerCase().includes(needle) ||
          (u?.name ?? '').toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [db.invoices, tab, needle, by]);

  const history = useMemo(() => {
    if (tab !== 'history') return [];
    return db.payments
      .filter((p) => {
        if (method && p.method !== method) return false;
        if (!needle) return true;
        const inv = by.invoice.get(p.invoiceId);
        const u = inv ? by.user.get(inv.customerId) : null;
        return (
          (inv?.number ?? '').toLowerCase().includes(needle) ||
          (u?.company ?? '').toLowerCase().includes(needle) ||
          (u?.name ?? '').toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [db.payments, tab, method, needle, by]);
  const pgInv = usePaged(invoices);
  const pgHis = usePaged(history);

  return (
    <>
      <PageHead title="Payments" sub="Which invoices are paid, which are still outstanding" />
      <div className="tabs">
        {(['outstanding', 'paid', 'history'] as Tab[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'outstanding'
              ? 'Outstanding invoices'
              : t === 'paid'
                ? 'Paid invoices'
                : 'Payment history'}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <input
          placeholder="Search invoice or customer…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {tab === 'history' ? (
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">All methods</option>
            {METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        ) : (
          <span />
        )}
        <span />
      </div>

      <div className="card table-wrap">
        {tab !== 'history' ? (
          pgInv.rows.length === 0 ? (
            <p className="empty">Nothing here.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Due</th>
                  <th className="num">Total</th>
                  <th className="num">Balance</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pgInv.rows.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link to={`/invoices/${i.id}`}>{i.number}</Link>
                    </td>
                    <td>{who(by.user.get(i.customerId))}</td>
                    <td>
                      {formatDate(i.dueDate)}{' '}
                      {isOverdue(i, today) && <Badge tone="red">overdue</Badge>}
                    </td>
                    <td className="num">{formatMoney(i.total)}</td>
                    <td className="num">{formatMoney(outstanding(i))}</td>
                    <td className="actions">
                      {tab === 'outstanding' && (
                        <button className="btn btn-primary" onClick={() => setPaying(i)}>
                          Record payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : pgHis.rows.length === 0 ? (
          <p className="empty">No payments yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Method</th>
                <th className="num">Amount</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {pgHis.rows.map((p) => {
                const inv = by.invoice.get(p.invoiceId);
                return (
                  <tr key={p.id}>
                    <td>{formatDate(p.date)}</td>
                    <td>{inv && <Link to={`/invoices/${inv.id}`}>{inv.number}</Link>}</td>
                    <td>{who(by.user.get(inv?.customerId ?? ''))}</td>
                    <td>{p.method}</td>
                    <td className="num">{formatMoney(p.amount)}</td>
                    <td>{p.note || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <Pager {...(tab === 'history' ? pgHis : pgInv)} />
      {paying && <PaymentModal invoice={paying} onClose={() => setPaying(null)} />}
    </>
  );
}
