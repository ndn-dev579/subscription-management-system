from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API v1 domain routes
    path('api/v1/', include('apps.accounts.urls')),
    path('api/v1/', include('apps.customers.urls')),
    path('api/v1/', include('apps.taxes.urls')),
    path('api/v1/', include('apps.products.urls')),
    path('api/v1/', include('apps.plans.urls')),
    path('api/v1/', include('apps.discounts.urls')),
    path('api/v1/', include('apps.quotations.urls')),
    path('api/v1/', include('apps.subscriptions.urls')),
    path('api/v1/', include('apps.invoices.urls')),
    path('api/v1/', include('apps.payments.urls')),
    path('api/v1/', include('apps.reports.urls')),

    # OpenAPI 3.0 documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]
