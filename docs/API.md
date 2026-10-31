# Brightloop Subscription Management System — REST API Reference

> **Base URL:** `/api/v1/`  
> **Interactive Swagger UI:** `/api/docs/`  
> **OpenAPI 3.0 Schema:** `/api/schema/`  
> **Authentication Header:** `Authorization: Bearer <access_token>`

---

## 1. Global Conventions

### 1.1 Pagination & Response Envelope
All paginated list endpoints return data wrapped in standard pagination metadata:

```json
{
  "pagination": {
    "count": 42,
    "next": "http://localhost:8000/api/v1/subscriptions/?page=2",
    "previous": null,
    "page": 1,
    "page_size": 20,
    "total_pages": 3
  },
  "data": [ ... ]
}
```

* Supported query parameters: `?page=1&page_size=20&search=...&ordering=-created_at`.

### 1.2 Error Responses
Errors follow a unified shape matching `docs/API.md`:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Please correct the highlighted fields.",
    "fields": {
      "password": ["Password must contain at least one special character."]
    },
    "request_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
  }
}
```

---

## 2. Endpoints by Domain

### 2.1 Authentication & Accounts (`/api/v1/auth/`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register/` | Public | Register customer account (email normalized, password complexity enforced). Returns user & initial JWT tokens. |
| `POST` | `/auth/login/` | Public | Authenticate with email/password; returns access & refresh tokens with user claims. |
| `POST` | `/auth/refresh/` | Public | Exchange refresh token for fresh access token. |
| `POST` | `/auth/logout/` | Authenticated | Blacklists refresh token. |
| `GET` | `/auth/me/` | Authenticated | Get current authenticated user profile. |
| `PATCH` | `/auth/me/` | Authenticated | Update user details (name, company). |
| `POST` | `/auth/password-reset/` | Public | Request password reset token via email. |
| `POST` | `/auth/password-reset/confirm/` | Public | Submit reset token with new password. |

### 2.2 Staff Management (`/api/v1/staff/`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/staff/` | **Admin only** | Paginated list of internal staff members. |
| `POST` | `/staff/` | **Admin only** | Create a staff account (`FR-AUTH-07`). |
| `GET` | `/staff/{id}/` | **Admin only** | Retrieve staff details. |
| `PATCH` | `/staff/{id}/` | **Admin only** | Update or deactivate staff member. |

### 2.3 Customers (`/api/v1/customers/`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/customers/` | Authenticated | List customers. Staff see all; customers see only their own. |
| `POST` | `/customers/` | Admin, Staff | Create a customer profile with billing address & tax ID. |
| `GET` | `/customers/{id}/` | Owner, Staff | Customer profile details. |
| `PATCH` | `/customers/{id}/` | Owner, Staff | Update billing address, contact name, or phone. |

### 2.4 Taxes & Discounts (`/api/v1/taxes/` & `/api/v1/discounts/`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/taxes/` | Authenticated | List all active tax rules. |
| `POST` | `/taxes/` | **Admin only** | Create tax rule (rate %, jurisdiction). |
| `PATCH` | `/taxes/{id}/` | **Admin only** | Update or deactivate tax rule. |
| `GET` | `/discounts/` | Authenticated | List discount rules with current redemption count. |
| `POST` | `/discounts/` | **Admin only** | Create discount rule (fixed or percentage, min qty/amount, max uses). |
| `PATCH` | `/discounts/{id}/` | **Admin only** | Update discount rule. |
| `POST` | `/discounts/{id}/deactivate/` | **Admin only** | Deactivate discount rule. |

### 2.5 Products & Variants (`/api/v1/products/`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/products/` | Authenticated | List products with nested variants and tax. |
| `POST` | `/products/` | **Admin only** | Create product (`sales_price`, `cost_price`, `product_type`). |
| `GET` | `/products/{id}/` | Authenticated | Retrieve product details. |
| `PATCH` | `/products/{id}/` | **Admin only** | Update product. |
| `POST` | `/products/{id}/variants/` | **Admin only** | Add variant (e.g. `attribute: "Brand"`, `value: "Odoo"`, `extra_price: 560.00`). |
| `PATCH` | `/products/{id}/variants/{v_id}/` | **Admin only** | Update variant. |

### 2.6 Subscription Plans (`/api/v1/plans/`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/plans/` | Authenticated | List plans (`daily`, `weekly`, `monthly`, `yearly`). |
| `POST` | `/plans/` | **Admin only** | Create plan with lifecycle configuration flags. |
| `GET` | `/plans/{id}/` | Authenticated | Retrieve plan details. |
| `PATCH` | `/plans/{id}/` | **Admin only** | Update plan configuration. |

### 2.7 Quotations & Templates (`/api/v1/quotations/`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/quotation-templates/` | Staff, Admin | List reusable quotation templates. |
| `POST` | `/quotation-templates/` | **Admin only** | Create quotation template. |
| `GET` | `/quotations/` | Staff, Admin, Owner | List quotations. |
| `POST` | `/quotations/` | Staff, Admin | Create new quotation. |
| `GET` | `/quotations/{id}/` | Owner, Staff | Quotation details with lines. |
| `POST` | `/quotations/{id}/confirm/` | Staff, Admin, Owner | **Confirm quote and convert to active Subscription!** |
| `POST` | `/quotations/{id}/cancel/` | Staff, Admin | Cancel quotation with reason. |

### 2.8 Subscriptions (`/api/v1/subscriptions/`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/subscriptions/` | Owner, Staff | List subscriptions. |
| `POST` | `/subscriptions/` | Staff, Admin | Create subscription directly. |
| `GET` | `/subscriptions/{id}/` | Owner, Staff | Subscription details and lines. |
| `POST` | `/subscriptions/{id}/pause/` | Owner, Staff | Pause active subscription. |
| `POST` | `/subscriptions/{id}/resume/` | Owner, Staff | Resume paused subscription. |
| `POST` | `/subscriptions/{id}/renew/` | Owner, Staff | Renew subscription term. |
| `POST` | `/subscriptions/{id}/close/` | Owner, Staff | Close subscription with mandatory reason. |

### 2.9 Invoices & Billing (`/api/v1/invoices/`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/invoices/` | Owner, Staff | List invoices (`?status=confirmed&overdue=true`). |
| `GET` | `/invoices/{id}/` | Owner, Staff | Invoice detail with lines and snapshot prices. |
| `POST` | `/invoices/{id}/confirm/` | Staff, Admin | Confirm draft invoice. |
| `POST` | `/invoices/{id}/cancel/` | Staff, Admin | Cancel invoice with reason. |
| `GET` | `/invoices/{id}/pdf/` | Owner, Staff | Download formatted invoice document. |

### 2.10 Payments & Allocations (`/api/v1/payments/`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/payments/` | Owner, Staff | List payments. |
| `POST` | `/payments/` | Staff, Admin | Record payment with multi-invoice allocations. Recalculates balance; sets status to `PAID` when settled. |
| `GET` | `/payments/{id}/` | Owner, Staff | Payment details and allocation map. |
| `POST` | `/payments/{id}/reverse/` | **Admin only** | Reverse payment; rolls back invoice balance and status to `CONFIRMED`. |

### 2.11 Reports & Analytics (`/api/v1/reports/`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/reports/dashboard/` | Staff, Admin | KPIs: Active Subscriptions, MRR, Invoiced, Collected, Unpaid, Overdue. |
| `GET` | `/reports/revenue/` | Staff, Admin | Total invoiced vs. collected. |
| `GET` | `/reports/subscriptions/` | Staff, Admin | Breakdown by plan and status. |
| `GET` | `/reports/invoices/` | Staff, Admin | Aging buckets (Current, 1-30, 31-60, 60+ days overdue). |
