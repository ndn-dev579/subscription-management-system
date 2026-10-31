# Requirements Specification

## 1. Purpose

Build a unified Subscription Management System for Brightloop Software. The application must manage the complete subscription business workflow: user access, products, plans, quotations, subscriptions, recurring invoices, taxes, discounts, payment records and business reporting.

The current process relies on spreadsheets, manually remembered renewals, hand-written invoices, manual bank-statement matching and manually prepared quarterly reports. The new system should centralize these operations and reduce missed renewals, billing errors and uncertainty about recurring revenue.

## 2. Source of truth and requirement labels

The uploaded `Subscription_Management_System.pdf` is the source for the mandatory business requirements in this document.

- **MUST:** Explicitly required by the source specification or the additional project criteria supplied by the team.
- **SHOULD:** Strongly recommended for usability, safety or maintainability.
- **PROPOSED:** A recommended default that requires product-owner approval before it becomes a fixed business rule.
- **OPEN:** Not specified and must be decided before the dependent feature is finalized.

Do not silently turn OPEN items into requirements.

## 3. Users and roles

### 3.1 Admin

The admin controls the system. Admin capabilities include:

- Manage staff accounts; only an admin may add staff.
- Manage products, product variants and subscription plans.
- Configure taxes and discounts.
- View and manage customers, quotations, subscriptions, invoices and payments.
- View reports and system-wide business information.

### 3.2 Staff

Staff handle permitted day-to-day operations. The exact staff permission set is configurable and must be defined by the admin or product owner. Staff must not receive unrestricted administrative access by default.

### 3.3 Customer

Customers can register, log in and access a customer portal. A customer may view and manage only their own subscriptions and invoices. Customers must never be able to retrieve another customer's records by changing an identifier or API request.

## 4. Functional requirements

### 4.1 Authentication and accounts

- **FR-AUTH-01 MUST:** Customers can register using an email address and password.
- **FR-AUTH-02 MUST:** Email addresses are unique per account, compared case-insensitively.
- **FR-AUTH-03 MUST:** Passwords must be more than eight characters and contain at least one uppercase letter, one lowercase letter and one special character. A minimum length of nine characters satisfies “more than eight.”
- **FR-AUTH-04 MUST:** Users can log in and log out.
- **FR-AUTH-05 MUST:** Users can request a password-reset link sent to the registered email address.
- **FR-AUTH-06 MUST:** The system distinguishes Admin, Staff and Customer roles.
- **FR-AUTH-07 MUST:** Only an Admin can create a Staff account.
- **FR-AUTH-08 MUST:** Protected API actions enforce permissions on the backend, not only in the frontend.
- **FR-AUTH-09 SHOULD:** Store password hashes using Django's supported password hashers; never store plaintext passwords.

### 4.2 Customer management

- **FR-CUST-01 MUST:** Staff with permission and admins can view and manage customer records.
- **FR-CUST-02 MUST:** Customer records are linked to the account used for portal access.
- **FR-CUST-03 MUST:** Customer portal queries are restricted to the signed-in customer.
- **FR-CUST-04 SHOULD:** Customer list supports search, filtering, pagination and a customer detail view.
- **OPEN:** The required customer profile fields (company name, contact name, phone, billing address, tax registration number, etc.) must be confirmed.

### 4.3 Product and variant management

- **FR-PROD-01 MUST:** Admin can create and manage products.
- **FR-PROD-02 MUST:** A product records name, type, sales price, cost price and notes.
- **FR-PROD-03 MUST:** A product can have variants, such as a brand or edition.
- **FR-PROD-04 MUST:** A variant can add an extra amount to the base product price. Example from the specification: selecting the Odoo brand adds 560 to the price.
- **FR-PROD-05 SHOULD:** Preserve the product/variant name and price used on an existing confirmed subscription or invoice, even if the catalogue price changes later.
- **OPEN:** Define supported product types, variant dimensions, whether variants can change price by fixed amount or percentage, and the currency.

### 4.4 Subscription plan management

- **FR-PLAN-01 MUST:** Admin can create and manage plans.
- **FR-PLAN-02 MUST:** A plan includes price, billing frequency, minimum quantity and availability start/end dates.
- **FR-PLAN-03 MUST:** Supported billing frequencies are daily, weekly, monthly and yearly.
- **FR-PLAN-04 MUST:** Each plan controls whether it closes automatically when it ends and whether it can be closed early, paused or renewed.
- **FR-PLAN-05 MUST:** The system enforces plan-specific lifecycle options.
- **OPEN:** Clarify whether a plan catalogue end date blocks new subscriptions only or also affects existing subscriptions. The recommended interpretation is that it controls availability for new sales, while each subscription follows its own agreed term.

### 4.5 Quotations and templates

- **FR-QUOTE-01 MUST:** Staff can create a quotation from a reusable quotation template.
- **FR-QUOTE-02 MUST:** A template can pre-populate a plan and product lines.
- **FR-QUOTE-03 MUST:** A template has a validity period measured in days.
- **FR-QUOTE-04 MUST:** A quotation records its customer, plan, dates, payment terms and line items.
- **FR-QUOTE-05 MUST:** Quotation/subscription lifecycle supports Draft, Quotation, Confirmed, Active and Closed states as specified.
- **FR-QUOTE-06 SHOULD:** Expired quotations are visibly identified and cannot be confirmed without an authorized extension or recreation.
- **OPEN:** Confirm whether quotations are represented as a separate record that becomes a subscription on confirmation, or one subscription record moving through the quotation workflow. Recommended design: separate quotation and subscription records linked at conversion.

### 4.6 Subscription management

- **FR-SUB-01 MUST:** Each subscription has a unique subscription number.
- **FR-SUB-02 MUST:** A subscription records customer, plan, start date, expiry date, payment terms and product lines.
- **FR-SUB-03 MUST:** Each subscription line records product, quantity, unit price, tax and line amount.
- **FR-SUB-04 MUST:** Staff can view the current lifecycle status.
- **FR-SUB-05 MUST:** The system supports the configured pause, early closure and renewal options of the selected plan.
- **FR-SUB-06 MUST:** The system can close subscriptions automatically when configured and their applicable end date is reached.
- **FR-SUB-07 SHOULD:** Record a reason and actor for significant lifecycle changes.
- **OPEN:** Confirm whether a paused subscription has a distinct `Paused` state, how it affects billing, and how its expiry date behaves. The source lists the main states but also requires pausing as an action.

### 4.7 Invoice management and billing

- **FR-INV-01 MUST:** Invoices are generated from subscriptions due for billing.
- **FR-INV-02 MUST:** Invoice creation pre-fills customer information, product lines, quantities, prices, taxes and totals from the subscription and applicable rules.
- **FR-INV-03 MUST:** Tax calculations are performed automatically using admin-configured rules.
- **FR-INV-04 MUST:** Authorized users can confirm, cancel, send and print invoices.
- **FR-INV-05 MUST:** Invoice lifecycle supports Draft, Confirmed and Paid as described in the source; cancellation is also an available action.
- **FR-INV-06 MUST:** The system must not bill a subscription twice for the same billing period or silently skip a due billing period.
- **FR-INV-07 SHOULD:** Track payment state separately from document lifecycle so partially paid and overdue invoices can be represented accurately.
- **FR-INV-08 SHOULD:** Preserve a snapshot of line descriptions, prices, tax rates and discounts on the invoice.
- **OPEN:** Define the due-date calculation, grace period, failed billing retry policy, pro-rating policy and invoice numbering format.

### 4.8 Tax management

- **FR-TAX-01 MUST:** Admin can configure tax rules.
- **FR-TAX-02 MUST:** The system calculates applicable tax automatically on invoices.
- **OPEN:** Confirm tax jurisdiction, rates, inclusive/exclusive pricing, compound tax rules, rounding policy and whether multiple taxes can apply to a line. Do not hardcode tax rates in source code.

### 4.9 Discount management

- **FR-DISC-01 MUST:** Only Admin can create discount rules.
- **FR-DISC-02 MUST:** Discount type supports a fixed amount or percentage.
- **FR-DISC-03 MUST:** A rule can specify minimum purchase value and/or minimum quantity.
- **FR-DISC-04 MUST:** A rule has start and end dates and a maximum usage count.
- **FR-DISC-05 MUST:** A discount can target specific products or an entire subscription.
- **FR-DISC-06 MUST:** Applicable discounts appear automatically on the next invoice.
- **FR-DISC-07 MUST:** A discount stops applying after expiry or when its usage limit is exhausted.
- **OPEN:** Define discount stacking, priority, allocation across multiple lines, treatment of tax and whether usage is counted at invoice creation or invoice confirmation. Recommended: count a redemption atomically when the invoice is confirmed, and release it if the invoice is cancelled, subject to approval.

### 4.10 Payment management

- **FR-PAY-01 MUST:** Authorized staff can record a payment.
- **FR-PAY-02 MUST:** A payment records method, amount, date, note and the associated invoice.
- **FR-PAY-03 MUST:** The system displays paid and outstanding invoices.
- **FR-PAY-04 MUST:** The system identifies overdue invoices according to a defined due-date rule.
- **FR-PAY-05 SHOULD:** Support one payment allocated across one or more invoices and more than one payment against an invoice, if partial payments are approved.
- **OPEN:** The source requires payment recording but does not require online payment collection, gateway integration, refunds or payment reconciliation automation. These must be decided separately.

### 4.11 Dashboard and reports

- **FR-REPORT-01 MUST:** Provide a summary of active subscriptions.
- **FR-REPORT-02 MUST:** Provide revenue received, outstanding amounts and overdue invoice information.
- **FR-REPORT-03 MUST:** Provide subscription and payment information.
- **FR-REPORT-04 MUST:** Provide filters and a summary view.
- **FR-REPORT-05 SHOULD:** Report metrics must be computed from persistent application data, not hardcoded values.
- **OPEN:** Define revenue recognition basis, date range presets, export formats and whether reports are accessible to Staff as well as Admin.

### 4.12 Customer portal

- **FR-PORTAL-01 MUST:** Customers can view their own subscriptions.
- **FR-PORTAL-02 MUST:** Customers can view their own invoices.
- **FR-PORTAL-03 MUST:** Customers can manage their own subscriptions, within actions permitted by the plan and business rules.
- **FR-PORTAL-04 MUST:** Customers cannot access another customer's records.
- **OPEN:** Define the exact customer actions: request cancellation, pause/resume, renew, change plan, update billing details, download invoice, etc. Do not expose an action until its policy is defined.

## 5. Non-functional requirements

### 5.1 Performance and scale

- **NFR-PERF-01 MUST:** Every page should respond in under two seconds, including when the company has thousands of subscriptions.
- **NFR-PERF-02 SHOULD:** Use server-side pagination, selective fields, database indexes and query optimization.
- **NFR-PERF-03 SHOULD:** Avoid loading all invoices, subscriptions or payments into the browser at once.
- **OPEN:** Define test data volume, environment, network assumptions and whether the two-second target applies to a percentile (recommended: p95 for normal list/dashboard requests).

### 5.2 Security and privacy

- **NFR-SEC-01 MUST:** Enforce role and object-level access on the backend.
- **NFR-SEC-02 MUST:** Hash passwords and protect secrets.
- **NFR-SEC-03 MUST:** Validate and authorize all state-changing requests.
- **NFR-SEC-04 SHOULD:** Use HTTPS in production, secure token/cookie settings, CSRF protection where cookie authentication is used, and rate limits on authentication endpoints.
- **NFR-SEC-05 SHOULD:** Maintain audit records for important financial and administrative changes.

### 5.3 Data integrity and reliability

- **NFR-DATA-01 MUST:** Do not generate duplicate invoices for the same subscription billing period.
- **NFR-DATA-02 MUST:** Do not silently skip due billing periods.
- **NFR-DATA-03 SHOULD:** Use database transactions for invoice creation, payment allocation and discount redemption.
- **NFR-DATA-04 SHOULD:** Preserve financial history; avoid hard-deleting confirmed invoices or recorded payments.
- **NFR-DATA-05 SHOULD:** Make scheduled tasks safe to retry.

### 5.4 Usability and compatibility

- **NFR-UX-01 MUST:** Provide a clean, responsive UI with consistent colors and layout.
- **NFR-UX-02 MUST:** Use intuitive navigation with sensible menu placement and spacing.
- **NFR-UX-03 MUST:** Validate user input robustly on both client and server.
- **NFR-UX-04 SHOULD:** Support desktop, tablet and mobile layouts for core workflows.
- **NFR-UX-05 SHOULD:** Provide accessible labels, keyboard focus, readable contrast and clear error feedback.

### 5.5 Dynamic data

- **NFR-DYN-01 MUST:** Use live application data from the backend/database for real product functionality. Do not depend on static JSON for production business screens.
- **NFR-DYN-02 MUST:** After successful mutations, affected screens must refresh or update from the API so users see current data.
- **NFR-DYN-03 SHOULD:** Use scheduled refresh/polling only for views that need periodic updates; WebSockets are not required unless a demonstrated use case emerges.

### 5.6 Maintainability and collaboration

- **NFR-MAINT-01 MUST:** Use Git with shared branches and contributions from all team members; repository administration must not be the only person's participation.
- **NFR-MAINT-02 SHOULD:** Use pull requests, review and automated checks before merging to the main branch.
- **NFR-MAINT-03 MUST:** Developers must understand, adapt and test AI-generated code rather than copying it blindly.
- **NFR-MAINT-04 SHOULD:** Keep the system modular and avoid technologies that do not solve a real requirement.

### 5.7 Local development

- **NFR-LOCAL-01 SHOULD:** Provide a local database and local development path so development and demonstration are not entirely dependent on cloud services or internet availability.
- **NFR-LOCAL-02 SHOULD:** Use a local/console email backend in development; production email is an adapter/configuration choice.
- **NFR-LOCAL-03 OPEN:** Full offline operation for end users is not currently required. Confirm separately if it becomes a project requirement.

## 6. Core workflows

1. **Account:** customer registers → email/password validated → account created → customer can log in.
2. **Plan setup:** admin creates product and variants → admin creates a plan → configures pricing, cadence, quantity and lifecycle options.
3. **Quotation:** staff selects customer and template → reviews product lines, prices, taxes and terms → sends quotation → customer accepts or staff confirms according to policy.
4. **Subscription:** confirmed quotation converts to subscription → subscription receives unique identifier and dates → subscription becomes active according to confirmation rules.
5. **Billing:** scheduled worker finds due active subscriptions → creates one invoice per due billing period → calculates eligible discounts/taxes → persists invoice and billing period atomically → sends notification if configured.
6. **Payment:** staff records payment against invoice → payment allocation is persisted → outstanding amount and payment state are recalculated.
7. **Reporting:** dashboard queries current subscriptions, invoices and payments with filters and summary calculations.

## 7. Acceptance criteria for the first usable release

- A customer can register, log in and reset a password.
- Admin can create staff and staff cannot create other staff.
- Admin can create a product, variant and plan with a supported billing interval.
- Staff can create a quotation using a template and convert an approved quotation into a subscription.
- A due subscription produces an invoice with the correct customer and line snapshots.
- Running the same billing job more than once does not create a duplicate invoice.
- Taxes and eligible discounts are calculated using configured data, not hardcoded values.
- A payment can be recorded against an invoice and the outstanding amount updates correctly.
- Customers can view only their own subscriptions and invoices.
- Dashboard metrics come from database-backed API results.
- Core screens have loading, empty, error and success states and adapt to mobile widths.
- Git history shows contributions from the team members, with pull-request review or an agreed equivalent process.

## 8. Open decisions register

Resolve these with the product owner before implementing dependent behaviour:

1. Currency and timezone policy. Suggested initial timezone: `Asia/Kolkata`; currency must be confirmed.
2. Tax rules and tax-inclusive/exclusive pricing.
3. Billing date calculation for month-end and leap-year cases.
4. Proration on plan changes, pauses, early closure and renewal.
5. Whether paused subscriptions skip billing and how expiry dates change.
6. Automatic versus manual renewal behaviour per plan.
7. Invoice due-date and overdue rules, grace period and reminders.
8. Partial payment and payment allocation requirements.
9. Online payment gateway and refund requirements.
10. Discount stacking, priority and usage-counting rules.
11. Customer portal actions beyond viewing and permitted subscription management.
12. Quotation-to-subscription record model and approval process.
13. Staff permission granularity.
14. Report definitions, exports and revenue basis.
15. Single-company deployment versus future multi-tenancy.
