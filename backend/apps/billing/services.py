from datetime import date, timedelta
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from apps.subscriptions.models import Subscription, SubscriptionStatus
from apps.invoices.models import Invoice, InvoiceLine, InvoiceStatus
from apps.billing.models import BillingCycle
from apps.discounts.models import DiscountRule

def calculate_next_period_end(start_date: date, interval: str) -> date:
    if interval == 'daily':
        return start_date
    if interval == 'weekly':
        return start_date + timedelta(days=6)
    if interval == 'yearly':
        try:
            return date(start_date.year + 1, start_date.month, start_date.day) - timedelta(days=1)
        except ValueError:
            return date(start_date.year + 1, start_date.month, start_date.day - 1) - timedelta(days=1)
    # Default: monthly (~30 days or month increment)
    # Calculate one month ahead minus 1 day
    month = start_date.month + 1
    year = start_date.year
    if month > 12:
        month = 1
        year += 1
    import calendar
    days_in_target = calendar.monthrange(year, month)[1]
    target_day = min(start_date.day, days_in_target)
    return date(year, month, target_day) - timedelta(days=1)

def generate_invoice_for_subscription(subscription: Subscription, as_of_date: date = None) -> Invoice:
    """
    Idempotent billing generation service according to FR-INV-01, FR-INV-02, NFR-DATA-01.
    """
    if as_of_date is None:
        as_of_date = timezone.now().date()

    if subscription.status != SubscriptionStatus.ACTIVE:
        raise ValueError(f"Subscription {subscription.subscription_number} is not active (status: {subscription.status}).")

    # If subscription was already billed for as_of_date and next billing date is in the future, return current cycle's invoice
    if subscription.last_billed_date and subscription.next_billing_date and as_of_date < subscription.next_billing_date:
        cycle = BillingCycle.objects.filter(
            subscription=subscription,
            period_start=subscription.last_billed_date,
        ).select_related('invoice').first()
        if cycle:
            return cycle.invoice

    period_start = subscription.next_billing_date or subscription.start_date
    period_end = calculate_next_period_end(period_start, subscription.plan.billing_interval)

    # Check for existing billing cycle (Idempotency check)
    existing_cycle = BillingCycle.objects.filter(
        subscription=subscription,
        period_start=period_start,
        period_end=period_end,
    ).select_related('invoice').first()

    if existing_cycle:
        return existing_cycle.invoice

    with transaction.atomic():
        subtotal = Decimal('0.00')
        tax_total = Decimal('0.00')
        discount_total = Decimal('0.00')
        lines_data = []

        # 1. Plan Recurring Fee
        plan = subscription.plan
        plan_price = plan.price
        subtotal += plan_price
        plan_tax_amount = Decimal('0.00')
        plan_tax_rate = Decimal('0.00')
        if plan.tax and plan.tax.is_active:
            plan_tax_rate = plan.tax.rate
            plan_tax_amount = round(plan_price * (plan_tax_rate / Decimal('100.00')), 2)
            tax_total += plan_tax_amount

        lines_data.append({
            'description': f"Plan: {plan.name} ({plan.billing_interval})",
            'product': None,
            'variant': None,
            'qty': 1,
            'unit_price': plan_price,
            'tax_rate': plan_tax_rate,
            'tax_amount': plan_tax_amount,
            'discount_amount': Decimal('0.00'),
            'line_total': plan_price + plan_tax_amount,
        })

        # 2. Product Lines
        for sline in subscription.lines.select_related('product', 'variant', 'tax').all():
            line_subtotal = Decimal(sline.qty) * sline.unit_price
            subtotal += line_subtotal
            line_tax_rate = Decimal('0.00')
            line_tax_amount = Decimal('0.00')
            tax_rule = sline.tax or sline.product.tax
            if tax_rule and tax_rule.is_active:
                line_tax_rate = tax_rule.rate
                line_tax_amount = round(line_subtotal * (line_tax_rate / Decimal('100.00')), 2)
                tax_total += line_tax_amount

            desc = sline.product.name
            if sline.variant:
                desc += f" ({sline.variant.attribute}: {sline.variant.value})"

            lines_data.append({
                'description': desc,
                'product': sline.product,
                'variant': sline.variant,
                'qty': sline.qty,
                'unit_price': sline.unit_price,
                'tax_rate': line_tax_rate,
                'tax_amount': line_tax_amount,
                'discount_amount': Decimal('0.00'),
                'line_total': line_subtotal + line_tax_amount,
            })

        # 3. Check for eligible discounts
        eligible_discounts = DiscountRule.objects.filter(is_active=True)
        for disc in eligible_discounts:
            if not disc.is_available:
                continue
            if disc.start_date and as_of_date < disc.start_date:
                continue
            if disc.end_date and as_of_date > disc.end_date:
                continue
            if disc.min_amount > 0 and subtotal < disc.min_amount:
                continue

            disc_amount = Decimal('0.00')
            if disc.discount_type == 'percent':
                disc_amount = round(subtotal * (disc.value / Decimal('100.00')), 2)
            else:
                disc_amount = min(subtotal, disc.value)

            if disc_amount > 0:
                discount_total += disc_amount
                disc.current_uses += 1
                disc.save(update_fields=['current_uses'])
                # Only apply one major subscription discount rule by default
                break

        total_amount = max(Decimal('0.00'), (subtotal + tax_total) - discount_total)

        # Payment terms to calculate due date
        due_days = 30
        if subscription.payment_terms == 'immediate':
            due_days = 0
        elif subscription.payment_terms == 'net15':
            due_days = 15
        elif subscription.payment_terms == 'net45':
            due_days = 45
        due_date = as_of_date + timedelta(days=due_days)

        invoice = Invoice.objects.create(
            customer=subscription.customer,
            subscription=subscription,
            period_start=period_start,
            period_end=period_end,
            issue_date=as_of_date,
            due_date=due_date,
            status=InvoiceStatus.CONFIRMED,
            subtotal=subtotal,
            tax_total=tax_total,
            discount_total=discount_total,
            total_amount=total_amount,
            paid_amount=Decimal('0.00'),
            outstanding_amount=total_amount,
        )

        for l in lines_data:
            InvoiceLine.objects.create(
                invoice=invoice,
                product=l['product'],
                variant=l['variant'],
                description=l['description'],
                qty=l['qty'],
                unit_price=l['unit_price'],
                tax_rate=l['tax_rate'],
                tax_amount=l['tax_amount'],
                discount_amount=l['discount_amount'],
                line_total=l['line_total'],
            )

        BillingCycle.objects.create(
            subscription=subscription,
            invoice=invoice,
            period_start=period_start,
            period_end=period_end,
        )

        subscription.last_billed_date = period_start
        subscription.next_billing_date = period_end + timedelta(days=1)
        subscription.save(update_fields=['last_billed_date', 'next_billing_date'])

        return invoice

def run_recurring_billing_all_due() -> int:
    """Finds all active subscriptions due for billing and generates invoices."""
    today = timezone.now().date()
    due_subs = Subscription.objects.filter(
        status=SubscriptionStatus.ACTIVE,
        next_billing_date__lte=today,
    )
    count = 0
    for sub in due_subs:
        generate_invoice_for_subscription(sub, as_of_date=today)
        count += 1
    return count

