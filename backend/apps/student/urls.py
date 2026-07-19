from django.urls import path

from apps.student.views import (
    ConflictDetailView,
    CourseListView,
    DropCourseView,
    FreeSlotsView,
    RecommendView,
    ScheduleView,
    SelectCourseView,
)

urlpatterns = [
    path("schedule/", ScheduleView.as_view(), name="student-schedule"),
    path("courses/", CourseListView.as_view(), name="student-courses"),
    path("courses/<int:pk>/conflict-detail/", ConflictDetailView.as_view(), name="student-conflict-detail"),
    path("courses/<int:pk>/select/", SelectCourseView.as_view(), name="student-select"),
    path("courses/<int:pk>/drop/", DropCourseView.as_view(), name="student-drop"),
    path("free-slots/", FreeSlotsView.as_view(), name="student-free-slots"),
    path("free-slots/<int:day>/<int:period>/recommend/", RecommendView.as_view(), name="student-recommend"),
]
