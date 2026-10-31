import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _

class PasswordComplexityValidator:
    """
    Validates password complexity according to FR-AUTH-03:
    - More than 8 characters (min length 9 enforced by MinimumLengthValidator)
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one special character
    """
    def validate(self, password, user=None):
        if not re.search(r'[A-Z]', password):
            raise ValidationError(
                _("Password must contain at least one uppercase letter."),
                code='password_no_upper',
            )
        if not re.search(r'[a-z]', password):
            raise ValidationError(
                _("Password must contain at least one lowercase letter."),
                code='password_no_lower',
            )
        if not re.search(r'[^A-Za-z0-9]', password):
            raise ValidationError(
                _("Password must contain at least one special character."),
                code='password_no_special',
            )

    def get_help_text(self):
        return _(
            "Your password must contain at least 9 characters, including uppercase letters, "
            "lowercase letters, and special characters."
        )

