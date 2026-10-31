import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import type { AuthUser } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import { ForgotPage, LoginPage, ResetPage, SignupPage } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Discounts from './pages/Discounts';
import InvoiceDetail from './pages/InvoiceDetail';
import Invoices from './pages/Invoices';
import Payments from './pages/Payments';
import People from './pages/People';
import Plans from './pages/Plans';
import Products from './pages/Products';
import Quotations from './pages/Quotations';
import SubscriptionDetail from './pages/SubscriptionDetail';
import Subscriptions from './pages/Subscriptions';
import Taxes from './pages/Taxes';
import Templates from './pages/Templates';

type Role = AuthUser['role'];

function Guard({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { me, isLoading } = useAuth();
  if (isLoading) return <div className="loading-screen">Loading…</div>;
  if (!me) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(me.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Home() {
  const { me } = useAuth();
  return me?.role === 'customer' ? <Navigate to="/subscriptions" replace /> : <Dashboard />;
}

const ADMIN: Role[] = ['admin'];
const TEAM: Role[] = ['admin', 'staff'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPage />} />
      <Route path="/reset-password/:token" element={<ResetPage />} />
      <Route
        element={
          <Guard>
            <Layout />
          </Guard>
        }
      >
        <Route index element={<Home />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="subscriptions/:id" element={<SubscriptionDetail />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route
          path="payments"
          element={
            <Guard roles={TEAM}>
              <Payments />
            </Guard>
          }
        />
        <Route
          path="people"
          element={
            <Guard roles={TEAM}>
              <People />
            </Guard>
          }
        />
        <Route
          path="quotations"
          element={
            <Guard roles={TEAM}>
              <Quotations />
            </Guard>
          }
        />
        <Route
          path="products"
          element={
            <Guard roles={ADMIN}>
              <Products />
            </Guard>
          }
        />
        <Route
          path="plans"
          element={
            <Guard roles={ADMIN}>
              <Plans />
            </Guard>
          }
        />
        <Route
          path="templates"
          element={
            <Guard roles={ADMIN}>
              <Templates />
            </Guard>
          }
        />
        <Route
          path="discounts"
          element={
            <Guard roles={ADMIN}>
              <Discounts />
            </Guard>
          }
        />
        <Route
          path="taxes"
          element={
            <Guard roles={ADMIN}>
              <Taxes />
            </Guard>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
