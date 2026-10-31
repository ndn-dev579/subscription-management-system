import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, ErrorBanner, PageHead, StatCard } from '../components/ui';
import { reportsApi } from '../lib/api';
import { addDays, formatDate, formatMoney } from '../lib/format';

interface DashboardData {
  active_subscriptions: number;
  mrr: string;
  arr: string;
  invoiced_period: string;
  collected_period: string;
  outstanding: string;
  overdue: string;
  overdue_count: number;
  overdue_invoices: Array<{
    id: string;
    number: string;
    customer_name: string;
    due_date: string;
    balance: string;
    days_late: number;
  }>;
  subscription_status_breakdown: Record<string, number>;
  monthly_collections: Array<{ month: string; amount: string; label: string }>;
  mrr_by_plan: Array<{ plan_name: string; mrr: string }>;
}

function rangeFor(preset: string, today: string): [string, string] {
  if (preset === 'month') return [`${today.slice(0, 7)}-01`, today];
  if (preset === '30') return [addDays(today, -30), today];
  if (preset === '90') return [addDays(today, -90), today];
  if (preset === 'year') return [`${today.slice(0, 4)}-01-01`, today];
  return ['0000-01-01', '9999-12-31'];
}

export default function Dashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const [preset, setPreset] = useState('90');
  const [from, setFrom] = useState(addDays(today, -90));
  const [to, setTo] = useState(today);

  const [f, t] = preset === 'custom' ? [from, to] : rangeFor(preset, today);

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard', f, t],
    queryFn: () =>
      reportsApi.dashboard({ date_from: f, date_to: t }).then((r) => r.data as DashboardData),
  });

  const months = data?.monthly_collections ?? [];
  const maxMonth = Math.max(1, ...months.map((m) => Number(m.amount)));

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
      </div>

      {error && <ErrorBanner error={(error as Error).message} />}

      {isLoading ? (
        <p className="muted">Loading dashboard…</p>
      ) : data ? (
        <>
          <section className="stats">
            <StatCard
              label="Active subscriptions"
              value={data.active_subscriptions.toLocaleString()}
              hint={Object.entries(data.subscription_status_breakdown)
                .filter(([k]) => k !== 'active')
                .map(([k, v]) => `${v} ${k}`)
                .join(' · ')}
            />
            <StatCard
              label="Monthly recurring revenue"
              value={formatMoney(Number(data.mrr))}
              hint={`ARR ≈ ${formatMoney(Number(data.arr))}`}
            />
            <StatCard
              label="Invoiced (selected range)"
              value={formatMoney(Number(data.invoiced_period))}
            />
            <StatCard
              label="Collected (selected range)"
              value={formatMoney(Number(data.collected_period))}
              tone="green"
            />
            <StatCard
              label="Outstanding now"
              value={formatMoney(Number(data.outstanding))}
              tone="amber"
            />
            <StatCard
              label="Overdue now"
              value={formatMoney(Number(data.overdue))}
              hint={`${data.overdue_count} invoice(s)`}
              tone="red"
            />
          </section>

          <section className="grid-2">
            <Card title="Payments received, last 6 months">
              <div className="chart">
                {months.map((m) => (
                  <div className="chart-col" key={m.month}>
                    <div className="chart-track">
                      <div
                        className="chart-bar"
                        style={{ height: `${(Number(m.amount) / maxMonth) * 100}%` }}
                        title={formatMoney(Number(m.amount))}
                      />
                    </div>
                    <span className="small muted">{m.label}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Monthly recurring revenue by plan">
              <ul className="list">
                {(data.mrr_by_plan ?? []).map((p) => (
                  <li key={p.plan_name}>
                    <span>{p.plan_name}</span>
                    <strong>{formatMoney(Number(p.mrr))}</strong>
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          <Card title="Overdue invoices">
            {data.overdue_count === 0 ? (
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
                    {(data.overdue_invoices ?? []).slice(0, 8).map((i) => (
                      <tr key={i.id}>
                        <td>
                          <Link to={`/invoices/${i.id}`}>{i.number}</Link>
                        </td>
                        <td>{i.customer_name}</td>
                        <td>{formatDate(i.due_date)}</td>
                        <td>{i.days_late}</td>
                        <td className="num">{formatMoney(Number(i.balance))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.overdue_count > 8 && (
                  <p className="small muted">
                    <Link to="/invoices">See all {data.overdue_count} in Invoices →</Link>
                  </p>
                )}
              </div>
            )}
          </Card>
        </>
      ) : null}
    </>
  );
}
