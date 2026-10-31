# Brightloop Subscription Management System

A web application for managing products, subscription plans, quotations, recurring billing, invoices, payments and subscription revenue in one place.

> **Project source of truth:** `Subscription_Management_System.pdf`. This README explains the project and how to work on it. Detailed requirements and design decisions are maintained in the documents under `docs/`.

## Documentation

| Document | Purpose |
|---|---|
| [Requirements](docs/REQUIREMENTS.md) | Functional and non-functional requirements, roles and acceptance criteria |
| [Architecture](docs/ARCHITECTURE.md) | Application structure, technology choices, security and background processing |
| [Frontend design](docs/FRONTEND_DESIGN.md) | Screens, navigation, design system and interaction requirements |
| [Database design](docs/DATABASE.md) | Entities, relationships, constraints and data integrity |
| [API specification](docs/API.md) | REST endpoints, permissions, payload conventions and errors |
| [Billing rules](docs/BILLING_RULES.md) | Recurring billing, renewals, invoices, discounts and payment rules |

## Product scope

The system has three user roles:

- **Admin:** manages staff, customers, products, variants, plans, taxes, discounts and system-wide operations.
- **Staff:** performs permitted day-to-day customer, quotation, subscription, invoice and payment operations.
- **Customer:** accesses only their own account, subscriptions and invoices through the customer portal.

The application should replace spreadsheet-based subscription tracking, manually prepared invoices, informal renewal reminders and manual revenue reporting.

## Technology stack

| Layer | Selected technology | Responsibility |
|---|---|---|
| Frontend | React + TypeScript + Vite | Single-page web application |
| Routing | React Router | Client-side navigation and protected route groups |
| UI | Tailwind CSS + shadcn/ui | Consistent responsive interface |
| Forms | React Hook Form + Zod | Client-side form state and validation |
| Data fetching | TanStack Query | API requests, caching and refreshing server data |
| Backend | Python + Django + Django REST Framework | Business logic, REST APIs, authentication and permissions |
| Authentication | Django authentication + JWT (for example, SimpleJWT) | Login and token-based API access |
| Database | PostgreSQL | Persistent relational business data |
| Background work | Celery + Redis | Scheduled billing and asynchronous tasks |
| API documentation | drf-spectacular / OpenAPI | Discoverable API specification |
| Testing | pytest, Django test tools, Playwright | Backend, API and browser-level tests |
| Local environment | Python virtual environment, Node.js, Docker Compose (optional) | Repeatable local development |

Use a technology only when it solves a project requirement. Do not introduce microservices, Kubernetes, Kafka or a separate frontend server-rendering framework for the initial application.

## Prerequisites

Install the following on a development machine:

- Git
- Python version selected by the team and pinned in the backend project (Python 3.12 is a reasonable initial target; verify library compatibility before pinning)
- Node.js LTS and npm
- PostgreSQL, either installed locally or run through Docker
- Redis, either installed locally or run through Docker, for Celery-backed tasks

Docker is optional for the application itself, but recommended for running local PostgreSQL and Redis consistently across team members.

## Repository layout

```text
subscription-management-system/
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml                 # Add when local container setup is implemented
├── docs/
│   ├── REQUIREMENTS.md
│   ├── ARCHITECTURE.md
│   ├── FRONTEND_DESIGN.md
│   ├── DATABASE.md
│   ├── API.md
│   └── BILLING_RULES.md
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/                        # App providers and route setup
│   │   ├── components/                 # Shared UI components
│   │   ├── features/                   # Feature-oriented screens and logic
│   │   ├── layouts/                    # Admin, staff and customer layouts
│   │   ├── lib/                        # API client and shared libraries
│   │   ├── hooks/
│   │   ├── types/
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
└── backend/
    ├── config/                         # Django project settings and URL config
    ├── apps/                           # Django feature apps
    ├── common/                         # Shared utilities and permissions
    ├── integrations/                   # Email and PDF adapters
    ├── manage.py
    └── requirements.txt
```

The layout is a target structure. Create modules when they are needed; do not generate empty folders and files just to match the tree.

## Local development setup

The commands below are a starting point. Update them to match the exact package versions and scripts committed by the team.

### 1. Clone the repository

```bash
git clone <repository-url>
cd subscription-management-system
```

### 2. Configure environment variables

Copy `.env.example` to the appropriate local environment files. Never commit `.env` files, credentials, JWT secrets, database passwords or email API keys.

Typical backend settings include:

```dotenv
DJANGO_SECRET_KEY=replace-for-local-development
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgresql://app:app@localhost:5432/subscription_management
REDIS_URL=redis://localhost:6379/0
CORS_ALLOWED_ORIGINS=http://localhost:5173
DEFAULT_CURRENCY=INR
TIME_ZONE=Asia/Kolkata
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

These are example local values, not production secrets. Validate the final environment variable names against the implemented Django settings.

### 3. Start local services

Start PostgreSQL and Redis using local installations or the team's Docker Compose configuration. If Docker Compose is used, keep the configuration in the repository and document the exact command here.

### 4. Start the backend

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### 5. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite normally serves the development frontend at `http://localhost:5173`. Confirm the actual address in the terminal output.

### 6. Start background processing

When Celery tasks are implemented, run a worker and scheduler in separate terminals:

```bash
# From backend, with the virtual environment active
celery -A config worker -l info
celery -A config beat -l info
```

The Celery application import path may be adjusted to match the final Django project package.

## Dynamic data requirement

Production screens must obtain business data from the Django REST API backed by PostgreSQL. Do not use hardcoded JSON arrays as the source for customers, products, plans, subscriptions, invoices, payments or dashboard metrics. Static fixtures are acceptable for tests, Storybook-style component previews or early UI prototyping only. Replace prototype fixtures with API integration before considering a feature complete.

After a create, update, payment or status-change operation, the UI should refresh or invalidate the affected server data so that the user sees the saved state. Use polling or push updates only where there is a clear need; WebSockets are not required for the initial version.

## Git and team workflow

Version control is a shared responsibility. One person may administer repository settings, but every contributor must use Git and contribute through their own branch and commits.

1. Protect `main`; do not commit directly to it.
2. Create a branch for each task, for example `feat/subscription-list`, `fix/invoice-rounding` or `docs/api-spec`.
3. Assign work through repository issues or an agreed task board.
4. Commit small, meaningful changes with clear messages.
5. Push branches and open pull requests.
6. Require at least one teammate review before merging where team size permits.
7. Run relevant tests and checks before merging.
8. Resolve conflicts and update the branch before merge.
9. Keep `.env`, secrets, local databases, generated files and dependency caches out of Git.
10. Review AI-generated code, understand it, adapt it to the project and test it. Do not merge code that the contributor cannot explain.

Suggested commit prefixes: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.

## Quality checks

At minimum, the team should automate or document:

- Backend formatting, linting and tests.
- Frontend linting, type checking and production build.
- API permission and validation tests.
- Billing calculations, duplicate-invoice and payment-allocation tests.
- Browser tests for critical user journeys.
- Manual responsive checks at desktop, tablet and mobile widths.

The application requirement is that pages respond in under two seconds under the agreed test conditions. Define realistic data volume, hardware/environment and percentile measurement before claiming this target has been met.

## Local-first development and offline considerations

Core development must be possible without depending on a hosted database or paid cloud service. Provide local PostgreSQL and Redis options and use Django's console email backend during development. External email delivery and online payment gateways should be adapters that can be configured later. The application itself requires a running backend and database to use live business data; full offline customer operations are not part of the initial scope unless separately approved.

## Important decisions to confirm

See the **Open decisions** sections in `REQUIREMENTS.md` and `BILLING_RULES.md`. Do not infer final rules for proration, payment gateway integration, partial payments, plan changes, tax-inclusive prices, refund workflows or currency support without agreement from the product owner.
