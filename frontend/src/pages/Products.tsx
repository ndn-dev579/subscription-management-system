import { useMutation, useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { type FormEvent, useState } from 'react';
import { ErrorBanner, Field, Modal, PageHead } from '../components/ui';
import { productsApi, taxesApi } from '../lib/api';
import { formatMoney } from '../lib/format';
import { queryClient } from '../lib/queryClient';

interface ProductVariant {
  id?: string;
  attribute: string;
  value: string;
  extra_price: string | number;
}

interface Product {
  id: string;
  name: string;
  product_type: 'Software' | 'Service';
  sales_price: string | number;
  cost_price: string | number;
  tax: string | null;
  notes: string;
  variants: ProductVariant[];
  is_active: boolean;
}

interface TaxRule {
  id: string;
  name: string;
  rate: number;
}

function ProductForm({
  initial,
  onClose,
  taxes,
}: {
  initial: Product | null;
  onClose: () => void;
  taxes: TaxRule[];
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [productType, setProductType] = useState<'Software' | 'Service'>(
    initial?.product_type ?? 'Software',
  );
  const [salesPrice, setSalesPrice] = useState<number>(initial ? Number(initial.sales_price) : 0);
  const [costPrice, setCostPrice] = useState<number>(initial ? Number(initial.cost_price) : 0);
  const [tax, setTax] = useState<string>(initial?.tax ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [variants, setVariants] = useState<ProductVariant[]>(initial?.variants ?? []);
  const [error, setError] = useState('');

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      let productId = initial?.id;
      if (productId) {
        await productsApi.update(productId, payload);
      } else {
        const res = await productsApi.create(payload);
        productId = res.data.id;
      }
      // If there are new variants to add
      for (const v of variants) {
        if (!v.id && productId) {
          await productsApi.addVariant(productId, {
            attribute: v.attribute,
            value: v.value,
            extra_price: v.extra_price,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
    onError: (err) => {
      const e = err as AxiosError<{ detail?: string }>;
      setError(e.response?.data?.detail ?? e.message);
    },
  });

  const addVariant = () => {
    setVariants([...variants, { attribute: 'Brand', value: '', extra_price: 0 }]);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, patch: Partial<ProductVariant>) => {
    setVariants(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = {
      name,
      product_type: productType,
      sales_price: salesPrice,
      cost_price: costPrice,
      tax: tax || null,
      notes,
    };
    saveMutation.mutate(payload);
  };

  return (
    <Modal title={initial ? 'Edit product' : 'New product'} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Product Name">
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          </Field>
          <Field label="Type">
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value as 'Software' | 'Service')}
            >
              <option value="Software">Software</option>
              <option value="Service">Service</option>
            </select>
          </Field>
          <Field label="Sales Price">
            <input
              type="number"
              min="0"
              step="0.01"
              value={salesPrice}
              onChange={(e) => setSalesPrice(Number(e.target.value))}
              required
            />
          </Field>
          <Field label="Cost Price">
            <input
              type="number"
              min="0"
              step="0.01"
              value={costPrice}
              onChange={(e) => setCostPrice(Number(e.target.value))}
            />
          </Field>
          <Field label="Tax Rule">
            <select value={tax} onChange={(e) => setTax(e.target.value)}>
              <option value="">No tax</option>
              {taxes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.rate}%)
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Notes">
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div
          style={{
            marginTop: '1rem',
            marginBottom: '0.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <strong>Product Variants (e.g. Brand, Tier)</strong>
          <button type="button" className="btn btn-ghost" onClick={addVariant}>
            + Add variant
          </button>
        </div>

        {variants.map((v, i) => (
          <div className="row4" key={i}>
            <input
              placeholder="Attribute (e.g. Brand)"
              value={v.attribute}
              onChange={(e) => updateVariant(i, { attribute: e.target.value })}
            />
            <input
              placeholder="Value (e.g. Odoo)"
              value={v.value}
              onChange={(e) => updateVariant(i, { value: e.target.value })}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Extra price"
              value={v.extra_price}
              onChange={(e) => updateVariant(i, { extra_price: Number(e.target.value) })}
            />
            <button type="button" className="btn btn-danger" onClick={() => removeVariant(i)}>
              ✕
            </button>
          </div>
        ))}

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

export default function Products() {
  const [editing, setEditing] = useState<Product | null | 'new'>(null);

  const {
    data: products,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['products'],
    queryFn: () =>
      productsApi.list().then((r) => {
        const d = r.data;
        return (d.results ?? d) as Product[];
      }),
  });

  const { data: taxes = [] } = useQuery({
    queryKey: ['taxes'],
    queryFn: () => taxesApi.list().then((r) => r.data as TaxRule[]),
  });

  const taxMap = new Map(taxes.map((t) => [t.id, t.name]));

  const apiError = error
    ? ((error as AxiosError<{ detail?: string }>).response?.data?.detail ??
      (error as Error).message)
    : '';

  return (
    <>
      <PageHead
        title="Products"
        sub="Catalog of software products, services, and optional variants"
      >
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          + New product
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
                <th>Name</th>
                <th>Type</th>
                <th className="num">Sales Price</th>
                <th className="num">Cost Price</th>
                <th>Tax</th>
                <th>Variants</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(products ?? []).map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    {p.notes && <div className="muted small">{p.notes}</div>}
                  </td>
                  <td>{p.product_type}</td>
                  <td className="num">{formatMoney(Number(p.sales_price))}</td>
                  <td className="num">{formatMoney(Number(p.cost_price))}</td>
                  <td>{p.tax ? (taxMap.get(p.tax) ?? '—') : '—'}</td>
                  <td className="small">
                    {p.variants?.length
                      ? p.variants
                          .map(
                            (v) =>
                              `${v.attribute}: ${v.value} (+${formatMoney(Number(v.extra_price))})`,
                          )
                          .join(' · ')
                      : '—'}
                  </td>
                  <td className="actions">
                    <button type="button" className="btn btn-ghost" onClick={() => setEditing(p)}>
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
        <ProductForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          taxes={taxes}
        />
      )}
    </>
  );
}
