from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from common.permissions import IsAdminUser
from .models import Role
from .serializers import (
    UserSerializer,
    RegisterSerializer,
    CreateStaffSerializer,
    CustomTokenObtainPairSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)

User = get_user_model()

class RegisterView(generics.CreateAPIView):
    """Register customer account according to FR-AUTH-01."""
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Automatically issue JWT tokens upon registration
        refresh = RefreshToken.for_user(user)
        refresh['email'] = user.email
        refresh['name'] = user.name
        refresh['role'] = user.role
        refresh['company'] = user.company

        return Response(
            {
                'message': 'Account created successfully.',
                'user': UserSerializer(user).data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                },
            },
            status=status.HTTP_201_CREATED,
        )

class CustomLoginView(TokenObtainPairView):
    """Login and obtain JWT tokens according to FR-AUTH-04."""
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]

class MeView(generics.RetrieveUpdateAPIView):
    """Retrieve or update current authenticated user profile."""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

class LogoutView(APIView):
    """Logout and blacklist refresh token."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response({'message': 'Logged out successfully.'}, status=status.HTTP_200_OK)
        except Exception:
            return Response({'message': 'Invalid token or already logged out.'}, status=status.HTTP_200_OK)

class PasswordResetRequestView(APIView):
    """Request password reset email according to FR-AUTH-05."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        user = User.objects.filter(email=email).first()
        if user and user.is_active:
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            reset_url = f"http://localhost:5173/reset-password/{uid}_{token}"
            
            # Send email via configured backend (console in dev)
            send_mail(
                subject="Reset Your Brightloop Password",
                message=f"Hello {user.name},\n\nPlease click the link below to reset your password:\n{reset_url}\n\nIf you did not request this, please ignore this email.",
                from_email="no-reply@brightloop.local",
                recipient_list=[user.email],
                fail_silently=True,
            )

        # Always return 200 to prevent user enumeration
        return Response(
            {'message': 'If an account exists with this email address, a password reset link has been sent.'},
            status=status.HTTP_200_OK,
        )

class PasswordResetConfirmView(APIView):
    """Confirm password reset with token."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token_str = serializer.validated_data['token']
        new_password = serializer.validated_data['password']

        try:
            uid, token = token_str.split('_', 1)
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (ValueError, TypeError, OverflowError, User.DoesNotExist):
            return Response(
                {'error': {'code': 'invalid_token', 'message': 'Password reset token is invalid or has expired.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {'error': {'code': 'invalid_token', 'message': 'Password reset token is invalid or has expired.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save()
        return Response({'message': 'Password has been reset successfully.'}, status=status.HTTP_200_OK)

class StaffListCreateView(generics.ListCreateAPIView):
    """Admin-only endpoint for managing staff members according to FR-AUTH-07."""
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateStaffSerializer
        return UserSerializer

    def get_queryset(self):
        return User.objects.filter(role=Role.STAFF)

class StaffDetailView(generics.RetrieveUpdateAPIView):
    """Admin-only endpoint to view or update/deactivate staff."""
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]
    queryset = User.objects.filter(role=Role.STAFF)
    lookup_field = 'id'

