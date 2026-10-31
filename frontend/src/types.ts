export type Role = 'admin' | 'staff' | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // plain text: prototype only, the backend must hash
  role: Role;
  company: string;
  createdAt: string;
}

export const PERIODS = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export type Period = (typeof PERIODS)[number];

export const PRODUCT_TYPES = ['Software', 'Add-on', 'Service', 'Hardware'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export interface Tax { id: string; name: string; rate: number }
export interface Variant { id: string; attribute: string; value: string; extraPrice: number }
export interface Product {
  id: string; name: string; type: ProductType;
  salesPrice: number; costPrice: number; notes: string;
  taxId: string; variants: Variant[];
}

export type PlanStatus = 'active' | 'paused' | 'closed';
export interface Plan {
  id: string; name: string; price: number; period: Period; minQty: number;
  startDate: string; endDate: string; taxId: string;
  autoClose: boolean; closable: boolean; pausable: boolean; renewable: boolean;
  status: PlanStatus;
}

export interface SubLine { productId: string; variantId: string; qty: number; unitPrice: number }
export interface Template { id: string; name: string; planId: string; validityDays: number; lines: SubLine[] }

export const TERMS = {
  immediate: { label: 'Immediate', days: 0 },
  net15: { label: '15 days', days: 15 },
  net30: { label: '30 days', days: 30 },
  net45: { label: '45 days', days: 45 },
} as const;
export type TermsKey = keyof typeof TERMS;

export const SUB_FLOW = ['draft', 'quotation', 'confirmed', 'active', 'closed'] as const;
export type SubStatus = (typeof SUB_FLOW)[number];

export interface Subscription {
  id: string; number: string; customerId: string; planId: string;
  startDate: string; expiryDate: string; terms: TermsKey; status: SubStatus;
  lines: SubLine[]; quoteValidUntil: string; createdAt: string;
}

export interface Discount {
  id: string; name: string; type: 'fixed' | 'percent'; value: number;
  minPurchase: number; minQty: number; startDate: string; endDate: string;
  usageLimit: number; // 0 = unlimited
  used: number;
  scope: 'products' | 'subscription';
  productIds: string[];
  subscriptionIds: string[]; // empty = any subscription
}

export type InvoiceStatus = 'draft' | 'confirmed' | 'paid' | 'cancelled';
export interface InvoiceLine {
  description: string; productId: string; qty: number; unitPrice: number;
  discount: number; taxName: string; taxRate: number; net: number; tax: number;
}
export interface Invoice {
  id: string; number: string; subscriptionId: string; customerId: string;
  periodStart: string; periodEnd: string; issueDate: string; dueDate: string;
  status: InvoiceStatus; lines: InvoiceLine[];
  discounts: { discountId: string; name: string; amount: number }[];
  subtotal: number; discountTotal: number; taxTotal: number; total: number;
  paid: number; sent: boolean;
}

export const METHODS = ['Bank transfer', 'UPI', 'Card', 'Cash', 'Cheque'] as const;
export type PaymentMethod = (typeof METHODS)[number];
export interface Payment {
  id: string; invoiceId: string; method: PaymentMethod; amount: number; date: string; note: string;
}

export interface Db {
  users: User[]; taxes: Tax[]; products: Product[]; plans: Plan[]; templates: Template[];
  discounts: Discount[]; subscriptions: Subscription[]; invoices: Invoice[]; payments: Payment[];
  resetTokens: { token: string; userId: string; expires: number }[];
  counters: { subscription: number; invoice: number };
  sessionUserId: string | null;
}