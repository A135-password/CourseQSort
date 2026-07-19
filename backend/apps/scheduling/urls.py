from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.scheduling.views import GenerateView, PlanViewSet, TaskStatusView

router = DefaultRouter()
router.register(r"plans", PlanViewSet, basename="plan")

urlpatterns = [
    path("schedule/generate/", GenerateView.as_view({"post": "create"}), name="schedule-generate"),
    path("schedule/tasks/<uuid:pk>/", TaskStatusView.as_view({"get": "retrieve"}), name="schedule-task-status"),
    path("schedule/", include(router.urls)),
]
