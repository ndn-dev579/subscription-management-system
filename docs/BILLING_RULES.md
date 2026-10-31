# Billing and Subscription Business Rules

## 1. Purpose and status

This document describes how subscriptions, billing cycles, invoices, discounts, taxes and payments should behave.

The source requirements explicitly require recurring billing, automatic invoice creation, configurable taxes and discounts, payment tracking, and prevention of duplicate or missed billing. Several detailed calculation rules are not specified. To avoid inventing policy, this document distinguishes:

- **Specified:** explicitly required by the project brief.
- **Proposed default:** recommended behaviour for implementation; requires product-owner approval.
- **Open decision:** must be confirmed before the dependent feature is finalized.

Do not implement an open rule as an invisible assumption.

## 2. Core terminology

- **Plan:** a catalogue offering that defines price, billing frequency, minimum quantity, availability and allowed lifecycle actions.
- **Subscription:** a customer's agreed purchase of a plan and associated product lines for a term.
- **Billing period:** the time interval covered by one recurring charge.
- **Billing cycle record:** durable record that a subscription period is due/processed.
- **Invoice:** a financial document generated for a subscription billing period or an explicitly approved one-off charge.
- **Payment:** money recorded as received.
- **Allocation:** the amount of a payment applied to an invoice.
- **Outstanding balance:** invoice total less valid allocated payments and credits/reversals, subject to approved policy.

## 3. Subscription lifecycle

### 3.1 States

The brief specifies the lifecycle:

`Draft -> Quotation -> Confirmed -> Active -> Closed`

The brief also requires that some plans allow subscriptions to be paused. **Proposed:** add a `Paused` state, with transitions defined below. Product-owner approval is needed because `Paused` is not listed in the explicit lifecycle sequence.

### 3.2 Proposed state transitions

| Current state | Action | Next state | Conditions |
|---|---|---|---|
| Draft | Prepare/send quotation | Quotation | Required details valid |
| Quotation | Confirm | Confirmed | Quotation is valid and accepted under agreed process |
| Confirmed | Activate | Active | Start date/activation policy reached |
| Active | Pause | Paused | Plan allows pause |
| Paused | Resume | Active | Plan allows pause/resume and policy checks pass |
| Active/Paused | Close | Closed | Plan allows early closure or term-end closure applies |
| Active/Closed | Renew | Active or new linked subscription | Plan allows renewal; renewal policy defined |

This table is a proposal, not final policy. Confirm whether `Confirmed` and `Active` can be the same moment, and whether renewals extend an existing record or create a linked new subscription.

### 3.3 Plan availability versus subscription term

**Proposed default:** plan availability dates control when a plan can be sold to a new customer. An existing subscription follows its own agreed start/expiry dates and snapshots, unless the contract explicitly says otherwise.

## 4. Billing frequency and period calculation

The system must support daily, weekly, monthly and yearly billing.

### 4.1 Period representation

Store a start and end boundary for every billing cycle. Use a consistent convention, preferably a half-open interval `[period_start, next_period_start)` internally, while displaying the covered dates in a user-friendly way. The implementation must document which convention is used so adjacent periods neither overlap nor leave gaps.

### 4.2 Proposed interval behaviour

- Daily: next period begins one calendar day after the prior period start in the configured business timezone.
- Weekly: next period begins seven calendar days after the prior period start.
- Monthly: next period advances by one calendar month, not a fixed number of days.
- Yearly: next period advances by one calendar year.

**Open decisions:** timezone, whether calculations use calendar days or exact elapsed time, month-end behaviour (for example, a start on the 31st), leap-day behaviour, and the displayed inclusive end date.

**Proposed month-end default:** clamp to the last valid day of the target month and preserve the original anchor day for later cycles where practical. This must be tested and approved.

### 4.3 Billing anchor and first invoice

**Open:** decide whether the first invoice is generated at activation, at the first scheduled billing date, or according to payment terms. Decide whether the first period can be partial.

Do not assume proration without approval.

## 5. Due-subscription selection and invoice generation

### 5.1 Required behaviour

- The system identifies subscriptions due for billing.
- It generates invoices from subscription data.
- Customer, product lines, quantities, taxes and totals are populated automatically.
- A billing cycle must not be invoiced twice or silently skipped.

### 5.2 Proposed due-selection rules

A subscription is eligible for scheduled billing only when all of the following are true:

1. Its state is `Active`.
2. Its next billing time is due according to the configured business timezone.
3. It has not been closed or otherwise made ineligible.
4. Its plan/contract rules permit billing for the period.
5. No successful billing-cycle record/invoice already exists for that period.

Paused-subscription billing behaviour is an OPEN decision. Proposed default: no new recurring invoice is generated while paused; the effect on next billing date and expiry is determined by the approved pause policy.

### 5.3 Idempotency and concurrency

This is a critical invariant:

> There must be at most one recurring invoice for one subscription and one billing period.

Implementation safeguards:

- Give each billing cycle a deterministic `(subscription_id, period_start, period_end)` identity.
- Add a PostgreSQL unique constraint for that identity.
- Create the billing-cycle record and invoice in one database transaction.
- Lock or safely claim the subscription/cycle when multiple workers may process it.
- A retry should detect an existing completed cycle and return/skip it safely.
- Log failures with subscription and cycle identifiers.
- Retry transient failures with bounded attempts and backoff.
- Provide a way for an authorized operator to inspect and reprocess failed cycles without creating a duplicate.

Never rely only on a Celery task ID or in-memory lock for duplicate prevention.

### 5.4 Missed billing periods

**Open:** decide whether a delayed worker should backfill every missed period, create one catch-up invoice, or require manual review. Proposed default: create one invoice per missed billable period in chronological order, subject to contract expiry and pause/closure rules; alert staff if a large backlog is detected.

## 6. Invoice rules

### 6.1 Invoice content

An invoice should snapshot:

- Invoice number and dates.
- Customer billing identity/address.
- Subscription and billing period reference.
- Product/variant description.
- Quantity and unit price.
- Discount lines/amounts.
- Tax name/rate/amount.
- Subtotal, discount total, tax total and grand total.
- Currency and payment terms.

The invoice must not change retroactively if the product name, plan price, tax rule or discount configuration changes later.

### 6.2 Document status and payment status

The brief describes invoice document states `Draft`, `Confirmed` and `Paid`, and supports cancellation. To represent outstanding and overdue amounts correctly, keep document lifecycle distinct from payment state.

**Proposed document states:** `DRAFT`, `CONFIRMED`, `CANCELLED`.

**Payment state (derived or carefully maintained):** `UNPAID`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`.

An invoice may be document-confirmed while its payment state is unpaid, partially paid or overdue. A fully settled invoice may display `Paid`. Confirm terminology with the product owner.

### 6.3 Cancellation

**Proposed:** a confirmed invoice is never silently deleted. Cancellation requires permission, a reason and an audit event. If payment has already been allocated, the cancellation workflow must define how to unallocate/refund/reverse it before the invoice can be cancelled.

### 6.4 Due dates and overdue

**Open:** define due-date calculation from issue date and payment terms, timezone, grace period and whether overdue begins at the start of the day after the due date. Until confirmed, do not invent a default in customer-facing messaging.

## 7. Pricing, variants and snapshots

- Product sales price is the base price.
- Variant price adjustment is added to or otherwise combined with base price according to the approved variant rule.
- Subscription items store the agreed unit price at confirmation/activation.
- Invoice items snapshot the charged description, quantity, unit price and relevant rules.
- Changing a catalogue price must not silently change an existing subscription's agreed price.

**Open:** decide whether price changes affect existing subscriptions at renewal, require explicit approval, or apply only to new subscriptions.

## 8. Taxes

### 8.1 Required behaviour

Admin-configured tax rules are applied automatically to invoices.

### 8.2 Calculation sequence

**Open:** tax jurisdictions, included/excluded tax, compound taxes, exemption handling, line-level versus invoice-level tax and rounding.

**Proposed implementation approach:** calculate eligible discounts and taxable base according to the approved policy, apply the applicable tax rules to each invoice line, aggregate line totals, and persist the exact rate/amount snapshot. The final sequence must match the jurisdiction and agreed accounting policy.

Never hardcode a tax rate in frontend code or backend business logic. Read active rules from the database and snapshot the chosen rule on the invoice.

## 9. Discounts

### 9.1 Required eligibility fields

A discount may define:

- Fixed amount or percentage.
- Minimum purchase value.
- Minimum quantity.
- Start and end date.
- Usage limit.
- Product scope or whole-subscription scope.

It must apply automatically to an eligible next invoice and stop applying after expiry or exhausted usage.

### 9.2 Proposed evaluation order

1. Confirm the rule is active and current at the agreed evaluation time.
2. Check product/subscription scope.
3. Check minimum purchase and quantity conditions.
4. Check usage limit with concurrency-safe reservation/redemption.
5. Calculate discount using decimal arithmetic.
6. Apply any approved cap so a discount cannot create an unintended negative charge.
7. Store the applied rule and calculated amount on the invoice snapshot.

### 9.3 Open discount decisions

- Can multiple discounts stack?
- If multiple rules match, which one wins?
- Is fixed discount applied per line, per product, or across the whole invoice?
- Is percentage calculated before or after another discount?
- Is usage consumed at draft creation, confirmation or payment?
- Is a redemption released when an invoice is cancelled?
- Are discounts applied before tax or after tax?

**Proposed default:** do not stack discounts in the first release unless explicitly required; consume usage atomically when the invoice is confirmed; release it on a valid cancellation before settlement. Approve before implementation.

## 10. Payments and outstanding balances

### 10.1 Required payment fields

Each payment records method, amount, date, note and the associated invoice.

### 10.2 Proposed balance calculation

`outstanding = invoice_grand_total - valid_allocated_payments - approved_credits`

The result must not be negative. Any overpayment handling is an OPEN policy decision (unallocated credit, refund or rejection).

### 10.3 Partial and multiple payments

The source document does not explicitly require partial payment, but it is a useful capability for accurate outstanding balances.

**Proposed:** support multiple payments per invoice and one payment allocated across multiple invoices through a payment-allocation table. Payment allocation must be transactional and validated against available payment amount and invoice outstanding balance.

### 10.4 Payment methods and gateway

- **Specified:** record the payment method.
- **Open:** allowed method list and whether online payment is required.
- **Proposed initial scope:** manual recording of bank transfer, cash, card/other as approved. Online gateway integration is optional until explicitly selected.

### 10.5 Corrections and refunds

**Open:** define whether refunds are in scope. Recommended financial-history principle: reverse/refund through linked records with reasons rather than editing or deleting the original payment.

## 11. Subscription pause, closure and renewal

These actions must obey plan-level configuration.

### Pause

**Open decisions:**
- Does a pause stop billing immediately or at the end of the current paid period?
- Does expiry extend by the paused duration?
- Can a subscription be paused more than once?
- What happens to an invoice already generated?

**Proposed default:** pause blocks future recurring invoice generation; already confirmed invoices remain payable; resume behaviour is calculated from the recorded pause/resume dates and approved policy.

### Early closure

**Open decisions:** immediate versus end-of-period closure, refund/credit treatment, outstanding invoice handling and access end date.

**Proposed default:** preserve all prior invoices and payments; closure affects future cycles only unless a separately approved credit/refund is recorded.

### Renewal

**Open decisions:** automatic versus manual renewal per plan, renewal notice, new term dates, price change handling and whether a new subscription record is created.

**Proposed default:** record renewal as an auditable operation and preserve the historical term. Do not silently overwrite the previous term's dates or prices.

## 12. Currency, timezone and precision

The project must configure a business timezone and currency policy.

- Suggested initial timezone: `Asia/Kolkata`, subject to confirmation.
- Currency must be confirmed; INR may be suitable for a Kerala/India demonstration but should not be hardcoded as an architectural assumption.
- Store timestamps in UTC; calculate calendar billing periods in the configured business timezone.
- Use decimal arithmetic and the currency's approved minor-unit precision.
- Define rounding mode and whether rounding happens per line or at invoice total.

## 13. Operational recovery and reconciliation

- Billing job execution must record start/end time, processed count, skipped count and failed count.
- Failed cycles must be queryable by authorized staff/admin.
- Retry transient errors with bounded retries and backoff.
- Do not retry permanent validation/business-rule failures indefinitely.
- Provide an admin/staff recovery procedure with permission and audit trail.
- Reconciliation should compare invoice totals, allocations and outstanding balances from durable records.
- Email/PDF delivery failures must not roll back a successfully created invoice; retry delivery separately.

## 14. Minimum billing test scenarios

- Daily, weekly, monthly and yearly cycle generation.
- Month-end and leap-year dates.
- Billing on exact due time and a delayed scheduled worker.
- Two workers processing the same subscription concurrently.
- Same task retried after successful invoice commit.
- Subscription closed or paused before billing.
- Subscription expires at the billing boundary.
- Plan price changes after subscription confirmation.
- Variant price adjustment.
- Discount before start date, during validity, after expiry and at exhausted limit.
- Two simultaneous invoices competing for the final discount use.
- Tax rate changes after an invoice has been confirmed.
- Full payment, partial payment, multiple payments and overpayment attempt.
- Payment allocated to more than one invoice if supported.
- Invoice cancellation with and without allocated payment.
- Email failure after successful invoice creation.
- Missed billing period backfill/recovery.

## 15. Decisions required before final implementation

1. Currency and business timezone.
2. Billing anchor and first invoice timing.
3. Month-end and leap-year period rules.
4. Proration policy.
5. Pause and resume effects on billing and expiry.
6. Early closure and refund/credit policy.
7. Renewal process and price changes.
8. Invoice due-date and overdue/grace-period rules.
9. Tax jurisdiction and calculation/rounding rules.
10. Discount stacking, priority and usage consumption point.
11. Partial payments, overpayments and allocations.
12. Online payment provider, if any.
13. Missed-period backfill behaviour.
14. Invoice cancellation after payment.
15. Revenue reporting definition (cash received, invoiced value or recognized revenue).
