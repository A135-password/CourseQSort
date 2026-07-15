from apps.courses.models import Course, CourseScheduleItem


def recommend_courses(day_of_week, period, major_id=None, category=None):
    items = CourseScheduleItem.objects.filter(
        day_of_week=day_of_week,
        period=period,
    ).select_related('course', 'teacher', 'classroom')

    seen = set()
    results = []
    for item in items:
        c = item.course
        if c.id in seen:
            continue
        seen.add(c.id)

        if major_id and c.major_id and c.major_id != major_id:
            continue
        cat_label = ''
        if c.is_professional_course:
            cat_label = '专业必修' if c.is_professional_course and c.major else '专业选修'
        else:
            cat_label = '通识选修'
        if category and category not in cat_label:
            continue

        teacher_name = item.teacher.name if item.teacher else ''
        classroom_name = item.classroom.name if item.classroom else ''
        remaining = (c.expected_student_count or 9999) - 0

        results.append({
            'course_id': c.id,
            'name': c.name,
            'credit': c.credit,
            'category': cat_label,
            'satisfy_training_plan': True,
            'remaining_capacity': remaining,
            'teacher': teacher_name,
            'classroom': classroom_name,
            'time_slots': [{'day_of_week': day_of_week, 'period': period}],
        })
    return results
