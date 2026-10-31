import uuid
from django.db import models
from apps.subscriptions.models import Subscription
from apps.invoices.models import Invoice

class BillingCycle(models.Model):
    """
    Enforces idempotency and prevents duplicate billing per NFR-DATA-01:
    (subscription, period_start, period_end) is strictly unique.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name='billing_cycles')
    invoice = models.OneToOneField(Invoice, on_delete=models.CASCADE, related_name='billing_cycle')
    period_start = models.DateField()
    period_end = models.DateField()
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'billing_cycles'
        unique_together = ('subscription', 'period_start', 'period_end')
        ordering = ['-period_start']

    def __str__(self):
        return f"{self.subscription.subscription_number}: {self.period_start} to {self.period_end}"

