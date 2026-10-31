from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum, Count, Q
from rest_framework.views import APIView
from rest_framework.response import Response
from common.permissions import IsStaffMember
from apps.subscriptions.models import Subscription, SubscriptionStatus
from apps.invoices.models import Invoice, InvoiceStatus
from apps.payments.models import Payment

class DashboardMetricsView(APIView):
    permission_classes = [IsStaffMember]

    def get(self, request):
        today = timezone.now().date()
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        # Subscription stats
        active_subs = Subscription.objects.filter(status=SubscriptionStatus.ACTIVE).count()
        total_subs = Subscription.objects.count()

        # Breakdown by status
        status_breakdown = {}
        for row in Subscription.objects.values('status').annotate(count=Count('id')):
            status_breakdown[row['status']] = row['count']

        # Calculate MRR estimate & MRR by plan
        mrr = Decimal('0.00')
        mrr_by_plan_map = {}
        active_sub_objs = Subscription.objects.filter(
            status=SubscriptionStatus.ACTIVE
        ).select_related('plan').prefetch_related('lines')

        for s in active_sub_objs:
            multiplier = Decimal('1.0')
            if s.plan.billing_interval == 'yearly':
                multiplier = Decimal('1.0') / Decimal('12.0')
            elif s.plan.billing_interval == 'weekly':
                multiplier = Decimal('4.33')
            elif s.plan.billing_interval == 'daily':
                multiplier = Decimal('30.0')

            sub_monthly = s.plan.price
            for l in s.lines.all():
                sub_monthly += Decimal(l.qty) * l.unit_price
            val = round(sub_monthly * multiplier, 2)
            mrr += val

            plan_name = s.plan.name
            mrr_by_plan_map[plan_name] = mrr_by_plan_map.get(plan_name, Decimal('0.00')) + val

        arr = mrr * Decimal('12.0')
        mrr_by_plan = [{'plan_name': k, 'mrr': str(v)} for k, v in mrr_by_plan_map.items()]

        # Filtered invoice range
        inv_qs = Invoice.objects.filter(status__in=[InvoiceStatus.CONFIRMED, InvoiceStatus.PAID])
        if date_from:
            inv_qs = inv_qs.filter(issue_date__gte=date_from)
        if date_to:
            inv_qs = inv_qs.filter(issue_date__lte=date_to)

        invoiced_period = inv_qs.aggregate(Sum('total_amount'))['total_amount__sum'] or Decimal('0.00')
        collected_period = inv_qs.aggregate(Sum('paid_amount'))['paid_amount__sum'] or Decimal('0.00')

        # Outstanding & overdue invoices
        confirmed_invoices = Invoice.objects.filter(status=InvoiceStatus.CONFIRMED)
        outstanding = confirmed_invoices.aggregate(Sum('outstanding_amount'))['outstanding_amount__sum'] or Decimal('0.00')

        overdue_invoices_qs = Invoice.objects.filter(
            status=InvoiceStatus.CONFIRMED,
            due_date__lt=today,
            outstanding_amount__gt=Decimal('0.00'),
        ).select_related('customer').order_by('due_date')

        overdue_amt = overdue_invoices_qs.aggregate(Sum('outstanding_amount'))['outstanding_amount__sum'] or Decimal('0.00')
        overdue_count = overdue_invoices_qs.count()

        overdue_list = []
        for inv in overdue_invoices_qs[:10]:
            days_late = (today - inv.due_date).days
            overdue_list.append({
                'id': str(inv.id),
                'number': inv.invoice_number,
                'customer_name': inv.customer.company_name or inv.customer.contact_name,
                'due_date': str(inv.due_date),
                'balance': str(inv.outstanding_amount),
                'days_late': days_late,
            })

        # Monthly collections for the last 6 months
        monthly_collections = []
        for i in range(5, -1, -1):
            m_date = today.replace(day=1) - timedelta(days=i * 30)
            month_start = m_date.replace(day=1)
            if month_start.month == 12:
                next_month = month_start.replace(year=month_start.year + 1, month=1)
            else:
                next_month = month_start.replace(month=month_start.month + 1)
            month_end = next_month - timedelta(days=1)

            month_total = Payment.objects.filter(
                is_reversed=False,
                payment_date__gte=month_start,
                payment_date__lte=month_end,
            ).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')

            monthly_collections.append({
                'month': month_start.strftime('%Y-%m'),
                'amount': str(month_total),
                'label': month_start.strftime('%b'),
            })

        return Response({
            'active_subscriptions': active_subs,
            'total_subscriptions': total_subs,
            'mrr': str(mrr),
            'arr': str(arr),
            'invoiced_period': str(invoiced_period),
            'invoiced_total': str(invoiced_period),
            'collected_period': str(collected_period),
            'collected_total': str(collected_period),
            'outstanding': str(outstanding),
            'unpaid_total': str(outstanding),
            'overdue': str(overdue_amt),
            'overdue_total': str(overdue_amt),
            'overdue_count': overdue_count,
            'overdue_invoices': overdue_list,
            'subscription_status_breakdown': status_breakdown,
            'mrr_by_plan': mrr_by_plan,
            'monthly_collections': monthly_collections,
            'currency': 'INR',
        })

class RevenueReportView(APIView):
    permission_classes = [IsStaffMember]

    def get(self, request):
        invoiced = Invoice.objects.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
        collected = Payment.objects.filter(is_reversed=False).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        return Response({
            'total_invoiced': str(invoiced),
            'total_collected': str(collected),
            'currency': 'INR',
        })

class SubscriptionsReportView(APIView):
    permission_classes = [IsStaffMember]

    def get(self, request):
        status_counts = Subscription.objects.values('status').annotate(count=Count('id'))
        plan_counts = Subscription.objects.values('plan__name').annotate(count=Count('id'))
        return Response({
            'by_status': list(status_counts),
            'by_plan': list(plan_counts),
        })

class InvoicesReportView(APIView):
    permission_classes = [IsStaffMember]

    def get(self, request):
        today = timezone.now().date()
        open_invoices = Invoice.objects.filter(status=InvoiceStatus.CONFIRMED, outstanding_amount__gt=0)

        current = open_invoices.filter(due_date__gte=today).aggregate(Sum('outstanding_amount'))['outstanding_amount__sum'] or Decimal('0.00')
        days_1_30 = open_invoices.filter(due_date__lt=today, due_date__gte=today - timedelta(days=30)).aggregate(Sum('outstanding_amount'))['outstanding_amount__sum'] or Decimal('0.00')
        days_31_60 = open_invoices.filter(due_date__lt=today - timedelta(days=30), due_date__gte=today - timedelta(days=60)).aggregate(Sum('outstanding_amount'))['outstanding_amount__sum'] or Decimal('0.00')
        days_60_plus = open_invoices.filter(due_date__lt=today - timedelta(days=60)).aggregate(Sum('outstanding_amount'))['outstanding_amount__sum'] or Decimal('0.00')

        return Response({
            'current': str(current),
            'overdue_1_30_days': str(days_1_30),
            'overdue_31_60_days': str(days_31_60),
            'overdue_60_plus_days': str(days_60_plus),
            'currency': 'INR',
        })
