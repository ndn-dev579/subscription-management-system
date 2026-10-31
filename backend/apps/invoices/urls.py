from django.urls import path
from .views import (
    InvoiceListView,
    InvoiceDetailView,
    InvoiceConfirmView,
    InvoiceCancelView,
    InvoicePdfView,
)

urlpatterns = [
    path('invoices/', InvoiceListView.as_view(), name='invoice-list'),
    path('invoices/<uuid:id>/', InvoiceDetailView.as_view(), name='invoice-detail'),
    path('invoices/<uuid:id>/confirm/', InvoiceConfirmView.as_view(), name='invoice-confirm'),
    path('invoices/<uuid:id>/cancel/', InvoiceCancelView.as_view(), name='invoice-cancel'),
    path('invoices/<uuid:id>/pdf/', InvoicePdfView.as_view(), name='invoice-pdf'),
]

