import uuid

from django.db import models

from apps.courses.models import Course


class ConflictAnalysisResult(models.Model):
    semester = models.CharField(max_length=20)
    course_count = models.IntegerField(default=0)
    conflict_pairs_count = models.IntegerField(default=0)
    threshold = models.IntegerField(default=30)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "conflict_analysis_result"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.semester} ({self.conflict_pairs_count} pairs)"


class ConflictPair(models.Model):
    result = models.ForeignKey(ConflictAnalysisResult, on_delete=models.CASCADE, related_name="pairs")
    course_a = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="conflict_a")
    course_b = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="conflict_b")
    conflicting_student_count = models.IntegerField(default=0)
    conflict_rate = models.FloatField(default=0.0)

    class Meta:
        db_table = "conflict_pair"
        ordering = ["-conflicting_student_count"]

    def __str__(self):
        return f"{self.course_a.name} vs {self.course_b.name}"


class ConflictTaskRecord(models.Model):
    STATUS_CHOICES = [
        ("PENDING", "等待中"),
        ("RUNNING", "执行中"),
        ("SUCCESS", "完成"),
        ("FAILED", "失败"),
    ]

    task_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    result = models.ForeignKey(ConflictAnalysisResult, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="PENDING")
    progress = models.FloatField(default=0.0)
    analyzed_pairs = models.IntegerField(default=0)
    total_pairs = models.IntegerField(default=0)
    conflict_pairs_found = models.IntegerField(default=0)
    error_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "conflict_task_record"
