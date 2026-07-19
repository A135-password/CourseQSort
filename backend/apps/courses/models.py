from django.contrib.auth.models import User
from django.db import models


class Major(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, blank=True, default="")
    student_count = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = "major"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Teacher(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="teacher_profile", verbose_name="绑定用户"
    )
    name = models.CharField(max_length=50)
    employee_no = models.CharField(max_length=50, blank=True, default="")
    department = models.CharField(max_length=100, blank=True, default="")
    unavailable_slots = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "teacher"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Classroom(models.Model):
    name = models.CharField(max_length=100)
    capacity = models.IntegerField(default=60)
    building = models.CharField(max_length=200, blank=True, default="")
    equipment_types = models.JSONField(default=list, blank=True)
    is_lab = models.BooleanField(default=False)

    class Meta:
        db_table = "classroom"
        ordering = ["building", "name"]

    def __str__(self):
        return f"{self.building}-{self.name}" if self.building else self.name


class Course(models.Model):
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, blank=True, default="")
    credit = models.FloatField(default=0.0)
    hours = models.IntegerField(null=True, blank=True)
    semester = models.CharField(max_length=20, blank=True, default="")
    campus = models.CharField(max_length=50, blank=True, default="")
    major = models.ForeignKey(Major, on_delete=models.SET_NULL, null=True, blank=True)
    teachers = models.ManyToManyField(Teacher, blank=True)
    required_classroom_types = models.JSONField(default=list, blank=True)
    expected_student_count = models.IntegerField(null=True, blank=True)
    is_professional_course = models.BooleanField(default=True)
    session_length = models.IntegerField(default=2, help_text="每次课连排节数（每门课程独立设置）")
    prerequisites = models.JSONField(default=list, blank=True)
    course_id_from_source = models.CharField(max_length=50, unique=True, verbose_name="来源系统 courseId")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "course"
        ordering = ["-semester", "name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class CourseScheduleItem(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="schedule_items")
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True)
    classroom = models.ForeignKey(Classroom, on_delete=models.SET_NULL, null=True, blank=True)
    day_of_week = models.IntegerField()
    period = models.IntegerField()
    week_start = models.IntegerField(default=1)
    week_end = models.IntegerField(default=18)
    class_identification = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        db_table = "course_schedule_item"
        ordering = ["day_of_week", "period"]

    def __str__(self):
        return f"{self.course.name} 周{self.day_of_week} 第{self.period}节"


class Student(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="student_profile", verbose_name="绑定用户"
    )
    student_no = models.CharField(max_length=50, blank=True, default="")
    name = models.CharField(max_length=50, blank=True, default="")
    major = models.ForeignKey(Major, on_delete=models.SET_NULL, null=True, blank=True)
    grade = models.CharField(max_length=20, blank=True, default="")
    class_identification = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        db_table = "student"
        ordering = ["grade", "major"]

    def __str__(self):
        return f"{self.name} ({self.student_no})"
