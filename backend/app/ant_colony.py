import math
import random
from dataclasses import dataclass

import httpx

from tsp_core import *

N_ANTS = 20
N_ITERATIONS = 100
ALPHA = 1.0
BETA = 3.0
EVAPORATION_RATE = 0.5
PHEROMONE_DEPOSIT = 100.0

def ant_colony_order(
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

    pheromone = [[1.0] * n for _ in range(n)]

    def edge_weight(i: int, j: int) -> float:
        distance = matrix[i][j]
        if distance <= 0:
            return 1e6
        return (pheromone[i][j] ** ALPHA) * ((1.0 / distance) ** BETA)

    best_order: list[int] | None = None
    best_cost = math.inf

    for _ in range(N_ITERATIONS):
        iteration_routes: list[tuple[list[int], float]] = []

        for _ant in range(N_ANTS):
            unvisited = set(range(n)) - {start}
            route = [start]
            current = start

            while unvisited:
                candidates = list(unvisited)
                weights = [edge_weight(current, j) for j in candidates]
                total_weight = sum(weights)

                if total_weight <= 0:
                    next_node = rng.choice(candidates)
                else:
                    threshold = rng.uniform(0, total_weight)
                    cumulative = 0.0
                    next_node = candidates[-1]
                    for node, weight in zip(candidates, weights):
                        cumulative += weight
                        if cumulative >= threshold:
                            next_node = node
                            break

                route.append(next_node)
                unvisited.discard(next_node)
                current = next_node

            cost = sum(
                matrix[route[i]][route[i + 1]] for i in range(len(route) - 1)
            )
            iteration_routes.append((route, cost))

            if cost < best_cost:
                best_cost = cost
                best_order = route

        for i in range(n):
            for j in range(n):
                pheromone[i][j] *= 1 - EVAPORATION_RATE

        for route, cost in iteration_routes:
            if cost <= 0:
                continue
            deposit = PHEROMONE_DEPOSIT / cost
            for i in range(len(route) - 1):
                a, b = route[i], route[i + 1]
                pheromone[a][b] += deposit
                pheromone[b][a] += deposit

    return best_order if best_order is not None else list(range(n))

@dataclass
class HeuristicRoute:
    order: list[int]
    points: list[Point]
    total_distance: float

async def optimize_route_ant_colony(
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
    order = ant_colony_order(matrix, start=start, seed=seed)

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
    demo_order = ant_colony_order(demo_matrix, start=0, seed=42)
    demo_total = sum(
        demo_matrix[demo_order[i]][demo_order[i + 1]]
        for i in range(len(demo_order) - 1)
    )

    print(
        "Порядок обхода:",
        " -> ".join(demo_names[i] for i in demo_order),
        "| суммарное расстояние:", demo_total,
    )