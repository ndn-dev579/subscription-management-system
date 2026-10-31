from decimal import Decimal
from django.db import transaction, models
from django.utils import timezone
from rest_framework import generics, permissions, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from common.permissions import IsStaffMember, IsAdminUser
from apps.invoices.models import Invoice, InvoiceStatus
from .models import Payment, PaymentAllocation
from .serializers import PaymentSerializer

class PaymentListCreateView(generics.ListCreateAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['payment_number', 'customer__company_name', 'customer__contact_name', 'transaction_reference']
    ordering_fields = ['payment_date', 'amount', 'created_at']
    ordering = ['-payment_date', '-created_at']

    def get_queryset(self):
        user = self.request.user
        qs = Payment.objects.all().prefetch_related('allocations').select_related('customer')
        if not (user.is_admin or user.is_staff_member):
            qs = qs.filter(customer__user=user)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class PaymentDetailView(generics.RetrieveAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Payment.objects.all().prefetch_related('allocations').select_related('customer')
    lookup_field = 'id'

class PaymentReverseView(APIView):
    """Admin-only payment reversal with balance recalculation."""
    permission_classes = [IsAdminUser]

    def post(self, request, id):
        payment = generics.get_object_or_404(Payment, id=id)
        if payment.is_reversed:
            return Response({'error': {'code': 'already_reversed', 'message': 'Payment is already reversed.'}}, status=status.HTTP_400_BAD_REQUEST)
        
        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({'error': {'code': 'reason_required', 'message': 'Reversal reason is required.'}}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            payment.is_reversed = True
            payment.reversal_reason = reason
            payment.reversed_at = timezone.now()
            payment.save(update_fields=['is_reversed', 'reversal_reason', 'reversed_at'])

            # Recalculate affected invoices
            for alloc in payment.allocations.all():
                inv = alloc.invoice
                total_paid = inv.payment_allocations.filter(payment__is_reversed=False).aggregate(
                    total=models.Sum('amount')
                )['total'] or Decimal('0.00')
                inv.paid_amount = total_paid
                inv.outstanding_amount = max(Decimal('0.00'), inv.total_amount - total_paid)
                if inv.status == InvoiceStatus.PAID and inv.outstanding_amount > Decimal('0.00'):
                    inv.status = InvoiceStatus.CONFIRMED
                inv.save()

        return Response({'message': 'Payment reversed successfully.'}, status=status.HTTP_200_OK)
