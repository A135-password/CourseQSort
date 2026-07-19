from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.protected_slots.views import ProtectedSlotViewSet

router = DefaultRouter()
router.register(r"protected-slots", ProtectedSlotViewSet, basename="protected-slot")

urlpatterns = [
    path("", include(router.urls)),
]
