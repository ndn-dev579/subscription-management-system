import uuid
from decimal import Decimal
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.accounts.models import Role
from apps.customers.models import CustomerProfile
from apps.taxes.models import TaxRule
from apps.products.models import Product, ProductVariant
from apps.plans.models import Plan, BillingInterval
from apps.discounts.models import DiscountRule, DiscountType
from apps.quotations.models import QuotationTemplate, QuotationTemplateLine, Quotation, QuotationLine, QuotationStatus
from apps.subscriptions.models import Subscription, SubscriptionLine, SubscriptionStatus
from apps.invoices.models import Invoice, InvoiceLine, InvoiceStatus
from apps.payments.models import Payment, PaymentAllocation

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds complete demonstration data into the database for Brightloop Subscription Management System'

    def handle(self, *args, **options):
        self.stdout.write("Seeding Brightloop database with comprehensive demo data...")
        today = timezone.now().date()

        # -------------------------------------------------------------
        # 1. Staff and Admin Users
        # -------------------------------------------------------------
        admin, _ = User.objects.get_or_create(
            email='admin@brightloop.com',
            defaults={
                'name': 'Asha Menon',
                'company': 'Brightloop Software Pvt Ltd',
                'role': Role.ADMIN,
                'is_staff': True,
                'is_superuser': True,
            }
        )
        admin.set_password('Admin@1234')
        admin.save()

        staff, _ = User.objects.get_or_create(
            email='staff@brightloop.com',
            defaults={
                'name': 'Ravi Nair',
                'company': 'Brightloop Software Pvt Ltd',
                'role': Role.STAFF,
                'is_staff': True,
            }
        )
        staff.set_password('Staff@1234')
        staff.save()

        # -------------------------------------------------------------
        # 2. Customers
        # -------------------------------------------------------------
        customer_definitions = [
            {
                'email': 'customer@brightloop.com',
                'password': 'Customer@1234',
                'name': 'Priya Kurian',
                'company': 'Acme Traders',
                'number': 'CUST-0001',
                'phone': '+91 98450 11223',
                'address': 'Plot 42, Electronics City, Bengaluru 560100',
                'tax_id': '29ABCDE1234F1Z5',
            },
            {
                'email': 'joseph@greenmart.in',
                'password': 'Customer@1234',
                'name': 'Joseph Thomas',
                'company': 'GreenMart Retail',
                'number': 'CUST-0002',
                'phone': '+91 98451 22334',
                'address': '12 Marine Drive, Kochi, Kerala 682011',
                'tax_id': '32AABCG6789K1Z2',
            },
            {
                'email': 'meera@northwind.in',
                'password': 'Customer@1234',
                'name': 'Meera Das',
                'company': 'Northwind Logistics',
                'number': 'CUST-0003',
                'phone': '+91 98452 33445',
                'address': 'Ring Road Warehouse Complex, Pune 411028',
                'tax_id': '27AABCN4567M1Z8',
            },
            {
                'email': 'arun@coastalfoods.in',
                'password': 'Customer@1234',
                'name': 'Arun Pillai',
                'company': 'Coastal Foods',
                'number': 'CUST-0004',
                'phone': '+91 98453 44556',
                'address': 'Port Road, Mangaluru 575001',
                'tax_id': '29AAACC1122H1Z1',
            },
        ]

        customer_profiles = []
        for cdef in customer_definitions:
            u, _ = User.objects.get_or_create(
                email=cdef['email'],
                defaults={
                    'name': cdef['name'],
                    'company': cdef['company'],
                    'role': Role.CUSTOMER,
                }
            )
            u.set_password(cdef['password'])
            u.save()

            cp = CustomerProfile.objects.filter(user=u).first()
            if not cp:
                cp = CustomerProfile.objects.create(
                    user=u,
                    customer_number=cdef['number'],
                    company_name=cdef['company'],
                    contact_name=cdef['name'],
                    billing_email=cdef['email'],
                    phone=cdef['phone'],
                    billing_address=cdef['address'],
                    tax_identifier=cdef['tax_id'],
                )
            else:
                cp.company_name = cdef['company']
                cp.contact_name = cdef['name']
                cp.phone = cdef['phone']
                cp.billing_address = cdef['address']
                cp.tax_identifier = cdef['tax_id']
                cp.save()
            customer_profiles.append(cp)

        c1, c2, c3, c4 = customer_profiles

        # -------------------------------------------------------------
        # 3. Tax Rules
        # -------------------------------------------------------------
        t_gst18, _ = TaxRule.objects.get_or_create(
            name='GST 18%',
            defaults={'rate': Decimal('18.00'), 'jurisdiction': 'IN'}
        )
        t_gst5, _ = TaxRule.objects.get_or_create(
            name='GST 5%',
            defaults={'rate': Decimal('5.00'), 'jurisdiction': 'IN'}
        )

        # -------------------------------------------------------------
        # 4. Products & Variants
        # -------------------------------------------------------------
        p_crm, _ = Product.objects.get_or_create(
            name='Brightloop CRM',
            defaults={
                'product_type': 'Software',
                'sales_price': Decimal('1200.00'),
                'cost_price': Decimal('400.00'),
                'tax': t_gst18,
                'notes': 'Core CRM licence, per user seat',
            }
        )
        v_odoo, _ = ProductVariant.objects.get_or_create(
            product=p_crm,
            attribute='Brand',
            value='Odoo',
            defaults={'extra_price': Decimal('560.00')}
        )
        v_sf, _ = ProductVariant.objects.get_or_create(
            product=p_crm,
            attribute='Brand',
            value='Salesforce',
            defaults={'extra_price': Decimal('900.00')}
        )

        p_seat, _ = Product.objects.get_or_create(
            name='Extra Seat Pack',
            defaults={
                'product_type': 'Software',
                'sales_price': Decimal('300.00'),
                'cost_price': Decimal('90.00'),
                'tax': t_gst18,
                'notes': 'Additional 5 team user pack',
            }
        )

        p_support, _ = Product.objects.get_or_create(
            name='Priority Support',
            defaults={
                'product_type': 'Service',
                'sales_price': Decimal('800.00'),
                'cost_price': Decimal('350.00'),
                'tax': t_gst18,
                'notes': '24/7 dedicated support channel with guaranteed SLA',
            }
        )

        p_analytics, _ = Product.objects.get_or_create(
            name='Analytics Add-on',
            defaults={
                'product_type': 'Software',
                'sales_price': Decimal('450.00'),
                'cost_price': Decimal('120.00'),
                'tax': t_gst18,
                'notes': 'Executive reports, KPI forecasting and data export',
            }
        )

        # -------------------------------------------------------------
        # 5. Subscription Plans
        # -------------------------------------------------------------
        pl_month, _ = Plan.objects.get_or_create(
            name='Business Monthly',
            defaults={
                'price': Decimal('999.00'),
                'billing_interval': BillingInterval.MONTHLY,
                'minimum_quantity': 1,
                'start_date': today - timedelta(days=200),
                'end_date': today + timedelta(days=400),
                'tax': t_gst18,
                'auto_close_on_end': False,
                'allow_early_close': True,
                'allow_pause': True,
                'allow_renewal': True,
            }
        )

        pl_year, _ = Plan.objects.get_or_create(
            name='Enterprise Yearly',
            defaults={
                'price': Decimal('9999.00'),
                'billing_interval': BillingInterval.YEARLY,
                'minimum_quantity': 5,
                'start_date': today - timedelta(days=200),
                'end_date': today + timedelta(days=600),
                'tax': t_gst18,
                'auto_close_on_end': True,
                'allow_early_close': True,
                'allow_pause': False,
                'allow_renewal': True,
            }
        )

        pl_week, _ = Plan.objects.get_or_create(
            name='Weekly Pilot',
            defaults={
                'price': Decimal('199.00'),
                'billing_interval': BillingInterval.WEEKLY,
                'minimum_quantity': 1,
                'start_date': today - timedelta(days=100),
                'end_date': today + timedelta(days=60),
                'tax': t_gst5,
                'auto_close_on_end': True,
                'allow_early_close': True,
                'allow_pause': True,
                'allow_renewal': False,
            }
        )

        # -------------------------------------------------------------
        # 6. Discount Rules
        # -------------------------------------------------------------
        DiscountRule.objects.get_or_create(
            name='Volume 10% (10+ seats)',
            defaults={
                'discount_type': DiscountType.PERCENT,
                'value': Decimal('10.00'),
                'min_amount': Decimal('0.00'),
                'min_quantity': 10,
                'start_date': today - timedelta(days=120),
                'end_date': today + timedelta(days=240),
                'max_uses': 100,
                'is_active': True,
            }
        )

        DiscountRule.objects.get_or_create(
            name='Analytics promo ₹100 off',
            defaults={
                'discount_type': DiscountType.FIXED,
                'value': Decimal('100.00'),
                'min_amount': Decimal('0.00'),
                'min_quantity': 0,
                'start_date': today - timedelta(days=60),
                'end_date': today + timedelta(days=120),
                'max_uses': 20,
                'product': p_analytics,
                'is_active': True,
            }
        )

        # -------------------------------------------------------------
        # 7. Quotation Templates
        # -------------------------------------------------------------
        tmpl_starter, _ = QuotationTemplate.objects.get_or_create(
            name='Starter Monthly Bundle',
            defaults={
                'plan': pl_month,
                'validity_days': 15,
            }
        )
        QuotationTemplateLine.objects.get_or_create(
            template=tmpl_starter,
            product=p_crm,
            defaults={'qty': 1, 'unit_price': p_crm.sales_price}
        )
        QuotationTemplateLine.objects.get_or_create(
            template=tmpl_starter,
            product=p_support,
            defaults={'qty': 1, 'unit_price': p_support.sales_price}
        )

        tmpl_enterprise, _ = QuotationTemplate.objects.get_or_create(
            name='Enterprise Yearly Bundle',
            defaults={
                'plan': pl_year,
                'validity_days': 30,
            }
        )
        QuotationTemplateLine.objects.get_or_create(
            template=tmpl_enterprise,
            product=p_crm,
            defaults={'variant': v_odoo, 'qty': 10, 'unit_price': Decimal('1760.00')}
        )
        QuotationTemplateLine.objects.get_or_create(
            template=tmpl_enterprise,
            product=p_analytics,
            defaults={'qty': 10, 'unit_price': p_analytics.sales_price}
        )
        QuotationTemplateLine.objects.get_or_create(
            template=tmpl_enterprise,
            product=p_support,
            defaults={'qty': 5, 'unit_price': p_support.sales_price}
        )

        # -------------------------------------------------------------
        # 8. Quotations
        # -------------------------------------------------------------
        q1, _ = Quotation.objects.get_or_create(
            quotation_number='QUO-0001',
            defaults={
                'customer': c1,
                'plan': pl_month,
                'template': tmpl_starter,
                'status': QuotationStatus.DRAFT,
                'start_date': today + timedelta(days=5),
                'expiry_date': today + timedelta(days=35),
                'valid_until': today + timedelta(days=15),
                'payment_terms': 'net30',
                'notes': 'Proposed standard monthly setup for Acme Traders',
                'created_by': staff,
            }
        )
        QuotationLine.objects.get_or_create(
            quotation=q1,
            product=p_crm,
            defaults={'qty': 3, 'unit_price': Decimal('1200.00'), 'tax': t_gst18}
        )

        q2, _ = Quotation.objects.get_or_create(
            quotation_number='QUO-0002',
            defaults={
                'customer': c2,
                'plan': pl_year,
                'template': tmpl_enterprise,
                'status': QuotationStatus.SENT,
                'start_date': today + timedelta(days=10),
                'expiry_date': today + timedelta(days=375),
                'valid_until': today + timedelta(days=30),
                'payment_terms': 'net15',
                'notes': 'Enterprise proposal with Odoo brand customization',
                'created_by': admin,
            }
        )
        QuotationLine.objects.get_or_create(
            quotation=q2,
            product=p_crm,
            defaults={'variant': v_odoo, 'qty': 10, 'unit_price': Decimal('1760.00'), 'tax': t_gst18}
        )

        # -------------------------------------------------------------
        # 9. Subscriptions
        # -------------------------------------------------------------
        sub1, _ = Subscription.objects.get_or_create(
            subscription_number='SUB-0001',
            defaults={
                'customer': c1,
                'plan': pl_month,
                'status': SubscriptionStatus.ACTIVE,
                'start_date': today - timedelta(days=75),
                'expiry_date': today + timedelta(days=290),
                'last_billed_date': today - timedelta(days=15),
                'next_billing_date': today + timedelta(days=15),
                'payment_terms': 'net30',
                'auto_close_on_end': False,
                'allow_early_close': True,
                'allow_pause': True,
                'allow_renewal': True,
                'created_by': admin,
            }
        )
        SubscriptionLine.objects.get_or_create(
            subscription=sub1,
            product=p_crm,
            defaults={'qty': 4, 'unit_price': Decimal('1200.00'), 'tax': t_gst18}
        )
        SubscriptionLine.objects.get_or_create(
            subscription=sub1,
            product=p_support,
            defaults={'qty': 1, 'unit_price': Decimal('800.00'), 'tax': t_gst18}
        )

        sub2, _ = Subscription.objects.get_or_create(
            subscription_number='SUB-0002',
            defaults={
                'customer': c2,
                'plan': pl_year,
                'status': SubscriptionStatus.ACTIVE,
                'start_date': today - timedelta(days=60),
                'expiry_date': today + timedelta(days=305),
                'last_billed_date': today - timedelta(days=60),
                'next_billing_date': today + timedelta(days=305),
                'payment_terms': 'net30',
                'auto_close_on_end': True,
                'allow_early_close': True,
                'allow_pause': False,
                'allow_renewal': True,
                'created_by': admin,
            }
        )
        SubscriptionLine.objects.get_or_create(
            subscription=sub2,
            product=p_crm,
            defaults={'variant': v_odoo, 'qty': 8, 'unit_price': Decimal('1760.00'), 'tax': t_gst18}
        )

        sub3, _ = Subscription.objects.get_or_create(
            subscription_number='SUB-0003',
            defaults={
                'customer': c3,
                'plan': pl_month,
                'status': SubscriptionStatus.PAUSED,
                'start_date': today - timedelta(days=45),
                'expiry_date': today + timedelta(days=320),
                'last_billed_date': today - timedelta(days=45),
                'next_billing_date': today + timedelta(days=15),
                'payment_terms': 'net15',
                'allow_pause': True,
                'created_by': staff,
            }
        )
        SubscriptionLine.objects.get_or_create(
            subscription=sub3,
            product=p_seat,
            defaults={'qty': 5, 'unit_price': Decimal('300.00'), 'tax': t_gst18}
        )

        sub4, _ = Subscription.objects.get_or_create(
            subscription_number='SUB-0004',
            defaults={
                'customer': c4,
                'plan': pl_week,
                'status': SubscriptionStatus.ACTIVE,
                'start_date': today - timedelta(days=21),
                'expiry_date': today + timedelta(days=40),
                'last_billed_date': today - timedelta(days=7),
                'next_billing_date': today,
                'payment_terms': 'immediate',
                'created_by': staff,
            }
        )
        SubscriptionLine.objects.get_or_create(
            subscription=sub4,
            product=p_analytics,
            defaults={'qty': 2, 'unit_price': Decimal('450.00'), 'tax': t_gst5}
        )

        # -------------------------------------------------------------
        # 10. Invoices (Fully Paid, Partially Paid, Confirmed, Overdue, Draft)
        # -------------------------------------------------------------
        # Invoice 1: Fully Paid (Settled 45 days ago)
        inv1, _ = Invoice.objects.get_or_create(
            invoice_number='INV-0001',
            defaults={
                'customer': c1,
                'subscription': sub1,
                'period_start': today - timedelta(days=75),
                'period_end': today - timedelta(days=46),
                'issue_date': today - timedelta(days=75),
                'due_date': today - timedelta(days=45),
                'status': InvoiceStatus.PAID,
                'subtotal': Decimal('5600.00'),
                'tax_total': Decimal('1008.00'),
                'discount_total': Decimal('0.00'),
                'total_amount': Decimal('6608.00'),
                'paid_amount': Decimal('6608.00'),
                'outstanding_amount': Decimal('0.00'),
            }
        )
        InvoiceLine.objects.get_or_create(
            invoice=inv1,
            product=p_crm,
            defaults={
                'description': f"{p_crm.name} x4 seats",
                'qty': 4,
                'unit_price': Decimal('1200.00'),
                'tax_rate': Decimal('18.00'),
                'tax_amount': Decimal('864.00'),
                'line_total': Decimal('5664.00'),
            }
        )
        InvoiceLine.objects.get_or_create(
            invoice=inv1,
            product=p_support,
            defaults={
                'description': f"{p_support.name} monthly SLA",
                'qty': 1,
                'unit_price': Decimal('800.00'),
                'tax_rate': Decimal('18.00'),
                'tax_amount': Decimal('144.00'),
                'line_total': Decimal('944.00'),
            }
        )

        # Invoice 2: Overdue (Confirmed, balance remaining, due date in past)
        inv2, _ = Invoice.objects.get_or_create(
            invoice_number='INV-0002',
            defaults={
                'customer': c1,
                'subscription': sub1,
                'period_start': today - timedelta(days=45),
                'period_end': today - timedelta(days=16),
                'issue_date': today - timedelta(days=45),
                'due_date': today - timedelta(days=15),
                'status': InvoiceStatus.CONFIRMED,
                'subtotal': Decimal('5600.00'),
                'tax_total': Decimal('1008.00'),
                'discount_total': Decimal('500.00'),
                'total_amount': Decimal('6108.00'),
                'paid_amount': Decimal('2500.00'),
                'outstanding_amount': Decimal('3608.00'),
            }
        )
        InvoiceLine.objects.get_or_create(
            invoice=inv2,
            product=p_crm,
            defaults={
                'description': f"{p_crm.name} x4 seats",
                'qty': 4,
                'unit_price': Decimal('1200.00'),
                'tax_rate': Decimal('18.00'),
                'tax_amount': Decimal('864.00'),
                'discount_amount': Decimal('500.00'),
                'line_total': Decimal('5164.00'),
            }
        )

        # Invoice 3: Enterprise Annual Paid
        inv3, _ = Invoice.objects.get_or_create(
            invoice_number='INV-0003',
            defaults={
                'customer': c2,
                'subscription': sub2,
                'period_start': today - timedelta(days=60),
                'period_end': today + timedelta(days=305),
                'issue_date': today - timedelta(days=60),
                'due_date': today - timedelta(days=30),
                'status': InvoiceStatus.PAID,
                'subtotal': Decimal('24079.00'),
                'tax_total': Decimal('4334.22'),
                'discount_total': Decimal('0.00'),
                'total_amount': Decimal('28413.22'),
                'paid_amount': Decimal('28413.22'),
                'outstanding_amount': Decimal('0.00'),
            }
        )
        InvoiceLine.objects.get_or_create(
            invoice=inv3,
            product=p_crm,
            defaults={
                'description': f"{p_crm.name} (Odoo Edition) x8 seats annual",
                'qty': 8,
                'unit_price': Decimal('1760.00'),
                'tax_rate': Decimal('18.00'),
                'tax_amount': Decimal('2534.40'),
                'line_total': Decimal('16614.40'),
            }
        )

        # Invoice 4: Current Outstanding (Due in 15 days)
        inv4, _ = Invoice.objects.get_or_create(
            invoice_number='INV-0004',
            defaults={
                'customer': c3,
                'subscription': sub3,
                'period_start': today - timedelta(days=45),
                'period_end': today - timedelta(days=16),
                'issue_date': today - timedelta(days=10),
                'due_date': today + timedelta(days=5),
                'status': InvoiceStatus.CONFIRMED,
                'subtotal': Decimal('2499.00'),
                'tax_total': Decimal('449.82'),
                'discount_total': Decimal('0.00'),
                'total_amount': Decimal('2948.82'),
                'paid_amount': Decimal('0.00'),
                'outstanding_amount': Decimal('2948.82'),
            }
        )
        InvoiceLine.objects.get_or_create(
            invoice=inv4,
            product=p_seat,
            defaults={
                'description': f"{p_seat.name} x5 packs",
                'qty': 5,
                'unit_price': Decimal('300.00'),
                'tax_rate': Decimal('18.00'),
                'tax_amount': Decimal('270.00'),
                'line_total': Decimal('1770.00'),
            }
        )

        # Invoice 5: Draft
        inv5, _ = Invoice.objects.get_or_create(
            invoice_number='INV-0005',
            defaults={
                'customer': c4,
                'subscription': sub4,
                'period_start': today,
                'period_end': today + timedelta(days=7),
                'issue_date': today,
                'due_date': today + timedelta(days=7),
                'status': InvoiceStatus.DRAFT,
                'subtotal': Decimal('1099.00'),
                'tax_total': Decimal('54.95'),
                'discount_total': Decimal('0.00'),
                'total_amount': Decimal('1153.95'),
                'paid_amount': Decimal('0.00'),
                'outstanding_amount': Decimal('1153.95'),
            }
        )
        InvoiceLine.objects.get_or_create(
            invoice=inv5,
            product=p_analytics,
            defaults={
                'description': f"{p_analytics.name} weekly run",
                'qty': 2,
                'unit_price': Decimal('450.00'),
                'tax_rate': Decimal('5.00'),
                'tax_amount': Decimal('45.00'),
                'line_total': Decimal('945.00'),
            }
        )

        # -------------------------------------------------------------
        # 11. Payments & Ledger Allocations
        # -------------------------------------------------------------
        pay1, _ = Payment.objects.get_or_create(
            payment_number='PAY-0001',
            defaults={
                'customer': c1,
                'amount': Decimal('6608.00'),
                'currency': 'INR',
                'method': 'Bank Transfer',
                'payment_date': today - timedelta(days=48),
                'transaction_reference': 'NEFT/HDFC/2026/0019284',
                'note': 'Full settlement of INV-0001',
            }
        )
        PaymentAllocation.objects.get_or_create(
            payment=pay1,
            invoice=inv1,
            defaults={'amount': Decimal('6608.00')}
        )

        pay2, _ = Payment.objects.get_or_create(
            payment_number='PAY-0002',
            defaults={
                'customer': c1,
                'amount': Decimal('2500.00'),
                'currency': 'INR',
                'method': 'UPI',
                'payment_date': today - timedelta(days=20),
                'transaction_reference': 'UPI/29482019482@okaxis',
                'note': 'Partial payment towards INV-0002',
            }
        )
        PaymentAllocation.objects.get_or_create(
            payment=pay2,
            invoice=inv2,
            defaults={'amount': Decimal('2500.00')}
        )

        pay3, _ = Payment.objects.get_or_create(
            payment_number='PAY-0003',
            defaults={
                'customer': c2,
                'amount': Decimal('28413.22'),
                'currency': 'INR',
                'method': 'Bank Transfer',
                'payment_date': today - timedelta(days=35),
                'transaction_reference': 'RTGS/ICIC/2026/882194',
                'note': 'Annual Enterprise contract fee settlement for INV-0003',
            }
        )
        PaymentAllocation.objects.get_or_create(
            payment=pay3,
            invoice=inv3,
            defaults={'amount': Decimal('28413.22')}
        )

        self.stdout.write(self.style.SUCCESS("All mock data successfully migrated into real database!"))
        self.stdout.write(self.style.SUCCESS("  Admin credentials:   admin@brightloop.com / Admin@1234"))
        self.stdout.write(self.style.SUCCESS("  Staff credentials:   staff@brightloop.com / Staff@1234"))
        self.stdout.write(self.style.SUCCESS("  Customer 1 (Acme):   customer@brightloop.com / Customer@1234"))
        self.stdout.write(self.style.SUCCESS("  Customer 2 (Retail): joseph@greenmart.in / Customer@1234"))
        self.stdout.write(self.style.SUCCESS("  Customer 3 (Logist): meera@northwind.in / Customer@1234"))
        self.stdout.write(self.style.SUCCESS("  Customer 4 (Foods):  arun@coastalfoods.in / Customer@1234"))
