from django.urls import path
from .views import (
    PaymentListCreateView,
    PaymentDetailView,
    PaymentReverseView,
)

urlpatterns = [
    path('payments/', PaymentListCreateView.as_view(), name='payment-list-create'),
    path('payments/<uuid:id>/', PaymentDetailView.as_view(), name='payment-detail'),
    path('payments/<uuid:id>/reverse/', PaymentReverseView.as_view(), name='payment-reverse'),
]

