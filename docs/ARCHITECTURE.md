# System Architecture

## 1. Architectural approach

Use a **modular monolith**: one Django backend application organized into business modules, one React frontend application, and one PostgreSQL database. Background tasks run in separate Celery worker processes but share the same application code and database.

This is intentionally simpler than microservices. It is suitable for the described business workflow and thousands of subscriptions, provided database access, indexing, pagination and scheduled jobs are designed carefully.

## 2. Selected technology stack

| Layer | Technology | Reason |
|---|---|---|
| Web UI | React + TypeScript | Component-based interactive interface with type checking |
| Build/dev server | Vite | Fast local development and static production build |
| Routing | React Router | Client-side routes and role-specific layouts |
| Styling/components | Tailwind CSS + shadcn/ui | Consistent responsive design with reusable accessible primitives |
| Forms | React Hook Form + Zod | Form state and client-side schema validation |
| API data | TanStack Query | Server-state fetching, caching, invalidation and loading/error states |
| Backend | Django + Django REST Framework | Mature ORM, migrations, authentication, permissions and API support |
| API authentication | Django authentication + JWT library | Authenticated REST requests; exact token transport to be finalized securely |
| Database | PostgreSQL | Relational integrity and transactional financial data |
| Background jobs | Celery | Asynchronous and scheduled work |
| Broker | Redis | Celery task transport and optional cache use |
| API schema | OpenAPI via drf-spectacular | Contract documentation and client integration |
| Tests | pytest, Django/DRF tests, Playwright | Unit, API, integration and browser coverage |

## 3. High-level system context

```text
                  Browser
                     |
             React + TypeScript
             Vite-built SPA
                     |
              HTTPS / REST API
                     |
          Django REST Framework
       +-------------+--------------+
       |             |              |
  Auth/Permissions  Domain       Reporting
       |           Services          |
       +-------------+--------------+
                     |
                PostgreSQL
                     |
             Transactional data

        Django / Celery task producer
                     |
                   Redis
                     |
                Celery Worker
                     |
       Billing, expiry, email, reports
                     |
              PostgreSQL / Email
```

PostgreSQL is the source of truth for business records. Redis is not the source of truth for invoices, payments, subscriptions or balances.

## 4. Frontend architecture

The frontend is a single-page application built with React and Vite. It has three role-specific navigation experiences but shares a design system, API client and common components.

### 4.1 Frontend responsibilities

- Render Admin, Staff and Customer interfaces.
- Collect and validate user input for usability.
- Call the versioned REST API.
- Show loading, empty, success and error states.
- Refresh affected server state after mutations.
- Hide navigation/actions the current role cannot use, while treating backend authorization as authoritative.

### 4.2 Frontend data rules

- Business data must come from API responses, not embedded JSON constants.
- Static demo data is permitted only for temporary prototyping, tests or component previews and must be removed/replaced before release.
- TanStack Query should own server state; local component state should be used for transient UI state such as an open dialog or unsaved input.
- Invalidate/refetch affected queries after successful create, update, payment or status-change operations.
- Use pagination and filters on the server for large collections.

### 4.3 Frontend directory guidance

```text
frontend/src/
├── app/                 # Providers, app initialization and route tree
├── components/          # Shared UI primitives and common widgets
├── features/            # Feature-specific screens, hooks and components
│   ├── auth/
│   ├── customers/
│   ├── products/
│   ├── plans/
│   ├── quotations/
│   ├── subscriptions/
│   ├── invoices/
│   ├── payments/
│   └── reports/
├── layouts/             # Admin, staff and customer shells
├── lib/                 # API client, query client and shared libraries
├── hooks/               # Cross-feature hooks
├── types/               # Shared TypeScript types
└── main.tsx
```

Keep code feature-oriented. Do not create a huge generic `services/` or `utils/` directory containing unrelated business logic.

## 5. Backend architecture

Django is organized into domain apps. Each app owns its models and the business operations associated with that domain. API views should remain thin: authenticate, validate/deserialize, call a service, and return a response.

### 5.1 Suggested backend modules

| Django app | Responsibility |
|---|---|
| `accounts` | Custom user model, role, authentication and staff membership |
| `customers` | Customer profile and customer-specific access |
| `products` | Products and variants |
| `plans` | Plans, pricing cadence and allowed lifecycle actions |
| `quotations` | Quotation templates, quotations and line items |
| `subscriptions` | Subscription lifecycle, dates and subscription items |
| `taxes` | Tax configuration and tax calculation support |
| `discounts` | Rules, eligibility and redemption records |
| `invoices` | Invoice documents, invoice lines and status |
| `payments` | Payment records, allocations and outstanding balances |
| `billing` | Due-cycle selection, invoice generation and recovery |
| `reports` | Aggregated business queries and dashboard endpoints |
| `audit` | Important actor/action/object history |

The final codebase may combine very small apps if that improves cohesion. Avoid splitting a module solely to increase folder count.

### 5.2 Backend layering

```text
HTTP Request
    -> URL/router
    -> DRF view / serializer
    -> Permission checks
    -> Domain service
    -> Django ORM / PostgreSQL
    -> Response serializer
    -> HTTP Response
```

Business rules such as invoice totals, discount eligibility, subscription transitions and payment allocation must live in tested domain services, not be duplicated in React or scattered across API views.

## 6. Data flow and important operations

### 6.1 Creating a subscription

1. Staff creates or selects a customer and quotation.
2. Backend validates plan availability, quantity, dates and permission.
3. Quotation lines are converted to subscription item snapshots.
4. A database transaction creates or links the subscription and updates the quotation state.
5. An audit event is written.
6. Frontend refreshes quotation and subscription queries.

### 6.2 Generating an invoice

1. Celery Beat schedules a billing run.
2. The billing task selects due subscriptions in bounded batches.
3. The billing service computes the intended billing period.
4. A database transaction locks or safely claims the relevant subscription/cycle.
5. It checks the unique billing-period key to prevent duplicates.
6. It snapshots subscription lines, applicable discounts and taxes into the invoice.
7. The invoice and billing-cycle record are committed together.
8. Email/PDF work can be queued after commit.
9. Failures are logged and retried safely; a retry must not create a second invoice.

### 6.3 Recording a payment

1. Staff submits invoice, amount, method, date and note.
2. Backend validates amount, invoice state and permission.
3. A transaction creates the payment and its allocation(s).
4. Allocated and outstanding balances are recalculated from persisted records.
5. Payment/invoice status is updated consistently.
6. An audit event is recorded.

## 7. Authentication and authorization

- Use a custom Django user model from the start so roles and future account requirements can evolve without replacing the user table.
- Roles: Admin, Staff and Customer.
- Use Django permissions and DRF permission classes for operation-level access.
- Enforce object-level rules for customer-owned records on every endpoint, including nested resources and downloads.
- Customers must be scoped to their own customer profile in querysets; do not rely on the frontend to filter data.
- Only Admin may create Staff accounts.
- Apply password validation from the requirements document on the backend. Frontend validation is supplementary.
- Use a maintained JWT implementation if JWT is selected. Prefer short-lived access tokens and a carefully secured refresh mechanism. Choose cookie versus authorization-header transport based on deployment topology and configure CORS/CSRF accordingly; do not store long-lived credentials in insecure browser storage.
- Rate-limit login and password-reset requests and avoid revealing whether an email address exists in reset responses.

## 8. Background jobs and reliability

Use Celery workers for tasks that should not block an HTTP response:

- Recurring invoice generation.
- Subscription expiry/auto-close checks.
- Renewal reminders if approved.
- Invoice email sending.
- PDF generation if it is expensive.
- Periodic reconciliation or report refresh if required.

Celery Beat schedules jobs. Redis carries tasks; PostgreSQL stores the durable business outcome. Every financial task must be retry-safe and idempotent. Use bounded batches, retry limits, backoff for transient failures, and logs containing job/cycle identifiers. Do not use Celery task state as proof that an invoice or payment exists; verify durable database records.

## 9. Email and PDF integrations

Wrap email and PDF generation behind small service interfaces so local and production implementations can be swapped.

- Local development: Django console email backend or a local mail catcher.
- Production: configured SMTP or an email provider.
- PDF: generate invoice PDFs from persisted invoice snapshots.
- Email failure must not roll back an already committed invoice; queue/retry delivery separately and expose delivery status where useful.

## 10. Security, audit and data protection

- Use HTTPS in production and secure deployment settings.
- Keep secrets in environment variables or a secrets manager; never commit them.
- Validate and authorize all writes on the backend.
- Protect against IDOR by enforcing object-level querysets and permissions.
- Use Django ORM parameterization; avoid constructing raw SQL from user input.
- Record who performed sensitive actions such as discount creation, invoice cancellation, payment recording and subscription closure.
- Do not hard-delete finalized invoices or payments. Use cancellation/reversal records and audit history.
- Limit access to logs and avoid logging passwords, tokens or unnecessary personal/financial information.
- Back up PostgreSQL and test restoration before production use.

## 11. Performance and scaling

The stated requirement is page response under two seconds with thousands of subscriptions. The team must define test conditions before acceptance.

Initial strategies:

- Server-side pagination, filtering and sorting.
- Index foreign keys, unique business identifiers, status/date filters and billing-cycle lookup fields.
- Use `select_related`/`prefetch_related` to avoid N+1 queries.
- Aggregate report metrics in the database rather than loading full tables into Python/browser memory.
- Process billing in batches and use row locking or unique constraints to coordinate concurrent workers.
- Add caching only after measuring a bottleneck; cache is not the source of truth.

## 12. Local development and deployment

### Local-first development

A developer should be able to run React, Django, PostgreSQL and Redis locally. Docker Compose may be used for PostgreSQL/Redis and optionally the backend. Do not require a hosted database or paid service to run the basic project locally.

### Initial deployment shape

- Frontend: static Vite build hosted on a static web host.
- Backend: Django application on an application host.
- Database: managed or self-hosted PostgreSQL.
- Redis: managed or self-hosted Redis.
- Worker: separate Celery worker process.
- Scheduler: Celery Beat process with one active scheduler instance.
- File storage: local in development; durable object storage in production if user-uploaded files or generated PDFs require it.

Specific providers are deployment choices, not architectural dependencies. Vercel/Render may be used, but the application should not depend on proprietary features to implement its core business rules.

## 13. Observability and operations

At minimum, log application errors and background task failures with timestamps, task identifiers and relevant record identifiers. Provide health checks for the web process and dependencies. Monitor database availability, worker queue failures and scheduled billing runs. Maintain backups and a documented restore procedure.

## 14. Explicit non-goals for the initial architecture

- Microservices.
- Kubernetes.
- Kafka/event streaming platform.
- WebSockets unless a concrete live-update requirement emerges.
- A separate search cluster.
- Mandatory online payment gateway.
- Full offline operation for end users.
