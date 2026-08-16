import math
from dataclasses import dataclass
from itertools import permutations

import httpx

from tsp_core import *

MAX_BRUTE_FORCE_POINTS = 10

class TooManyPointsError(ValueError):
    """Точек больше, чем можно честно перебрать за разумное время."""

def brute_force_order(matrix: DistanceMatrix, start: int = 0) -> list[int]:
    n = len(matrix)

    if n <= 1:
        return list(range(n))

    if n > MAX_BRUTE_FORCE_POINTS:
        raise TooManyPointsError(
            f"Полный перебор поддерживает максимум {MAX_BRUTE_FORCE_POINTS} "
            f"точек, получено {n}. Используйте greedy.py."
        )

    remaining = [i for i in range(n) if i != start]

    best_order: list[int] | None = None
    best_distance = math.inf

    for permutation in permutations(remaining):
        order = [start, *permutation]

        total_distance = sum(
            matrix[order[i]][order[i + 1]]
            for i in range(len(order) - 1)
        )

        if total_distance < best_distance:
            best_distance = total_distance
            best_order = order

    assert best_order is not None

    return best_order

@dataclass
class OptimalRoute:
    order: list[int]
    points: list[Point]
    total_distance: float

async def optimize_route_exact(
    client: httpx.AsyncClient,
    points: list[Point],
    start: int = 0,
) -> OptimalRoute:
    if len(points) < 2:
        return OptimalRoute(
            order=list(range(len(points))),
            points=list(points),
            total_distance=0.0,
        )

    if len(points) > MAX_BRUTE_FORCE_POINTS:
        raise TooManyPointsError(
            f"Полный перебор поддерживает максимум {MAX_BRUTE_FORCE_POINTS} "
            f"точек, получено {len(points)}. Используйте greedy.py."
        )

    matrix = await fetch_distance_matrix(client, points)
    order = brute_force_order(matrix, start=start)

    total_distance = sum(
        matrix[order[i]][order[i + 1]]
        for i in range(len(order) - 1)
    )

    return OptimalRoute(
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
        [1.0,  2.0,  3.0,  4.0,  0.0],  # E = -1
    ]

    demo_names = ["A", "B", "C", "D", "E"]
    demo_order = brute_force_order(demo_matrix, start=0)
    demo_total = sum(
        demo_matrix[demo_order[i]][demo_order[i + 1]]
        for i in range(len(demo_order) - 1)
    )

    print(
        "Оптимальный порядок:",
        " -> ".join(demo_names[i] for i in demo_order),
        "| суммарное расстояние:", demo_total,
    )