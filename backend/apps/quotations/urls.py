from django.urls import path
from .views import (
    QuotationTemplateListCreateView,
    QuotationTemplateDetailView,
    QuotationListCreateView,
    QuotationDetailView,
    QuotationConfirmView,
    QuotationCancelView,
)

urlpatterns = [
    path('quotation-templates/', QuotationTemplateListCreateView.as_view(), name='quotation-template-list-create'),
    path('quotation-templates/<uuid:id>/', QuotationTemplateDetailView.as_view(), name='quotation-template-detail'),
    path('quotations/', QuotationListCreateView.as_view(), name='quotation-list-create'),
    path('quotations/<uuid:id>/', QuotationDetailView.as_view(), name='quotation-detail'),
    path('quotations/<uuid:id>/confirm/', QuotationConfirmView.as_view(), name='quotation-confirm'),
    path('quotations/<uuid:id>/cancel/', QuotationCancelView.as_view(), name='quotation-cancel'),
]

