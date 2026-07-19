from django.contrib.auth.models import User
from django.db import models


class Profile(models.Model):
    ROLE_CHOICES = [
        ('MANAGER', '管理员'),
        ('ADMIN', '教务'),
        ('TEACHER', '教师'),
        ('STUDENT', '学生'),
    ]

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='profile'
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='STUDENT')
    name = models.CharField(max_length=50, blank=True, default='')
    major = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = 'profile'

    def __str__(self):
        return f'{self.name} ({self.get_role_display()})'
