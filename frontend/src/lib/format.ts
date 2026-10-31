import type { Period, User } from '../types';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }); // change currency here
export const formatMoney = (n: number) => money.format(n);

const pad = (n: number) => String(n).padStart(2, '0');
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toISO = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(iso: string, n: number) {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

export function addPeriod(iso: string, period: Period, n = 1) {
  const d = parse(iso);
  if (period === 'daily') d.setUTCDate(d.getUTCDate() + n);
  else if (period === 'weekly') d.setUTCDate(d.getUTCDate() + 7 * n);
  else {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + (period === 'monthly' ? n : 12 * n));
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last)); // Jan 31 + 1 month = Feb 28
  }
  return toISO(d);
}

export const diffDays = (a: string, b: string) =>
  Math.round((parse(a).getTime() - parse(b).getTime()) / 86_400_000);
export const monthKey = (iso: string) => iso.slice(0, 7);
export const minISO = (a: string, b: string) => (a < b ? a : b);

export const formatDate = (iso: string) =>
  iso
    ? parse(iso).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '—';

const TERM_COUNT: Record<Period, number> = { daily: 90, weekly: 26, monthly: 12, yearly: 2 };
export const defaultExpiry = (start: string, period: Period) =>
  addPeriod(start, period, TERM_COUNT[period]);

export const who = (u?: User) => (u ? (u.company ? `${u.company} · ${u.name}` : u.name) : '—');
