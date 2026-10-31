from django.urls import path
from .views import (
    SubscriptionListCreateView,
    SubscriptionDetailView,
    SubscriptionPauseView,
    SubscriptionResumeView,
    SubscriptionRenewView,
    SubscriptionCloseView,
)

urlpatterns = [
    path('subscriptions/', SubscriptionListCreateView.as_view(), name='subscription-list-create'),
    path('subscriptions/<uuid:id>/', SubscriptionDetailView.as_view(), name='subscription-detail'),
    path('subscriptions/<uuid:id>/pause/', SubscriptionPauseView.as_view(), name='subscription-pause'),
    path('subscriptions/<uuid:id>/resume/', SubscriptionResumeView.as_view(), name='subscription-resume'),
    path('subscriptions/<uuid:id>/renew/', SubscriptionRenewView.as_view(), name='subscription-renew'),
    path('subscriptions/<uuid:id>/close/', SubscriptionCloseView.as_view(), name='subscription-close'),
]

