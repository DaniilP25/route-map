export type Point = [number, number];

export interface RoutePointInput {
    id: number;
    text: string;
    point: Point | null;
}

export interface GeocodingResult {
    name: string;
    point: Point;
}

export interface RouteGeometry {
    type: "LineString";
    coordinates: [number, number][];
}

export interface RouteResponse {
    distance: number;
    duration: number;
    geometry: RouteGeometry;
}

export type Selecting = number | null;