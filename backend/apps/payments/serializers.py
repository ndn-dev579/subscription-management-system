from rest_framework import serializers
from .models import Payment, PaymentAllocation

class PaymentAllocationSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True, default='')

    class Meta:
        model = PaymentAllocation
        fields = ['id', 'invoice', 'invoice_number', 'amount', 'created_at']
        read_only_fields = ['id', 'created_at']

class PaymentSerializer(serializers.ModelSerializer):
    allocations = PaymentAllocationSerializer(many=True, required=False)
    customer_name = serializers.CharField(source='customer.company_name', read_only=True, default='')

    class Meta:
        model = Payment
        fields = [
            'id',
            'payment_number',
            'customer',
            'customer_name',
            'amount',
            'currency',
            'method',
            'payment_date',
            'transaction_reference',
            'note',
            'is_reversed',
            'reversed_at',
            'reversal_reason',
            'allocations',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'payment_number',
            'is_reversed',
            'reversed_at',
            'reversal_reason',
            'created_at',
            'updated_at',
        ]

    def create(self, validated_data):
        allocations_data = validated_data.pop('allocations', [])
        payment = Payment.objects.create(**validated_data)
        for alloc in allocations_data:
            PaymentAllocation.objects.create(payment=payment, **alloc)
        return payment
