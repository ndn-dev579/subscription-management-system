import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../lib/api';
import { formatMoney } from '../lib/format';

export interface ProductVariantItem {
  id: string;
  attribute: string;
  value: string;
  extra_price: string | number;
}

export interface ProductOption {
  id: string;
  name: string;
  sales_price: string | number;
  variants: ProductVariantItem[];
}

export interface LineDraft {
  product: string;
  variant?: string;
  qty: number;
  unit_price: string | number;
}

export default function LinesEditor({
  lines,
  onChange,
  minQty = 1,
}: {
  lines: LineDraft[];
  onChange: (l: LineDraft[]) => void;
  minQty?: number;
}) {
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () =>
      productsApi.list().then((r) => {
        const d = r.data;
        return (d.results ?? d) as ProductOption[];
      }),
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  const patch = (i: number, p: Partial<LineDraft>) =>
    onChange(lines.map((l, k) => (k === i ? { ...l, ...p } : l)));

  const pick = (i: number, productId: string, variantId = '') => {
    const prod = productMap.get(productId);
    const variant = prod?.variants?.find((v) => v.id === variantId);
    const extra = variant ? Number(variant.extra_price) : 0;
    const base = prod ? Number(prod.sales_price) : 0;
    patch(i, {
      product: productId,
      variant: variantId || undefined,
      unit_price: base + extra,
    });
  };

  const addLine = () => {
    if (products.length === 0) return;
    const first = products[0];
    onChange([
      ...lines,
      {
        product: first.id,
        variant: undefined,
        qty: minQty,
        unit_price: Number(first.sales_price),
      },
    ]);
  };

  const removeLine = (i: number) => {
    onChange(lines.filter((_, k) => k !== i));
  };

  return (
    <div className="lines">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}
      >
        <strong>Product Lines & Quantities</strong>
        <button type="button" className="btn btn-ghost" onClick={addLine}>
          + Add line
        </button>
      </div>

      <div className="line line-head">
        <span>Product</span>
        <span>Variant</span>
        <span>Qty</span>
        <span>Unit price</span>
        <span />
      </div>

      {lines.map((l, i) => {
        const prod = productMap.get(l.product);
        return (
          <div className="line" key={i}>
            <select value={l.product} onChange={(e) => pick(i, e.target.value)}>
              <option value="">Select product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {prod && prod.variants?.length > 0 ? (
              <select value={l.variant ?? ''} onChange={(e) => pick(i, l.product, e.target.value)}>
                <option value="">Standard</option>
                {prod.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.attribute}: {v.value} (+{formatMoney(Number(v.extra_price))})
                  </option>
                ))}
              </select>
            ) : (
              <span className="muted small">—</span>
            )}

            <input
              type="number"
              min={minQty}
              step="1"
              value={l.qty}
              onChange={(e) => patch(i, { qty: Number(e.target.value) })}
            />

            <input
              type="number"
              step="0.01"
              value={l.unit_price}
              onChange={(e) => patch(i, { unit_price: Number(e.target.value) })}
            />

            <button type="button" className="btn btn-danger" onClick={() => removeLine(i)}>
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
