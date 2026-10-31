from rest_framework import serializers
from .models import DiscountRule

class DiscountRuleSerializer(serializers.ModelSerializer):
    is_available = serializers.BooleanField(read_only=True)

    class Meta:
        model = DiscountRule
        fields = [
            'id',
            'name',
            'discount_type',
            'value',
            'min_amount',
            'min_quantity',
            'start_date',
            'end_date',
            'max_uses',
            'current_uses',
            'product',
            'is_active',
            'is_available',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'current_uses', 'created_at', 'updated_at']

