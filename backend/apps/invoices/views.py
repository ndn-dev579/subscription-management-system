from django.utils import timezone
from django.http import HttpResponse
from rest_framework import generics, permissions, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from common.permissions import IsStaffMember, IsOwnerOrStaff
from .models import Invoice, InvoiceStatus
from .serializers import InvoiceSerializer

class InvoiceListView(generics.ListAPIView):
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['invoice_number', 'customer__company_name', 'customer__contact_name']
    ordering_fields = ['issue_date', 'due_date', 'total_amount', 'created_at']
    ordering = ['-issue_date', '-created_at']

    def get_queryset(self):
        user = self.request.user
        qs = Invoice.objects.all().prefetch_related('lines').select_related('customer', 'subscription')
        if not (user.is_admin or user.is_staff_member):
            qs = qs.filter(customer__user=user, status__in=[InvoiceStatus.CONFIRMED, InvoiceStatus.PAID])
        
        # Filter params
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param.lower())
        overdue = self.request.query_params.get('overdue')
        if overdue and overdue.lower() == 'true':
            qs = qs.filter(status=InvoiceStatus.CONFIRMED, due_date__lt=timezone.now().date(), outstanding_amount__gt=0)
        return qs

class InvoiceDetailView(generics.RetrieveAPIView):
    serializer_class = InvoiceSerializer
    permission_classes = [IsOwnerOrStaff]
    queryset = Invoice.objects.all().prefetch_related('lines').select_related('customer', 'subscription')
    lookup_field = 'id'

class InvoiceConfirmView(APIView):
    permission_classes = [IsStaffMember]

    def post(self, request, id):
        inv = generics.get_object_or_404(Invoice, id=id)
        if inv.status != InvoiceStatus.DRAFT:
            return Response({'error': {'code': 'invalid_state', 'message': f'Invoice is already {inv.status}.'}}, status=status.HTTP_400_BAD_REQUEST)
        inv.status = InvoiceStatus.CONFIRMED
        inv.save(update_fields=['status'])
        return Response({'message': 'Invoice confirmed.', 'status': inv.status}, status=status.HTTP_200_OK)

class InvoiceCancelView(APIView):
    permission_classes = [IsStaffMember]

    def post(self, request, id):
        inv = generics.get_object_or_404(Invoice, id=id)
        if inv.status == InvoiceStatus.PAID:
            return Response({'error': {'code': 'invalid_state', 'message': 'Cannot cancel fully paid invoice.'}}, status=status.HTTP_400_BAD_REQUEST)
        
        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({'error': {'code': 'reason_required', 'message': 'Cancellation reason is required.'}}, status=status.HTTP_400_BAD_REQUEST)
        
        inv.status = InvoiceStatus.CANCELLED
        inv.cancel_reason = reason
        inv.cancelled_at = timezone.now()
        inv.save(update_fields=['status', 'cancel_reason', 'cancelled_at'])
        return Response({'message': 'Invoice cancelled.', 'status': inv.status}, status=status.HTTP_200_OK)

class InvoicePdfView(APIView):
    permission_classes = [IsOwnerOrStaff]

    def get(self, request, id):
        inv = generics.get_object_or_404(Invoice, id=id)
        content = f"""
============================================================
              BRIGHTLOOP SOFTWARE - INVOICE
============================================================
Invoice Number: {inv.invoice_number}
Issue Date:     {inv.issue_date}
Due Date:       {inv.due_date}
Billing Period: {inv.period_start} to {inv.period_end}
Status:         {inv.status.upper()}

Customer:       {inv.customer.company_name or inv.customer.contact_name}
Billing Email:  {inv.customer.billing_email}
Tax ID:         {inv.customer.tax_identifier or 'N/A'}
------------------------------------------------------------
LINE ITEMS:
"""
        for line in inv.lines.all():
            content += f"- {line.description} x{line.qty} @ {line.unit_price}: Total {line.line_total}\n"
        content += f"""------------------------------------------------------------
Subtotal:       INR {inv.subtotal}
Tax:            INR {inv.tax_total}
Discounts:     -INR {inv.discount_total}
TOTAL AMOUNT:   INR {inv.total_amount}
Paid:           INR {inv.paid_amount}
OUTSTANDING:    INR {inv.outstanding_amount}
============================================================
"""
        response = HttpResponse(content, content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{inv.invoice_number}.txt"'
        return response

