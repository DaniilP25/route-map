from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*']
)

class RouteRequest(BaseModel):
    points: list[str]

def parse_coordinates(value: str) -> tuple[float, float] | None:
    try:
        lat, lon = map(float, value.split(","))

        if not (-90 <= lat <= 90):
            return None

        if not (-180 <= lon <= 180):
            return None

        return lat, lon
    except (ValueError, TypeError):
        return None

async def geocode(client: httpx.AsyncClient, query: str) -> tuple[float, float]:
    response = await client.get(
        "https://nominatim.openstreetmap.org/search",
        params={
            "q": query,
            "format": "json",
            "limit": 1,
        },
        headers={
            "User-Agent": "route-map/1.0"
        },
    )

    response.raise_for_status()

    data = response.json()

    if not data:
        raise ValueError(f"Location not found: {query}")

    return float(data[0]["lat"]), float(data[0]["lon"])

@app.post("/route")
async def route(request: RouteRequest):
    if len(request.points) != 2:
        raise ValueError("Exactly two points are required")

    async with httpx.AsyncClient() as client:
        coordinates: list[tuple[float, float]] = []

        for point in request.points:
            parsed = parse_coordinates(point)

            if parsed is not None:
                coordinates.append(parsed)
                continue

            coordinates.append(
                await geocode(client, point)
            )

        (lat_a, lon_a), (lat_b, lon_b) = coordinates

        url = (
            f"https://router.project-osrm.org/route/v1/driving/"
            f"{lon_a},{lat_a};{lon_b},{lat_b}"
        )

        response = await client.get(
            url,
            params={
                "overview": "full",
                "geometries": "geojson"
            },
        )

        response.raise_for_status()

        data = response.json()

    route_data = data["routes"][0]

    return {
        "distance": route_data["distance"],
        "duration": route_data["duration"],
        "geometry": route_data["geometry"]
    }