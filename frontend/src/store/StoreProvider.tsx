import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { seedDb } from '../data/seed';
import { addUser } from '../lib/actions';
import { uid } from '../lib/format';
import { passwordIssues } from '../lib/validation';
import type { Db } from '../types';
import { type Lookups, type Store, StoreContext } from './store';

const KEY = 'brightloop.db.v1';

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch {
    /* fall back to seed data */
  }
  return seedDb();
}

const index = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x): [string, T] => [x.id, x]));

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db>(load);
  const ref = useRef(db);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      console.warn('Could not save data (browser storage full?)');
    }
  }, [db]);

  const update = useCallback((fn: (d: Db) => Db) => {
    const next = fn(ref.current); // throws before any state changes
    ref.current = next;
    setDb(next);
  }, []);

  const by = useMemo<Lookups>(
    () => ({
      user: index(db.users),
      plan: index(db.plans),
      product: index(db.products),
      tax: index(db.taxes),
      sub: index(db.subscriptions),
      invoice: index(db.invoices),
    }),
    [db.users, db.plans, db.products, db.taxes, db.subscriptions, db.invoices],
  );
  const me = useMemo(() => by.user.get(db.sessionUserId ?? '') ?? null, [by, db.sessionUserId]);

  const scope = useMemo(() => {
    if (me?.role === 'customer')
      return {
        subscriptions: db.subscriptions.filter((s) => s.customerId === me.id),
        invoices: db.invoices.filter(
          (i) => i.customerId === me.id && (i.status === 'confirmed' || i.status === 'paid'),
        ),
      };
    return { subscriptions: db.subscriptions, invoices: db.invoices };
  }, [db.subscriptions, db.invoices, me]);

  const value = useMemo<Store>(
    () => ({
      db,
      me,
      by,
      scope,
      update,
      login: (email, password) => {
        const u = ref.current.users.find(
          (x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password,
        );
        if (!u) throw new Error('Invalid email or password.');
        update((d) => ({ ...d, sessionUserId: u.id }));
      },
      signup: (input) =>
        update((d) => {
          const next = addUser(d, { ...input, role: 'customer' });
          return { ...next, sessionUserId: next.users[next.users.length - 1].id };
        }),
      logout: () => update((d) => ({ ...d, sessionUserId: null })),
      requestReset: (email) => {
        const u = ref.current.users.find(
          (x) => x.email.toLowerCase() === email.trim().toLowerCase(),
        );
        if (!u) return null; // the UI says the same thing either way
        const token = uid() + uid();
        update((d) => ({
          ...d,
          resetTokens: [
            ...d.resetTokens.filter((t) => t.userId !== u.id),
            { token, userId: u.id, expires: Date.now() + 3_600_000 },
          ],
        }));
        return token;
      },
      resetPassword: (token, password) => {
        const t = ref.current.resetTokens.find((x) => x.token === token && x.expires > Date.now());
        if (!t) throw new Error('This reset link is invalid or has expired.');
        const issues = passwordIssues(password);
        if (issues.length) throw new Error(`Password needs: ${issues.join(', ').toLowerCase()}.`);
        update((d) => ({
          ...d,
          users: d.users.map((u) => (u.id === t.userId ? { ...u, password } : u)),
          resetTokens: d.resetTokens.filter((x) => x.token !== token),
        }));
      },
      resetDemo: () => {
        const fresh = seedDb();
        ref.current = fresh;
        setDb(fresh);
      },
    }),
    [db, me, by, scope, update],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
