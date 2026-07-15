from rest_framework import serializers
from apps.courses.models import Course
from apps.conflict_analysis.models import (
    ConflictAnalysisResult, ConflictPair, ConflictTaskRecord
)


class NestedCourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ['id', 'name']


class RunAnalysisSerializer(serializers.Serializer):
    semester = serializers.CharField()
    course_ids = serializers.ListField(child=serializers.IntegerField())
    threshold = serializers.IntegerField(default=30)


class ConflictTaskStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConflictTaskRecord
        fields = ['task_id', 'status', 'progress', 'analyzed_pairs',
                  'total_pairs', 'conflict_pairs_found']


class ConflictResultListSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConflictAnalysisResult
        fields = ['id', 'semester', 'course_count', 'conflict_pairs_count',
                  'threshold', 'created_at']


class ConflictPairSerializer(serializers.ModelSerializer):
    course_a = NestedCourseSerializer(read_only=True)
    course_b = NestedCourseSerializer(read_only=True)

    class Meta:
        model = ConflictPair
        fields = ['course_a', 'course_b',
                  'conflicting_student_count', 'conflict_rate']
