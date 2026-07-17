"""
遗传算法核心模块。

染色体编码：
    每条染色体是一个 Assignments 列表：
    [(course_id, day_of_week, period, teacher_id, classroom_id), ...]
    其中每个元组代表一门课的某个排课安排。

算法流程：
    1. 初始化种群 — 随机生成 N 个可行（或部分可行）方案
    2. 评估适应度
    3. 选择 — 锦标赛选择
    4. 交叉 — 均匀交叉
    5. 变异 — 随机变更时段/教室
    6. 精英保留
    7. 重复 2-6 直到收敛或达到最大代数
"""

import random
import math
from collections import defaultdict
from .constraints import check_hard_constraints, is_feasible
from .fitness import evaluate_fitness


# 一周 5 天，每天 11 节
DAYS = list(range(1, 6))
PERIODS = list(range(1, 12))
# 排除午休节次
VALID_PERIODS = [p for p in PERIODS if p != 5]


def _random_assignment(course_id, course, classrooms_by_type, teachers):
    """
    为一门课生成随机排课安排。

    返回:
        (course_id, day_of_week, period, teacher_id, classroom_id)
    """
    day = random.choice(DAYS)
    period = random.choice(VALID_PERIODS)

    # 随机选教师
    teacher_id = None
    course_teachers = (
        list(course.teachers.all())
        if hasattr(course, 'teachers')
        else []
    )
    if course_teachers:
        teacher_id = random.choice(course_teachers).id

    # 随机选教室（优先匹配类型）
    classroom_id = None
    required_types = (
        course.required_classroom_types
        if hasattr(course, 'required_classroom_types')
        else course.get('required_classroom_types', [])
    ) or []
    matching_rooms = classrooms_by_type.get(
        tuple(sorted(required_types)), list(classrooms_by_type.values())
    )
    if matching_rooms:
        # flatten
        flat_rooms = []
        for v in matching_rooms:
            if isinstance(v, list):
                flat_rooms.extend(v)
            else:
                flat_rooms.append(v)
        if flat_rooms:
            room = random.choice(flat_rooms)
            classroom_id = room.id if hasattr(room, 'id') else room.get('id')

    return (course_id, day, period, teacher_id, classroom_id)


def init_population(courses, classrooms, teachers, pop_size):
    """
    初始化种群。

    每个个体包含所有课程的一个排课安排。
    为使初始种群多样化，每个课程生成多个随机时段分配（number of schedule items）。
    """
    population = []

    # 按教室类型索引
    classrooms_by_type = defaultdict(list)
    for room in classrooms:
        equip = tuple(sorted(
            room.equipment_types
            if hasattr(room, 'equipment_types')
            else room.get('equipment_types', [])
        )) or ('default',)
        classrooms_by_type[equip].append(room)

    for _ in range(pop_size):
        chromosome = []
        for course in courses:
            cid = course.id if hasattr(course, 'id') else course.get('id')
            # 每门课生成其所有 schedule_items 对应的排课安排
            items = (
                list(course.schedule_items.all())
                if hasattr(course, 'schedule_items')
                else course.get('schedule_items', [])
            )
            num_slots = max(1, len(items))
            for _ in range(num_slots):
                assignment = _random_assignment(
                    cid, course, classrooms_by_type, teachers
                )
                chromosome.append(assignment)
        population.append(chromosome)

    return population


def evaluate_population(population, courses, protected_slots, config):
    """
    评估种群中每个个体的适应度。

    返回:
        scores: [(fitness, details), ...] 与 population 一一对应
    """
    # 构建 courses lookup
    course_map = {}
    for c in courses:
        cid = c.id if hasattr(c, 'id') else c.get('id')
        course_map[cid] = c

    scores = []
    for chromosome in population:
        try:
            fitness, details = evaluate_fitness(
                chromosome, course_map, [], protected_slots, config
            )
            # 硬约束违反严重惩罚
            violations = check_hard_constraints(
                chromosome, course_map,
                {t.id: t for t in (
                    list(getattr(c, 'teachers', None) or [])
                    if hasattr(c, 'teachers')
                    else []
                )},
                {}
            )
            if violations:
                penalty = len(violations) * 0.3
                fitness = max(0.0, fitness - penalty)
            scores.append((fitness, details))
        except Exception:
            scores.append((0.0, {'error': 'evaluation failed'}))

    return scores


def tournament_select(population, scores, tournament_size=3):
    """锦标赛选择：随机选 tournament_size 个个体，返回适应度最高的"""
    candidates = random.sample(
        list(enumerate(zip(population, scores))),
        min(tournament_size, len(population))
    )
    best = max(candidates, key=lambda x: x[1][1][0] if isinstance(x[1], tuple) else x[1][0][0])
    return best[1][0]  # 返回 chromosome


def crossover(parent1, parent2):
    """
    均匀交叉：每个基因位随机继承自父方或母方。
    两条染色体长度相同 → 按位交叉。
    """
    if not parent1 or not parent2:
        return parent1 or parent2 or []

    # 对齐长度
    min_len = min(len(parent1), len(parent2))
    child1, child2 = [], []
    for i in range(min_len):
        if random.random() < 0.5:
            child1.append(parent2[i])
            child2.append(parent1[i])
        else:
            child1.append(parent1[i])
            child2.append(parent2[i])
    # 处理不等长尾巴
    if len(parent1) > min_len:
        child1.extend(parent1[min_len:])
    if len(parent2) > min_len:
        child2.extend(parent2[min_len:])

    return child1, child2


def mutate(chromosome, courses, classrooms, teachers, mutation_rate=0.05):
    """
    变异操作：以 mutation_rate 的概率改变每个基因的时段/教室。

    - 时段变异：随机换成另一个 (day, period)
    - 教室变异：随机换成另一个同类型教室
    """
    if not chromosome:
        return chromosome

    course_map = {}
    for c in courses:
        cid = c.id if hasattr(c, 'id') else c.get('id')
        course_map[cid] = c

    classrooms_by_type = defaultdict(list)
    for room in classrooms:
        equip = tuple(sorted(
            room.equipment_types
            if hasattr(room, 'equipment_types')
            else room.get('equipment_types', [])
        )) or ('default',)
        classrooms_by_type[equip].append(room)

    mutated = []
    for gene in chromosome:
        course_id, day, period, teacher_id, classroom_id = gene
        if random.random() < mutation_rate:
            # 时段变异
            day = random.choice(DAYS)
            period = random.choice(VALID_PERIODS)
        if random.random() < mutation_rate:
            # 教室变异
            course = course_map.get(course_id)
            if course:
                req_types = tuple(sorted(
                    course.required_classroom_types
                    if hasattr(course, 'required_classroom_types')
                    else course.get('required_classroom_types', [])
                )) or ('default',)
                rooms = classrooms_by_type.get(req_types)
                if not rooms:
                    rooms = [r for sublist in classrooms_by_type.values()
                             for r in sublist]
                if rooms:
                    room = random.choice(rooms)
                    classroom_id = room.id if hasattr(room, 'id') else room.get('id')
        if random.random() < mutation_rate:
            # 教师变异
            course = course_map.get(course_id)
            if course:
                cts = list(course.teachers.all()) if hasattr(course, 'teachers') else []
                if cts:
                    teacher_id = random.choice(cts).id

        mutated.append((course_id, day, period, teacher_id, classroom_id))

    return mutated


def run_genetic(courses, classrooms, protected_slots, config):
    """
    运行遗传算法，返回最优排课方案。

    参数:
        courses: Course QuerySet/列表
        classrooms: Classroom QuerySet/列表
        protected_slots: ProtectedSlot QuerySet/列表
        config: AlgorithmConfig 对象或 dict

    返回:
        best_chromosome: 最优排课方案 [(course_id, day, period, teacher_id, classroom_id), ...]
        best_fitness: 最优适应度
        stats: 运行统计信息
    """
    pop_size = getattr(config, 'population_size', 200) or 200
    max_gen = getattr(config, 'max_generations', 500) or 500
    mutation_rate = getattr(config, 'mutation_rate', 0.05) or 0.05
    crossover_rate = getattr(config, 'crossover_rate', 0.85) or 0.85
    timeout = getattr(config, 'timeout_seconds', 300) or 300

    courses_list = list(courses)
    classrooms_list = list(classrooms)
    teachers_list = []
    for c in courses_list:
        if hasattr(c, 'teachers'):
            teachers_list.extend(list(c.teachers.all()))
    # 去重
    seen_tids = set()
    unique_teachers = []
    for t in teachers_list:
        tid = t.id if hasattr(t, 'id') else t.get('id')
        if tid not in seen_tids:
            seen_tids.add(tid)
            unique_teachers.append(t)
    teachers_list = unique_teachers

    if not courses_list:
        return [], 0.0, {'generations': 0, 'message': 'no courses'}

    # 初始化种群
    population = init_population(courses_list, classrooms_list, teachers_list, pop_size)

    best_chromosome = None
    best_fitness = 0.0
    generation_stats = []

    for gen in range(max_gen):
        # 评估
        scores = evaluate_population(population, courses_list, protected_slots, config)

        # 找最优
        for i, (fitness, details) in enumerate(scores):
            if fitness > best_fitness:
                best_fitness = fitness
                best_chromosome = population[i][:]

        # 精英保留
        elite_count = max(2, pop_size // 20)  # 保留前 5%
        sorted_indices = sorted(
            range(len(scores)), key=lambda i: scores[i][0], reverse=True
        )
        new_population = [population[i][:] for i in sorted_indices[:elite_count]]

        # 生成新个体
        while len(new_population) < pop_size:
            parent1 = tournament_select(population, scores)
            parent2 = tournament_select(population, scores)

            if random.random() < crossover_rate:
                child1, child2 = crossover(parent1, parent2)
            else:
                child1, child2 = parent1[:], parent2[:]

            child1 = mutate(child1, courses_list, classrooms_list, teachers_list, mutation_rate)
            child2 = mutate(child2, courses_list, classrooms_list, teachers_list, mutation_rate)

            new_population.append(child1)
            if len(new_population) < pop_size:
                new_population.append(child2)

        population = new_population

        generation_stats.append({
            'generation': gen + 1,
            'best_fitness': round(best_fitness, 4),
            'avg_fitness': round(
                sum(s[0] for s in scores) / max(len(scores), 1), 4
            ),
        })

        # 收敛判断：最优适应度接近 1.0 或连续 N 代无改进
        if best_fitness >= 0.999:
            break

    return best_chromosome or population[0], best_fitness, {
        'generations': len(generation_stats),
        'stats': generation_stats[-10:],  # 最后 10 代统计
    }
