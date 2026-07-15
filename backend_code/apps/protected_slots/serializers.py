from rest_framework import serializers
from apps.protected_slots.models import ProtectedSlot


class ProtectedSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProtectedSlot
        fields = ['id', 'day_of_week', 'start_period', 'end_period',
                  'penalty_weight', 'description']


class BatchUpdateSerializer(serializers.Serializer):
    slots = ProtectedSlotSerializer(many=True)
