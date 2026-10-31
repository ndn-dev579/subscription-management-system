from django.db import transaction
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from common.permissions import IsStaffMember, IsAdminUser
from apps.subscriptions.models import Subscription, SubscriptionLine, SubscriptionStatus
from apps.billing.services import calculate_next_period_end
from .models import QuotationTemplate, Quotation, QuotationStatus
from .serializers import QuotationTemplateSerializer, QuotationSerializer

class QuotationTemplateListCreateView(generics.ListCreateAPIView):
    queryset = QuotationTemplate.objects.all().prefetch_related('lines')
    serializer_class = QuotationTemplateSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminUser()]
        return [IsStaffMember()]

class QuotationTemplateDetailView(generics.RetrieveUpdateAPIView):
    queryset = QuotationTemplate.objects.all().prefetch_related('lines')
    serializer_class = QuotationTemplateSerializer
    lookup_field = 'id'

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH']:
            return [IsAdminUser()]
        return [IsStaffMember()]

class QuotationListCreateView(generics.ListCreateAPIView):
    serializer_class = QuotationSerializer

    def get_permissions(self):
        return [IsStaffMember()]

    def get_queryset(self):
        user = self.request.user
        if user.is_admin or user.is_staff_member:
            return Quotation.objects.all().prefetch_related('lines').select_related('customer', 'plan')
        return Quotation.objects.filter(customer__user=user).prefetch_related('lines')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class QuotationDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = QuotationSerializer
    lookup_field = 'id'

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.is_admin or user.is_staff_member:
            return Quotation.objects.all().prefetch_related('lines')
        return Quotation.objects.filter(customer__user=user).prefetch_related('lines')

class QuotationConfirmView(APIView):
    """
    Confirms quotation and converts it into an active Subscription
    according to FR-QUOTE-05 and core workflow #4.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        quotation = generics.get_object_or_404(Quotation, id=id)
        if quotation.status == QuotationStatus.CONFIRMED:
            return Response({'message': 'Quotation has already been confirmed.'}, status=status.HTTP_400_BAD_REQUEST)
        if quotation.status in [QuotationStatus.CANCELLED, QuotationStatus.EXPIRED]:
            return Response({'error': {'code': 'invalid_state', 'message': f'Cannot confirm {quotation.status} quotation.'}}, status=status.HTTP_409_CONFLICT)

        with transaction.atomic():
            quotation.status = QuotationStatus.CONFIRMED
            quotation.save(update_fields=['status'])

            expiry = quotation.expiry_date or calculate_next_period_end(quotation.start_date, quotation.plan.billing_interval)

            sub = Subscription.objects.create(
                customer=quotation.customer,
                plan=quotation.plan,
                quotation=quotation,
                status=SubscriptionStatus.ACTIVE,
                start_date=quotation.start_date,
                expiry_date=expiry,
                payment_terms=quotation.payment_terms,
                auto_close_on_end=quotation.plan.auto_close_on_end,
                allow_early_close=quotation.plan.allow_early_close,
                allow_pause=quotation.plan.allow_pause,
                allow_renewal=quotation.plan.allow_renewal,
                next_billing_date=quotation.start_date,
                created_by=request.user,
            )

            for line in quotation.lines.all():
                SubscriptionLine.objects.create(
                    subscription=sub,
                    product=line.product,
                    variant=line.variant,
                    qty=line.qty,
                    unit_price=line.unit_price,
                    tax=line.tax,
                )

        return Response({
            'message': 'Quotation confirmed and converted to subscription.',
            'subscription_id': str(sub.id),
            'subscription_number': sub.subscription_number,
        }, status=status.HTTP_200_OK)

class QuotationCancelView(APIView):
    permission_classes = [IsStaffMember]

    def post(self, request, id):
        quotation = generics.get_object_or_404(Quotation, id=id)
        quotation.status = QuotationStatus.CANCELLED
        quotation.notes += f"\nCancelled: {request.data.get('reason', 'No reason provided')}"
        quotation.save()
        return Response({'message': 'Quotation cancelled.'}, status=status.HTTP_200_OK)

