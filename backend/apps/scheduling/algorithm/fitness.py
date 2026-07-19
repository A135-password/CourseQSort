import math
from collections import defaultdict


def _get(obj, attr, default=None):
    if hasattr(obj, attr):
        return getattr(obj, attr, default)
    if isinstance(obj, dict):
        return obj.get(attr, default)
    return default


def evaluate_fitness(assignments, course_map, students, protected_slots, config):
    variance_weight = float(_get(config, 'variance_weight', 0.6) or 0.6)
    conflict_weight = float(_get(config, 'conflict_penalty_weight', 0.4) or 0.4)
    protected_penalty_base = float(_get(config, 'protected_slot_penalty', 8.0) or 8.0)

    total_w = variance_weight + conflict_weight
    if total_w == 0:
        total_w = 1.0
    variance_weight /= total_w
    conflict_weight /= total_w

    course_assignments = defaultdict(list)
    for cid, day, period, tid, rid in assignments:
        course_assignments[cid].append((day, period, tid, rid))

    daily_total_hours = defaultdict(float)
    for cid, day_slots in course_assignments.items():
        course = course_map.get(cid)
        student_count = float(_get(course, 'expected_student_count', 30) or 30)
        for day, period, tid, rid in day_slots:
            daily_total_hours[day] += student_count

    days = list(range(1, 6))
    hours_list = [daily_total_hours.get(d, 0) for d in days]
    total_hours = sum(hours_list)

    if total_hours == 0:
        variance_score = 0.5
        variance = 0.0
    else:
        avg = total_hours / len(days)
        variance = sum((h - avg) ** 2 for h in hours_list) / len(days)
        max_var = (total_hours ** 2) / len(days) if total_hours > 0 else 1
        normalized_var = variance / max(max_var, 1) if max_var > 0 else 0
        variance_score = math.exp(-normalized_var * 5)

    if not protected_slots:
        penalty_score = 1.0
        protected_occupied = 0
    else:
        occupied = 0
        for cid, day_slots in course_assignments.items():
            for day, period, tid, rid in day_slots:
                for ps in protected_slots:
                    ps_day = ps.day_of_week if hasattr(ps, 'day_of_week') else ps.get('day_of_week', 0)
                    ps_start = ps.start_period if hasattr(ps, 'start_period') else ps.get('start_period', 0)
                    ps_end = ps.end_period if hasattr(ps, 'end_period') else ps.get('end_period', 0)
                    if ps_day == day and ps_start <= period <= ps_end:
                        occupied += 1
                        break

        max_possible = len(assignments) or 1
        penalty_ratio = occupied / max_possible
        penalty_score = math.exp(-penalty_ratio * protected_penalty_base / 2)
        protected_occupied = occupied

    fitness = (variance_weight * variance_score + conflict_weight * penalty_score)
    fitness = max(0.0, min(1.0, fitness))

    daily_hours_str = {str(d): round(v, 1) for d, v in daily_total_hours.items()}

    return fitness, {
        'variance_score': round(variance_score, 4),
        'penalty_score': round(penalty_score, 4),
        'variance_weight': round(variance_weight, 4),
        'conflict_weight': round(conflict_weight, 4),
        'variance': round(variance, 2),
        'protected_occupied': protected_occupied,
        'daily_hours': daily_hours_str,
    }
