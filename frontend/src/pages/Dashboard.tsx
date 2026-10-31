import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, PageHead, StatCard } from '../components/ui';
import { addDemoSubscriptions } from '../data/seed';
import { isOverdue, monthlyRecurring, outstanding } from '../lib/billing';
import {
  addDays,
  addPeriod,
  diffDays,
  formatDate,
  formatMoney,
  monthKey,
  todayISO,
  who,
} from '../lib/format';
import { useStore } from '../store/store';
import type { Invoice } from '../types';

function rangeFor(preset: string, today: string): [string, string] {
  if (preset === 'month') return [`${today.slice(0, 7)}-01`, today];
  if (preset === '30') return [addDays(today, -30), today];
  if (preset === '90') return [addDays(today, -90), today];
  if (preset === 'year') return [`${today.slice(0, 4)}-01-01`, today];
  return ['0000-01-01', '9999-12-31'];
}

export default function Dashboard() {
  const { db, by, me, update, resetDemo } = useStore();
  const today = todayISO();
  const [preset, setPreset] = useState('90');
  const [from, setFrom] = useState(addDays(today, -90));
  const [to, setTo] = useState(today);
  const [planId, setPlanId] = useState('');
  const [busy, setBusy] = useState(false);

  const d = useMemo(() => {
    const [f, t] = preset === 'custom' ? [from, to] : rangeFor(preset, today);
    const inPlan = (subId: string) => !planId || by.sub.get(subId)?.planId === planId;

    let active = 0,
      mrr = 0;
    const status: Record<string, number> = {};
    const mrrByPlan = new Map<string, number>();
    for (const s of db.subscriptions) {
      if (planId && s.planId !== planId) continue;
      status[s.status] = (status[s.status] ?? 0) + 1;
      if (s.status === 'active') {
        const m = monthlyRecurring(s, by.plan.get(s.planId));
        active++;
        mrr += m;
        mrrByPlan.set(s.planId, (mrrByPlan.get(s.planId) ?? 0) + m);
      }
    }

    let invoiced = 0,
      owed = 0,
      overdueAmt = 0;
    const overdue: Invoice[] = [];
    for (const i of db.invoices) {
      if (!inPlan(i.subscriptionId)) continue;
      if ((i.status === 'confirmed' || i.status === 'paid') && i.issueDate >= f && i.issueDate <= t)
        invoiced += i.total;
      if (i.status === 'confirmed') {
        owed += outstanding(i);
        if (isOverdue(i, today)) {
          overdueAmt += outstanding(i);
          overdue.push(i);
        }
      }
    }
    overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    let collected = 0;
    const perMonth = new Map<string, number>();
    for (const p of db.payments) {
      const inv = by.invoice.get(p.invoiceId);
      if (!inv || !inPlan(inv.subscriptionId)) continue;
      if (p.date >= f && p.date <= t) collected += p.amount;
      perMonth.set(monthKey(p.date), (perMonth.get(monthKey(p.date)) ?? 0) + p.amount);
    }
    const months = Array.from({ length: 6 }, (_, k) => {
      const key = monthKey(addPeriod(`${today.slice(0, 7)}-01`, 'monthly', k - 5));
      return {
        key,
        value: perMonth.get(key) ?? 0,
        label: new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-IN', {
          month: 'short',
          timeZone: 'UTC',
        }),
      };
    });
    return {
      active,
      mrr,
      status,
      mrrByPlan,
      invoiced,
      owed,
      overdueAmt,
      overdue,
      collected,
      months,
      maxMonth: Math.max(1, ...months.map((m) => m.value)),
    };
  }, [db, by, preset, from, to, planId, today]);

  return (
    <>
      <PageHead
        title="Finance overview"
        sub="Active subscriptions, revenue, payments and overdue invoices in one place"
      />
      <div className="toolbar">
        <select value={preset} onChange={(e) => setPreset(e.target.value)}>
          <option value="month">This month</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="year">This year</option>
          <option value="all">All time</option>
          <option value="custom">Custom range</option>
        </select>
        {preset === 'custom' ? (
          <>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        ) : (
          <span />
        )}
        <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
          <option value="">All plans</option>
          {db.plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <section className="stats">
        <StatCard
          label="Active subscriptions"
          value={d.active.toLocaleString()}
          hint={`${d.status.draft ?? 0} draft · ${d.status.quotation ?? 0} quotation · ${d.status.confirmed ?? 0} confirmed`}
        />
        <StatCard
          label="Monthly recurring revenue"
          value={formatMoney(d.mrr)}
          hint={`ARR ≈ ${formatMoney(d.mrr * 12)}`}
        />
        <StatCard label="Invoiced (selected range)" value={formatMoney(d.invoiced)} />
        <StatCard
          label="Collected (selected range)"
          value={formatMoney(d.collected)}
          tone="green"
        />
        <StatCard label="Outstanding now" value={formatMoney(d.owed)} tone="amber" />
        <StatCard
          label="Overdue now"
          value={formatMoney(d.overdueAmt)}
          hint={`${d.overdue.length} invoice(s)`}
          tone="red"
        />
      </section>

      <section className="grid-2">
        <Card title="Payments received, last 6 months">
          <div className="chart">
            {d.months.map((m) => (
              <div className="chart-col" key={m.key}>
                <div className="chart-track">
                  <div
                    className="chart-bar"
                    style={{ height: `${(m.value / d.maxMonth) * 100}%` }}
                    title={formatMoney(m.value)}
                  />
                </div>
                <span className="small muted">{m.label}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Monthly recurring revenue by plan">
          <ul className="list">
            {db.plans.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <strong>{formatMoney(d.mrrByPlan.get(p.id) ?? 0)}</strong>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <Card title="Overdue invoices">
        {d.overdue.length === 0 ? (
          <p className="muted">Nothing overdue. 🎉</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Due</th>
                  <th>Days late</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {d.overdue.slice(0, 8).map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link to={`/invoices/${i.id}`}>{i.number}</Link>
                    </td>
                    <td>{who(by.user.get(i.customerId))}</td>
                    <td>{formatDate(i.dueDate)}</td>
                    <td>{diffDays(today, i.dueDate)}</td>
                    <td className="num">{formatMoney(outstanding(i))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {d.overdue.length > 8 && (
              <p className="small muted">
                <Link to="/invoices">See all {d.overdue.length} in Invoices →</Link>
              </p>
            )}
          </div>
        )}
      </Card>

      {me?.role === 'admin' && (
        <Card title="Prototype tools" className="tools">
          <p className="muted small">
            Test the "thousands of subscriptions, every page under 2 seconds" requirement, or start
            over.
          </p>
          <div className="head-actions">
            <button
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setTimeout(() => {
                  update((x) => addDemoSubscriptions(x, 800));
                  setBusy(false);
                }, 30);
              }}
            >
              {busy ? 'Generating…' : 'Add 800 demo subscriptions'}
            </button>
            <button
              className="btn btn-danger"
              onClick={() => window.confirm('Reset all data to the demo set?') && resetDemo()}
            >
              Reset demo data
            </button>
          </div>
        </Card>
      )}
    </>
  );
}
