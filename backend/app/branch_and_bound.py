import math
from dataclasses import dataclass

import httpx

from tsp_core import *
from greedy import nearest_neighbor_order

MAX_BRANCH_AND_BOUND_POINTS = 15

class TooManyPointsError(ValueError):
    """Точек больше, чем можно честно обойти методом ветвей и границ за разумное время."""

def _lower_bound(
    matrix: DistanceMatrix,
    current: int,
    unvisited: set[int],
    cost_so_far: float,
) -> float:
    if not unvisited:
        return cost_so_far

    min_out_current = min(matrix[current][u] for u in unvisited)

    min_outs: list[float] = []
    for v in unvisited:
        other_targets = [u for u in unvisited if u != v]
        if other_targets:
            min_outs.append(min(matrix[v][u] for u in other_targets))
        else:
            # v — единственная оставшаяся точка, значит она и есть конец
            # маршрута, исходящее ребро от неё не требуется
            min_outs.append(0.0)

    return (
        cost_so_far
        + min_out_current
        + sum(min_outs)
        - max(min_outs)
    )

def branch_and_bound_order(matrix: DistanceMatrix, start: int = 0) -> list[int]:
    n = len(matrix)

    if n <= 1:
        return list(range(n))

    if n > MAX_BRANCH_AND_BOUND_POINTS:
        raise TooManyPointsError(
            f"Метод ветвей и границ поддерживает максимум "
            f"{MAX_BRANCH_AND_BOUND_POINTS} точек, получено {n}."
        )

    best_order = nearest_neighbor_order(matrix, start)
    best_cost = sum(
        matrix[best_order[i]][best_order[i + 1]]
        for i in range(len(best_order) - 1)
    )

    path = [start]

    def dfs(current: int, unvisited: set[int], cost_so_far: float) -> None:
        nonlocal best_order, best_cost

        if not unvisited:
            if cost_so_far < best_cost:
                best_cost = cost_so_far
                best_order = path[:]
            return

        bound = _lower_bound(matrix, current, unvisited, cost_so_far)
        if bound >= best_cost:
            return

        for next_node in sorted(unvisited, key=lambda node: matrix[current][node]):
            new_cost = cost_so_far + matrix[current][next_node]
            if new_cost >= best_cost:
                continue

            path.append(next_node)
            dfs(next_node, unvisited - {next_node}, new_cost)
            path.pop()

    dfs(start, set(range(n)) - {start}, 0.0)

    return best_order

@dataclass
class OptimalRoute:
    order: list[int]
    points: list[Point]
    total_distance: float

async def optimize_route_branch_and_bound(
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

    if len(points) > MAX_BRANCH_AND_BOUND_POINTS:
        raise TooManyPointsError(
            f"Метод ветвей и границ поддерживает максимум "
            f"{MAX_BRANCH_AND_BOUND_POINTS} точек, получено {len(points)}."
        )

    matrix = await fetch_distance_matrix(client, points)
    order = branch_and_bound_order(matrix, start=start)

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
        [1.0,  2.0,  3.0,  4.0,  0.0],  # E = 4
    ]

    demo_names = ["A", "B", "C", "D", "E"]
    demo_order = branch_and_bound_order(demo_matrix, start=0)
    demo_total = sum(
        demo_matrix[demo_order[i]][demo_order[i + 1]]
        for i in range(len(demo_order) - 1)
    )

    print(
        "Оптимальный порядок:",
        " -> ".join(demo_names[i] for i in demo_order),
        "| суммарное расстояние:", demo_total,
    )