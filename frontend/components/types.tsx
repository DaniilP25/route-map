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

export interface AlgorithmResult {
    order: number[];
    points: Point[];
    total_distance_m: number;
    elapsed_ms: number;
    error_vs_optimal_percent: number | null;
    error_vs_original_percent: number;
}

export interface OriginalRouteResult {
    order: number[];
    points: Point[];
    total_distance_m: number;
}

export interface OptimizeResponse {
    original: OriginalRouteResult;
    brute_force: AlgorithmResult | null;
    branch_and_bound: AlgorithmResult | null;
    greedy: AlgorithmResult | null;
    ant_colony: AlgorithmResult | null;
    genetic: AlgorithmResult | null;
    chosen_algorithm: string;
}

export type AlgorithmKey =
    | "brute_force"
    | "branch_and_bound"
    | "greedy"
    | "ant_colony"
    | "genetic";

export type RouteViewKey = AlgorithmKey | "original";

export type Selecting = number | null;