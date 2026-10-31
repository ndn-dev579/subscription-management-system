from datetime import date, timedelta
from decimal import Decimal
import pytest
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User, Role
from apps.customers.models import CustomerProfile
from apps.taxes.models import TaxRule
from apps.products.models import Product, ProductVariant
from apps.plans.models import Plan, BillingInterval
from apps.quotations.models import Quotation, QuotationStatus
from apps.subscriptions.models import Subscription, SubscriptionStatus
from apps.invoices.models import Invoice, InvoiceStatus
from apps.billing.services import generate_invoice_for_subscription

@pytest.fixture
def client():
    return APIClient()

@pytest.fixture
def admin_user():
    return User.objects.create_superuser(
        email='admin_billing@brightloop.io',
        password='AdminPassword123!',
        name='Admin Billing',
    )

@pytest.fixture
def staff_user():
    return User.objects.create_user(
        email='staff_billing@brightloop.io',
        password='StaffPassword123!',
        name='Staff Billing',
        role=Role.STAFF,
    )

@pytest.fixture
def customer_user():
    return User.objects.create_user(
        email='customer_billing@brightloop.io',
        password='CustomerPassword123!',
        name='Customer Billing',
        company='Global Tech Labs',
        role=Role.CUSTOMER,
    )

@pytest.mark.django_db
class TestCompleteBillingWorkflow:
    def test_full_quote_to_payment_and_reporting_cycle(self, client, admin_user, staff_user, customer_user):
        customer = CustomerProfile.objects.get(user=customer_user)
        tax = TaxRule.objects.create(name='GST 18%', rate=Decimal('18.00'))
        product = Product.objects.create(
            name='Cloud Storage Addon',
            sales_price=Decimal('500.00'),
            tax=tax,
        )
        plan = Plan.objects.create(
            name='Pro Monthly',
            price=Decimal('1000.00'),
            billing_interval=BillingInterval.MONTHLY,
            allow_pause=True,
            allow_renewal=True,
            tax=tax,
        )

        client.force_authenticate(user=staff_user)

        # 1. Create Quotation
        today = date.today()
        quote_payload = {
            'customer': str(customer.id),
            'plan': str(plan.id),
            'start_date': str(today),
            'expiry_date': str(today + timedelta(days=365)),
            'valid_until': str(today + timedelta(days=30)),
            'payment_terms': 'net30',
            'lines': [
                {
                    'product': str(product.id),
                    'qty': 2,
                    'unit_price': '500.00',
                    'tax': str(tax.id),
                }
            ],
        }
        quote_res = client.post('/api/v1/quotations/', quote_payload, format='json')
        assert quote_res.status_code == status.HTTP_201_CREATED
        quote_id = quote_res.data['id']

        # 2. Confirm Quotation -> Converts to Subscription
        confirm_res = client.post(f'/api/v1/quotations/{quote_id}/confirm/')
        assert confirm_res.status_code == status.HTTP_200_OK
        sub_id = confirm_res.data['subscription_id']
        sub = Subscription.objects.get(id=sub_id)
        assert sub.status == SubscriptionStatus.ACTIVE
        assert sub.lines.count() == 1

        # 3. Test Subscription Pause and Resume
        pause_res = client.post(f'/api/v1/subscriptions/{sub_id}/pause/')
        assert pause_res.status_code == status.HTTP_200_OK
        sub.refresh_from_db()
        assert sub.status == SubscriptionStatus.PAUSED

        resume_res = client.post(f'/api/v1/subscriptions/{sub_id}/resume/')
        assert resume_res.status_code == status.HTTP_200_OK
        sub.refresh_from_db()
        assert sub.status == SubscriptionStatus.ACTIVE

        # 4. Generate Recurring Billing Invoice & Verify Idempotency (NFR-DATA-01)
        invoice1 = generate_invoice_for_subscription(sub, as_of_date=today)
        assert invoice1.status == InvoiceStatus.CONFIRMED
        # Subtotal: Plan (1000) + 2x Products (1000) = 2000. Tax: 18% of 2000 = 360. Total = 2360
        assert invoice1.total_amount == Decimal('2360.00')
        assert invoice1.outstanding_amount == Decimal('2360.00')

        # Idempotency check: Calling again produces same invoice, no duplicates!
        invoice2 = generate_invoice_for_subscription(sub, as_of_date=today)
        assert invoice1.id == invoice2.id
        assert Invoice.objects.filter(subscription=sub).count() == 1

        # 5. Record Payment & Verify Balance Recalculation
        pay_payload = {
            'customer': str(customer.id),
            'amount': '2360.00',
            'method': 'BANK_TRANSFER',
            'payment_date': str(today),
            'transaction_reference': 'TXN-998877',
            'allocations': [
                {
                    'invoice': str(invoice1.id),
                    'amount': '2360.00',
                }
            ],
        }
        pay_res = client.post('/api/v1/payments/', pay_payload, format='json')
        assert pay_res.status_code == status.HTTP_201_CREATED
        payment_id = pay_res.data['id']

        invoice1.refresh_from_db()
        assert invoice1.paid_amount == Decimal('2360.00')
        assert invoice1.outstanding_amount == Decimal('0.00')
        assert invoice1.status == InvoiceStatus.PAID

        # 6. Test Reports API
        dash_res = client.get('/api/v1/reports/dashboard/')
        assert dash_res.status_code == status.HTTP_200_OK
        assert dash_res.data['active_subscriptions'] >= 1
        assert Decimal(dash_res.data['collected_total']) >= Decimal('2360.00')

        # 7. Test Admin Reversal of Payment
        client.force_authenticate(user=admin_user)
        rev_res = client.post(f'/api/v1/payments/{payment_id}/reverse/', {'reason': 'Bank chargeback'}, format='json')
        assert rev_res.status_code == status.HTTP_200_OK
        invoice1.refresh_from_db()
        assert invoice1.status == InvoiceStatus.CONFIRMED
        assert invoice1.outstanding_amount == Decimal('2360.00')

