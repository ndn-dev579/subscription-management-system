import { createContext, useContext } from 'react';
import type { Db, Invoice, Plan, Product, Subscription, Tax, User } from '../types';

export interface Lookups {
  user: Map<string, User>; plan: Map<string, Plan>; product: Map<string, Product>;
  tax: Map<string, Tax>; sub: Map<string, Subscription>; invoice: Map<string, Invoice>;
}

export interface Store {
  db: Db;
  me: User | null;
  by: Lookups; // O(1) lookups so big tables stay fast
  scope: { subscriptions: Subscription[]; invoices: Invoice[] }; // what the signed-in person may see
  update: (fn: (db: Db) => Db) => void; // throws if an action rejects, caller shows the message
  login: (email: string, password: string) => void;
  signup: (input: { name: string; company: string; email: string; password: string }) => void;
  logout: () => void;
  requestReset: (email: string) => string | null;
  resetPassword: (token: string, password: string) => void;
  resetDemo: () => void;
}

export const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside <StoreProvider>');
  return s;
}