import pytest
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, Role
from apps.taxes.models import TaxRule
from apps.products.models import Product, ProductVariant
from apps.plans.models import Plan, BillingInterval
from apps.discounts.models import DiscountRule, DiscountType
from apps.customers.models import CustomerProfile

@pytest.fixture
def client():
    return APIClient()

@pytest.fixture
def admin_user():
    return User.objects.create_superuser(
        email='admin_domain@brightloop.io',
        password='AdminPassword123!',
        name='Admin Domain',
    )

@pytest.fixture
def staff_user():
    return User.objects.create_user(
        email='staff_domain@brightloop.io',
        password='StaffPassword123!',
        name='Staff Domain',
        role=Role.STAFF,
    )

@pytest.fixture
def customer_user():
    return User.objects.create_user(
        email='customer_domain@brightloop.io',
        password='CustomerPassword123!',
        name='Customer Domain',
        company='Acme Enterprises',
        role=Role.CUSTOMER,
    )

@pytest.mark.django_db
class TestCoreDomainModels:
    def test_customer_profile_auto_created(self, customer_user):
        profile = CustomerProfile.objects.get(user=customer_user)
        assert profile.company_name == 'Acme Enterprises'
        assert profile.customer_number.startswith('CUST-')

    def test_tax_creation_and_access(self, client, admin_user, staff_user):
        client.force_authenticate(user=admin_user)
        res = client.post('/api/v1/taxes/', {'name': 'GST 18%', 'rate': '18.00'}, format='json')
        assert res.status_code == status.HTTP_201_CREATED

        # Staff can view taxes
        client.force_authenticate(user=staff_user)
        list_res = client.get('/api/v1/taxes/')
        assert list_res.status_code == status.HTTP_200_OK
        assert len(list_res.data['data']) >= 1

        # Staff cannot create tax
        staff_create = client.post('/api/v1/taxes/', {'name': 'VAT 5%', 'rate': '5.00'}, format='json')
        assert staff_create.status_code == status.HTTP_403_FORBIDDEN

    def test_product_and_variant_creation(self, client, admin_user):
        client.force_authenticate(user=admin_user)
        prod_res = client.post(
            '/api/v1/products/',
            {
                'name': 'Brightloop ERP Core',
                'product_type': 'Software',
                'sales_price': '1000.00',
                'cost_price': '200.00',
            },
            format='json',
        )
        assert prod_res.status_code == status.HTTP_201_CREATED
        product_id = prod_res.data['id']

        # Add Odoo Brand variant (+560 extra price per requirements FR-PROD-04)
        var_res = client.post(
            f'/api/v1/products/{product_id}/variants/',
            {
                'attribute': 'Brand',
                'value': 'Odoo',
                'extra_price': '560.00',
            },
            format='json',
        )
        assert var_res.status_code == status.HTTP_201_CREATED
        assert var_res.data['extra_price'] == '560.00'

    def test_plan_creation_with_lifecycle_options(self, client, admin_user):
        client.force_authenticate(user=admin_user)
        payload = {
            'name': 'Enterprise Yearly',
            'price': '12000.00',
            'currency': 'INR',
            'billing_interval': 'yearly',
            'minimum_quantity': 5,
            'allow_pause': True,
            'allow_renewal': True,
            'allow_early_close': False,
        }
        res = client.post('/api/v1/plans/', payload, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data['minimum_quantity'] == 5
        assert res.data['billing_interval'] == 'yearly'

    def test_discount_rule_lifecycle(self, client, admin_user):
        client.force_authenticate(user=admin_user)
        payload = {
            'name': 'New Year 10%',
            'discount_type': 'percent',
            'value': '10.00',
            'max_uses': 100,
        }
        res = client.post('/api/v1/discounts/', payload, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        discount_id = res.data['id']

        # Deactivate
        deact_res = client.post(f'/api/v1/discounts/{discount_id}/deactivate/')
        assert deact_res.status_code == status.HTTP_200_OK
        rule = DiscountRule.objects.get(id=discount_id)
        assert rule.is_active is False
        assert rule.is_available is False

