import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SubscriptionForm from '../components/SubscriptionForm';
import { PageHead, Pager, StatusBadge } from '../components/ui';
import { recurringAmount } from '../lib/billing';
import { formatDate, formatMoney, who } from '../lib/format';
import { usePaged } from '../lib/hooks';
import { useStore } from '../store/store';
import { SUB_FLOW } from '../types';

export default function Subscriptions() {
  const { scope, by, me } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [planId, setPlanId] = useState('');
  const [creating, setCreating] = useState(false);
  const isCustomer = me?.role === 'customer';

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return scope.subscriptions
      .filter((s) => {
        if (status && s.status !== status) return false;
        if (planId && s.planId !== planId) return false;
        if (!needle) return true;
        const u = by.user.get(s.customerId);
        return (
          s.number.toLowerCase().includes(needle) ||
          (u?.name ?? '').toLowerCase().includes(needle) ||
          (u?.company ?? '').toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => b.number.localeCompare(a.number));
  }, [scope.subscriptions, by, q, status, planId]);
  const pg = usePaged(rows);

  return (
    <>
      <PageHead
        title={isCustomer ? 'My subscriptions' : 'Subscriptions'}
        sub={`${scope.subscriptions.length.toLocaleString()} total`}
      >
        {!isCustomer && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + New subscription
          </button>
        )}
      </PageHead>
      <div className="toolbar">
        <input
          placeholder="Search number or customer…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {SUB_FLOW.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
          <option value="">All plans</option>
          {[...by.plan.values()].map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="card table-wrap">
        {rows.length === 0 ? (
          <p className="empty">No subscriptions match.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Number</th>
                {!isCustomer && <th>Customer</th>}
                <th>Plan</th>
                <th>Start</th>
                <th>Expiry</th>
                <th className="num">Recurring</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pg.rows.map((s) => {
                const plan = by.plan.get(s.planId);
                return (
                  <tr key={s.id}>
                    <td>
                      <Link to={`/subscriptions/${s.id}`}>
                        <strong>{s.number}</strong>
                      </Link>
                    </td>
                    {!isCustomer && <td>{who(by.user.get(s.customerId))}</td>}
                    <td>{plan?.name ?? '—'}</td>
                    <td>{formatDate(s.startDate)}</td>
                    <td>{formatDate(s.expiryDate)}</td>
                    <td className="num">
                      {formatMoney(recurringAmount(s, plan))}{' '}
                      <span className="muted small">/ {plan?.period}</span>
                    </td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <Pager {...pg} />
      {creating && <SubscriptionForm onClose={() => setCreating(false)} />}
    </>
  );
}
