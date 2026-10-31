import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, ErrorBanner, PageHead, Pager, StatusBadge } from '../components/ui';
import { isOverdue, outstanding, runBilling } from '../lib/billing';
import { formatDate, formatMoney, todayISO, who } from '../lib/format';
import { useAction, usePaged } from '../lib/hooks';
import { useStore } from '../store/store';

export default function Invoices() {
  const { scope, by, me, update } = useStore();
  const { error, run } = useAction();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [msg, setMsg] = useState('');
  const isTeam = me?.role !== 'customer';
  const today = todayISO();

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return scope.invoices
      .filter((i) => {
        if (status === 'overdue' ? !isOverdue(i, today) : status && i.status !== status)
          return false;
        if (!needle) return true;
        const u = by.user.get(i.customerId);
        return (
          i.number.toLowerCase().includes(needle) ||
          (u?.company ?? '').toLowerCase().includes(needle) ||
          (u?.name ?? '').toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => b.number.localeCompare(a.number));
  }, [scope.invoices, by, q, status, today]);
  const pg = usePaged(rows);

  const billingDay = () =>
    run(() => {
      let created = 0;
      update((d) => {
        const r = runBilling(d);
        created = r.created;
        return r.db;
      });
      setMsg(
        created
          ? `Billing run complete: ${created} draft invoice(s) created.`
          : 'Nothing is due: every active subscription is already invoiced.',
      );
    });

  return (
    <>
      <PageHead
        title={isTeam ? 'Invoices' : 'My invoices'}
        sub={`${scope.invoices.length.toLocaleString()} total`}
      >
        {isTeam && (
          <button className="btn btn-primary" onClick={billingDay}>
            Run billing
          </button>
        )}
      </PageHead>
      {msg && <p className="success">{msg}</p>}
      <ErrorBanner error={error} />
      <div className="toolbar">
        <input
          placeholder="Search invoice or customer…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {(isTeam ? ['draft', 'confirmed', 'paid', 'cancelled'] : ['confirmed', 'paid']).map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
          <option value="overdue">overdue</option>
        </select>
        <span />
      </div>
      <div className="card table-wrap">
        {rows.length === 0 ? (
          <p className="empty">No invoices match.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                {isTeam && <th>Customer</th>}
                <th>Subscription</th>
                <th>Issued</th>
                <th>Due</th>
                <th className="num">Total</th>
                <th className="num">Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pg.rows.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link to={`/invoices/${i.id}`}>
                      <strong>{i.number}</strong>
                    </Link>
                  </td>
                  {isTeam && <td>{who(by.user.get(i.customerId))}</td>}
                  <td>{by.sub.get(i.subscriptionId)?.number}</td>
                  <td>{formatDate(i.issueDate)}</td>
                  <td>{formatDate(i.dueDate)}</td>
                  <td className="num">{formatMoney(i.total)}</td>
                  <td className="num">
                    {i.status === 'confirmed' ? formatMoney(outstanding(i)) : '—'}
                  </td>
                  <td>
                    <StatusBadge status={i.status} />
                    {isOverdue(i, today) && (
                      <>
                        {' '}
                        <Badge tone="red">overdue</Badge>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pager {...pg} />
    </>
  );
}
