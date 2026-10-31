import { useMutation, useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { type FormEvent, useState } from 'react';
import { ErrorBanner, Field, Modal, PageHead } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { customersApi, staffApi } from '../lib/api';
import { formatDate } from '../lib/format';
import { queryClient } from '../lib/queryClient';

interface CustomerProfile {
  id: string;
  customer_number: string;
  company_name: string;
  contact_name: string;
  billing_email: string;
  phone: string;
  user: {
    id: string;
    email: string;
    name: string;
    company: string;
    role: string;
    created_at: string;
  } | null;
  created_at: string;
}

interface StaffUser {
  id: string;
  email: string;
  name: string;
  company: string;
  role: string;
  created_at: string;
}

export default function People() {
  const { me } = useAuth();
  const [tab, setTab] = useState<'customer' | 'team'>('customer');
  const [addingStaff, setAddingStaff] = useState(false);
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [modalError, setModalError] = useState('');

  const {
    data: customers,
    isLoading: loadingCustomers,
    error: custErr,
  } = useQuery({
    queryKey: ['customers'],
    queryFn: () =>
      customersApi.list().then((r) => {
        const d = r.data;
        return (d.results ?? d) as CustomerProfile[];
      }),
  });

  const {
    data: staff,
    isLoading: loadingStaff,
    error: staffErr,
  } = useQuery({
    queryKey: ['staff'],
    queryFn: () =>
      staffApi.list().then((r) => {
        const d = r.data;
        return (d.results ?? d) as StaffUser[];
      }),
  });

  const createStaffMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => staffApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setAddingStaff(false);
      setF({ name: '', email: '', password: '', role: 'staff' });
    },
    onError: (err) => {
      const e = err as AxiosError<{ detail?: string }>;
      setModalError(e.response?.data?.detail ?? e.message);
    },
  });

  const submitStaff = (e: FormEvent) => {
    e.preventDefault();
    setModalError('');
    createStaffMutation.mutate({
      name: f.name,
      email: f.email,
      password: f.password,
      role: f.role,
      company: 'Brightloop Software',
    });
  };

  const currentError = tab === 'customer' ? custErr : staffErr;
  const apiError = currentError
    ? ((currentError as AxiosError<{ detail?: string }>).response?.data?.detail ??
      (currentError as Error).message)
    : '';

  return (
    <>
      <PageHead title="People" sub="Customers and internal staff team">
        {me?.role === 'admin' && (
          <button type="button" className="btn btn-primary" onClick={() => setAddingStaff(true)}>
            + Add staff member
          </button>
        )}
      </PageHead>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === 'customer' ? 'active' : ''}`}
          onClick={() => setTab('customer')}
        >
          Customers
        </button>
        <button
          type="button"
          className={`tab ${tab === 'team' ? 'active' : ''}`}
          onClick={() => setTab('team')}
        >
          Team & Staff
        </button>
      </div>

      {apiError && <ErrorBanner error={apiError} />}

      <div className="card table-wrap">
        {tab === 'customer' ? (
          loadingCustomers ? (
            <p className="muted" style={{ padding: '1rem' }}>
              Loading customers…
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Customer #</th>
                  <th>Contact Name</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {(customers ?? []).map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.customer_number}</strong>
                    </td>
                    <td>{c.contact_name || c.user?.name || '—'}</td>
                    <td>{c.company_name || c.user?.company || '—'}</td>
                    <td>{c.billing_email || c.user?.email || '—'}</td>
                    <td>{c.phone || '—'}</td>
                    <td>{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : loadingStaff ? (
          <p className="muted" style={{ padding: '1rem' }}>
            Loading team…
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Company</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {(staff ?? []).map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className="badge">{u.role}</span>
                  </td>
                  <td>{u.company || '—'}</td>
                  <td>{formatDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {addingStaff && (
        <Modal title="Add staff member" onClose={() => setAddingStaff(false)}>
          <form className="form" onSubmit={submitStaff}>
            <Field label="Full Name">
              <input
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
                autoFocus
                required
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value })}
                required
              />
            </Field>
            <Field label="Role">
              <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Field label="Temporary password" hint="Min 8 characters, uppercase, number and symbol">
              <input
                type="text"
                value={f.password}
                onChange={(e) => setF({ ...f, password: e.target.value })}
                required
              />
            </Field>

            {modalError && <ErrorBanner error={modalError} />}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setAddingStaff(false)}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createStaffMutation.isPending}
              >
                {createStaffMutation.isPending ? 'Adding…' : 'Add Staff'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
