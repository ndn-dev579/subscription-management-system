from django.urls import path
from .views import DiscountListCreateView, DiscountDetailView, DiscountDeactivateView

urlpatterns = [
    path('discounts/', DiscountListCreateView.as_view(), name='discount-list-create'),
    path('discounts/<uuid:id>/', DiscountDetailView.as_view(), name='discount-detail'),
    path('discounts/<uuid:id>/deactivate/', DiscountDeactivateView.as_view(), name='discount-deactivate'),
]

