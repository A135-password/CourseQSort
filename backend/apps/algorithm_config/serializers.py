from rest_framework import serializers
from apps.algorithm_config.models import AlgorithmConfig


class AlgorithmConfigSerializer(serializers.ModelSerializer):
    updated_by = serializers.SerializerMethodField()

    class Meta:
        model = AlgorithmConfig
        fields = [
            'variance_weight', 'conflict_penalty_weight',
            'protected_slot_penalty', 'population_size',
            'max_generations', 'mutation_rate', 'crossover_rate',
            'timeout_seconds', 'updated_at', 'updated_by',
        ]
        read_only_fields = ['updated_at', 'updated_by']

    def get_updated_by(self, obj):
        if obj.updated_by:
            profile = getattr(obj.updated_by, 'profile', None)
            return profile.name if profile else obj.updated_by.username
        return None
