"use client";

import {
    ROUTE_VIEWS,
    formatHms,
    formatKm,
    formatPercent,
    getRouteResult,
    isOrderChanged,
} from "./algorithms";
import {
    type AlgorithmResult,
    type OptimizeResponse,
    type RouteViewKey,
} from "./types";

interface OptimizeResultsPanelProps {
    result: OptimizeResponse | null;
    isLoading: boolean;
    visibility: Record<RouteViewKey, boolean>;
    onToggleVisibility: (key: RouteViewKey) => void;
    activeView: RouteViewKey;
    onSelectActiveView: (key: RouteViewKey) => void;
    routeDurations: Partial<Record<RouteViewKey, number>>;
}

export default function OptimizeResultsPanel({
    result,
    isLoading,
    visibility,
    onToggleVisibility,
    activeView,
    onSelectActiveView,
    routeDurations,
}: OptimizeResultsPanelProps) {
    if (!isLoading && !result) {
        return null;
    }

    return (
        <div className="absolute right-5 top-10 z-1000 w-360px rounded-lg bg-white/80 p-4 shadow-lg backdrop-blur-sm">
            <h2 className="mb-1 text-black font-semibold">
                Сравнение маршрутов
            </h2>

            {!isLoading && result && (
                <p className="mb-4 text-xs text-gray-500">
                    Галочка — показать линию на карте. Клик по строке —
                    посмотреть порядок точек этого варианта.
                </p>
            )}

            {isLoading && (
                <p className="text-sm text-gray-600">Считаем маршруты…</p>
            )}

            {!isLoading && result && (
                <div className="flex flex-col gap-3">
                    {ROUTE_VIEWS.map((meta) => {
                        const isOriginal = meta.key === "original";
                        const routeResult = getRouteResult(result, meta.key);

                        const isActive = activeView === meta.key;
                        const isVisible = Boolean(visibility[meta.key]);
                        const duration = routeDurations[meta.key];

                        if (!routeResult) {
                            return (
                                <div
                                    key={meta.key}
                                    className="rounded border border-dashed border-gray-300 px-3 py-2"
                                >
                                    <p className="text-sm font-medium text-gray-400">
                                        {meta.label}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        Не посчитан: слишком много точек или
                                        не уложился по времени
                                    </p>
                                </div>
                            );
                        }

                        const algorithmResult = !isOriginal
                            ? (routeResult as AlgorithmResult)
                            : null;

                        return (
                            <div
                                key={meta.key}
                                onClick={() => onSelectActiveView(meta.key)}
                                className={`cursor-pointer rounded border-l-4 px-3 py-2 transition-colors ${
                                    isActive ? "bg-gray-100" : "hover:bg-gray-50"
                                }`}
                                style={{ borderLeftColor: meta.color }}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <label
                                        className="flex min-w-0 items-center gap-2"
                                        onClick={(event) => event.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isVisible}
                                            onChange={() => onToggleVisibility(meta.key)}
                                            className="h-4 w-4 shrink-0"
                                        />
                                        <span
                                            className="truncate text-sm font-semibold"
                                            style={{ color: meta.color }}
                                        >
                                            {meta.label}
                                        </span>
                                    </label>

                                    {isActive && (
                                        <span className="shrink-0 rounded bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                                            порядок показан
                                        </span>
                                    )}
                                </div>

                                <p className="mt-1 text-sm text-gray-700">
                                    Расстояние: {formatKm(routeResult.total_distance_m)}
                                </p>

                                <p className="text-sm text-gray-700">
                                    Время в пути:{" "}
                                    {duration != null ? formatHms(Math.round(duration)) : "—"}
                                </p>

                                {algorithmResult && (
                                    <>
                                        <p className="text-sm text-gray-700">
                                            Расчёт занял:{" "}
                                            {algorithmResult.elapsed_ms} ms
                                        </p>

                                        <p className="text-sm text-gray-700">
                                            Погрешность от идеала:{" "}
                                            {algorithmResult.error_vs_optimal_percent == null
                                                ? "Неизвестно"
                                                : formatPercent(
                                                      algorithmResult.error_vs_optimal_percent,
                                                  )}
                                        </p>

                                        <p className="text-sm text-gray-700">
                                            Относительно вашего маршрута:{" "}
                                            {formatPercent(
                                                algorithmResult.error_vs_original_percent,
                                            )}
                                        </p>

                                        <p className="mt-1 text-xs text-gray-500">
                                            {isOrderChanged(algorithmResult.order)
                                                ? "Порядок точек изменён"
                                                : "Порядок точек совпадает с исходным"}
                                        </p>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}