from rest_framework import generics, permissions
from common.permissions import IsAdminUser
from .models import TaxRule
from .serializers import TaxRuleSerializer

class TaxListCreateView(generics.ListCreateAPIView):
    """List all taxes (authenticated), create tax (Admin only)."""
    queryset = TaxRule.objects.all()
    serializer_class = TaxRuleSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminUser()]
        return [permissions.IsAuthenticated()]

class TaxDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update tax rule (Admin only for update)."""
    queryset = TaxRule.objects.all()
    serializer_class = TaxRuleSerializer
    lookup_field = 'id'

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH']:
            return [IsAdminUser()]
        return [permissions.IsAuthenticated()]

