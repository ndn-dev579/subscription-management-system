import uuid
from decimal import Decimal
from django.db import models
from django.conf import settings
from apps.customers.models import CustomerProfile
from apps.invoices.models import Invoice, InvoiceStatus

class PaymentMethod(models.TextChoices):
    BANK_TRANSFER = 'BANK_TRANSFER', 'Bank Transfer'
    CASH = 'CASH', 'Cash'
    CARD = 'CARD', 'Credit/Debit Card'
    UPI = 'UPI', 'UPI'

class Payment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment_number = models.CharField(max_length=50, unique=True, db_index=True)
    customer = models.ForeignKey(CustomerProfile, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='INR')
    method = models.CharField(max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.BANK_TRANSFER)
    payment_date = models.DateField()
    transaction_reference = models.CharField(max_length=100, blank=True, default='')
    note = models.TextField(blank=True, default='')
    
    is_reversed = models.BooleanField(default=False)
    reversed_at = models.DateTimeField(null=True, blank=True)
    reversal_reason = models.TextField(blank=True, default='')
    
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payments'
        ordering = ['-payment_date', '-created_at']

    def __str__(self):
        return f"{self.payment_number} - {self.customer} ({self.amount} {self.currency})"

    def save(self, *args, **kwargs):
        if not self.payment_number:
            count = Payment.objects.count() + 1
            self.payment_number = f"PAY-{count:04d}"
        super().save(*args, **kwargs)

class PaymentAllocation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name='allocations')
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payment_allocations')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payment_allocations'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Recalculate invoice paid amount
        inv = self.invoice
        total_paid = inv.payment_allocations.filter(payment__is_reversed=False).aggregate(
            total=models.Sum('amount')
        )['total'] or Decimal('0.00')
        inv.paid_amount = total_paid
        inv.outstanding_amount = max(Decimal('0.00'), inv.total_amount - total_paid)
        if inv.status == InvoiceStatus.CONFIRMED and inv.outstanding_amount <= Decimal('0.00') and inv.total_amount > Decimal('0.00'):
            inv.status = InvoiceStatus.PAID
        inv.save()

