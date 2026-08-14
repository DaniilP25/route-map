"use client";

import { useState } from "react";
import { Map, Plus } from "lucide-react";
type Point = [number, number];

interface RoutePanelProps {
    departure: Point | null;
    arrival: Point | null;
    selecting: "departure" | "arrival" | "build-route" | null;
    onSelectMode: (mode: "departure" | "arrival" | "build-route" ) => void;
    onDepartureChange: (point: Point | null) => void;
    onArrivalChange: (point: Point | null) => void;
    onRouteChange: (geometry: {
        type: string;
        coordinates: [number, number][];
    }) => void;
}

export default function RoutePanel({
    departure,
    arrival,
    selecting,
    onSelectMode,
    onDepartureChange,
    onArrivalChange,
    onRouteChange
}: RoutePanelProps) {
    const [departureText, setDepartureText] = useState("");
    const [arrivalText, setArrivalText] = useState("");

    return (
        <div className="absolute left-5 top-10 z-1000 w-520px rounded-lg bg-white/80 p-4 shadow-lg backdrop-blur-sm">
            <h2 className="mb-4 text-black font-semibold">
                Маршрут
            </h2>

            <div className="mb-4 flex items-center gap-3">
                <label className="w-40 shrink-0 text-base font-medium text-black whitespace-nowrap">
                    Пункт отправления
                </label>

                <input
                    className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-base text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Место или координаты"
                    value={
                        departure
                        ? `${departure[0]}, ${departure[1]}`
                        : departureText
                    }
                    onChange={(event) => {
                        setDepartureText(event.target.value);
                        onDepartureChange(null);
                    }}
                />

                <button
                    type="button"
                    onClick={() => onSelectMode("departure")}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded border ${
                        selecting === "departure"
                        ? "bg-black text-white"
                        : "bg-white text-black hover:bg-black hover:text-white"
                    }`}
                    title="Выбрать на карте"
                >
                    <Map size={20} />
                </button>
            </div>

            <div className="mb-4 flex items-center gap-3">
                <label className="w-40 shrink-0 text-base font-medium text-black whitespace-nowrap">
                    Пункт прибытия
                </label>

                <input
                    className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-base text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Место или координаты"
                    value={
                        arrival
                        ? `${arrival[0]}, ${arrival[1]}`
                        : arrivalText
                    }
                    onChange={(event) => {
                        setArrivalText(event.target.value);
                        onArrivalChange(null);
                    }}
                />

                <button
                    type="button"
                    onClick={() => onSelectMode("arrival")}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded border ${
                        selecting === "arrival"
                        ? "bg-black text-white"
                        : "bg-white text-black hover:bg-black hover:text-white"
                    }`}
                    title="Выбрать на карте"
                >
                    <Map size={20} />
                </button>
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
                <button
                    type="button"
                    onClick={async () => {
                        onSelectMode("build-route");
                        try {
                            const response = await fetch(
                                "http://127.0.0.1:3001/route", {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                        points: [
                                            departure
                                                ? `${departureText[0]}, ${departureText[1]}`
                                                : departureText,
                                            arrival
                                                ? `${arrivalText[0]}, ${arrivalText[1]}`
                                                : arrivalText,
                                        ],
                                    }),
                                },
                            );

                            if (!response.ok) {
                                throw new Error(`HTTP error: ${response.status}`);
                            }

                            const data = await response.json();
                            onRouteChange(data.geometry);
                        }
                        catch (error) {
                            console.error("Route error:", error);
                        }
                    }}
                    className={`flex h-10 w-48 shrink-0 items-center justify-center rounded border ${
                        selecting === "build-route"
                        ? "bg-black text-white"
                        : "bg-white text-black hover:bg-black hover:text-white"
                    }`}
                    title="Построить маршрут"
                >
                    Построить маршрут
                </button>

                <button
                    type="button"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-white text-black hover:bg-black hover:text-white"
                    title="Добавить новую точку"
                >
                    <Plus strokeWidth={2} size={20} />
                </button>
            </div>
        </div>
    )
}