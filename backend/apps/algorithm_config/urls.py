from django.urls import path
from apps.algorithm_config.views import AlgorithmConfigRetrieveUpdateView

urlpatterns = [
    path('algorithm-config/', AlgorithmConfigRetrieveUpdateView.as_view(),
         name='algorithm-config'),
]
