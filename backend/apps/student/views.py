from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsStudentUser
from apps.courses.models import Course
from apps.student.bitmap import build_bitmap, has_conflict
from apps.student.models import Enrollment
from apps.student.recommendation import recommend_courses


class ScheduleView(APIView):
    permission_classes = [IsAuthenticated, IsStudentUser]

    def get(self, request):
        enrollments = Enrollment.objects.filter(user=request.user).select_related("course")

        slots = set()
        courses_data = []
        for e in enrollments:
            c = e.course
            items = c.schedule_items.all()
            time_slots = [(item.day_of_week, item.period) for item in items]
            slots.update(time_slots)

            teacher_name = ""
            first_teacher = c.teachers.first()
            if first_teacher:
                teacher_name = first_teacher.name
            classroom_name = ""
            first_item = items.first()
            if first_item and first_item.classroom:
                classroom_name = first_item.classroom.name

            courses_data.append(
                {
                    "course_id": c.id,
                    "name": c.name,
                    "teacher": teacher_name,
                    "time_slots": [{"day_of_week": d, "period": p} for d, p in time_slots],
                    "classroom": classroom_name,
                }
            )

        bitmap = build_bitmap(list(slots))
        return Response(
            {
                "student_id": request.user.id,
                "semester": enrollments.first().course.semester if enrollments else "",
                "bitmap": bitmap,
                "courses": courses_data,
            }
        )


class CourseListView(APIView):
    permission_classes = [IsAuthenticated, IsStudentUser]

    def get(self, request):
        major_id = request.query_params.get("major")
        keyword = request.query_params.get("keyword")

        # Build user's schedule bitmap
        user_slots = set()
        for e in Enrollment.objects.filter(user=request.user).select_related("course"):
            for item in e.course.schedule_items.all():
                user_slots.add((item.day_of_week, item.period))
        user_bitmap = build_bitmap(list(user_slots))

        courses = Course.objects.all().prefetch_related("schedule_items__classroom", "teachers")
        if major_id:
            courses = courses.filter(major_id=major_id)
        if keyword:
            courses = courses.filter(name__icontains=keyword)

        results = []
        for c in courses:
            time_slots_raw = list(set((item.day_of_week, item.period) for item in c.schedule_items.all()))
            course_bitmap = build_bitmap(time_slots_raw)
            conflict = has_conflict(user_bitmap, course_bitmap)

            conflict_with = []
            if conflict:
                for e in Enrollment.objects.filter(user=request.user).select_related("course"):
                    e_slots = set((item.day_of_week, item.period) for item in e.course.schedule_items.all())
                    overlap = e_slots & set(time_slots_raw)
                    if overlap:
                        conflict_with.append(
                            {
                                "course_id": e.course.id,
                                "name": e.course.name,
                                "time_slots": [{"day_of_week": d, "period": p} for d, p in overlap],
                            }
                        )

            teacher_name = ""
            first_teacher = c.teachers.first()
            if first_teacher:
                teacher_name = first_teacher.name
            enrolled_count = c.enrollments.count()
            capacity = c.expected_student_count or 9999

            results.append(
                {
                    "course_id": c.id,
                    "name": c.name,
                    "credit": c.credit,
                    "teacher": teacher_name,
                    "capacity": capacity,
                    "enrolled_count": enrolled_count,
                    "time_slots": [{"day_of_week": d, "period": p} for d, p in time_slots_raw],
                    "remaining_capacity": capacity - enrolled_count,
                    "conflict": conflict,
                    "conflict_with": conflict_with,
                }
            )

        return Response({"count": len(results), "results": results})


class ConflictDetailView(APIView):
    permission_classes = [IsAuthenticated, IsStudentUser]

    def get(self, request, pk=None):
        try:
            course = Course.objects.prefetch_related("schedule_items__classroom", "teachers").get(id=pk)
        except Course.DoesNotExist:
            return Response({"detail": "Course not found"}, status=status.HTTP_404_NOT_FOUND)

        course_slots_raw = list(set((item.day_of_week, item.period) for item in course.schedule_items.all()))
        course_bitmap = build_bitmap(course_slots_raw)

        conflict_courses = []
        conflict_slots = set()
        for e in Enrollment.objects.filter(user=request.user).select_related("course"):
            e_slots = set((item.day_of_week, item.period) for item in e.course.schedule_items.all())
            overlap = e_slots & set(course_slots_raw)
            if overlap:
                for d, p in overlap:
                    conflict_slots.add((d, p))
                    first_item = e.course.schedule_items.filter(day_of_week=d, period=p).first()
                    classroom_name = first_item.classroom.name if first_item and first_item.classroom else ""
                    teacher_name = ""
                    first_teacher = e.course.teachers.first()
                    if first_teacher:
                        teacher_name = first_teacher.name
                    conflict_courses.append(
                        {
                            "course_id": e.course.id,
                            "name": e.course.name,
                            "teacher": teacher_name,
                            "day_of_week": d,
                            "period": p,
                            "classroom": classroom_name,
                            "conflict_type": "TIME_OVERLAP",
                        }
                    )

        return Response(
            {
                "course_id": course.id,
                "course_name": course.name,
                "course_time_slots": [{"day_of_week": d, "period": p} for d, p in course_slots_raw],
                "conflict_courses": conflict_courses,
                "bitmap": course_bitmap,
                "conflict_bitmap": build_bitmap(list(conflict_slots)),
            }
        )


class SelectCourseView(APIView):
    permission_classes = [IsAuthenticated, IsStudentUser]

    def post(self, request, pk=None):
        try:
            course = Course.objects.prefetch_related("schedule_items").get(id=pk)
        except Course.DoesNotExist:
            return Response({"detail": "Course not found"}, status=status.HTTP_404_NOT_FOUND)

        if Enrollment.objects.filter(user=request.user, course=course).exists():
            return Response(
                {
                    "course_id": course.id,
                    "status": "ALREADY_SELECTED",
                    "message": "已选择该课程",
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Capacity check
        enrolled_count = course.enrollments.count()
        capacity = course.expected_student_count or 9999
        if enrolled_count >= capacity:
            return Response(
                {
                    "course_id": course.id,
                    "status": "FULL",
                    "message": f"该课程容量已满（{capacity}/{capacity}）",
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Conflict check
        user_slots = set()
        for e in Enrollment.objects.filter(user=request.user).select_related("course"):
            for item in e.course.schedule_items.all():
                user_slots.add((item.day_of_week, item.period))
        course_slots = set((item.day_of_week, item.period) for item in course.schedule_items.all())
        overlap = user_slots & course_slots
        if overlap:
            conflict_names = []
            for e in Enrollment.objects.filter(user=request.user).select_related("course"):
                e_slots = set((item.day_of_week, item.period) for item in e.course.schedule_items.all())
                if e_slots & course_slots:
                    conflict_names.append(e.course.name)
            return Response(
                {
                    "course_id": course.id,
                    "status": "CONFLICT",
                    "message": f'课程时间与已选课程「{"、".join(conflict_names)}」冲突',
                },
                status=status.HTTP_409_CONFLICT,
            )

        Enrollment.objects.create(user=request.user, course=course)
        return Response(
            {
                "course_id": course.id,
                "status": "SELECTED",
                "message": "选课成功",
            },
            status=status.HTTP_201_CREATED,
        )


class DropCourseView(APIView):
    permission_classes = [IsAuthenticated, IsStudentUser]

    def delete(self, request, pk=None):
        try:
            course = Course.objects.get(id=pk)
        except Course.DoesNotExist:
            return Response({"detail": "Course not found"}, status=status.HTTP_404_NOT_FOUND)

        deleted, _ = Enrollment.objects.filter(user=request.user, course=course).delete()
        if not deleted:
            return Response(
                {
                    "course_id": course.id,
                    "status": "NOT_SELECTED",
                    "message": "未选择该课程",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "course_id": course.id,
                "status": "DROPPED",
                "message": "退课成功",
            }
        )


class FreeSlotsView(APIView):
    permission_classes = [IsAuthenticated, IsStudentUser]

    def get(self, request):
        user_slots = set()
        for e in Enrollment.objects.filter(user=request.user).select_related("course"):
            for item in e.course.schedule_items.all():
                user_slots.add((item.day_of_week, item.period))

        period_labels = {
            1: "第一二节",
            2: "第三四节",
            3: "第五六节",
            4: "第七八节",
            5: "第九十节",
            6: "第十一十二节",
            7: "第十三十四节",
            8: "第十五十六节",
            9: "第十七十八节",
            10: "第十九二十节",
            11: "第二十一二十二节",
        }
        day_names = {1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五"}
        free_slots = []
        for day in range(1, 6):
            for period in range(1, 12):
                if (day, period) not in user_slots:
                    label = f'{day_names[day]}{period_labels.get(period, f"第{period}节")}'
                    free_slots.append(
                        {
                            "day_of_week": day,
                            "period": period,
                            "label": label,
                        }
                    )
        return Response({"free_slots": free_slots})


class RecommendView(APIView):
    permission_classes = [IsAuthenticated, IsStudentUser]

    def get(self, request, day=None, period=None):
        try:
            day_of_week = int(day)
            period_num = int(period)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid day or period"}, status=status.HTTP_400_BAD_REQUEST)

        major_id = request.query_params.get("major")
        category = request.query_params.get("category")
        if not major_id:
            profile = getattr(request.user, "profile", None)
            if profile and profile.major:
                from apps.courses.models import Major

                major_qs = Major.objects.filter(name=profile.major)
                if major_qs.exists():
                    major_id = major_qs.first().id

        courses = recommend_courses(
            day_of_week,
            period_num,
            major_id=int(major_id) if major_id else None,
            category=category,
        )

        return Response(
            {
                "day_of_week": day_of_week,
                "period": period_num,
                "courses": courses,
            }
        )
