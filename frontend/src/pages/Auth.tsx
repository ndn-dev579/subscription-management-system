import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ErrorBanner } from '../components/ui';
import { useAction } from '../lib/hooks';
import { isEmail, PASSWORD_RULES } from '../lib/validation';
import { useStore } from '../store/store';

function Shell({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-card card">
        <div className="brand"><span className="brand-dot" /> Brightloop</div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
        {children}
      </div>
    </div>
  );
}

const Rules = ({ password }: { password: string }) => (
  <ul className="rules">
    {PASSWORD_RULES.map((r) => <li key={r.label} className={r.test(password) ? 'ok' : ''}>{r.label}</li>)}
  </ul>
);

export function LoginPage() {
  const { login, me } = useStore();
  const { error, run } = useAction();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  if (me) return <Navigate to="/" replace />;
  const submit = (e: FormEvent) => { e.preventDefault(); run(() => login(email, password)); };
  const demo = (e: string, p: string) => { setEmail(e); setPassword(p); };
  return (
    <Shell title="Sign in" sub="Subscription management for Brightloop Software">
      <form className="form" onSubmit={submit}>
        <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></label>
        <label className="field"><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <ErrorBanner error={error} />
        <button className="btn btn-primary" type="submit">Sign in</button>
      </form>
      <p className="small"><Link to="/forgot-password">Forgot password?</Link> · <Link to="/signup">Create an account</Link></p>
      <div className="demo-note">
        <strong>Demo accounts</strong>
        <div className="chips">
          <button className="chip" onClick={() => demo('admin@brightloop.com', 'Admin@1234')}>Admin</button>
          <button className="chip" onClick={() => demo('staff@brightloop.com', 'Staff@1234')}>Staff</button>
          <button className="chip" onClick={() => demo('priya@acmetraders.in', 'Customer@123')}>Customer</button>
        </div>
      </div>
    </Shell>
  );
}

export function SignupPage() {
  const { signup, me } = useStore();
  const { error, run } = useAction();
  const [f, setF] = useState({ name: '', company: '', email: '', password: '', confirm: '' });
  if (me) return <Navigate to="/" replace />;
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => {
      if (f.password !== f.confirm) throw new Error('Passwords do not match.');
      signup({ name: f.name, company: f.company, email: f.email, password: f.password });
    });
  };
  return (
    <Shell title="Create your account" sub="Customers can see their own subscriptions and invoices.">
      <form className="form" onSubmit={submit}>
        <label className="field"><span>Your name</span><input value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
        <label className="field"><span>Company</span><input value={f.company} onChange={(e) => set('company', e.target.value)} /></label>
        <label className="field"><span>Email</span><input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></label>
        <label className="field"><span>Password</span><input type="password" value={f.password} onChange={(e) => set('password', e.target.value)} /></label>
        <Rules password={f.password} />
        <label className="field"><span>Confirm password</span><input type="password" value={f.confirm} onChange={(e) => set('confirm', e.target.value)} /></label>
        <ErrorBanner error={error} />
        <button className="btn btn-primary" type="submit">Create account</button>
      </form>
      <p className="small">Already registered? <Link to="/login">Sign in</Link></p>
    </Shell>
  );
}

export function ForgotPage() {
  const { requestReset } = useStore();
  const { error, run } = useAction();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => {
      if (!isEmail(email)) throw new Error('Enter a valid email address.');
      setLink(requestReset(email));
      setSent(true);
    });
  };
  return (
    <Shell title="Reset your password" sub="We'll send a reset link to your registered email.">
      {sent ? (
        <>
          <p>If an account exists for <strong>{email}</strong>, a reset link is on its way.</p>
          {link && (
            <p className="demo-note">Prototype only, no email is sent. Open the link here: <Link to={`/reset-password/${link}`}>Reset password</Link></p>
          )}
        </>
      ) : (
        <form className="form" onSubmit={submit}>
          <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></label>
          <ErrorBanner error={error} />
          <button className="btn btn-primary" type="submit">Send reset link</button>
        </form>
      )}
      <p className="small"><Link to="/login">Back to sign in</Link></p>
    </Shell>
  );
}

export function ResetPage() {
  const { token = '' } = useParams();
  const { resetPassword } = useStore();
  const { error, run } = useAction();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => {
      if (password !== confirm) throw new Error('Passwords do not match.');
      resetPassword(token, password);
      setDone(true);
    });
  };
  return (
    <Shell title="Choose a new password">
      {done ? (
        <p>Password updated. <Link to="/login">Sign in</Link></p>
      ) : (
        <form className="form" onSubmit={submit}>
          <label className="field"><span>New password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus /></label>
          <Rules password={password} />
          <label className="field"><span>Confirm password</span><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
          <ErrorBanner error={error} />
          <button className="btn btn-primary" type="submit">Update password</button>
        </form>
      )}
    </Shell>
  );
}