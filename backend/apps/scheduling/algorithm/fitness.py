"""
适应度函数模块。

适应度由两部分加权组成：
1. 日课时方差得分 — 衡量所有学生每日课时的均衡程度
2. 辅修时段惩罚 — 占用受保护时段的惩罚

总适应度 = variance_weight * variance_score + conflict_penalty_weight * (1 - penalty_score)

返回值 0~1，越接近 1 越好。
"""

import math
from collections import defaultdict


def evaluate_fitness(assignments, courses, students, protected_slots, config):
    """
    计算适应度。

    参数:
        assignments: [(course_id, day, period, teacher_id, classroom_id), ...]
        courses: {course_id: Course} 字典
        students: [Student] 列表（含已选课信息）
        protected_slots: [ProtectedSlot] 列表
        config: AlgorithmConfig 或 dict，包含权重参数

    返回:
        fitness: 0~1 的浮点数
        details: dict，包含各项分解得分
    """
    # 获取权重参数
    variance_weight = getattr(config, 'variance_weight', 0.6) or 0.6
    conflict_weight = getattr(config, 'conflict_penalty_weight', 0.4) or 0.4
    protected_penalty_base = getattr(config, 'protected_slot_penalty', 8.0) or 8.0

    # 权重归一化
    total_w = variance_weight + conflict_weight
    if total_w == 0:
        total_w = 1.0
    variance_weight /= total_w
    conflict_weight /= total_w

    # 1. 构建学生-日-课时统计
    # student_id -> {day: hour_count}
    student_daily_hours = defaultdict(lambda: defaultdict(float))

    # 构建 course_id -> assignments 映射
    course_assignments = defaultdict(list)
    for (cid, day, period, tid, rid) in assignments:
        course_assignments[cid].append((day, period, tid, rid))

    for student in students:
        sid = student.id if hasattr(student, 'id') else student.get('id', 0)
        # 模拟：遍历所有课程，假设学生选了本专业的课程
        # 实际场景中应从 Enrollment 表获取学生选课信息
        # 此处使用简化模型
        pass

    # 实际使用：统计每个"学生群"的课时分布
    # 因为我们没有真实的选课数据，用课程级别的统计代替
    # 每门课的学生数 = expected_student_count

    # 按天统计总课时（所有课程汇总）
    daily_total_hours = defaultdict(float)
    for cid, day_slots in course_assignments.items():
        course = courses.get(cid, {})
        student_count = (
            course.expected_student_count
            if hasattr(course, 'expected_student_count')
            else course.get('expected_student_count', 30)
        ) or 30
        for day, period, tid, rid in day_slots:
            daily_total_hours[day] += student_count  # 加权课时

    # 2. 日课时方差得分
    days = [1, 2, 3, 4, 5]
    hours_list = [daily_total_hours.get(d, 0) for d in days]
    total_hours = sum(hours_list)
    if total_hours == 0:
        variance_score = 0.5
    else:
        avg = total_hours / len(days)
        variance = sum((h - avg) ** 2 for h in hours_list) / len(days)
        # 归一化：方差越小越好，得分越高
        # 使用指数衰减：score = exp(-variance / max_possible_variance)
        # max_possible_variance 粗略估计为 total_hours^2
        max_var = (total_hours ** 2) / len(days) if total_hours > 0 else 1
        normalized_var = variance / max(max_var, 1)
        variance_score = math.exp(-normalized_var * 5)

    # 3. 辅修时段惩罚得分
    if not protected_slots:
        penalty_score = 1.0
        protected_occupied = 0
    else:
        occupied = 0
        for cid, day_slots in course_assignments.items():
            for day, period, tid, rid in day_slots:
                for ps in protected_slots:
                    ps_day = (ps.day_of_week
                              if hasattr(ps, 'day_of_week')
                              else ps.get('day_of_week', 0))
                    ps_start = (ps.start_period
                                if hasattr(ps, 'start_period')
                                else ps.get('start_period', 0))
                    ps_end = (ps.end_period
                              if hasattr(ps, 'end_period')
                              else ps.get('end_period', 0))
                    if ps_day == day and ps_start <= period <= ps_end:
                        occupied += 1
                        break

        # 惩罚：占用越多，得分越低
        max_possible = len(assignments) or 1
        penalty_ratio = occupied / max_possible
        penalty_score = math.exp(-penalty_ratio * protected_penalty_base / 2)
        protected_occupied = occupied

    # 4. 综合适应度
    fitness = (variance_weight * variance_score +
               conflict_weight * penalty_score)
    fitness = max(0.0, min(1.0, fitness))

    return fitness, {
        'variance_score': round(variance_score, 4),
        'penalty_score': round(penalty_score, 4),
        'variance_weight': round(variance_weight, 4),
        'conflict_weight': round(conflict_weight, 4),
        'variance_raw': round(variance if total_hours > 0 else 0, 2),
        'protected_occupied': protected_occupied,
        'daily_hours': {str(d): v for d, v in daily_total_hours.items()},
    }
