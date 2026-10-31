import type { ReactNode } from 'react';

type Tone = 'gray' | 'green' | 'amber' | 'red' | 'blue';

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      <div className="head-actions">{children}</div>
    </header>
  );
}

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: Tone }) {
  return (
    <div className={`card stat ${tone ? `tone-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

const TONES: Record<string, Tone> = {
  draft: 'gray', quotation: 'blue', confirmed: 'amber', active: 'green', closed: 'gray',
  paid: 'green', cancelled: 'red', paused: 'amber', overdue: 'red',
};
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={TONES[status] ?? 'gray'}>{status}</Badge>;

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className={`modal card ${wide ? 'wide' : ''}`} onMouseDown={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

export const ErrorBanner = ({ error }: { error: string }) => (error ? <p className="error">{error}</p> : null);

export function Pager({ page, pages, total, setPage }: { page: number; pages: number; total: number; setPage: (n: number) => void }) {
  if (total === 0) return null;
  return (
    <div className="pager">
      <span className="muted">{total.toLocaleString()} result{total === 1 ? '' : 's'}</span>
      {pages > 1 && (
        <div>
          <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span>Page {page} of {pages}</span>
          <button className="btn btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}