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
    points: list[list[float]]

@app.post("/route")
async def route(request: RouteRequest):
    point_a = request.points[0]
    point_b = request.points[1]

    lat_a, lon_a = point_a[0], point_a[1]
    lat_b, lon_b = point_b[0], point_b[1]

    url = (
        f"https://router.project-osrm.org/route/v1/driving/"
        f"{lon_a},{lat_a};{lon_b},{lat_b}"
    )

    async with httpx.AsyncClient() as client:
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