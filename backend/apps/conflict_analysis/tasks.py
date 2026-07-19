from apps.conflict_analysis.models import ConflictPair, ConflictTaskRecord
from apps.courses.models import Course


def run_analysis_sync(task_id):
    try:
        task = ConflictTaskRecord.objects.get(task_id=task_id)
    except ConflictTaskRecord.DoesNotExist:
        return

    task.status = "RUNNING"
    task.progress = 0.0
    task.save(update_fields=["status", "progress"])

    try:
        result = task.result
        semester = result.semester
        threshold = result.threshold

        courses = Course.objects.filter(semester=semester).prefetch_related("schedule_items")
        course_list = list(courses)
        total_pairs = len(course_list) * (len(course_list) - 1) // 2
        task.total_pairs = total_pairs
        task.save(update_fields=["total_pairs"])

        # Build time slot lookup: course_id -> set of (day_of_week, period)
        course_slots = {}
        for c in course_list:
            slots = set()
            for item in c.schedule_items.all():
                slots.add((item.day_of_week, item.period))
            course_slots[c.id] = slots

        analyzed = 0
        conflict_pairs = []

        for i in range(len(course_list)):
            for j in range(i + 1, len(course_list)):
                ca, cb = course_list[i], course_list[j]
                slots_a = course_slots.get(ca.id, set())
                slots_b = course_slots.get(cb.id, set())
                overlap = slots_a & slots_b

                analyzed += 1
                if analyzed % 10 == 0:
                    task.analyzed_pairs = analyzed
                    task.progress = min(1.0, analyzed / max(total_pairs, 1))
                    task.save(update_fields=["analyzed_pairs", "progress"])

                if overlap:
                    conflict_count = len(overlap)
                    total_overlap = len(slots_a | slots_b) or 1
                    rate = min(1.0, conflict_count / total_overlap)
                    if conflict_count >= threshold:
                        conflict_pairs.append(
                            ConflictPair(
                                result=result,
                                course_a=ca,
                                course_b=cb,
                                conflicting_student_count=conflict_count,
                                conflict_rate=round(rate, 2),
                            )
                        )

        ConflictPair.objects.bulk_create(conflict_pairs, ignore_conflicts=True)

        result.course_count = len(course_list)
        result.conflict_pairs_count = len(conflict_pairs)
        result.save(update_fields=["course_count", "conflict_pairs_count"])

        task.status = "SUCCESS"
        task.progress = 1.0
        task.analyzed_pairs = analyzed
        task.conflict_pairs_found = len(conflict_pairs)
        task.save(update_fields=["status", "progress", "analyzed_pairs", "conflict_pairs_found"])

    except Exception as e:
        task.status = "FAILED"
        task.error_message = str(e)
        task.save(update_fields=["status", "error_message"])
