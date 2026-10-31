import uuid
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _

class CustomerProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='customer_profile',
    )
    customer_number = models.CharField(max_length=50, unique=True, db_index=True)
    company_name = models.CharField(max_length=255, blank=True, default='')
    contact_name = models.CharField(max_length=255)
    billing_email = models.EmailField(blank=True, default='')
    phone = models.CharField(max_length=50, blank=True, default='')
    billing_address = models.JSONField(default=dict, blank=True)
    tax_identifier = models.CharField(max_length=100, blank=True, default='')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customer_profiles'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.customer_number} - {self.company_name or self.contact_name}"

    def save(self, *args, **kwargs):
        if not self.customer_number:
            count = CustomerProfile.objects.count() + 1
            self.customer_number = f"CUST-{count:04d}"
        if not self.billing_email and self.user:
            self.billing_email = self.user.email
        if not self.contact_name and self.user:
            self.contact_name = self.user.name
        if not self.company_name and self.user:
            self.company_name = self.user.company
        super().save(*args, **kwargs)

