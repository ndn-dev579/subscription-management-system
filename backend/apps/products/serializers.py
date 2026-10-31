from rest_framework import serializers
from .models import Product, ProductVariant

class ProductVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = ['id', 'product', 'attribute', 'value', 'extra_price', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {'product': {'required': False}}

class ProductSerializer(serializers.ModelSerializer):
    variants = ProductVariantSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'product_type',
            'sales_price',
            'cost_price',
            'currency',
            'tax',
            'notes',
            'is_active',
            'variants',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

