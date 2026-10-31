import uuid
from django.db import models
from apps.taxes.models import TaxRule

class ProductType(models.TextChoices):
    SOFTWARE = 'Software', 'Software'
    ADDON = 'Add-on', 'Add-on'
    SERVICE = 'Service', 'Service'
    HARDWARE = 'Hardware', 'Hardware'

class Product(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    product_type = models.CharField(max_length=50, choices=ProductType.choices, default=ProductType.SOFTWARE)
    sales_price = models.DecimalField(max_digits=12, decimal_places=2)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default='INR')
    tax = models.ForeignKey(TaxRule, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    notes = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'products'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.sales_price} {self.currency})"

class ProductVariant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants')
    attribute = models.CharField(max_length=100)  # e.g., "Brand", "Edition"
    value = models.CharField(max_length=100)      # e.g., "Odoo", "Enterprise"
    extra_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # e.g., +560.00
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'product_variants'
        ordering = ['attribute', 'value']

    def __str__(self):
        return f"{self.product.name} - {self.attribute}: {self.value} (+{self.extra_price})"

