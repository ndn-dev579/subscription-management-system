# REST API Specification

## 1. API conventions

- Base path: `/api/v1/`
- Style: JSON REST API using Django REST Framework.
- Authentication: JWT or another approved secure Django-supported mechanism.
- Resource identifiers: UUIDs are recommended for public API identifiers.
- Dates: ISO 8601. API timestamps should include timezone information; persist timestamps in UTC.
- Money: return decimal amounts as strings to avoid JSON floating-point ambiguity, with an explicit currency code.
- Pagination: server-side pagination for list endpoints.
- Filtering, sorting and search: implemented on the server and allowlisted per resource.
- Versioning: breaking contract changes require a versioning decision rather than silently changing existing clients.

The endpoint list is a contract proposal. Implement only endpoints needed by the approved requirements, and keep the OpenAPI schema synchronized with the code.

## 2. Authentication

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| POST | `/auth/register/` | Register customer account | Public |
| POST | `/auth/login/` | Authenticate | Public |
| POST | `/auth/refresh/` | Refresh access token, if JWT is used | Authenticated refresh credential |
| POST | `/auth/logout/` | Logout/revoke refresh token, if supported | Authenticated |
| POST | `/auth/password-reset/` | Request reset email | Public, rate-limited |
| POST | `/auth/password-reset/confirm/` | Confirm reset token and new password | Public, token-validated |
| GET | `/auth/me/` | Current user and role | Authenticated |

Login and reset responses must not disclose unnecessary account-existence information. Validate password rules on the server.

## 3. Role and access model

| Resource/action | Admin | Staff | Customer |
|---|---:|---:|---:|
| Create staff account | Yes | No | No |
| Manage products/plans | Yes | Only if explicitly granted | No |
| Configure taxes/discount rules | Yes | No by default | No |
| View/manage all customers | Yes | Based on assigned permissions | No |
| Create quotations | Yes | Yes, if permitted | No by default |
| Manage subscriptions | Yes | Based on permission | Own records and approved portal actions only |
| Confirm/cancel invoices | Yes | Based on permission | No |
| Record payments | Yes | Based on permission | Online payment only if gateway feature is approved |
| View reports | Yes | Based on permission | No |
| View own subscriptions/invoices | Yes | Yes, if permitted | Own records only |

The backend must enforce both action-level and object-level access. Customer querysets must be scoped to the authenticated customer's profile. A hidden button is not an authorization control.

## 4. Standard response and error formats

### 4.1 Successful response

For a single resource:

```json
{
  "data": {
    "id": "uuid",
    "name": "Example"
  }
}
```

For a list (illustrative pagination shape):

```json
{
  "data": [
    { "id": "uuid", "name": "Example" }
  ],
  "pagination": {
    "count": 1,
    "next": null,
    "previous": null,
    "page": 1,
    "page_size": 20
  }
}
```

The exact envelope may follow DRF's configured pagination format, but it must be consistent and documented.

### 4.2 Error response

```json
{
  "error": {
    "code": "validation_error",
    "message": "Please correct the highlighted fields.",
    "fields": {
      "quantity": ["Ensure this value is greater than zero."]
    },
    "request_id": "correlation-id"
  }
}
```

Use appropriate HTTP status codes: `400` validation, `401` unauthenticated, `403` forbidden, `404` not found, `409` conflicting state, `429` rate limited and `5xx` unexpected server errors. Do not expose stack traces or secrets.

## 5. Resource endpoints

### 5.1 Customers

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/customers/` | Search/filter/paginate customers |
| POST | `/customers/` | Create customer profile |
| GET | `/customers/{id}/` | Customer details |
| PATCH | `/customers/{id}/` | Update permitted fields |

### 5.2 Staff

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/staff/` | List staff (Admin) |
| POST | `/staff/` | Create staff account (Admin only) |
| GET | `/staff/{id}/` | Staff details |
| PATCH | `/staff/{id}/` | Update/deactivate if supported |

### 5.3 Products and variants

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/products/` | List/search products |
| POST | `/products/` | Create product (Admin) |
| GET | `/products/{id}/` | Product details and variants |
| PATCH | `/products/{id}/` | Update product |
| POST | `/products/{id}/variants/` | Add variant |
| PATCH | `/products/{id}/variants/{variant_id}/` | Update variant |

### 5.4 Plans

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/plans/` | List/filter plans |
| POST | `/plans/` | Create plan (Admin) |
| GET | `/plans/{id}/` | Plan details |
| PATCH | `/plans/{id}/` | Update plan |

### 5.5 Quotation templates and quotations

| Method | Endpoint | Purpose |
|---|---|---|
| GET/POST | `/quotation-templates/` | List/create templates |
| GET/PATCH | `/quotation-templates/{id}/` | View/update template |
| GET/POST | `/quotations/` | List/create quotations |
| GET/PATCH | `/quotations/{id}/` | View/update quotation |
| POST | `/quotations/{id}/send/` | Send quotation if email configured |
| POST | `/quotations/{id}/confirm/` | Confirm/convert under approved workflow |
| POST | `/quotations/{id}/cancel/` | Cancel with reason if allowed |

### 5.6 Subscriptions

| Method | Endpoint | Purpose |
|---|---|---|
| GET/POST | `/subscriptions/` | List/create subscriptions |
| GET/PATCH | `/subscriptions/{id}/` | View/update permitted fields |
| POST | `/subscriptions/{id}/pause/` | Pause if allowed by plan/state |
| POST | `/subscriptions/{id}/resume/` | Resume if allowed |
| POST | `/subscriptions/{id}/renew/` | Renew if allowed |
| POST | `/subscriptions/{id}/close/` | Close with required reason/policy |
| GET | `/subscriptions/{id}/billing-history/` | Related billing cycles/invoices |

State-changing actions should be explicit endpoints or controlled actions. Reject invalid transitions with `409 Conflict` and a meaningful code/message.

### 5.7 Invoices

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/invoices/` | List/filter invoices |
| GET | `/invoices/{id}/` | Invoice detail |
| POST | `/invoices/{id}/confirm/` | Confirm draft invoice |
| POST | `/invoices/{id}/cancel/` | Cancel invoice with reason |
| POST | `/invoices/{id}/send/` | Queue invoice email |
| GET | `/invoices/{id}/pdf/` | Download/render invoice PDF |

Invoice creation from subscriptions is normally performed by the billing service. A manual generation endpoint should exist only if an authorized operational use case is defined and it must use the same idempotent billing service.

### 5.8 Taxes and discounts

| Method | Endpoint | Purpose |
|---|---|---|
| GET/POST | `/taxes/` | List/create tax rules (Admin) |
| GET/PATCH | `/taxes/{id}/` | View/update tax rule |
| GET/POST | `/discounts/` | List/create discount rules (Admin for create) |
| GET/PATCH | `/discounts/{id}/` | View/update discount rule |
| POST | `/discounts/{id}/deactivate/` | Deactivate rule if supported |

Do not allow frontend clients to submit a trusted discount total or tax total as authoritative. Backend calculates and returns them.

### 5.9 Payments

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/payments/` | List/filter payment records |
| POST | `/payments/` | Record payment and allocation(s) |
| GET | `/payments/{id}/` | Payment detail |
| POST | `/payments/{id}/reverse/` | Reverse/correct payment only if approved workflow exists |

### 5.10 Reports

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/reports/dashboard/` | Dashboard KPIs and recent activity |
| GET | `/reports/revenue/` | Revenue report by period/filters |
| GET | `/reports/subscriptions/` | Subscription report |
| GET | `/reports/invoices/` | Invoice/outstanding/overdue report |

Report definitions must state what “revenue” means. Cash collected, invoiced value and recognized revenue are not interchangeable.

## 6. Request examples

### 6.1 Record a payment (illustrative)

```json
{
  "invoice_id": "invoice-uuid",
  "amount": "1500.00",
  "currency": "INR",
  "method": "BANK_TRANSFER",
  "payment_date": "2026-10-31",
  "note": "October payment",
  "allocations": [
    { "invoice_id": "invoice-uuid", "amount": "1500.00" }
  ]
}
```

The backend must verify that the payment amount and allocations are valid. Do not trust a client-calculated outstanding balance.

### 6.2 Filter a list

```text
GET /api/v1/invoices/?status=CONFIRMED&overdue=true&page=1&page_size=20&ordering=-due_date
```

Only documented/allowlisted fields may be used for filtering and ordering.

## 7. Validation and business-rule enforcement

- Validate input in serializers and domain services.
- Check referenced objects exist and are accessible to the requesting user.
- Validate state transitions and plan-specific lifecycle permissions.
- Use transactions for multi-record operations.
- Use database constraints as the final guard for uniqueness and critical invariants.
- Return field errors in a consistent format.
- Normalize emails and validate uniqueness case-insensitively.
- Validate money and quantity using decimal/integer types.
- Never accept invoice totals, discount amounts or tax calculations from the client as authoritative.

## 8. Idempotency and concurrency

For billing generation and other retry-prone operations:

- Use the unique billing-cycle key `(subscription_id, period_start, period_end)` in PostgreSQL.
- Make the service safe if called multiple times.
- Where a client may retry a payment or other financial POST, consider an idempotency key stored with the operation.
- Use database transactions and row locking/unique constraints for concurrent requests.
- A duplicate request should return the existing result or a clear conflict, not create duplicate financial records.

## 9. API documentation and testing

- Generate an OpenAPI schema from DRF serializers/views.
- Keep endpoint permissions and examples up to date.
- Test success, invalid payload, unauthenticated, forbidden and cross-customer access cases.
- Test pagination/filtering and concurrent/idempotent financial operations.
- Do not treat API documentation as a substitute for automated tests.

## 10. Open API decisions

1. Final JWT transport and refresh strategy.
2. Exact list response envelope and pagination convention.
3. Which staff actions are enabled by default.
4. Quotation send/confirm workflow and customer acceptance mechanism.
5. Customer-initiated subscription actions.
6. Partial payments, allocations and reversals.
7. Report definitions and export formats.
8. Whether any customer-facing APIs require online payment gateway integration.
