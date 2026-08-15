"use client";

import { Map as MapIcon, Plus, X } from "lucide-react";
import {
    type RoutePointInput,
    type GeocodingResult,
    type Selecting,
} from "./types";

interface RoutePanelProps {
    points: RoutePointInput[];
    selecting: Selecting;
    suggestions: Record<number, GeocodingResult[]>;
    onSelectMode: (id: Selecting) => void;
    onPointChange: (id: number, text: string) => void;
    onSelectSuggestion: (id: number, suggestion: GeocodingResult) => void;
    onBuildRoute: () => void;
    onAddPoint: () => void;
    onRemovePoint: (id: number) => void;
}

export default function RoutePanel({
    points,
    selecting,
    suggestions,

    onSelectMode,
    onPointChange,
    onSelectSuggestion,

    onBuildRoute,
    onAddPoint,
    onRemovePoint,
}: RoutePanelProps) {
    return (
        <div className="absolute left-5 top-10 z-1000 w-520px rounded-lg bg-white/80 p-4 shadow-lg backdrop-blur-sm">
            <h2 className="mb-4 text-black font-semibold">
                Маршрут
            </h2>

            {points.map((point, index) => {
                const pointSuggestions = suggestions[point.id] ?? [];
                const canRemove = points.length > 2;

                return (
                    <div
                        key={point.id}
                        className="mb-4 flex items-center gap-3"
                    >
                        <label className="w-40 shrink-0 text-base font-medium text-black whitespace-nowrap">
                            Точка №{index + 1}
                        </label>

                        <div className="relative min-w-0 flex-1">
                            <input
                                className="min-w-0 w-full rounded border border-gray-300 px-3 py-2 text-base text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Место или координаты"
                                value={point.text}
                                onChange={(event) => {
                                    onPointChange(
                                        point.id,
                                        event.target.value,
                                    );
                                }}
                            />

                            {pointSuggestions.length > 0 && (
                                <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded border border-gray-300 bg-white shadow-lg">
                                    {pointSuggestions.map((suggestion, suggestionIndex) => (
                                        <button
                                            key={`${suggestion.name}-${suggestionIndex}`}
                                            type="button"
                                            className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm text-black last:border-0 hover:bg-gray-100"
                                            onClick={() =>
                                                onSelectSuggestion(point.id, suggestion)
                                            }
                                        >
                                            {suggestion.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                onSelectMode(
                                    selecting === point.id ? null : point.id,
                                );
                            }}
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded border ${
                                selecting === point.id
                                    ? "bg-black text-white"
                                    : "bg-white text-black hover:bg-black hover:text-white"
                            }`}
                            title="Выбрать на карте"
                        >
                            <MapIcon size={20} />
                        </button>

                        {canRemove && (
                            <button
                                type="button"
                                onClick={() => onRemovePoint(point.id)}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-white text-black hover:bg-black hover:text-white"
                                title="Удалить точку"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>
                );
            })}

            <div className="mt-4 flex items-center justify-end gap-3">
                <button
                    type="button"
                    onClick={onBuildRoute}
                    className="rounded border bg-white px-4 py-2 text-black hover:bg-black hover:text-white"
                >
                    Оптимизировать маршрут
                </button>

                <button
                    type="button"
                    onClick={onAddPoint}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-white text-black hover:bg-black hover:text-white"
                    title="Добавить новую точку"
                >
                    <Plus strokeWidth={2} size={20} />
                </button>
            </div>
        </div>
    );
}