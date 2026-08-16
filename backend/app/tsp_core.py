import httpx
import math

Point = tuple[float, float]

DistanceMatrix = list[list[float]]

OSRM_TABLE_URL_TEMPLATE = "https://router.project-osrm.org/table/v1/driving/{coordinates}"

async def fetch_distance_matrix(
    client: httpx.AsyncClient,
    points: list[Point],
) -> DistanceMatrix:
    if len(points) < 2:
        return [[0.0] * len(points) for _ in points]

    coordinates = ";".join(f"{lon},{lat}" for lat, lon in points)
    url = OSRM_TABLE_URL_TEMPLATE.format(coordinates=coordinates)

    response = await client.get(url, params={"annotations": "distance"})
    response.raise_for_status()

    data = response.json()
    raw_matrix: list[list[float | None]] = data["distances"]

    matrix: DistanceMatrix = [
        [math.inf if value is None else float(value) for value in row]
        for row in raw_matrix
    ]

    return matrix