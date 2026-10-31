from rest_framework import serializers
from .models import Plan

class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = [
            'id',
            'name',
            'price',
            'currency',
            'billing_interval',
            'minimum_quantity',
            'start_date',
            'end_date',
            'tax',
            'auto_close_on_end',
            'allow_early_close',
            'allow_pause',
            'allow_renewal',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

