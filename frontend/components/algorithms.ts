import {
    type AlgorithmResult,
    type OptimizeResponse,
    type OriginalRouteResult,
    type RouteViewKey,
} from "./types";

export interface RouteViewMeta {
    key: RouteViewKey;
    label: string;
    color: string;
}

export const ROUTE_VIEWS: RouteViewMeta[] = [
    { key: "original", label: "Ваш маршрут", color: "#2563eb" },
    { key: "brute_force", label: "Математический перебор", color: "#16a34a" },
    { key: "branch_and_bound", label: "Метод ветвей и границ", color: "#9333ea" },
    { key: "greedy", label: "Жадный алгоритм", color: "#dc2626" },
    { key: "ant_colony", label: "Муравьиный алгоритм", color: "#f97316" },
    { key: "genetic", label: "Генетический алгоритм", color: "#0d9488" },
];

function buildRouteViewMeta(): Record<RouteViewKey, RouteViewMeta> {
    const entries = ROUTE_VIEWS.map((meta) => [meta.key, meta] as const);
    return Object.fromEntries(entries) as Record<RouteViewKey, RouteViewMeta>;
}

export const ROUTE_VIEW_META: Record<RouteViewKey, RouteViewMeta> = buildRouteViewMeta();

// Достаёт результат нужного варианта маршрута из ответа /optimize
export function getRouteResult(
    result: OptimizeResponse,
    key: RouteViewKey,
): OriginalRouteResult | AlgorithmResult | null {
    if (key === "original") {
        return result.original;
    }

    return result[key];
}

export function formatKm(meters: number): string {
    return `${(meters / 1000).toFixed(2)} км`;
}

// Секунды -> "чч:мм:сс"
export function formatHms(totalSeconds: number): string {
    const clamped = Math.max(0, totalSeconds);
    const hours = Math.floor(clamped / 3600);
    const minutes = Math.floor((clamped % 3600) / 60);
    const seconds = clamped % 60;

    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");

    return `${hh}:${mm}:${ss}`;
}

export function formatPercent(percent: number): string {
    if (percent === 0) {
        return "0%";
    }

    const rounded = percent.toFixed(1);
    return percent > 0 ? `+${rounded}%` : `${rounded}%`;
}

// Порядок точек совпадает с тем, в котором их ввёл пользователь?
export function isOrderChanged(order: number[]): boolean {
    return order.some((value, index) => value !== index);
}