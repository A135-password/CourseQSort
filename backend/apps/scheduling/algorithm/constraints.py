"""
排课硬约束检查模块。

硬约束（违反则解不可用）：
1. 教师冲突：同一教师不能在同一时段安排多门课
2. 教室冲突：同一教室不能在同一时段安排多门课
3. 教室容量：教室容量 >= 课程预计学生数
4. 教师禁排时段：不能在教师不可用时段排课
5. 午休禁排：第5节（午休）不排课
6. 体育课后禁排理论课：体育课后至少空1节

软约束（影响适应度但不直接判定不可用）：
- 辅修时段保护 → 由 fitness.py 的惩罚权重处理
- 学生日课时方差 → 由 fitness.py 处理
"""

# 午休节次（第5节 = 午休时间）
NOON_BREAK_PERIODS = {5}

# 体育课标识关键字
PE_KEYWORDS = ['体育', '运动', '游泳', '篮球', '足球', '排球', '羽毛球', '乒乓球',
               '网球', '健美操', '武术', '跆拳道', '瑜伽', '体能', '田径']


def is_pe_course(course_name):
    """判断是否为体育课"""
    name = (course_name or '').lower()
    return any(kw in name for kw in PE_KEYWORDS)


def check_hard_constraints(assignments, courses, teachers, classrooms):
    """
    检查所有硬约束，返回违反列表。

    参数:
        assignments: [(course_id, day_of_week, period, teacher_id, classroom_id), ...]
        courses: {course_id: Course对象} 字典
        teachers: {teacher_id: Teacher对象} 字典
        classrooms: {classroom_id: Classroom对象} 字典

    返回:
        violations: [(violation_type, description, course_id), ...]
        空列表表示满足所有硬约束
    """
    violations = []

    # 构建"时间-教师"和"时间-教室"占用表
    # key: (day_of_week, period), value: set of teacher_ids / classroom_ids
    teacher_slots = {}
    classroom_slots = {}
    course_slots = {}  # course_id -> set of (day, period)

    for course_id, day, period, teacher_id, classroom_id in assignments:
        key = (day, period)
        course_slots.setdefault(course_id, set()).add(key)

        # 1. 午休禁排
        if period in NOON_BREAK_PERIODS:
            violations.append(('NOON_BREAK', f'课程安排在午休时段(第{period}节)', course_id))

        # 2. 教师冲突
        if teacher_id and teacher_id in teachers:
            if key not in teacher_slots:
                teacher_slots[key] = []
            for existing_tid, existing_cid in teacher_slots[key]:
                if existing_tid == teacher_id and existing_cid != course_id:
                    cname = courses.get(course_id, {}).get('name', str(course_id))
                    ecname = courses.get(existing_cid, {}).get('name', str(existing_cid))
                    violations.append(('TEACHER_CONFLICT',
                                       f'教师冲突：{cname} 和 {ecname} 同时排在 周{day}第{period}节',
                                       course_id))
            teacher_slots[key].append((teacher_id, course_id))

        # 3. 教室冲突 + 容量检查
        if classroom_id and classroom_id in classrooms:
            if key not in classroom_slots:
                classroom_slots[key] = []
            for existing_rid, existing_cid in classroom_slots[key]:
                if existing_rid == classroom_id and existing_cid != course_id:
                    cname = courses.get(course_id, {}).get('name', str(course_id))
                    ecname = courses.get(existing_cid, {}).get('name', str(existing_cid))
                    violations.append(('CLASSROOM_CONFLICT',
                                       f'教室冲突：{cname} 和 {ecname} 同时使用教室 周{day}第{period}节',
                                       course_id))
            classroom_slots[key].append((classroom_id, course_id))

            room = classrooms[classroom_id]
            course = courses.get(course_id, {})
            capacity = room.capacity if hasattr(room, 'capacity') else room.get('capacity', 999)
            student_count = (course.expected_student_count
                             if hasattr(course, 'expected_student_count')
                             else course.get('expected_student_count', 0)) or 0
            if student_count > capacity:
                violations.append(('CAPACITY',
                                   f'教室容量不足：{capacity} < {student_count} 人', course_id))

        # 4. 教师禁排时段
        if teacher_id and teacher_id in teachers:
            teacher = teachers[teacher_id]
            unavailable = (teacher.unavailable_slots
                           if hasattr(teacher, 'unavailable_slots')
                           else teacher.get('unavailable_slots', []))
            for us in unavailable:
                if isinstance(us, dict):
                    if us.get('day_of_week') == day and us.get('period') == period:
                        violations.append(('TEACHER_UNAVAILABLE',
                                           f'教师禁排时段 周{day}第{period}节', course_id))

    # 5. 体育课后禁排理论课
    for course_id, day, period, _, _ in assignments:
        course = courses.get(course_id, {})
        cname = (course.name if hasattr(course, 'name')
                 else course.get('name', ''))
        if is_pe_course(cname):
            # 找到此体育课后紧邻的节次安排
            next_period = period + 1
            for cid2, d2, p2, _, _ in assignments:
                if d2 == day and p2 == next_period and cid2 != course_id:
                    c2 = courses.get(cid2, {})
                    c2name = (c2.name if hasattr(c2, 'name')
                              else c2.get('name', ''))
                    if not is_pe_course(c2name):
                        violations.append(('PE_AFTER',
                                           f'体育课({cname})后紧排理论课({c2name}) 周{day}',
                                           cid2))

    return violations


def is_feasible(assignments, courses, teachers, classrooms):
    """检查方案是否满足所有硬约束"""
    return len(check_hard_constraints(assignments, courses, teachers, classrooms)) == 0
