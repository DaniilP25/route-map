import math
from dataclasses import dataclass

import httpx

from tsp_core import *

def nearest_neighbor_order(matrix: DistanceMatrix, start: int = 0) -> list[int]:
    n = len(matrix)

    if n <= 1:
        return list(range(n))

    visited = [False] * n
    order = [start]
    visited[start] = True

    current = start

    for _ in range(n - 1):
        nearest_index: int | None = None
        nearest_distance = math.inf

        for candidate in range(n):
            if visited[candidate]:
                continue

            distance = matrix[current][candidate]

            if distance < nearest_distance:
                nearest_distance = distance
                nearest_index = candidate

        if nearest_index is None:
            order.extend(i for i in range(n) if not visited[i])
            break

        order.append(nearest_index)
        visited[nearest_index] = True
        current = nearest_index

    return order


@dataclass
class OptimizedRoute:
    order: list[int]
    points: list[Point]
    total_distance: float

async def optimize_route(
    client: httpx.AsyncClient,
    points: list[Point],
    start: int = 0,
) -> OptimizedRoute:
    if len(points) < 2:
        return OptimizedRoute(
            order=list(range(len(points))),
            points=list(points),
            total_distance=0.0,
        )

    matrix = await fetch_distance_matrix(client, points)
    order = nearest_neighbor_order(matrix, start=start)

    total_distance = sum(
        matrix[order[i]][order[i + 1]]
        for i in range(len(order) - 1)
    )

    return OptimizedRoute(
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
    demo_order = nearest_neighbor_order(demo_matrix, start=0)
    demo_total = sum(
        demo_matrix[demo_order[i]][demo_order[i + 1]]
        for i in range(len(demo_order) - 1)
    )

    print("Порядок обхода:", " -> ".join(demo_names[i] for i in demo_order), "| суммарное расстояние:", demo_total)