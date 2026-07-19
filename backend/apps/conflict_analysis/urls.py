from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.conflict_analysis.views import ResultViewSet, RunAnalysisView, TaskStatusView

router = DefaultRouter()
router.register(r"results", ResultViewSet, basename="conflict-result")

urlpatterns = [
    path("conflict-analysis/run/", RunAnalysisView.as_view({"post": "create"}), name="conflict-analysis-run"),
    path(
        "conflict-analysis/tasks/<uuid:pk>/",
        TaskStatusView.as_view({"get": "retrieve"}),
        name="conflict-analysis-task-status",
    ),
    path("conflict-analysis/", include(router.urls)),
]
