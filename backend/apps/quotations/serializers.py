from rest_framework import serializers
from .models import QuotationTemplate, QuotationTemplateLine, Quotation, QuotationLine

class QuotationTemplateLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationTemplateLine
        fields = ['id', 'product', 'variant', 'qty', 'unit_price']
        read_only_fields = ['id']

class QuotationTemplateSerializer(serializers.ModelSerializer):
    lines = QuotationTemplateLineSerializer(many=True, required=False)

    class Meta:
        model = QuotationTemplate
        fields = ['id', 'name', 'plan', 'validity_days', 'lines', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        template = QuotationTemplate.objects.create(**validated_data)
        for l in lines_data:
            QuotationTemplateLine.objects.create(template=template, **l)
        return template

class QuotationLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationLine
        fields = ['id', 'product', 'variant', 'qty', 'unit_price', 'tax']
        read_only_fields = ['id']

class QuotationSerializer(serializers.ModelSerializer):
    lines = QuotationLineSerializer(many=True, required=False)

    class Meta:
        model = Quotation
        fields = [
            'id',
            'quotation_number',
            'customer',
            'plan',
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

