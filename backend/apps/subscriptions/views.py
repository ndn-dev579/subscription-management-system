from datetime import timedelta
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from common.permissions import IsStaffMember
from apps.billing.services import calculate_next_period_end
from .models import Subscription, SubscriptionStatus
from .serializers import SubscriptionSerializer

class SubscriptionListCreateView(generics.ListCreateAPIView):
    serializer_class = SubscriptionSerializer

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.is_admin or user.is_staff_member:
            return Subscription.objects.all().prefetch_related('lines').select_related('customer', 'plan')
        return Subscription.objects.filter(customer__user=user).prefetch_related('lines')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class SubscriptionDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = SubscriptionSerializer
    lookup_field = 'id'

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.is_admin or user.is_staff_member:
            return Subscription.objects.all().prefetch_related('lines')
        return Subscription.objects.filter(customer__user=user).prefetch_related('lines')

class SubscriptionPauseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        sub = generics.get_object_or_404(Subscription, id=id)
        if not sub.allow_pause:
            return Response({'error': {'code': 'not_allowed', 'message': 'Plan does not allow pausing.'}}, status=status.HTTP_400_BAD_REQUEST)
        if sub.status != SubscriptionStatus.ACTIVE:
            return Response({'error': {'code': 'invalid_state', 'message': f'Cannot pause subscription with status {sub.status}.'}}, status=status.HTTP_409_CONFLICT)
        
        sub.status = SubscriptionStatus.PAUSED
        sub.save(update_fields=['status'])
        return Response({'message': 'Subscription paused.', 'status': sub.status}, status=status.HTTP_200_OK)

class SubscriptionResumeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        sub = generics.get_object_or_404(Subscription, id=id)
        if sub.status != SubscriptionStatus.PAUSED:
            return Response({'error': {'code': 'invalid_state', 'message': f'Subscription is not paused (status: {sub.status}).'}}, status=status.HTTP_409_CONFLICT)
        
        sub.status = SubscriptionStatus.ACTIVE
        sub.save(update_fields=['status'])
        return Response({'message': 'Subscription resumed.', 'status': sub.status}, status=status.HTTP_200_OK)

class SubscriptionRenewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        sub = generics.get_object_or_404(Subscription, id=id)
        if not sub.allow_renewal:
            return Response({'error': {'code': 'not_allowed', 'message': 'Plan does not allow renewal.'}}, status=status.HTTP_400_BAD_REQUEST)
        
        # Extend expiry date by one period
        new_expiry = calculate_next_period_end(sub.expiry_date + timedelta(days=1), sub.plan.billing_interval)
        sub.expiry_date = new_expiry
        if sub.status == SubscriptionStatus.CLOSED:
            sub.status = SubscriptionStatus.ACTIVE
        sub.save(update_fields=['expiry_date', 'status'])
        return Response({'message': 'Subscription renewed.', 'new_expiry_date': sub.expiry_date}, status=status.HTTP_200_OK)

class SubscriptionCloseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        sub = generics.get_object_or_404(Subscription, id=id)
        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({'error': {'code': 'reason_required', 'message': 'A closure reason is required.'}}, status=status.HTTP_400_BAD_REQUEST)
        
        sub.status = SubscriptionStatus.CLOSED
        sub.close_reason = reason
        sub.closed_at = timezone.now()
        sub.save(update_fields=['status', 'close_reason', 'closed_at'])
        return Response({'message': 'Subscription closed.', 'status': sub.status}, status=status.HTTP_200_OK)

