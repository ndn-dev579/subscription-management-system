import uuid
from django.db import models
from django.conf import settings
from apps.customers.models import CustomerProfile
from apps.plans.models import Plan
from apps.products.models import Product, ProductVariant
from apps.taxes.models import TaxRule

class QuotationStatus(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    SENT = 'sent', 'Sent'
    CONFIRMED = 'confirmed', 'Confirmed'
    EXPIRED = 'expired', 'Expired'
    CANCELLED = 'cancelled', 'Cancelled'

class QuotationTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name='templates')
    validity_days = models.PositiveIntegerField(default=30)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'quotation_templates'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.validity_days} days)"

class QuotationTemplateLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(QuotationTemplate, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    variant = models.ForeignKey(ProductVariant, on_delete=models.SET_NULL, null=True, blank=True)
    qty = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'quotation_template_lines'

class Quotation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quotation_number = models.CharField(max_length=50, unique=True, db_index=True)
    customer = models.ForeignKey(CustomerProfile, on_delete=models.CASCADE, related_name='quotations')
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name='quotations')
    template = models.ForeignKey(QuotationTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name='generated_quotations')
    
    status = models.CharField(max_length=20, choices=QuotationStatus.choices, default=QuotationStatus.DRAFT)
    start_date = models.DateField()
    expiry_date = models.DateField(null=True, blank=True)
    valid_until = models.DateField()
    payment_terms = models.CharField(max_length=20, default='net30')
    
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'quotations'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.quotation_number} - {self.customer}"

    def save(self, *args, **kwargs):
        if not self.quotation_number:
            count = Quotation.objects.count() + 1
            self.quotation_number = f"QUO-{count:04d}"
        super().save(*args, **kwargs)

class QuotationLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    variant = models.ForeignKey(ProductVariant, on_delete=models.SET_NULL, null=True, blank=True)
    qty = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    tax = models.ForeignKey(TaxRule, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'quotation_lines'

