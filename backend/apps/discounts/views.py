from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from common.permissions import IsAdminUser
from .models import DiscountRule
from .serializers import DiscountRuleSerializer

class DiscountListCreateView(generics.ListCreateAPIView):
    queryset = DiscountRule.objects.all().select_related('product')
    serializer_class = DiscountRuleSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminUser()]
        return [permissions.IsAuthenticated()]

class DiscountDetailView(generics.RetrieveUpdateAPIView):
    queryset = DiscountRule.objects.all().select_related('product')
    serializer_class = DiscountRuleSerializer
    lookup_field = 'id'

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH']:
            return [IsAdminUser()]
        return [permissions.IsAuthenticated()]

class DiscountDeactivateView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, id):
        discount = generics.get_object_or_404(DiscountRule, id=id)
        discount.is_active = False
        discount.save(update_fields=['is_active'])
        return Response({'message': f'Discount {discount.name} deactivated.'}, status=status.HTTP_200_OK)

