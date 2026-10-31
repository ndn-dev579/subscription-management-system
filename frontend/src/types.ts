export type Role = 'admin' | 'staff' | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  company?: string;
  createdAt?: string;
}

export const PERIODS = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export type Period = (typeof PERIODS)[number];

export const PRODUCT_TYPES = ['Software', 'Add-on', 'Service', 'Hardware'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const METHODS = ['Bank transfer', 'UPI', 'Card', 'Cash', 'Cheque'] as const;
export type PaymentMethod = (typeof METHODS)[number];
