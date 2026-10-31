from rest_framework import serializers
from .models import QuotationTemplate, QuotationTemplateLine, Quotation, QuotationLine

class QuotationTemplateLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True, default='')

    class Meta:
        model = QuotationTemplateLine
        fields = ['id', 'product', 'product_name', 'variant', 'qty', 'unit_price']
        read_only_fields = ['id']

class QuotationTemplateSerializer(serializers.ModelSerializer):
    lines = QuotationTemplateLineSerializer(many=True, required=False)
    plan_name = serializers.CharField(source='plan.name', read_only=True, default='')

    class Meta:
        model = QuotationTemplate
        fields = ['id', 'name', 'plan', 'plan_name', 'validity_days', 'lines', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        template = QuotationTemplate.objects.create(**validated_data)
        for l in lines_data:
            QuotationTemplateLine.objects.create(template=template, **l)
        return template

class QuotationLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True, default='')

    class Meta:
        model = QuotationLine
        fields = ['id', 'product', 'product_name', 'variant', 'qty', 'unit_price', 'tax']
        read_only_fields = ['id']

class QuotationSerializer(serializers.ModelSerializer):
    lines = QuotationLineSerializer(many=True, required=False)
    customer_name = serializers.CharField(source='customer.company_name', read_only=True, default='')
    plan_name = serializers.CharField(source='plan.name', read_only=True, default='')

    class Meta:
        model = Quotation
        fields = [
            'id',
            'quotation_number',
            'customer',
            'customer_name',
            'plan',
            'plan_name',
            'template',
            'status',
            'start_date',
            'expiry_date',
            'valid_until',
            'payment_terms',
            'notes',
            'lines',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'quotation_number', 'status', 'created_at', 'updated_at']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        quotation = Quotation.objects.create(**validated_data)
        for l in lines_data:
            QuotationLine.objects.create(quotation=quotation, **l)
        return quotation
