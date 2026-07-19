import random
from collections import defaultdict

from .constraints import check_hard_constraints
from .fitness import evaluate_fitness

DAYS = list(range(1, 6))
ALL_PERIODS = list(range(1, 12))
VALID_PERIODS = [p for p in ALL_PERIODS if p != 5]


def _get(obj, attr, default=None):
    if hasattr(obj, attr):
        return getattr(obj, attr, default)
    if isinstance(obj, dict):
        return obj.get(attr, default)
    return default


def _random_assignment(course_id, course, classrooms_by_type, teacher_pool):
    day = random.choice(DAYS)
    period = random.choice(VALID_PERIODS)
    teacher_id = None
    if teacher_pool:
        teacher_id = random.choice(teacher_pool).id
    classroom_id = None
    req_types = _get(course, "required_classroom_types", []) or []
    key = tuple(sorted(req_types)) if req_types else None
    pool = classrooms_by_type.get(key, [])
    if not pool:
        pool = [r for rooms in classrooms_by_type.values() for r in rooms]
    if pool:
        needed = _get(course, "expected_student_count", 0) or 0
        adequate = [r for r in pool if (r.capacity if hasattr(r, "capacity") else 999) >= needed]
        if adequate:
            classroom_id = random.choice(adequate).id
        else:
            classroom_id = random.choice(pool).id
    return (course_id, day, period, teacher_id, classroom_id)


def init_population(courses, classrooms, teachers, pop_size):
    classrooms_by_type = defaultdict(list)
    for room in classrooms:
        equip = tuple(sorted(_get(room, "equipment_types", []) or []))
        if not equip:
            equip = ("default",)
        classrooms_by_type[equip].append(room)

    teacher_pool = list(teachers)

    population = []
    for _ in range(pop_size):
        chromosome = []
        for course in courses:
            cid = course.id
            items = list(course.schedule_items.all())
            num_slots = max(1, len(items))
            for _ in range(num_slots):
                chromosome.append(_random_assignment(cid, course, classrooms_by_type, teacher_pool))
        population.append(chromosome)
    return population


def evaluate_population(population, course_list, teacher_list, classroom_list, protected_slots, config):
    course_map = {c.id: c for c in course_list}
    teacher_map = {t.id: t for t in teacher_list}
    classroom_map = {cr.id: cr for cr in classroom_list}

    scores = []
    for chromosome in population:
        try:
            fitness, details = evaluate_fitness(chromosome, course_map, [], protected_slots, config)
            violations = check_hard_constraints(chromosome, course_map, teacher_map, classroom_map)
            if violations:
                severe = sum(1 for v in violations if v[0] in ("TEACHER_CONFLICT", "CLASSROOM_CONFLICT"))
                minor = len(violations) - severe
                penalty = severe * 0.3 + minor * 0.05
                penalty = min(0.9, penalty)
                fitness = max(0.01, fitness - penalty)
            scores.append((fitness, details))
        except Exception:
            scores.append((0.0, {}))
    return scores


def tournament_select(population, scores, tournament_size=3):
    indices = list(range(len(population)))
    candidates = random.sample(indices, min(tournament_size, len(population)))
    best_idx = max(candidates, key=lambda i: scores[i][0])
    return population[best_idx]


def crossover(parent1, parent2):
    if not parent1 or not parent2:
        return (parent1 or [])[:], (parent2 or [])[:]
    min_len = min(len(parent1), len(parent2))
    child1, child2 = [], []
    for i in range(min_len):
        if random.random() < 0.5:
            child1.append(parent2[i])
            child2.append(parent1[i])
        else:
            child1.append(parent1[i])
            child2.append(parent2[i])
    if len(parent1) > min_len:
        child1.extend(parent1[min_len:])
    if len(parent2) > min_len:
        child2.extend(parent2[min_len:])
    return child1, child2


def mutate(chromosome, course_list, teacher_list, classrooms, mutation_rate=0.05):
    if not chromosome:
        return chromosome

    course_map = {c.id: c for c in course_list}
    teacher_pool = list(teacher_list)

    classrooms_by_type = defaultdict(list)
    for room in classrooms:
        equip = tuple(sorted(_get(room, "equipment_types", []) or []))
        if not equip:
            equip = ("default",)
        classrooms_by_type[equip].append(room)

    mutated = []
    for gene in chromosome:
        course_id, day, period, teacher_id, classroom_id = gene
        if random.random() < mutation_rate:
            day = random.choice(DAYS)
            period = random.choice(VALID_PERIODS)
        if random.random() < mutation_rate:
            course = course_map.get(course_id)
            if course:
                req_types = tuple(sorted(_get(course, "required_classroom_types", []) or []))
                req_key = req_types if req_types else None
                pool = classrooms_by_type.get(req_key, [])
                if not pool:
                    pool = [r for rooms in classrooms_by_type.values() for r in rooms]
                if pool:
                    classroom_id = random.choice(pool).id
        if random.random() < mutation_rate and teacher_pool:
            teacher_id = random.choice(teacher_pool).id
        mutated.append((course_id, day, period, teacher_id, classroom_id))
    return mutated


def run_genetic(courses, classrooms, protected_slots, config, progress_callback=None):
    pop_size = int(_get(config, "population_size", 200) or 200)
    max_gen = int(_get(config, "max_generations", 500) or 500)
    mutation_rate = float(_get(config, "mutation_rate", 0.05) or 0.05)
    crossover_rate = float(_get(config, "crossover_rate", 0.85) or 0.85)

    course_list = list(courses)
    classroom_list = list(classrooms)

    teacher_set = {}
    for c in course_list:
        for t in c.teachers.all():
            if t.id not in teacher_set:
                teacher_set[t.id] = t
    teacher_list = list(teacher_set.values())

    if not course_list:
        return [], 0.0, {"generations": 0, "message": "no courses"}

    pop_size = min(pop_size, 200)
    population = init_population(course_list, classroom_list, teacher_list, pop_size)

    best_chromosome = None
    best_fitness = 0.0
    no_improve = 0

    for gen in range(max_gen):
        scores = evaluate_population(population, course_list, teacher_list, classroom_list, protected_slots, config)

        gen_best = max(s[0] for s in scores)
        if gen_best > best_fitness:
            best_fitness = gen_best
            best_idx = max(range(len(scores)), key=lambda i: scores[i][0])
            best_chromosome = population[best_idx][:]
            no_improve = 0
        else:
            no_improve += 1

        if progress_callback:
            progress_callback((gen + 1) / max_gen, gen + 1, best_fitness)

        elite_count = max(2, pop_size // 20)
        sorted_indices = sorted(range(len(scores)), key=lambda i: scores[i][0], reverse=True)
        new_population = [population[i][:] for i in sorted_indices[:elite_count]]

        while len(new_population) < pop_size:
            p1 = tournament_select(population, scores)
            p2 = tournament_select(population, scores)
            if random.random() < crossover_rate:
                c1, c2 = crossover(p1, p2)
            else:
                c1, c2 = p1[:], p2[:]
            c1 = mutate(c1, course_list, teacher_list, classroom_list, mutation_rate)
            c2 = mutate(c2, course_list, teacher_list, classroom_list, mutation_rate)
            new_population.append(c1)
            if len(new_population) < pop_size:
                new_population.append(c2)

        population = new_population

        if no_improve >= 50:
            break

        if best_fitness >= 0.999:
            break

    if best_chromosome is None:
        best_chromosome = population[0][:]

    return (
        best_chromosome,
        best_fitness,
        {
            "generations": gen + 1,
            "best_fitness": round(best_fitness, 4),
        },
    )
