import uuid
from django.db import models
from django.contrib.auth.models import User
from apps.courses.models import Course, Teacher, Classroom


class SchedulePlan(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', '草稿'),
        ('PUBLISHED', '已发布'),
    ]

    plan_name = models.CharField(max_length=200)
    semester = models.CharField(max_length=20, blank=True, default='')
    major_ids = models.JSONField(default=list, blank=True)
    overall_fitness = models.FloatField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='DRAFT')
    algorithm_config = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = 'schedule_plan'
        ordering = ['-created_at']

    def __str__(self):
        return self.plan_name


class ScheduleEntry(models.Model):
    plan = models.ForeignKey(
        SchedulePlan, on_delete=models.CASCADE, related_name='entries'
    )
    course = models.ForeignKey(
        Course, on_delete=models.SET_NULL, null=True, blank=True
    )
    teacher = models.ForeignKey(
        Teacher, on_delete=models.SET_NULL, null=True, blank=True
    )
    classroom = models.ForeignKey(
        Classroom, on_delete=models.SET_NULL, null=True, blank=True
    )
    day_of_week = models.IntegerField()
    period = models.IntegerField()
    student_group_ids = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = 'schedule_entry'
        ordering = ['day_of_week', 'period']

    def __str__(self):
        cname = self.course.name if self.course else '(no course)'
        return f'{cname} 周{self.day_of_week} 第{self.period}节'


class TaskRecord(models.Model):
    STATUS_CHOICES = [
        ('PENDING', '等待中'),
        ('RUNNING', '执行中'),
        ('SUCCESS', '完成'),
        ('FAILED', '失败'),
    ]

    task_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(
        SchedulePlan, on_delete=models.SET_NULL, null=True, blank=True
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    progress = models.FloatField(default=0.0)
    current_generation = models.IntegerField(null=True, blank=True)
    best_fitness = models.FloatField(null=True, blank=True)
    estimated_time_remaining = models.CharField(max_length=20, blank=True, default='')
    error_message = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'task_record'
