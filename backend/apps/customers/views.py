from rest_framework import generics, permissions, filters
from common.permissions import IsStaffMember, IsOwnerOrStaff
from .models import CustomerProfile
from .serializers import CustomerProfileSerializer

class CustomerListCreateView(generics.ListCreateAPIView):
    """
    List customers (Admin/Staff view all, Customers see only their own).
    Create customer (Admin/Staff only).
    """
    serializer_class = CustomerProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['company_name', 'contact_name', 'billing_email', 'customer_number']
    ordering_fields = ['created_at', 'company_name', 'customer_number']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        if user.is_admin or user.is_staff_member:
            return CustomerProfile.objects.all().select_related('user')
        return CustomerProfile.objects.filter(user=user)

    def perform_create(self, serializer):
        user = self.request.user
        # If staff is creating a customer for another user or assigning
        target_user = user
        if (user.is_admin or user.is_staff_member) and 'user_id' in serializer.validated_data:
            from apps.accounts.models import User
            target_user = User.objects.get(id=serializer.validated_data.pop('user_id'))
        serializer.save(user=target_user)

class CustomerDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = CustomerProfileSerializer
    permission_classes = [IsOwnerOrStaff]
    queryset = CustomerProfile.objects.all().select_related('user')
    lookup_field = 'id'

