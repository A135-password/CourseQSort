NOON_BREAK_PERIODS = {5}

PE_KEYWORDS = ['体育', '运动', '游泳', '篮球', '足球', '排球', '羽毛球', '乒乓球',
               '网球', '健美操', '武术', '跆拳道', '瑜伽', '体能', '田径']


def is_pe_course(course_name):
    name = (course_name or '').lower()
    return any(kw in name for kw in PE_KEYWORDS)


def _get(obj, attr, default=None):
    """Safely get attr from a Django model instance."""
    if hasattr(obj, attr):
        return getattr(obj, attr, default)
    if isinstance(obj, dict):
        return obj.get(attr, default)
    return default


def check_hard_constraints(assignments, course_map, teacher_map, classroom_map):
    """
    assignments: [(course_id, day, period, teacher_id, classroom_id), ...]
    Returns list of (type, description, course_id) violations.
    """
    violations = []
    teacher_slots = {}
    classroom_slots = {}

    for course_id, day, period, teacher_id, classroom_id in assignments:
        key = (day, period)
        course = course_map.get(course_id)

        if period in NOON_BREAK_PERIODS:
            violations.append(('NOON_BREAK',
                               f'安排在午休时段(第{period}节)', course_id))

        if teacher_id:
            if key not in teacher_slots:
                teacher_slots[key] = []
            for existing_tid, existing_cid in teacher_slots[key]:
                if existing_tid == teacher_id:
                    cname = _get(course_map.get(course_id), 'name', course_id)
                    ecname = _get(course_map.get(existing_cid), 'name', existing_cid)
                    violations.append(('TEACHER_CONFLICT',
                        f'{cname} 和 {ecname} 同时排在周{day}第{period}节', course_id))
            teacher_slots[key].append((teacher_id, course_id))

        if classroom_id:
            if key not in classroom_slots:
                classroom_slots[key] = []
            for existing_rid, existing_cid in classroom_slots[key]:
                if existing_rid == classroom_id:
                    cname = _get(course_map.get(course_id), 'name', course_id)
                    ecname = _get(course_map.get(existing_cid), 'name', existing_cid)
                    violations.append(('CLASSROOM_CONFLICT',
                        f'{cname} 和 {ecname} 同时使用教室 周{day}第{period}节', course_id))
            classroom_slots[key].append((classroom_id, course_id))

            room = classroom_map.get(classroom_id)
            if room:
                capacity = _get(room, 'capacity', 999)
                student_count = _get(course, 'expected_student_count', 0) or 0
                if student_count > capacity:
                    violations.append(('CAPACITY',
                        f'教室容量不足：{capacity} < {student_count} 人', course_id))

        if teacher_id:
            teacher = teacher_map.get(teacher_id)
            if teacher:
                unavailable = _get(teacher, 'unavailable_slots', [])
                for us in unavailable:
                    if isinstance(us, dict):
                        if us.get('day_of_week') == day and us.get('period') == period:
                            violations.append(('TEACHER_UNAVAILABLE',
                                f'教师禁排时段 周{day}第{period}节', course_id))

    for course_id, day, period, teacher_id, classroom_id in assignments:
        course = course_map.get(course_id)
        cname = _get(course, 'name', '')
        if is_pe_course(cname):
            next_p = period + 1
            for cid2, d2, p2, _, _ in assignments:
                if d2 == day and p2 == next_p and cid2 != course_id:
                    c2 = course_map.get(cid2)
                    c2name = _get(c2, 'name', '')
                    if not is_pe_course(c2name):
                        violations.append(('PE_AFTER',
                            f'体育课({cname})后紧排理论课({c2name}) 周{day}', cid2))

    return violations


def is_feasible(assignments, course_map, teacher_map, classroom_map):
    return len(check_hard_constraints(assignments, course_map, teacher_map, classroom_map)) == 0
