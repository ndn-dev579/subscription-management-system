import uuid
from django.db import models
from django.conf import settings
from apps.customers.models import CustomerProfile
from apps.plans.models import Plan
from apps.products.models import Product, ProductVariant
from apps.taxes.models import TaxRule

class SubscriptionStatus(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    CONFIRMED = 'confirmed', 'Confirmed'
    ACTIVE = 'active', 'Active'
    PAUSED = 'paused', 'Paused'
    CLOSED = 'closed', 'Closed'

class Subscription(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription_number = models.CharField(max_length=50, unique=True, db_index=True)
    customer = models.ForeignKey(CustomerProfile, on_delete=models.CASCADE, related_name='subscriptions')
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name='subscriptions')
    quotation = models.ForeignKey('quotations.Quotation', on_delete=models.SET_NULL, null=True, blank=True, related_name='subscription_record')
    
    status = models.CharField(max_length=20, choices=SubscriptionStatus.choices, default=SubscriptionStatus.ACTIVE)
    start_date = models.DateField()
    expiry_date = models.DateField()
    payment_terms = models.CharField(max_length=20, default='net30')
    
    # Lifecycle snapshot flags inherited from plan
    auto_close_on_end = models.BooleanField(default=True)
    allow_early_close = models.BooleanField(default=True)
    allow_pause = models.BooleanField(default=True)
    allow_renewal = models.BooleanField(default=True)
    
    last_billed_date = models.DateField(null=True, blank=True)
    next_billing_date = models.DateField(null=True, blank=True)
    
    close_reason = models.TextField(blank=True, default='')
    closed_at = models.DateTimeField(null=True, blank=True)
    
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'subscriptions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.subscription_number} - {self.customer} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.subscription_number:
            count = Subscription.objects.count() + 1
            self.subscription_number = f"SUB-{count:04d}"
        if not self.next_billing_date and self.start_date:
            self.next_billing_date = self.start_date
        super().save(*args, **kwargs)

class SubscriptionLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    variant = models.ForeignKey(ProductVariant, on_delete=models.SET_NULL, null=True, blank=True)
    qty = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    tax = models.ForeignKey(TaxRule, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'subscription_lines'

