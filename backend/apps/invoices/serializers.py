from rest_framework import serializers
from .models import Invoice, InvoiceLine

class InvoiceLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLine
        fields = [
            'id',
            'product',
            'variant',
            'description',
            'qty',
            'unit_price',
            'tax_rate',
            'tax_amount',
            'discount_amount',
            'line_total',
        ]
        read_only_fields = ['id']

class InvoiceSerializer(serializers.ModelSerializer):
    lines = InvoiceLineSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.company_name', read_only=True, default='')
    subscription_number = serializers.CharField(source='subscription.subscription_number', read_only=True, default='')

    class Meta:
        model = Invoice
        fields = [
            'id',
            'invoice_number',
            'customer',
            'customer_name',
            'subscription',
            'subscription_number',
            'period_start',
            'period_end',
            'issue_date',
            'due_date',
            'status',
            'subtotal',
            'tax_total',
            'discount_total',
            'total_amount',
            'paid_amount',
            'outstanding_amount',
            'cancel_reason',
            'cancelled_at',
            'lines',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'invoice_number',
            'paid_amount',
            'outstanding_amount',
            'created_at',
            'updated_at',
        ]
