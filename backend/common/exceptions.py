import uuid
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

def custom_exception_handler(exc, context):
    """
    Standardizes error responses according to docs/API.md:
    {
      "error": {
        "code": "validation_error",
        "message": "Human readable message",
        "fields": { "field_name": ["error detail"] },
        "request_id": "uuid"
      }
    }
    """
    response = exception_handler(exc, context)
    request_id = str(uuid.uuid4())

    if response is not None:
        error_code = 'error'
        fields = {}
        message = 'An error occurred during request processing.'

        if response.status_code == status.HTTP_400_BAD_REQUEST:
            error_code = 'validation_error'
            message = 'Please correct the highlighted fields.'
            if isinstance(response.data, dict):
                fields = response.data
            elif isinstance(response.data, list):
                fields = {'non_field_errors': response.data}
        elif response.status_code == status.HTTP_401_UNAUTHORIZED:
            error_code = 'unauthorized'
            message = response.data.get('detail', 'Authentication credentials were not provided or are invalid.')
        elif response.status_code == status.HTTP_403_FORBIDDEN:
            error_code = 'forbidden'
            message = response.data.get('detail', 'You do not have permission to perform this action.')
        elif response.status_code == status.HTTP_404_NOT_FOUND:
            error_code = 'not_found'
            message = response.data.get('detail', 'The requested resource was not found.')
        elif response.status_code == status.HTTP_409_CONFLICT:
            error_code = 'conflict'
            message = response.data.get('detail', 'The request could not be completed due to a resource state conflict.')
        else:
            if isinstance(response.data, dict) and 'detail' in response.data:
                message = response.data['detail']

        response.data = {
            'error': {
                'code': error_code,
                'message': str(message),
                'fields': fields,
                'request_id': request_id,
            }
        }

    return response

