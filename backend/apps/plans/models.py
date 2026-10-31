import uuid
from django.db import models
from apps.taxes.models import TaxRule

class BillingInterval(models.TextChoices):
    DAILY = 'daily', 'Daily'
    WEEKLY = 'weekly', 'Weekly'
    MONTHLY = 'monthly', 'Monthly'
    YEARLY = 'yearly', 'Yearly'

class Plan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='INR')
    billing_interval = models.CharField(max_length=20, choices=BillingInterval.choices, default=BillingInterval.MONTHLY)
    minimum_quantity = models.PositiveIntegerField(default=1)
    
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    tax = models.ForeignKey(TaxRule, on_delete=models.SET_NULL, null=True, blank=True, related_name='plans')
    
    auto_close_on_end = models.BooleanField(default=True)
    allow_early_close = models.BooleanField(default=True)
    allow_pause = models.BooleanField(default=True)
    allow_renewal = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'plans'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.price} {self.currency}/{self.billing_interval})"

