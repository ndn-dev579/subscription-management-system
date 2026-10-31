from django.urls import path
from .views import (
    DashboardMetricsView,
    RevenueReportView,
    SubscriptionsReportView,
    InvoicesReportView,
)

urlpatterns = [
    path('reports/dashboard/', DashboardMetricsView.as_view(), name='report-dashboard'),
    path('reports/revenue/', RevenueReportView.as_view(), name='report-revenue'),
    path('reports/subscriptions/', SubscriptionsReportView.as_view(), name='report-subscriptions'),
    path('reports/invoices/', InvoicesReportView.as_view(), name='report-invoices'),
]

