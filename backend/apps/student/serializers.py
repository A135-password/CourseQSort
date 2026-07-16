from rest_framework import serializers


class CourseTimeSlotSerializer(serializers.Serializer):
    day_of_week = serializers.IntegerField()
    period = serializers.IntegerField()


class ScheduleCourseSerializer(serializers.Serializer):
    course_id = serializers.IntegerField()
    name = serializers.CharField()
    teacher = serializers.CharField()
    time_slots = CourseTimeSlotSerializer(many=True)
    classroom = serializers.CharField()


class ScheduleSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    semester = serializers.CharField()
    bitmap = serializers.CharField()
    courses = ScheduleCourseSerializer(many=True)


class ConflictWithSerializer(serializers.Serializer):
    course_id = serializers.IntegerField()
    name = serializers.CharField()
    time_slots = CourseTimeSlotSerializer(many=True)


class AvailableCourseSerializer(serializers.Serializer):
    course_id = serializers.IntegerField()
    name = serializers.CharField()
    credit = serializers.FloatField()
    teacher = serializers.CharField()
    capacity = serializers.IntegerField()
    enrolled_count = serializers.IntegerField()
    time_slots = CourseTimeSlotSerializer(many=True)
    remaining_capacity = serializers.IntegerField()
    conflict = serializers.BooleanField()
    conflict_with = ConflictWithSerializer(many=True)


class ConflictCourseSerializer(serializers.Serializer):
    course_id = serializers.IntegerField()
    name = serializers.CharField()
    teacher = serializers.CharField()
    day_of_week = serializers.IntegerField()
    period = serializers.IntegerField()
    classroom = serializers.CharField()
    conflict_type = serializers.CharField()


class ConflictDetailSerializer(serializers.Serializer):
    course_id = serializers.IntegerField()
    course_name = serializers.CharField()
    course_time_slots = CourseTimeSlotSerializer(many=True)
    conflict_courses = ConflictCourseSerializer(many=True)
    bitmap = serializers.CharField()
    conflict_bitmap = serializers.CharField()


class SelectCourseSerializer(serializers.Serializer):
    course_id = serializers.IntegerField()
    status = serializers.CharField()
    message = serializers.CharField()


class FreeSlotSerializer(serializers.Serializer):
    day_of_week = serializers.IntegerField()
    period = serializers.IntegerField()
    label = serializers.CharField()


class FreeSlotsSerializer(serializers.Serializer):
    free_slots = FreeSlotSerializer(many=True)


class RecommendCourseSerializer(serializers.Serializer):
    course_id = serializers.IntegerField()
    name = serializers.CharField()
    credit = serializers.FloatField()
    category = serializers.CharField()
    satisfy_training_plan = serializers.BooleanField()
    remaining_capacity = serializers.IntegerField()
    teacher = serializers.CharField()
    classroom = serializers.CharField()
    time_slots = CourseTimeSlotSerializer(many=True)


class RecommendSerializer(serializers.Serializer):
    day_of_week = serializers.IntegerField()
    period = serializers.IntegerField()
    courses = RecommendCourseSerializer(many=True)
