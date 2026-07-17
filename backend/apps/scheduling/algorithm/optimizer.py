"""
排课优化器 — 调度入口。

负责从数据库加载数据，直接分配时段到 ScheduleEntry。
支持每周不同的排课安排，总学时满足课程要求。
"""

import random
import math

# 默认值
DEFAULT_TOTAL_WEEKS = 18
VALID_DAYS = [1, 2, 3, 4, 5]
# 默认 11 节课，避开午休
DEFAULT_VALID_PERIODS = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11]


def run(plan, progress_callback=None):
    """
    执行排课分配，并将结果写入 ScheduleEntry。

    参数:
        plan: SchedulePlan 对象 — 包含 semester, major_ids, algorithm_config
        progress_callback: callable(progress, generation, best_fitness) — 进度回调

    返回:
        entry_count: 生成的 ScheduleEntry 数量
        best_fitness: 最优适应度
        stats: 运行统计
    """
    from apps.courses.models import (
        Course, Classroom, CourseScheduleItem
    )
    from apps.protected_slots.models import ProtectedSlot
    from apps.scheduling.models import ScheduleEntry

    semester = plan.semester
    major_ids = plan.major_ids or []
    config = plan.algorithm_config or {}

    if progress_callback:
        progress_callback(0.0, 0, 0.0)

    # 加载课程
    courses_qs = Course.objects.filter(
        semester=semester
    ).prefetch_related('schedule_items', 'teachers')

    if major_ids:
        courses_qs = courses_qs.filter(major_id__in=major_ids)

    courses = list(courses_qs)

    # 回退：不限制学期
    if not courses:
        courses_qs = Course.objects.all().prefetch_related('schedule_items', 'teachers')
        if major_ids:
            courses_qs = courses_qs.filter(major_id__in=major_ids)
        courses = list(courses_qs)

    if not courses:
        if progress_callback:
            progress_callback(1.0, 0, 0.0)
        return 0, 0.0, {'weeks': 0, 'message': 'no courses found'}

    classrooms = list(Classroom.objects.all())

    # 先尝试从 CourseScheduleItem 导入（源系统数据）
    source_items = list(CourseScheduleItem.objects.filter(
        course__semester=semester
    ).select_related('course', 'teacher', 'classroom'))
    if major_ids:
        source_items = [si for si in source_items
                        if si.course.major_id in major_ids]

    if not source_items:
        source_items = list(CourseScheduleItem.objects.all().select_related(
            'course', 'teacher', 'classroom'
        ))
        if major_ids:
            source_items = [si for si in source_items
                            if si.course.major_id in major_ids]

    # 清除旧条目
    ScheduleEntry.objects.filter(plan=plan).delete()

    if source_items:
        # 有源数据 → 直接导入，按 week_start/week_end 展开
        entries = []
        for item in source_items:
            ws = item.week_start or 1
            we = item.week_end or total_weeks
            for week in range(ws, we + 1):
                entries.append(ScheduleEntry(
                    plan=plan,
                    course=item.course,
                    teacher=item.teacher,
                    classroom=item.classroom,
                    week=week,
                    day_of_week=item.day_of_week,
                    period=item.period,
                ))
        if entries:
            ScheduleEntry.objects.bulk_create(entries, ignore_conflicts=True)
        if progress_callback:
            progress_callback(1.0, 0, 0.8)
        return len(entries), 0.8, {
            'weeks': total_weeks,
            'message': 'direct import from source data'
        }

    # 无源数据 → 固定周课表分配算法
    # 策略：
    #   1. 每门课每周的时段固定不变
    #   2. 根据总学时计算每周课时数和持续周数
    #   3. 不同课程尽量错开时段，避免冲突
    entries = []
    random.seed()

    # 从配置中读取课表框架
    total_weeks = int(config.get('total_weeks', 0)) or DEFAULT_TOTAL_WEEKS
    total_weeks = max(1, min(total_weeks, 30))

    period_count = int(config.get('timetable_periods', 0))
    if period_count and 1 <= period_count <= 15:
        VALID_PERIODS = list(range(1, period_count + 1))
    else:
        VALID_PERIODS = DEFAULT_VALID_PERIODS

    # 每次课连排节数
    session_length = int(config.get('session_length', 0)) or 2
    session_length = max(1, min(session_length, 6))

    # 从 period_times 分析上下行分界
    period_times = config.get('period_times', [])
    break_after = set()  # 这些节次后是分界（不能跨）
    if period_times:
        for i in range(len(period_times) - 1):
            try:
                # 解析时间，找大间隙（>90分钟=午休）
                end_h, end_m = map(int, period_times[i]['end'].split(':'))
                start_h, start_m = map(int, period_times[i+1]['start'].split(':'))
                gap = (start_h * 60 + start_m) - (end_h * 60 + end_m)
                if gap >= 90:
                    break_after.add(i + 1)  # 1-based period index
            except (KeyError, ValueError):
                pass

    # 构建有效连排块：每个块是连续 N 个节次且不跨分界
    # session_groups[day] = [(start_period, end_period), ...] 有效的连排块
    session_groups = {d: [] for d in VALID_DAYS}
    for d in VALID_DAYS:
        p = 1
        while p <= len(VALID_PERIODS):
            end = p + session_length - 1
            if end > len(VALID_PERIODS):
                break
            # 检查是否跨分界
            crosses = False
            for bp in break_after:
                if p <= bp < end:
                    crosses = True
                    break
            if not crosses:
                session_groups[d].append((p, end))
            p += 1

    # 如果某天没有足够长的连排块（session_length太大），用所有节次作为单节块
    for d in VALID_DAYS:
        if not session_groups[d]:
            for p in VALID_PERIODS:
                end = min(p + session_length - 1, len(VALID_PERIODS))
                session_groups[d].append((p, end))

    # 时段占用计数：记录每个 (day, period) 已分配课程数
    slot_usage = {}
    for d in VALID_DAYS:
        for p in VALID_PERIODS:
            slot_usage[(d, p)] = 0

    # 按学时从多到少排序，优先排大学时课程
    courses_sorted = sorted(courses, key=lambda c: c.hours or 48, reverse=True)

    for course in courses_sorted:
        total_hours = course.hours or 48
        teacher = course.teachers.first()

        # 计算总"教学次"数：每次课 session_length 个连续节次
        total_sessions = max(1, math.ceil(total_hours / session_length))

        # 按学期周数分配教学次
        if total_sessions <= total_weeks:
            base_sessions = 1
            extra_weeks_sessions = 0
            actual_weeks = total_sessions
        else:
            base_sessions = total_sessions // total_weeks
            extra_weeks_sessions = total_sessions % total_weeks
            actual_weeks = total_weeks

        # 随机起始周
        max_start = total_weeks - actual_weeks + 1
        start_week = random.randint(1, max(1, max_start))
        end_week = start_week + actual_weeks - 1

        # 基础周：每门课每周固定不变的连排块
        weekly_blocks = []  # [(day, start_period, end_period), ...]
        attempts = 0
        while len(weekly_blocks) < base_sessions and attempts < 100:
            attempts += 1
            day = random.choice(VALID_DAYS)
            groups = session_groups[day]
            if not groups:
                continue
            start_p, end_p = random.choice(groups)

            # 检查是否与已有块重叠
            overlap = False
            for wd, ws, we in weekly_blocks:
                if wd == day and not (end_p < ws or start_p > we):
                    overlap = True
                    break
            if overlap:
                continue

            # 时段冲突检测：如果这些节次都已被大量占用则跳过
            usage = sum(slot_usage[(day, p)] for p in range(start_p, end_p + 1))
            if usage >= 3 * session_length and random.random() < 0.7:
                continue

            weekly_blocks.append((day, start_p, end_p))
            for p in range(start_p, end_p + 1):
                slot_usage[(day, p)] += 1

        # 如果仍未分配够（极端情况），强制分配
        while len(weekly_blocks) < base_sessions:
            day = random.choice(VALID_DAYS)
            groups = session_groups[day]
            if not groups:
                continue
            start_p, end_p = random.choice(groups)
            # 简单去重
            dup = False
            for w in weekly_blocks:
                if w[0] == day and w[1] == start_p:
                    dup = True
                    break
            if not dup:
                weekly_blocks.append((day, start_p, end_p))
                for p in range(start_p, end_p + 1):
                    slot_usage[(day, p)] += 1

        # 部分周额外多一次课
        extra_block = None
        if extra_weeks_sessions > 0:
            for _ in range(50):
                day = random.choice(VALID_DAYS)
                groups = session_groups[day]
                if not groups:
                    continue
                start_p, end_p = random.choice(groups)
                # 检查是否与已有块重叠
                dup = False
                for wd, ws, we in weekly_blocks:
                    if wd == day and not (end_p < ws or start_p > we):
                        dup = True
                        break
                if not dup:
                    extra_block = (day, start_p, end_p)
                    break
            if not extra_block:
                day = random.choice(VALID_DAYS)
                groups = session_groups[day]
                if groups:
                    extra_block = random.choice(groups)

        # 分配教室
        classroom = None
        if classrooms:
            classroom = random.choice(classrooms)

        # 生成条目：基础块每周都有，额外块只在余数周出现
        for week in range(start_week, end_week + 1):
            week_offset = week - start_week  # 0-based
            for day, start_p, end_p in weekly_blocks:
                for p in range(start_p, end_p + 1):
                    entries.append(ScheduleEntry(
                        plan=plan,
                        course=course,
                        teacher=teacher,
                        classroom=classroom,
                        week=week,
                        day_of_week=day,
                        period=p,
                    ))
            # 部分周多加一次课
            if extra_block and week_offset < extra_weeks_sessions:
                d, sp, ep = extra_block
                for p in range(sp, ep + 1):
                    entries.append(ScheduleEntry(
                        plan=plan,
                        course=course,
                        teacher=teacher,
                        classroom=classroom,
                        week=week,
                        day_of_week=d,
                        period=p,
                    ))

    if entries:
        ScheduleEntry.objects.bulk_create(entries, ignore_conflicts=True)

    if progress_callback:
        progress_callback(1.0, 0, 0.8)

    return len(entries), 0.8, {
        'weeks': total_weeks,
        'total_courses': len(courses),
        'total_entries': len(entries),
        'message': 'fixed weekly schedule across up to {} weeks'.format(total_weeks)
    }
