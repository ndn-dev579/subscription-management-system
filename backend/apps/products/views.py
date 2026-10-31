from rest_framework import generics, permissions, filters
from common.permissions import IsAdminUser
from .models import Product, ProductVariant
from .serializers import ProductSerializer, ProductVariantSerializer

class ProductListCreateView(generics.ListCreateAPIView):
    queryset = Product.objects.all().prefetch_related('variants').select_related('tax')
    serializer_class = ProductSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'product_type', 'notes']
    ordering_fields = ['name', 'sales_price', 'created_at']
    ordering = ['name']

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminUser()]
        return [permissions.IsAuthenticated()]

class ProductDetailView(generics.RetrieveUpdateAPIView):
    queryset = Product.objects.all().prefetch_related('variants').select_related('tax')
    serializer_class = ProductSerializer
    lookup_field = 'id'

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH']:
            return [IsAdminUser()]
        return [permissions.IsAuthenticated()]

class ProductVariantListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductVariantSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        return ProductVariant.objects.filter(product_id=self.kwargs['product_id'])

    def perform_create(self, serializer):
        serializer.save(product_id=self.kwargs['product_id'])

class ProductVariantDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ProductVariantSerializer
    lookup_field = 'id'

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH']:
            return [IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        return ProductVariant.objects.filter(product_id=self.kwargs['product_id'])

