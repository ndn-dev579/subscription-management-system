# Database Design

## 1. Database principles

Use PostgreSQL as the durable source of truth. The model must support relational integrity, transactional billing and preservation of financial history.

- Use Django's custom user model from the first migration.
- Use foreign keys for ownership and relationships.
- Use `DecimalField`/PostgreSQL `NUMERIC` for money; never use floating-point types for financial values.
- Store timestamps in UTC and convert to the configured business timezone for display and billing calculations.
- Store currency code with monetary records, even if the first release uses one configured currency.
- Snapshot prices, descriptions and tax/discount details onto confirmed commercial and financial records.
- Use database constraints for uniqueness and non-negative amounts where appropriate.
- Do not hard-delete finalized invoices or payments.

This is a logical design. Final Django model names and exact field lengths can be adjusted during implementation without changing the business meaning.

## 2. Entity groups

### 2.1 Identity and access

#### `User`

Custom Django user model.

| Field | Suggested type | Notes |
|---|---|---|
| `id` | UUID | Primary key recommended |
| `email` | Email / varchar | Required; unique case-insensitively |
| `password` | Django password hash | Never plaintext |
| `role` | Enum/choice | `ADMIN`, `STAFF`, `CUSTOMER` |
| `is_active` | Boolean | Account activation |
| `is_staff` | Boolean | Django admin access flag; do not confuse with business role |
| `created_at`, `updated_at` | Timestamps | Audit timestamps |

Use a case-insensitive unique email constraint (for example, normalized email plus a unique constraint or PostgreSQL `citext`). Confirm the chosen implementation before migrations are finalized.

#### `CustomerProfile`

| Field | Suggested type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | FK User, nullable only if approved | Login account linked to customer |
| `customer_number` | Varchar | Unique business identifier |
| `display_name` | Varchar | Company/person label |
| `billing_email` | Email | Invoice contact if different from login email |
| `phone` | Varchar | Optional |
| `billing_address` | JSON or normalized address fields | Choose based on reporting/address validation needs |
| `tax_identifier` | Varchar | Optional and jurisdiction-dependent |
| `created_at`, `updated_at` | Timestamps | |

#### `StaffProfile` (optional)

Use only if staff-specific attributes beyond `User` are required. Do not duplicate role information unnecessarily.

### 2.2 Catalogue and plans

#### `Product`

| Field | Suggested type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | Varchar | Required |
| `product_type` | Varchar/choice | Controlled list once product types are agreed |
| `sales_price` | Decimal | Base selling price |
| `cost_price` | Decimal | Restrict visibility to appropriate roles |
| `currency` | Char(3) | ISO-style currency code |
| `notes` | Text | Optional |
| `is_active` | Boolean | Prevent new sale while preserving history |
| `created_at`, `updated_at` | Timestamps | |

#### `ProductVariant`

| Field | Suggested type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `product_id` | FK Product | Parent product |
| `name` | Varchar | Example: Odoo brand |
| `price_adjustment` | Decimal | Example: +560 |
| `attributes` | JSONB | Optional structured variant data |
| `is_active` | Boolean | |

#### `Plan`

| Field | Suggested type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | Varchar | Required |
| `price` | Decimal | Plan price |
| `currency` | Char(3) | Currency code |
| `billing_interval` | Enum | `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY` |
| `billing_interval_count` | Positive integer | Usually 1; supports future interval flexibility if approved |
| `minimum_quantity` | Positive integer | Must be at least 1 unless product owner allows otherwise |
| `available_from`, `available_until` | Date/time | Catalogue availability |
| `auto_close_on_end` | Boolean | Plan lifecycle option |
| `allow_early_close` | Boolean | Plan lifecycle option |
| `allow_pause` | Boolean | Plan lifecycle option |
| `allow_renewal` | Boolean | Plan lifecycle option |
| `is_active` | Boolean | Admin catalogue control |
| `created_at`, `updated_at` | Timestamps | |

#### `PlanProduct` (if plans define included lines)

Associates plans with included/default product lines and their default quantities/prices. Use this table if a plan contains multiple products; otherwise the plan may reference a simpler primary product relationship. Confirm the business model before implementation.

### 2.3 Quotations

#### `QuotationTemplate`

Fields: `id`, `name`, `validity_days`, `default_plan_id`, `notes`, `is_active`, `created_by_id`, timestamps.

#### `QuotationTemplateItem`

Fields: `id`, `template_id`, `product_id`, optional `variant_id`, `default_quantity`, optional default unit price/description snapshot.

#### `Quotation`

Fields: `id`, unique `quotation_number`, `customer_id`, `template_id` nullable, `plan_id`, `created_by_id`, `issue_date`, `valid_until`, `start_date`, `expiry_date`, `payment_terms`, `status`, `currency`, `subtotal`, `discount_total`, `tax_total`, `grand_total`, timestamps.

Suggested states: `DRAFT`, `QUOTATION`, `CONFIRMED`, `EXPIRED`, `CANCELLED`. Confirm whether `EXPIRED` and `CANCELLED` are required explicit states.

#### `QuotationItem`

Fields: `id`, `quotation_id`, optional `product_id`/`variant_id` references, `description_snapshot`, `quantity`, `unit_price`, `discount_amount`, `tax_amount`, `line_total`, optional tax/discount snapshot fields.

### 2.4 Subscriptions

#### `Subscription`

Fields: `id`, unique `subscription_number`, `customer_id`, `plan_id`, `quotation_id` nullable/unique as appropriate, `start_at`, `expires_at`, `next_billing_at`, `billing_interval_snapshot`, `status`, `payment_terms_snapshot`, `currency`, `created_by_id`, `closed_at`, `close_reason`, timestamps.

Suggested lifecycle states: `DRAFT`, `QUOTATION`, `CONFIRMED`, `ACTIVE`, `PAUSED`, `CLOSED`. The source explicitly names Draft, Quotation, Confirmed, Active and Closed; `PAUSED` is proposed to represent the required pause action. Confirm this state model before coding transitions.

#### `SubscriptionItem`

Fields: `id`, `subscription_id`, optional `product_id`/`variant_id` references, `product_name_snapshot`, `variant_name_snapshot`, `quantity`, `unit_price`, `currency`, `tax_configuration_snapshot`, `created_at`.

Snapshot fields preserve agreed commercial terms if a catalogue product is later renamed or repriced.

#### `BillingCycle`

Fields: `id`, `subscription_id`, `period_start`, `period_end`, `scheduled_at`, `status`, `invoice_id` nullable, `attempt_count`, `last_error` (carefully sanitized), `created_at`, `updated_at`.

Add a unique constraint on `(subscription_id, period_start, period_end)` to enforce one billing cycle per subscription period. The invoice relation should also be unique where one cycle creates one invoice.

### 2.5 Taxes and discounts

#### `TaxRule`

Fields: `id`, `name`, `tax_type`, `rate`, optional fixed amount, `is_inclusive`, `effective_from`, `effective_until`, `is_active`, applicable scope, timestamps.

Exact tax model depends on jurisdiction and whether taxes can be compound or multiple per line. Do not assume a specific tax regime from the current brief.

#### `DiscountRule`

Fields: `id`, `name`, `discount_type` (`FIXED`/`PERCENTAGE`), `value`, `minimum_purchase`, `minimum_quantity`, `starts_at`, `ends_at`, `usage_limit`, `usage_count` (or derive from redemptions), `scope`, `is_active`, `created_by_id`, timestamps.

#### `DiscountProduct`

Many-to-many association between discount rules and eligible products, if product-specific targeting is enabled.

#### `DiscountRedemption`

Fields: `id`, `discount_rule_id`, `subscription_id`, `invoice_id`, `customer_id`, `discount_amount`, `status`, `redeemed_at`, `released_at`.

Use a transaction/locking strategy to prevent simultaneous invoices from exceeding a discount's usage limit. Define whether redemption is reserved at draft creation or consumed on confirmation.

### 2.6 Invoices and payments

#### `Invoice`

Fields: `id`, unique `invoice_number`, `customer_id`, `subscription_id`, `billing_cycle_id` nullable/unique, `issue_date`, `due_date`, `currency`, `status`, `subtotal`, `discount_total`, `tax_total`, `grand_total`, `created_by_id` nullable for system-generated invoice, `confirmed_at`, `cancelled_at`, `cancellation_reason`, timestamps.

Document status may be `DRAFT`, `CONFIRMED`, `PAID`, `CANCELLED`. Payment status such as `UNPAID`, `PARTIALLY_PAID`, `PAID`, `OVERDUE` can be derived or stored with controlled recalculation. Avoid conflating an overdue condition with invoice document lifecycle.

#### `InvoiceItem`

Fields: `id`, `invoice_id`, optional source subscription item/product/variant references, `description_snapshot`, `quantity`, `unit_price`, `discount_amount`, `taxable_amount`, `tax_amount`, `line_total`, tax and discount snapshots.

#### `Payment`

Fields: `id`, unique `payment_reference`, `method`, `amount`, `currency`, `payment_date`, `note`, `status`, `recorded_by_id`, optional external reference, timestamps.

#### `PaymentAllocation`

Fields: `id`, `payment_id`, `invoice_id`, `allocated_amount`, `created_at`.

This junction supports multiple payments against an invoice and one payment split across invoices, if partial/multiple allocation is approved. Enforce that allocations do not exceed the payment amount or the invoice's outstanding balance within the same transaction.

### 2.7 Audit and operational records

#### `AuditLog`

Fields: `id`, `actor_user_id` nullable for system jobs, `action`, `entity_type`, `entity_id`, `timestamp`, `request_id`/correlation id, sanitized metadata JSONB.

Audit events should cover role changes, product/plan changes, discount creation/activation, subscription pause/resume/renewal/closure, invoice confirmation/cancellation and payment recording/reversal.

#### `EmailDelivery` (optional)

Track delivery attempts for quotations, invoices and notifications if the system needs delivery status and retries.

## 3. Relationship summary

```text
User 1---0..1 CustomerProfile
User 1---0..1 StaffProfile (if needed)

Customer 1---many Quotations
Customer 1---many Subscriptions
Customer 1---many Invoices

Product 1---many ProductVariants
Plan many---many Products (through PlanProduct, if needed)

QuotationTemplate 1---many TemplateItems
Quotation 1---many QuotationItems
Quotation 0..1---1 Subscription (conversion relationship)

Subscription 1---many SubscriptionItems
Subscription 1---many BillingCycles
BillingCycle 0..1---1 Invoice
Subscription 1---many Invoices

Invoice 1---many InvoiceItems
Payment many---many Invoice (through PaymentAllocation)

DiscountRule many---many Products (through DiscountProduct)
DiscountRule 1---many DiscountRedemptions
```

## 4. Key constraints and indexes

- Unique, case-insensitive user email.
- Unique customer number, quotation number, subscription number, invoice number and payment reference.
- Unique subscription billing period `(subscription_id, period_start, period_end)`.
- Unique invoice per billing cycle where the design enforces one invoice per cycle.
- Foreign keys on customer, plan, quotation, subscription and invoice relationships.
- Check constraints for non-negative prices/totals and positive quantities where applicable.
- Index subscription status and next billing date for due-cycle lookup.
- Index invoice customer, status, due date and issue date.
- Index payment invoice allocations and payment date.
- Index commonly filtered customer, status and date fields based on query patterns.
- Consider partial indexes for active/due records only after query plans are measured.

## 5. Money and rounding

- Use exact decimal storage, not float/double.
- Store currency code on invoices, payments and price snapshots.
- Keep calculation precision internally and round at the approved tax/currency boundary.
- Store calculated line amounts and invoice totals as snapshots so a later rule change does not rewrite historical invoices.
- The exact rounding method, currency decimal places, tax rounding level and discount allocation policy are OPEN decisions in `BILLING_RULES.md`.

## 6. Delete, archive and history rules

- Products, variants, plans, tax rules and discounts should generally be deactivated/archived rather than deleted when referenced by historical records.
- Confirmed invoices and recorded payments must not be hard-deleted.
- Correct errors using cancellation, reversal or adjustment records with reasons and audit history.
- User deactivation should not delete associated customer, subscription or payment history.
- Define retention requirements before production deployment.

## 7. Migration and seed-data rules

- Commit Django migrations to Git.
- Never edit an already-applied migration manually in a shared environment; create a new migration.
- Seed scripts may create demo products/plans for local demonstrations, but demo data must be distinguishable and must not be mistaken for production records.
- Test migrations against an empty database and a representative populated database.
- Do not use hardcoded JSON as a live data source. Fixtures are allowed for tests and local initial setup only.

## 8. Open schema decisions

1. Exact customer/company/billing address fields.
2. Product type and variant model complexity.
3. Whether a plan includes several products or only a plan price.
4. Whether quotations and subscriptions are separate records or a shared lifecycle entity.
5. Pause state and billing-cycle representation.
6. Currency and timezone policy.
7. Tax rule model and jurisdiction requirements.
8. Discount redemption timing and stacking policy.
9. Partial payments and allocation requirements.
10. Refund/reversal schema.
11. Data retention and privacy requirements.
