from contextlib import asynccontextmanager
from typing import AsyncGenerator, TypedDict

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URL_TEMPLATE = "https://router.project-osrm.org/route/v1/driving/{coordinates}"
HTTP_TIMEOUT_SECONDS = 10.0

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