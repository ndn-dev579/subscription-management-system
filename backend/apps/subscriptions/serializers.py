from rest_framework import serializers
from .models import Subscription, SubscriptionLine

class SubscriptionLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True, default='')

    class Meta:
        model = SubscriptionLine
        fields = ['id', 'product', 'product_name', 'variant', 'qty', 'unit_price', 'tax']
        read_only_fields = ['id']

class SubscriptionSerializer(serializers.ModelSerializer):
    lines = SubscriptionLineSerializer(many=True, required=False)
    customer_name = serializers.CharField(source='customer.company_name', read_only=True, default='')
    plan_name = serializers.CharField(source='plan.name', read_only=True, default='')
    billing_interval = serializers.CharField(source='plan.billing_interval', read_only=True, default='monthly')

    class Meta:
        model = Subscription
        fields = [
            'id',
            'subscription_number',
            'customer',
            'customer_name',
            'plan',
            'plan_name',
            'billing_interval',
            'quotation',
            'status',
            'start_date',
            'expiry_date',
            'payment_terms',
            'auto_close_on_end',
            'allow_early_close',
            'allow_pause',
            'allow_renewal',
            'last_billed_date',
            'next_billing_date',
            'close_reason',
            'closed_at',
            'lines',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'subscription_number',
            'last_billed_date',
            'next_billing_date',
            'closed_at',
            'created_at',
            'updated_at',
        ]

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        sub = Subscription.objects.create(**validated_data)
        for l in lines_data:
            SubscriptionLine.objects.create(subscription=sub, **l)
        return sub
