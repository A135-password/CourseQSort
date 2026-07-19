DEFAULT_TOTAL_WEEKS = 18
VALID_DAYS = [1, 2, 3, 4, 5]
DEFAULT_VALID_PERIODS = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11]


def run(plan, progress_callback=None):
    from apps.courses.models import Classroom, Course, CourseScheduleItem
    from apps.protected_slots.models import ProtectedSlot
    from apps.scheduling.models import ScheduleEntry

    semester = plan.semester
    major_ids = plan.major_ids or []
    config = plan.algorithm_config or {}

    if progress_callback:
        progress_callback(0.0, 0, 0.0)

    courses_qs = Course.objects.filter(semester=semester).prefetch_related("schedule_items", "teachers")

    if major_ids:
        courses_qs = courses_qs.filter(major_id__in=major_ids)

    courses = list(courses_qs)

    if not courses:
        courses_qs = Course.objects.all().prefetch_related("schedule_items", "teachers")
        if major_ids:
            courses_qs = courses_qs.filter(major_id__in=major_ids)
        courses = list(courses_qs)

    if not courses:
        if progress_callback:
            progress_callback(1.0, 0, 0.0)
        return 0, 0.0, {"weeks": 0, "message": "no courses found"}

    classrooms = list(Classroom.objects.all())
    protected_slots = list(ProtectedSlot.objects.all())

    total_weeks = int(config.get("total_weeks", 0)) or DEFAULT_TOTAL_WEEKS
    total_weeks = max(1, min(total_weeks, 30))

    ScheduleEntry.objects.filter(plan=plan).delete()

    if progress_callback:
        progress_callback(0.1, 0, 0.0)

    # 策略1：从 CourseScheduleItem 直接导入
    source_items = list(
        CourseScheduleItem.objects.filter(course__semester=semester).select_related("course", "teacher", "classroom")
    )
    if major_ids:
        source_items = [si for si in source_items if si.course.major_id in major_ids]

    if not source_items:
        source_items = list(CourseScheduleItem.objects.all().select_related("course", "teacher", "classroom"))
        if major_ids:
            source_items = [si for si in source_items if si.course.major_id in major_ids]

    if source_items:
        entries = []
        for item in source_items:
            ws = item.week_start or 1
            we = item.week_end or total_weeks
            for week in range(ws, we + 1):
                entries.append(
                    ScheduleEntry(
                        plan=plan,
                        course=item.course,
                        teacher=item.teacher,
                        classroom=item.classroom,
                        week=week,
                        day_of_week=item.day_of_week,
                        period=item.period,
                    )
                )
        if entries:
            ScheduleEntry.objects.bulk_create(entries, ignore_conflicts=True)
        if progress_callback:
            progress_callback(1.0, 0, 0.8)
        return len(entries), 0.8, {"weeks": total_weeks, "message": "direct import from source data"}

    # 策略2：遗传算法
    if progress_callback:
        progress_callback(0.2, 0, 0.0)

    try:
        from .genetic import run_genetic

        def ga_progress(progress, gen, fitness):
            if progress_callback:
                progress_callback(0.2 + 0.7 * progress, gen, fitness)

        best_chromosome, best_fitness, stats = run_genetic(courses, classrooms, protected_slots, config, ga_progress)

        if progress_callback:
            progress_callback(0.95, stats.get("generations", 0), best_fitness)

        entries = []
        for course_id, day, period, teacher_id, classroom_id in best_chromosome:
            course = next((c for c in courses if c.id == course_id), None)
            if not course:
                continue
            teacher = None
            if teacher_id:
                for c in courses:
                    t = c.teachers.filter(id=teacher_id).first()
                    if t:
                        teacher = t
                        break
            classroom = None
            if classroom_id:
                classroom = next((cr for cr in classrooms if cr.id == classroom_id), None)

            entries.append(
                ScheduleEntry(
                    plan=plan,
                    course=course,
                    teacher=teacher,
                    classroom=classroom,
                    day_of_week=day,
                    period=period,
                    week=1,
                )
            )

        if entries:
            ScheduleEntry.objects.bulk_create(entries, ignore_conflicts=True)

        if progress_callback:
            progress_callback(1.0, stats.get("generations", 0), best_fitness)

        return (
            len(entries),
            best_fitness,
            {
                "generations": stats.get("generations", 0),
                "message": "genetic algorithm optimization",
            },
        )

    except Exception as e:
        if progress_callback:
            progress_callback(1.0, 0, 0.0)
        return 0, 0.0, {"error": str(e)}
