from django.db import models


class ProtectedSlot(models.Model):
    day_of_week = models.IntegerField()
    start_period = models.IntegerField()
    end_period = models.IntegerField()
    penalty_weight = models.FloatField(default=8.0)
    description = models.CharField(max_length=200, blank=True, default='')

    class Meta:
        db_table = 'protected_slot'
        ordering = ['day_of_week', 'start_period']

    def __str__(self):
        return f'周{self.day_of_week} 第{self.start_period}-{self.end_period}节'
