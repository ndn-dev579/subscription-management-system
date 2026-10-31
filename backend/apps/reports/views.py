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
        
        # Subscription stats
        active_subs = Subscription.objects.filter(status=SubscriptionStatus.ACTIVE).count()
        total_subs = Subscription.objects.count()
        
        # Calculate MRR estimate
        mrr = Decimal('0.00')
        active_sub_objs = Subscription.objects.filter(status=SubscriptionStatus.ACTIVE).select_related('plan').prefetch_related('lines')
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
            mrr += round(sub_monthly * multiplier, 2)

        # Invoice metrics
        confirmed_invoices = Invoice.objects.filter(status__in=[InvoiceStatus.CONFIRMED, InvoiceStatus.PAID])
        invoiced_total = confirmed_invoices.aggregate(Sum('total_amount'))['total_amount__sum'] or Decimal('0.00')
        collected_total = confirmed_invoices.aggregate(Sum('paid_amount'))['paid_amount__sum'] or Decimal('0.00')
        unpaid_total = confirmed_invoices.filter(status=InvoiceStatus.CONFIRMED).aggregate(Sum('outstanding_amount'))['outstanding_amount__sum'] or Decimal('0.00')
        
        overdue_total = Invoice.objects.filter(
            status=InvoiceStatus.CONFIRMED,
            due_date__lt=today,
            outstanding_amount__gt=Decimal('0.00'),
        ).aggregate(Sum('outstanding_amount'))['outstanding_amount__sum'] or Decimal('0.00')

        return Response({
            'active_subscriptions': active_subs,
            'total_subscriptions': total_subs,
            'mrr': str(mrr),
            'invoiced_total': str(invoiced_total),
            'collected_total': str(collected_total),
            'unpaid_total': str(unpaid_total),
            'overdue_total': str(overdue_total),
            'currency': 'INR',
        })

class RevenueReportView(APIView):
    permission_classes = [IsStaffMember]

    def get(self, request):
        # Invoiced vs paid by status
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

