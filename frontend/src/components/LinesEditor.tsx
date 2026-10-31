import { variantPrice } from '../lib/billing';
import { formatMoney } from '../lib/format';
import { useStore } from '../store/store';
import type { SubLine } from '../types';

export default function LinesEditor({
  lines,
  onChange,
  minQty,
}: {
  lines: SubLine[];
  onChange: (l: SubLine[]) => void;
  minQty: number;
}) {
  const { db, by } = useStore();
  const patch = (i: number, p: Partial<SubLine>) =>
    onChange(lines.map((l, k) => (k === i ? { ...l, ...p } : l)));
  const pick = (i: number, productId: string, variantId = '') => {
    const prod = by.product.get(productId);
    patch(i, { productId, variantId, unitPrice: prod ? variantPrice(prod, variantId) : 0 });
  };
  return (
    <div className="lines">
      <div className="line line-head">
        <span>Product</span>
        <span>Variant</span>
        <span>Qty</span>
        <span>Unit price</span>
        <span />
      </div>
      {lines.map((l, i) => {
        const prod = by.product.get(l.productId);
        return (
          <div className="line" key={i}>
            <select value={l.productId} onChange={(e) => pick(i, e.target.value)}>
              <option value="">Select product…</option>
              {db.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {prod && prod.variants.length > 0 ? (
              <select value={l.variantId} onChange={(e) => pick(i, l.productId, e.target.value)}>
                <option value="">Standard</option>
                {prod.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.attribute}: {v.value} (+{formatMoney(v.extraPrice)})
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
              min="0"
              step="0.01"
              value={l.unitPrice}
              onChange={(e) => patch(i, { unitPrice: Number(e.target.value) })}
            />
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => onChange(lines.filter((_, k) => k !== i))}
            >
              ✕
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() =>
          onChange([...lines, { productId: '', variantId: '', qty: minQty, unitPrice: 0 }])
        }
      >
        + Add line
      </button>
    </div>
  );
}
