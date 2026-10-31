import { NavLink, Outlet } from 'react-router-dom';
import { useStore } from '../store/store';
import type { Role } from '../types';

interface Item {
  to: string;
  label: string;
  customerLabel?: string;
  roles: Role[];
  group: string;
  end?: boolean;
}
const ALL: Role[] = ['admin', 'staff', 'customer'];
const TEAM: Role[] = ['admin', 'staff'];

const NAV: Item[] = [
  { to: '/', label: 'Dashboard', roles: TEAM, group: 'Overview', end: true },
  {
    to: '/subscriptions',
    label: 'Subscriptions',
    customerLabel: 'My subscriptions',
    roles: ALL,
    group: 'Billing',
  },
  {
    to: '/invoices',
    label: 'Invoices',
    customerLabel: 'My invoices',
    roles: ALL,
    group: 'Billing',
  },
  { to: '/payments', label: 'Payments', roles: TEAM, group: 'Billing' },
  { to: '/people', label: 'People', roles: TEAM, group: 'Billing' },
  { to: '/products', label: 'Products', roles: ['admin'], group: 'Catalogue' },
  { to: '/plans', label: 'Plans', roles: ['admin'], group: 'Catalogue' },
  { to: '/templates', label: 'Quotation templates', roles: ['admin'], group: 'Catalogue' },
  { to: '/discounts', label: 'Discounts', roles: ['admin'], group: 'Catalogue' },
  { to: '/taxes', label: 'Taxes', roles: ['admin'], group: 'Catalogue' },
];

export default function Layout() {
  const { me, logout } = useStore();
  if (!me) return null;
  const items = NAV.filter((n) => n.roles.includes(me.role));
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-dot" /> Brightloop
        </div>
        <nav>
          {items.map((n, i) => (
            <div key={n.to}>
              {me.role !== 'customer' && (i === 0 || items[i - 1].group !== n.group) && (
                <div className="nav-group">{n.group}</div>
              )}
              <NavLink to={n.to} end={n.end} className="nav-link">
                {me.role === 'customer' && n.customerLabel ? n.customerLabel : n.label}
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="user-chip">
          <strong>{me.name}</strong>
          <span className="muted small">
            {me.role}
            {me.company ? ` · ${me.company}` : ''}
          </span>
          <button className="btn btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
