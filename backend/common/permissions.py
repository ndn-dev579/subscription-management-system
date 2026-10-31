from rest_framework import permissions

class IsAdminUser(permissions.BasePermission):
    """Allows access only to Admin users."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin)

class IsStaffMember(permissions.BasePermission):
    """Allows access to Admin and Staff users."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.user.is_admin or request.user.is_staff_member))

class IsCustomerUser(permissions.BasePermission):
    """Allows access to Customer users."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_customer)

class IsOwnerOrStaff(permissions.BasePermission):
    """
    Object-level permission allowing staff/admins full access,
    and customers access only to their own records.
    """
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_admin or request.user.is_staff_member:
            return True

        # Check customer ownership
        if hasattr(obj, 'user_id'):
            return obj.user_id == request.user.id
        if hasattr(obj, 'customer_id'):
            return obj.customer_id == request.user.id or (
                hasattr(obj, 'customer') and getattr(obj.customer, 'user_id', None) == request.user.id
            )
        if hasattr(obj, 'user'):
            return obj.user == request.user
        return False

