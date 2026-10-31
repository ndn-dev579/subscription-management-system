# Frontend Design Specification

## 1. Purpose

This document defines the structure, visual language, navigation and interaction behaviour of the React frontend. It complements `REQUIREMENTS.md` (what the application must do) and `ARCHITECTURE.md` (how it is implemented).

The UI should feel like a clear, dependable business operations dashboard. It should prioritize readability, speed of common tasks, predictable navigation and accurate financial information over decoration.

## 2. Design principles

1. **Clarity first:** show the information needed to make a decision; avoid decorative clutter.
2. **Consistency:** use shared layouts, typography, colors, spacing, form patterns and status indicators.
3. **Responsive by default:** support desktop, tablet and mobile widths; dense tables must have a considered mobile treatment.
4. **Data integrity:** make destructive or financial actions explicit and confirmable.
5. **Accessible interaction:** keyboard navigation, visible focus, labels, readable contrast and meaningful error messages.
6. **Live application data:** production business views fetch from the API; static JSON is not the production data source.
7. **Role-aware experience:** users see the navigation and actions relevant to their role, with backend permissions still enforced.

## 3. Design system

The palette below is a proposed starting point and can be tuned after a visual prototype. Keep colors centralized as design tokens rather than hardcoding them per page.

### 3.1 Color tokens

| Token | Suggested value | Use |
|---|---|---|
| `background` | `#F8FAFC` | Main page background |
| `surface` | `#FFFFFF` | Cards, panels, tables and dialogs |
| `foreground` | `#0F172A` | Main text |
| `muted` | `#64748B` | Secondary text and hints |
| `border` | `#E2E8F0` | Dividers and component boundaries |
| `primary` | `#2563EB` | Primary action and active navigation |
| `success` | `#15803D` | Paid, active or completed states |
| `warning` | `#B45309` | Due soon, pending or attention required |
| `danger` | `#B91C1C` | Overdue, failed or destructive action |
| `info` | `#0369A1` | Informational state |

Use semantic status colors consistently. Always pair color with text/icon; never communicate status by color alone. Check actual contrast before release.

### 3.2 Typography

- Use a readable system font stack or a single locally bundled font.
- Page title: clear, medium/semibold hierarchy.
- Section headings: smaller than page title and consistent across pages.
- Body text: comfortable reading size (typically 14–16 px).
- Table metadata and helper text: smaller but still readable.
- Financial figures should use tabular numerals where supported and consistent currency formatting.

### 3.3 Spacing, shape and elevation

- Use a consistent spacing scale based on 4 px increments.
- Use modest corner radii consistently for cards, inputs and dialogs.
- Use borders and subtle elevation sparingly to separate layers.
- Keep page content aligned to a shared maximum width and grid.
- Avoid excessive gradients, shadows, animation and oversized cards.

### 3.4 Icons and status labels

Use one icon set consistently. Status badges must include text, for example `Active`, `Paused`, `Draft`, `Confirmed`, `Paid`, `Partially paid`, `Overdue` or `Closed`. Do not create a status until the corresponding backend state or derived state has been defined.

## 4. Application shell and navigation

### 4.1 Desktop shell

- Left sidebar with product identity and role-appropriate navigation.
- Top header with page title/breadcrumb, global actions where appropriate, user menu and account/logout controls.
- Main content area with consistent page padding.
- Sidebar may collapse to icons only if labels remain accessible through tooltips and an expanded state is available.

### 4.2 Mobile shell

- Replace the persistent sidebar with a drawer or compact navigation menu.
- Keep the page title and primary action visible.
- Stack dashboard cards and forms vertically.
- Convert dense tables into horizontally scrollable tables or compact record cards; do not silently hide critical values/actions.
- Dialogs should fit the viewport and allow scrolling.

### 4.3 Navigation by role

**Admin navigation**

- Dashboard
- Customers
- Staff
- Products
- Plans
- Quotations
- Subscriptions
- Invoices
- Payments
- Taxes
- Discounts
- Reports
- Settings (only if settings are implemented)

**Staff navigation**

- Dashboard
- Customers
- Quotations
- Subscriptions
- Invoices
- Payments
- Reports (only if permitted)

**Customer navigation**

- Overview
- My Subscriptions
- My Invoices
- Account / Billing Details (only after requirements are confirmed)

The navigation is a proposed default. Final staff menu visibility must follow the approved permission matrix.

## 5. Route map

Example route layout; exact route names can be refined during implementation.

```text
/login
/register
/forgot-password
/reset-password

/admin/dashboard
/admin/staff
/admin/customers
/admin/products
/admin/products/:id
/admin/plans
/admin/quotations
/admin/quotations/:id
/admin/subscriptions
/admin/subscriptions/:id
/admin/invoices
/admin/invoices/:id
/admin/payments
/admin/taxes
/admin/discounts
/admin/reports

/staff/dashboard
/staff/customers
/staff/quotations
/staff/subscriptions
/staff/invoices
/staff/payments

/portal/overview
/portal/subscriptions
/portal/subscriptions/:id
/portal/invoices
/portal/invoices/:id
```

Protected route groups improve navigation and user experience, but route protection in React is not a security boundary. Every API endpoint must also authorize the user.

## 6. Page specifications

### 6.1 Authentication

**Login**
- Email and password fields.
- Show/hide password control.
- Submit button with pending state.
- Link to forgot password and customer registration.
- Field-level validation and a general invalid-credentials message that does not disclose account existence.

**Registration**
- Email and password fields, plus any approved profile fields.
- Show password requirements before submission.
- Enforce unique email and password rules on the backend; show helpful client validation too.
- Display submission progress and a clear success/error result.

**Forgot/reset password**
- Request a reset link using email.
- Use a neutral response message regardless of whether the email exists.
- Reset page accepts token and new password, validates rules and displays completion.

### 6.2 Dashboard

- KPI cards: active subscriptions, revenue received, outstanding amount and overdue invoices.
- Charts or trend summaries only when backed by valid API data and clearly labeled with date range.
- Recent invoices/payments or attention-needed list.
- Date range and relevant filters.
- Skeleton/loading state, empty state for a new business and error/retry state.
- Avoid fabricated sample figures in production. If no data exists, show zero/empty state rather than demo metrics.

### 6.3 Customers

- Search by approved customer fields.
- Filters and server-side pagination.
- Table columns should be limited to useful identifiers, contact/company, subscription count or status if available, and actions.
- Customer detail page groups profile, subscriptions, invoices and relevant activity.
- Create/edit forms show field-level validation.

### 6.4 Staff

- Admin-only list and create flow.
- Show name/email, role, account state and creation date where available.
- Provide clear confirmation for deactivate/reactivate if those operations are approved.
- Do not show staff creation actions to Staff or Customer roles.

### 6.5 Products and variants

- Product list with name, type, sales price, cost price and active/archived state if implemented.
- Product create/edit form includes notes and variant configuration.
- Variant editor should make base price and additional price adjustment obvious.
- Show a calculated preview of the selected variant price.
- Validate numeric values, non-negative quantity/price and currency precision on the backend.

### 6.6 Plans

- List plan name, price, cadence, minimum quantity, availability dates and allowed lifecycle options.
- Create/edit form for daily, weekly, monthly or yearly frequency.
- Make auto-close, early closure, pause and renewal settings explicit.
- Show validation for date ranges and minimum quantity.

### 6.7 Quotations and templates

- Template list and editor for reusable plan/product lines and validity duration.
- Quotation list with number, customer, date, expiry, total and status.
- Quotation detail shows customer, plan, lines, tax/discount breakdown, payment terms and activity.
- Primary actions depend on status and role: edit draft, send, confirm/convert, cancel or expire according to approved rules.
- Confirming/converting a quotation requires a review step showing the final commercial terms.

### 6.8 Subscriptions

- List with subscription number, customer, plan, start/expiry, next billing date if available, amount and status.
- Filters for status, customer, plan and date range.
- Detail view groups summary, items, billing history, linked invoices and timeline/audit activity.
- Pause, resume, renew and close actions appear only when allowed by the plan, current state and role.
- Confirmation dialog must describe consequences for billing and dates before a high-impact state change.

### 6.9 Invoices

- List with invoice number, customer, issue date, due date, total, paid amount, balance and status/payment status.
- Filters for status, customer, date range and overdue state.
- Detail view shows seller/customer details, line items, tax/discount breakdown, totals, payments allocated and PDF/send actions.
- Confirm/cancel actions require permission and confirmation.
- Do not allow silent deletion of confirmed financial documents.

### 6.10 Payments

- List with payment reference, date, method, amount, related invoice/customer and note.
- Record-payment form validates positive amount, invoice eligibility, date and allowed allocation.
- Show allocated and unallocated amounts if that model is approved.
- Payment corrections/refunds must use an explicitly designed reversal/refund workflow; do not edit history invisibly.

### 6.11 Taxes and discounts

- Admin-only configuration screens.
- Tax list/editor includes name, rate/type, effective dates and applicable scope as approved.
- Discount editor includes fixed/percentage type, value, minimums, validity period, usage limit and target products/subscriptions.
- Show a rule summary and preview where useful.
- Explain why an expired, exhausted or ineligible rule cannot be applied.

### 6.12 Reports

- Summary cards and trend charts from reporting APIs.
- Date-range filters and any approved segmentation filters.
- Clearly distinguish cash received from billed revenue and outstanding balances.
- Export buttons are shown only when export functionality is implemented.
- Chart labels, units, period and empty states must be explicit.

### 6.13 Customer portal

- Overview of customer's own subscriptions and invoices.
- Subscription detail with dates, plan, items and allowed actions.
- Invoice detail and PDF access.
- No admin or staff navigation.
- All API queries are scoped server-side to the authenticated customer.

## 7. Shared components

Build and reuse the following where needed:

- `AppSidebar`, `MobileNav`, `Topbar`, `Breadcrumbs`, `PageHeader`.
- `DataTable`, `TableToolbar`, `SearchInput`, `FilterBar`, `Pagination`.
- `StatusBadge`, `CurrencyAmount`, `DateDisplay`, `EmptyState`, `ErrorState`, `LoadingSkeleton`.
- `FormField`, `FormError`, `ConfirmDialog`, `Alert`, `Toast`.
- `MetricCard`, `ChartContainer`.
- `ProtectedRoute` and role-aware navigation helpers.

Keep shared components generic. Feature-specific business rules should remain in the feature module.

## 8. Form and validation behaviour

- Use React Hook Form and Zod for client-side form state/schema validation.
- Mirror important constraints on the backend; backend validation is authoritative.
- Show errors next to the relevant field and a summary for multi-field/server errors.
- Preserve safe user input after recoverable server errors.
- Disable duplicate submission while a request is pending.
- Show a clear success confirmation after a saved change.
- Confirm irreversible or financially significant actions.
- Use numeric inputs with sensible min/step and display formatted currency separately from raw values.
- Never trust a frontend-computed total; display backend-calculated totals as authoritative.

## 9. Dynamic data and UI states

Business records and dashboard numbers must be fetched from API endpoints backed by PostgreSQL. Static JSON fixtures may be used for initial layout prototyping and automated tests only.

Every data-driven page must implement:

- Initial loading state.
- Empty state for no records.
- Error state with safe retry.
- Success state.
- Mutation pending state.
- Permission-denied state where applicable.
- Pagination/filter state when the dataset can grow.

After a successful mutation, invalidate/refetch the relevant TanStack Query keys. Do not make a UI look live by locally changing a number if the server has rejected or not persisted the operation.

## 10. Responsive behaviour

- Desktop: persistent sidebar and multi-column KPI/form layouts.
- Tablet: compact/collapsible navigation and reduced grid columns.
- Mobile: drawer navigation, single-column forms and cards, compact page headers, and scrollable or card-based record lists.
- Test at representative widths such as 375 px, 768 px and 1280 px; include keyboard-only navigation.
- Avoid horizontal page overflow. A data table may scroll within its own container when necessary.

## 11. Accessibility

- Use semantic buttons, links, headings, labels and table markup.
- Ensure all controls have accessible names.
- Provide visible keyboard focus and logical tab order.
- Do not rely on color alone for status or errors.
- Maintain adequate contrast and support browser zoom.
- Dialogs must manage focus and allow Escape/close where appropriate.
- Charts should provide a textual summary or accessible data alternative.

## 12. Frontend acceptance checklist

- [ ] Navigation and available actions match the approved role permissions.
- [ ] All business lists and dashboard values are API/database-backed.
- [ ] No prototype static JSON remains as production business data.
- [ ] Forms show clear client and server validation errors.
- [ ] Loading, empty, error and success states exist on data-driven pages.
- [ ] Mutations refresh affected server data.
- [ ] Financial amounts and dates are consistently formatted.
- [ ] High-impact actions use confirmation and provide outcome feedback.
- [ ] Core workflows function at desktop, tablet and mobile widths.
- [ ] Keyboard navigation and contrast have been checked.
- [ ] Customer portal API access is restricted to the signed-in customer.
