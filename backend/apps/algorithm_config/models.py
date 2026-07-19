from django.contrib.auth.models import User
from django.db import models


class AlgorithmConfig(models.Model):
    variance_weight = models.FloatField(default=0.6)
    conflict_penalty_weight = models.FloatField(default=0.4)
    protected_slot_penalty = models.FloatField(default=8.0)
    population_size = models.IntegerField(default=200)
    max_generations = models.IntegerField(default=500)
    mutation_rate = models.FloatField(default=0.05)
    crossover_rate = models.FloatField(default=0.85)
    timeout_seconds = models.IntegerField(default=300)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = "algorithm_config"

    def __str__(self):
        return f"AlgorithmConfig (variance={self.variance_weight})"
