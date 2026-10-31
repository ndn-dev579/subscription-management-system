from django.urls import path
from .views import (
    ProductListCreateView,
    ProductDetailView,
    ProductVariantListCreateView,
    ProductVariantDetailView,
)

urlpatterns = [
    path('products/', ProductListCreateView.as_view(), name='product-list-create'),
    path('products/<uuid:id>/', ProductDetailView.as_view(), name='product-detail'),
    path('products/<uuid:product_id>/variants/', ProductVariantListCreateView.as_view(), name='product-variant-list-create'),
    path('products/<uuid:product_id>/variants/<uuid:id>/', ProductVariantDetailView.as_view(), name='product-variant-detail'),
]

