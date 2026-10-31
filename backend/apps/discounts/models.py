import uuid
from django.db import models
from apps.products.models import Product

class DiscountType(models.TextChoices):
    FIXED = 'fixed', 'Fixed Amount'
    PERCENT = 'percent', 'Percentage'

class DiscountRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    discount_type = models.CharField(max_length=20, choices=DiscountType.choices, default=DiscountType.PERCENT)
    value = models.DecimalField(max_digits=12, decimal_places=2)  # e.g. 10% or 500 INR
    min_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    min_quantity = models.PositiveIntegerField(default=0)
    
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    max_uses = models.PositiveIntegerField(default=0)  # 0 means unlimited
    current_uses = models.PositiveIntegerField(default=0)
    
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True, related_name='discounts')
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'discount_rules'
        ordering = ['name']

    def __str__(self):
        suffix = '%' if self.discount_type == DiscountType.PERCENT else ' flat'
        return f"{self.name} ({self.value}{suffix})"

    @property
    def is_available(self):
        if not self.is_active:
            return False
        if self.max_uses > 0 and self.current_uses >= self.max_uses:
            return False
        return True

