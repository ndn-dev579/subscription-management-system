from rest_framework import generics, permissions, filters
from common.permissions import IsAdminUser
from .models import Plan
from .serializers import PlanSerializer

class PlanListCreateView(generics.ListCreateAPIView):
    queryset = Plan.objects.all().select_related('tax')
    serializer_class = PlanSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'billing_interval']
    ordering_fields = ['name', 'price', 'created_at']
    ordering = ['name']

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminUser()]
        return [permissions.IsAuthenticated()]

class PlanDetailView(generics.RetrieveUpdateAPIView):
    queryset = Plan.objects.all().select_related('tax')
    serializer_class = PlanSerializer
    lookup_field = 'id'

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH']:
            return [IsAdminUser()]
        return [permissions.IsAuthenticated()]

