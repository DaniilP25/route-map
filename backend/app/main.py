import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator, TypedDict

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from brute_force import MAX_BRUTE_FORCE_POINTS, brute_force_order
from branch_and_bound import MAX_BRANCH_AND_BOUND_POINTS, branch_and_bound_order
from greedy import nearest_neighbor_order
from ant_colony import ant_colony_order
from genetic import genetic_order
from tsp_core import DistanceMatrix, Point, fetch_distance_matrix

logger = logging.getLogger("route_map.optimize")
logger.setLevel(logging.INFO)

if not logging.getLogger().handlers:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URL_TEMPLATE = "https://router.project-osrm.org/route/v1/driving/{coordinates}"
HTTP_TIMEOUT_SECONDS = 10.0

# Таймауты на расчёт каждого алгоритма
GREEDY_TIMEOUT_SECONDS = 5.0
BRUTE_FORCE_TIMEOUT_SECONDS = 5.0
BRANCH_AND_BOUND_TIMEOUT_SECONDS = 5.0
ANT_COLONY_TIMEOUT_SECONDS = 10.0
GENETIC_TIMEOUT_SECONDS = 10.0

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    async with httpx.AsyncClient(
        timeout=HTTP_TIMEOUT_SECONDS,
        trust_env=False,
    ) as client:
        app.state.http_client = client
        yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RouteRequest(BaseModel):
    points: list[list[float]]

class GeocodeRequest(BaseModel):
    query: str

class GeocodingResult(TypedDict):
    name: str
    point: list[float]

class OptimizeRequest(BaseModel):
    points: list[list[float]]
    start: int = 0

class AlgorithmResult(TypedDict):
    order: list[int]
    total_distance: float
    elapsed_seconds: float

class AlgorithmResponse(TypedDict):
    order: list[int]
    points: list[list[float]]
    total_distance_m: float
    elapsed_ms: float
    error_vs_optimal_percent: float | None
    error_vs_original_percent: float

class OriginalRouteResponse(TypedDict):
    order: list[int]
    points: list[list[float]]
    total_distance_m: float

class OptimizeResponse(TypedDict):
    original: OriginalRouteResponse
    brute_force: AlgorithmResponse | None
    branch_and_bound: AlgorithmResponse | None
    greedy: AlgorithmResponse | None
    ant_colony: AlgorithmResponse | None
    genetic: AlgorithmResponse | None
    chosen_algorithm: str

def _order_total_distance(matrix: DistanceMatrix, order: list[int]) -> float:
    return sum(
        matrix[order[i]][order[i + 1]]
        for i in range(len(order) - 1)
    )

def _to_algorithm_response(
    points: list[Point],
    result: AlgorithmResult,
    optimal_distance: float | None,
    original_distance: float,
) -> AlgorithmResponse:
    total_distance = result["total_distance"]

    error_vs_optimal: float | None
    if optimal_distance is None:
        error_vs_optimal = None
    elif optimal_distance > 0:
        error_vs_optimal = (total_distance - optimal_distance) / optimal_distance * 100
    else:
        error_vs_optimal = 0.0

    if original_distance > 0:
        error_vs_original = (total_distance - original_distance) / original_distance * 100
    else:
        error_vs_original = 0.0

    return {
        "order": result["order"],
        "points": [list(points[i]) for i in result["order"]],
        "total_distance_m": total_distance,
        "elapsed_ms": round(result["elapsed_seconds"] * 1000),
        "error_vs_optimal_percent": error_vs_optimal,
        "error_vs_original_percent": error_vs_original,
    }

async def _run_with_timeout(
    name: str,
    matrix: DistanceMatrix,
    start: int,
    order_fn,
    timeout_seconds: float,
) -> AlgorithmResult | None:
    started_at = time.perf_counter()

    try:
        order = await asyncio.wait_for(
            asyncio.to_thread(order_fn, matrix, start),
            timeout=timeout_seconds,
        )
    except asyncio.TimeoutError:
        logger.warning(
            "algorithm=%s points=%d timed_out_after=%.1fs, skipped",
            name, len(matrix), timeout_seconds,
        )
        return None

    elapsed_seconds = time.perf_counter() - started_at

    result: AlgorithmResult = {
        "order": order,
        "total_distance": _order_total_distance(matrix, order),
        "elapsed_seconds": elapsed_seconds,
    }

    logger.info(
        "algorithm=%s points=%d distance=%.2f elapsed=%.4fs order=%s",
        name, len(matrix), result["total_distance"], elapsed_seconds, order,
    )

    return result

async def geocode(client: httpx.AsyncClient, query: str) -> list[GeocodingResult]:
    try:
        response = await client.get(
            NOMINATIM_URL,
            params={
                "q": query,
                "format": "json",
                "limit": 3,
            },
            headers={
                "User-Agent": "route-map/1.0",
            },
        )

        response.raise_for_status()
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail="Geocoding service is unavailable",
        ) from error

    data: list[dict[str, object]] = response.json()

    results: list[GeocodingResult] = []

    for item in data:
        lat = item.get("lat")
        lon = item.get("lon")
        display_name = item.get("display_name")

        if not isinstance(lat, str):
            continue

        if not isinstance(lon, str):
            continue

        if not isinstance(display_name, str):
            continue

        results.append(
            {
                "name": display_name,
                "point": [
                    float(lat),
                    float(lon),
                ],
            }
        )

    return results

@app.post("/geocode")
async def geocode_endpoint(request: GeocodeRequest) -> list[GeocodingResult]:
    query = request.query.strip()

    if not query:
        return []

    return await geocode(app.state.http_client, query)

@app.post("/route")
async def route(request: RouteRequest):
    if len(request.points) < 2:
        raise HTTPException(
            status_code=400,
            detail=f"At least 2 points are required",
        )

    coordinates: list[tuple[float, float]] = []

    for point in request.points:
        if len(point) != 2:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid point: {point}",
            )

        lat, lon = point

        if not (-90 <= lat <= 90):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid latitude: {lat}",
            )

        if not (-180 <= lon <= 180):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid longitude: {lon}",
            )

        coordinates.append((lat, lon))

    osrm_coordinates = ";".join(
        f"{lon},{lat}"
        for lat, lon in coordinates
    )

    url = OSRM_URL_TEMPLATE.format(coordinates=osrm_coordinates)

    try:
        response = await app.state.http_client.get(
            url,
            params={
                "overview": "full",
                "geometries": "geojson",
            },
        )

        response.raise_for_status()
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail="Routing service is unavailable",
        ) from error

    data = response.json()
    routes = data.get("routes")

    if not routes:
        raise HTTPException(status_code=404, detail="No route found")

    route_data = routes[0]

    return {
        "distance": route_data["distance"],
        "duration": route_data["duration"],
        "geometry": route_data["geometry"],
    }

@app.post("/optimize")
async def optimization(request: OptimizeRequest) -> OptimizeResponse:
    if len(request.points) < 2:
        raise HTTPException(
            status_code=400,
            detail=f"At least 2 points are required",
        )

    points: list[Point] = []

    for point in request.points:
        if len(point) != 2:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid point: {point}",
            )

        lat, lon = point

        if not (-90 <= lat <= 90):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid latitude: {lat}",
            )

        if not (-180 <= lon <= 180):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid longitude: {lon}",
            )

        points.append((lat, lon))

    if not (0 <= request.start < len(points)):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid start index: {request.start}",
        )

    try:
        matrix = await fetch_distance_matrix(app.state.http_client, points)
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail="Routing service is unavailable",
        ) from error

    original_order = list(range(len(points)))
    original_distance = _order_total_distance(matrix, original_order)

    can_brute_force = len(points) <= MAX_BRUTE_FORCE_POINTS
    can_branch_and_bound = len(points) <= MAX_BRANCH_AND_BOUND_POINTS

    if not can_brute_force:
        logger.info(
            "algorithm=brute_force points=%d skipped: exceeds MAX_BRUTE_FORCE_POINTS=%d",
            len(points), MAX_BRUTE_FORCE_POINTS,
        )

    if not can_branch_and_bound:
        logger.info(
            "algorithm=branch_and_bound points=%d skipped: exceeds MAX_BRANCH_AND_BOUND_POINTS=%d",
            len(points), MAX_BRANCH_AND_BOUND_POINTS,
        )

    task_names: list[str] = ["greedy", "ant_colony", "genetic"]
    tasks = [
        _run_with_timeout("greedy", matrix, request.start, nearest_neighbor_order, GREEDY_TIMEOUT_SECONDS),
        _run_with_timeout("ant_colony", matrix, request.start, ant_colony_order, ANT_COLONY_TIMEOUT_SECONDS),
        _run_with_timeout("genetic", matrix, request.start, genetic_order, GENETIC_TIMEOUT_SECONDS),
    ]

    if can_brute_force:
        task_names.append("brute_force")
        tasks.append(
            _run_with_timeout("brute_force", matrix, request.start, brute_force_order, BRUTE_FORCE_TIMEOUT_SECONDS)
        )

    if can_branch_and_bound:
        task_names.append("branch_and_bound")
        tasks.append(
            _run_with_timeout("branch_and_bound", matrix, request.start, branch_and_bound_order, BRANCH_AND_BOUND_TIMEOUT_SECONDS)
        )

    task_results = await asyncio.gather(*tasks)
    results: dict[str, AlgorithmResult | None] = dict(zip(task_names, task_results))

    exact_distances = [
        results[name]["total_distance"]
        for name in ("brute_force", "branch_and_bound")
        if results.get(name) is not None
    ]
    optimal_distance = min(exact_distances) if exact_distances else None

    def build_response(name: str) -> AlgorithmResponse | None:
        result = results.get(name)
        if result is None:
            return None
        return _to_algorithm_response(points, result, optimal_distance, original_distance)

    brute_force_response = build_response("brute_force")
    branch_and_bound_response = build_response("branch_and_bound")
    greedy_response = build_response("greedy")
    ant_colony_response = build_response("ant_colony")
    genetic_response = build_response("genetic")

    candidates: list[tuple[str, float]] = [
        (name, result["total_distance"])
        for name, result in results.items()
        if result is not None
    ]
    candidates.append(("original", original_distance))

    chosen_algorithm, _ = min(candidates, key=lambda candidate: candidate[1])

    logger.info(
        "optimize: chosen_algorithm=%s points=%d original_distance=%.2f",
        chosen_algorithm, len(points), original_distance,
    )

    return {
        "original": {
            "order": original_order,
            "points": [list(p) for p in points],
            "total_distance_m": original_distance,
        },
        "brute_force": brute_force_response,
        "branch_and_bound": branch_and_bound_response,
        "greedy": greedy_response,
        "ant_colony": ant_colony_response,
        "genetic": genetic_response,
        "chosen_algorithm": chosen_algorithm,
    }