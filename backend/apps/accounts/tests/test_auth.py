import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import Role

User = get_user_model()

@pytest.fixture
def client():
    return APIClient()

@pytest.mark.django_db
class TestAuthentication:
    def test_customer_registration_success(self, client):
        payload = {
            'email': 'Alice@Brightloop.io',
            'name': 'Alice Smith',
            'company': 'Acme Corp',
            'password': 'StrongPassword123!',
        }
        response = client.post('/api/v1/auth/register/', payload, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert 'tokens' in response.data
        assert 'access' in response.data['tokens']
        assert 'refresh' in response.data['tokens']

        # Verify normalized email and default customer role
        user = User.objects.get(email='alice@brightloop.io')
        assert user.role == Role.CUSTOMER
        assert user.company == 'Acme Corp'

    def test_customer_registration_weak_password_fails(self, client):
        # Missing special character
        payload = {
            'email': 'bob@brightloop.io',
            'name': 'Bob Jones',
            'password': 'WeakPassword123',
        }
        response = client.post('/api/v1/auth/register/', payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'password' in response.data['error']['fields']

    def test_duplicate_email_registration_fails(self, client):
        User.objects.create_user(
            email='carol@brightloop.io',
            password='StrongPassword123!',
            name='Carol Danvers',
        )
        payload = {
            'email': 'CAROL@brightloop.io',
            'name': 'Carol Duplicate',
            'password': 'StrongPassword123!',
        }
        response = client.post('/api/v1/auth/register/', payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_and_jwt_claims(self, client):
        User.objects.create_user(
            email='dan@brightloop.io',
            password='StrongPassword123!',
            name='Dan Miller',
            company='Dan Consulting',
            role=Role.STAFF,
        )
        response = client.post(
            '/api/v1/auth/login/',
            {'email': 'DAN@brightloop.io', 'password': 'StrongPassword123!'},
            format='json',
        )
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
        assert 'refresh' in response.data
        assert response.data['user']['role'] == 'staff'
        assert response.data['user']['email'] == 'dan@brightloop.io'

    def test_me_endpoint_requires_auth(self, client):
        response = client.get('/api/v1/auth/me/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_me_endpoint_authenticated(self, client):
        user = User.objects.create_user(
            email='eve@brightloop.io',
            password='StrongPassword123!',
            name='Eve Polastri',
        )
        client.force_authenticate(user=user)
        response = client.get('/api/v1/auth/me/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['email'] == 'eve@brightloop.io'
        assert response.data['name'] == 'Eve Polastri'

    def test_staff_creation_by_admin(self, client):
        admin = User.objects.create_superuser(
            email='admin@brightloop.io',
            password='AdminPassword123!',
            name='Admin User',
        )
        client.force_authenticate(user=admin)
        payload = {
            'email': 'staff1@brightloop.io',
            'name': 'Staff Member One',
            'password': 'StaffPassword123!',
        }
        response = client.post('/api/v1/staff/', payload, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        created = User.objects.get(email='staff1@brightloop.io')
        assert created.role == Role.STAFF

    def test_staff_creation_by_non_admin_forbidden(self, client):
        staff = User.objects.create_user(
            email='staff2@brightloop.io',
            password='StaffPassword123!',
            name='Staff Member Two',
            role=Role.STAFF,
        )
        client.force_authenticate(user=staff)
        payload = {
            'email': 'staff3@brightloop.io',
            'name': 'Staff Member Three',
            'password': 'StaffPassword123!',
        }
        response = client.post('/api/v1/staff/', payload, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

