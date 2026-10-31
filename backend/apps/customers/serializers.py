from rest_framework import serializers
from apps.accounts.serializers import UserSerializer
from .models import CustomerProfile

class CustomerProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = CustomerProfile
        fields = [
            'id',
            'user',
            'user_id',
            'customer_number',
            'company_name',
            'contact_name',
            'billing_email',
            'phone',
            'billing_address',
            'tax_identifier',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'customer_number', 'created_at', 'updated_at']

