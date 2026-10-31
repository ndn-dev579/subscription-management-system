import { useMutation, useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { type FormEvent, useState } from 'react';
import { ErrorBanner, Field, Modal, PageHead } from '../components/ui';
import { plansApi, productsApi, quotationsApi } from '../lib/api';
import { queryClient } from '../lib/queryClient';

interface TemplateLine {
  id?: string;
  product: string;
  variant?: string | null;
  qty: number;
  unit_price: string;
}

interface QuotationTemplate {
  id: string;
  name: string;
  plan: string | null;
  validity_days: number;
  lines: TemplateLine[];
  created_at: string;
}

interface PlanItem {
  id: string;
  name: string;
  price: string;
}

interface ProductItem {
  id: string;
  name: string;
  sales_price: string;
}

function TemplateForm({
  initial,
  onClose,
  plans,
  products,
}: {
  initial: QuotationTemplate | null;
  onClose: () => void;
  plans: PlanItem[];
  products: ProductItem[];
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [plan, setPlan] = useState<string>(initial?.plan ?? '');
  const [validityDays, setValidityDays] = useState(initial?.validity_days ?? 30);
  const [lines, setLines] = useState<TemplateLine[]>(
    initial?.lines ??
      (products.length > 0
        ? [{ product: products[0].id, qty: 1, unit_price: products[0].sales_price }]
        : []),
  );
  const [error, setError] = useState('');

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
      if (initial?.id) {
        return quotationsApi.updateTemplate(initial.id, payload);
      }
      return quotationsApi.createTemplate(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      onClose();
    },
    onError: (err) => {
      const e = err as AxiosError<{ detail?: string }>;
      setError(e.response?.data?.detail ?? e.message);
    },
  });

  const addLine = () => {
    if (products.length === 0) return;
    setLines([...lines, { product: products[0].id, qty: 1, unit_price: products[0].sales_price }]);
  };

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, patch: Partial<TemplateLine>) => {
    setLines(
      lines.map((l, i) => {
        if (i !== idx) return l;
        const updated = { ...l, ...patch };
        if (patch.product) {
          const prod = products.find((p) => p.id === patch.product);
          if (prod) updated.unit_price = prod.sales_price;
        }
        return updated;
      }),
    );
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = {
      name,
      plan: plan || null,
      validity_days: Number(validityDays),
      lines: lines.map((l) => ({
        product: l.product,
        variant: l.variant || null,
        qty: Number(l.qty),
        unit_price: l.unit_price || '0',
      })),
    };
    saveMutation.mutate(payload);
  };

  return (
    <Modal
      title={initial ? 'Edit quotation template' : 'New quotation template'}
      onClose={onClose}
      wide
    >
      <form className="form" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Template name">
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          </Field>
          <Field label="Plan">
            <select value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="">No default plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quotation valid for (days)">
            <input
              type="number"
              min="1"
              value={validityDays}
              onChange={(e) => setValidityDays(Number(e.target.value))}
              required
            />
          </Field>
        </div>

        <div
          style={{
            marginTop: '1rem',
            marginBottom: '0.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <strong>Default Product Lines</strong>
          <button type="button" className="btn btn-ghost" onClick={addLine}>
            + Add line
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th style={{ width: '100px' }}>Qty</th>
                <th style={{ width: '120px' }}>Unit Price</th>
                <th style={{ width: '50px' }} />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx}>
                  <td>
                    <select
                      value={line.product}
                      onChange={(e) => updateLine(idx, { product: e.target.value })}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={line.qty}
                      onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={line.unit_price}
                      onChange={(e) => updateLine(idx, { unit_price: e.target.value })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => removeLine(idx)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <ErrorBanner error={error} />}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Templates() {
  const [editing, setEditing] = useState<QuotationTemplate | null | 'new'>(null);

  const {
    data: templates,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['templates'],
    queryFn: () =>
      quotationsApi.listTemplates().then((r) => {
        const d = r.data;
        return (d.results ?? d) as QuotationTemplate[];
      }),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: () =>
      plansApi.list().then((r) => {
        const d = r.data;
        return (d.results ?? d) as PlanItem[];
      }),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () =>
      productsApi.list().then((r) => {
        const d = r.data;
        return (d.results ?? d) as ProductItem[];
      }),
  });

  const planMap = new Map(plans.map((p) => [p.id, p.name]));

  const apiError = error
    ? ((error as AxiosError<{ detail?: string }>).response?.data?.detail ??
      (error as Error).message)
    : '';

  return (
    <>
      <PageHead
        title="Quotation templates"
        sub="Pre-built offers sales representatives can use to generate quotes instantly"
      >
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          + New template
        </button>
      </PageHead>

      {apiError && <ErrorBanner error={apiError} />}

      <div className="card table-wrap">
        {isLoading ? (
          <p className="muted" style={{ padding: '1rem' }}>
            Loading…
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Template Name</th>
                <th>Linked Plan</th>
                <th>Validity</th>
                <th>Line Items</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(templates ?? []).map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.name}</strong>
                  </td>
                  <td>{t.plan ? (planMap.get(t.plan) ?? 'Custom Plan') : '—'}</td>
                  <td>{t.validity_days} days</td>
                  <td className="small">{t.lines?.length ?? 0} item(s)</td>
                  <td className="actions">
                    <button type="button" className="btn btn-ghost" onClick={() => setEditing(t)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing !== null && (
        <TemplateForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          plans={plans}
          products={products}
        />
      )}
    </>
  );
}
