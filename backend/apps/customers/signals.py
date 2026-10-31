from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.accounts.models import User, Role
from .models import CustomerProfile

@receiver(post_save, sender=User)
def create_customer_profile_for_new_user(sender, instance, created, **kwargs):
    if created and instance.role == Role.CUSTOMER:
        CustomerProfile.objects.get_or_create(
            user=instance,
            defaults={
                'company_name': instance.company,
                'contact_name': instance.name,
                'billing_email': instance.email,
            },
        )

