import math
import random
from dataclasses import dataclass

import httpx

from tsp_core import *

POPULATION_SIZE = 60
GENERATIONS = 200
MUTATION_RATE = 0.02
ELITE_SIZE = 4
TOURNAMENT_SIZE = 5

def _route_cost(matrix: DistanceMatrix, order: list[int]) -> float:
    return sum(matrix[order[i]][order[i + 1]] for i in range(len(order) - 1))

def _order_crossover(
    parent_a: list[int],
    parent_b: list[int],
    rng: random.Random,
) -> list[int]:
    size = len(parent_a)

    if size <= 1:
        return parent_a[:]

    i, j = sorted(rng.sample(range(size), 2))

    child: list[int | None] = [None] * size
    child[i:j + 1] = parent_a[i:j + 1]

    taken = set(parent_a[i:j + 1])
    fill_values = [gene for gene in parent_b if gene not in taken]

    pos = 0
    for k in range(size):
        if child[k] is None:
            child[k] = fill_values[pos]
            pos += 1

    return child

def _mutate(order: list[int], rate: float, rng: random.Random) -> list[int]:
    mutated = order[:]

    for i in range(len(mutated)):
        if rng.random() < rate:
            j = rng.randrange(len(mutated))
            mutated[i], mutated[j] = mutated[j], mutated[i]

    return mutated

def genetic_order(
    matrix: DistanceMatrix,
    start: int = 0,
    seed: int | None = None,
) -> list[int]:
    n = len(matrix)

    if n <= 2:
        return list(range(n)) if start == 0 else [start] + [
            i for i in range(n) if i != start
        ]

    rng = random.Random(seed)

    rest = [i for i in range(n) if i != start]

    def full_order(individual: list[int]) -> list[int]:
        return [start, *individual]

    def fitness(individual: list[int]) -> float:
        return _route_cost(matrix, full_order(individual))

    population = []
    for _ in range(POPULATION_SIZE):
        individual = rest[:]
        rng.shuffle(individual)
        population.append(individual)

    best_individual = min(population, key=fitness)
    best_cost = fitness(best_individual)

    def tournament(pool: list[list[int]]) -> list[int]:
        contenders = rng.sample(pool, min(TOURNAMENT_SIZE, len(pool)))
        return min(contenders, key=fitness)

    for _ in range(GENERATIONS):
        ranked = sorted(population, key=fitness)

        if fitness(ranked[0]) < best_cost:
            best_cost = fitness(ranked[0])
            best_individual = ranked[0]

        next_population = [individual[:] for individual in ranked[:ELITE_SIZE]]

        while len(next_population) < POPULATION_SIZE:
            parent_a = tournament(population)
            parent_b = tournament(population)
            child = _order_crossover(parent_a, parent_b, rng)
            child = _mutate(child, MUTATION_RATE, rng)
            next_population.append(child)

        population = next_population

    return full_order(best_individual)

@dataclass
class HeuristicRoute:
    order: list[int]
    points: list[Point]
    total_distance: float

async def optimize_route_genetic(
    client: httpx.AsyncClient,
    points: list[Point],
    start: int = 0,
    seed: int | None = None,
) -> HeuristicRoute:
    if len(points) < 2:
        return HeuristicRoute(
            order=list(range(len(points))),
            points=list(points),
            total_distance=0.0,
        )

    matrix = await fetch_distance_matrix(client, points)
    order = genetic_order(matrix, start=start, seed=seed)

    total_distance = sum(
        matrix[order[i]][order[i + 1]]
        for i in range(len(order) - 1)
    )

    return HeuristicRoute(
        order=order,
        points=[points[i] for i in order],
        total_distance=total_distance,
    )

if __name__ == "__main__":
    demo_matrix = [
        # A     B     C     D     E
        [0.0,  1.0,  2.0,  3.0,  1.0],  # A = 0
        [1.0,  0.0,  1.0,  2.0,  2.0],  # B = 1
        [2.0,  1.0,  0.0,  1.0,  3.0],  # C = 2
        [3.0,  2.0,  1.0,  0.0,  4.0],  # D = 3
        [1.0,  2.0,  3.0,  4.0,  0.0],  # E = 4
    ]

    demo_names = ["A", "B", "C", "D", "E"]
    demo_order = genetic_order(demo_matrix, start=0, seed=42)
    demo_total = sum(
        demo_matrix[demo_order[i]][demo_order[i + 1]]
        for i in range(len(demo_order) - 1)
    )

    print(
        "Порядок обхода:",
        " -> ".join(demo_names[i] for i in demo_order),
        "| суммарное расстояние:", demo_total,
    )