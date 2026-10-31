from django.urls import path
from .views import TaxListCreateView, TaxDetailView

urlpatterns = [
    path('taxes/', TaxListCreateView.as_view(), name='tax-list-create'),
    path('taxes/<uuid:id>/', TaxDetailView.as_view(), name='tax-detail'),
]

