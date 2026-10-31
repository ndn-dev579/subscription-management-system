from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Role

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'company', 'role', 'is_active', 'created_at']
        read_only_fields = ['id', 'role', 'is_active', 'created_at']

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    company = serializers.CharField(required=False, allow_blank=True, default='')

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'company', 'password']
        read_only_fields = ['id']

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email=normalized).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return normalized

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data['email'],
            name=validated_data['name'],
            company=validated_data.get('company', ''),
            password=validated_data['password'],
            role=Role.CUSTOMER,
        )
        return user

class CreateStaffSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'company', 'password', 'role']
        read_only_fields = ['id']

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email=normalized).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return normalized

    def create(self, validated_data):
        validated_data['role'] = Role.STAFF
        user = User.objects.create_user(
            email=validated_data['email'],
            name=validated_data['name'],
            company=validated_data.get('company', ''),
            password=validated_data['password'],
            role=Role.STAFF,
        )
        return user

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email'] = user.email
        token['name'] = user.name
        token['role'] = user.role
        token['company'] = user.company
        return token

    def validate(self, attrs):
        # Email case-insensitive login support
        if 'email' in attrs:
            attrs['email'] = attrs['email'].strip().lower()
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data

class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()

class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, validators=[validate_password])

