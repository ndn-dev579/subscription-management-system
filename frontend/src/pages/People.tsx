import { useState, type FormEvent } from 'react';
import { ErrorBanner, Field, Modal, PageHead } from '../components/ui';
import { addUser } from '../lib/actions';
import { formatDate } from '../lib/format';
import { useAction, usePaged } from '../lib/hooks';
import { PASSWORD_RULES } from '../lib/validation';
import { useStore } from '../store/store';
import { Pager } from '../components/ui';

export default function People() {
  const { db, me, update } = useStore();
  const { error, run } = useAction();
  const [tab, setTab] = useState<'customer' | 'team'>('customer');
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const list = db.users.filter((u) => (tab === 'customer' ? u.role === 'customer' : u.role !== 'customer'));
  const pg = usePaged(list);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => { update((d) => addUser(d, { ...f, role: 'staff', company: 'Brightloop Software' })); setAdding(false); setF({ name: '', email: '', password: '' }); });
  };

  return (
    <>
      <PageHead title="People" sub="Customers and internal team">
        {me?.role === 'admin' && <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add staff member</button>}
      </PageHead>
      <div className="tabs">
        <button className={`tab ${tab === 'customer' ? 'active' : ''}`} onClick={() => setTab('customer')}>Customers</button>
        <button className={`tab ${tab === 'team' ? 'active' : ''}`} onClick={() => setTab('team')}>Team</button>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
          <tbody>
            {pg.rows.map((u) => (
              <tr key={u.id}><td><strong>{u.name}</strong></td><td>{u.company || '—'}</td><td>{u.email}</td><td>{u.role}</td><td>{formatDate(u.createdAt)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager {...pg} />
      {adding && (
        <Modal title="Add staff member" onClose={() => setAdding(false)}>
          <form className="form" onSubmit={submit}>
            <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
            <Field label="Email"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Temporary password" hint={PASSWORD_RULES.map((r) => r.label.toLowerCase()).join(' · ')}>
              <input type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            </Field>
            <ErrorBanner error={error} />
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}