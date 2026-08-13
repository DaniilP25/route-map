"use client";

import { useEffect, useState } from "react";
import { Map } from "lucide-react";
type Point = [number, number];

interface RoutePanelProps {
    departure: Point | null;
    arrival: Point | null;
    selecting: "departure" | "arrival" | null;
    onSelectMode: (mode: "departure" | "arrival") => void;
    onDepartureChange: (point: Point | null) => void;
    onArrivalChange: (point: Point | null) => void;
}

function isCoordinateInput(value: string): boolean {
    const parts = value.split(",").map((part) => part.trim());

    if (parts.length !== 2) {
        return false;
    }

    const lat = Number(parts[0]);
    const lng = Number(parts[1]);

    return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lng <= 90 &&
        lng >= -180 &&
        lng <= 180
    );
}

function parseCoordinates(value: string): Point {
    const [lat, lng] = value
        .split(",")
        .map((part) => Number(part.trim()));
    
    return [lat, lng];
}

export default function RoutePanel({
    departure,
    arrival,
    selecting,
    onSelectMode,
    onDepartureChange,
    onArrivalChange
}: RoutePanelProps) {
    const [departureText, setDepartureText] = useState("");
    const [arrivalText, setArrivalText] = useState("");

    useEffect(() => {
        if (!departureText.trim()) {
            return;
        }

        const timeout = setTimeout(async() => {
            if (isCoordinateInput(departureText)) {
                onDepartureChange(parseCoordinates(departureText));
                return;
            }

            try {
                const response = await fetch(
                    `/api/geocode/?q=${encodeURIComponent(departureText)}`
                );

                if (!response.ok) {
                    throw new Error(`HTTP error: ${response.status}`);
                }

                const data = await response.json();

                if (data.length === 0) {
                    return;
                }

                const point: Point = [
                    Number(data[0].lat),
                    Number(data[0].lon),
                ];

                onDepartureChange(point);
            }
            catch (error) {
                console.error("Geocoding error:", error);
            }
        }, 2000);

        return () => clearTimeout(timeout);
    }, [departureText, onDepartureChange]);

    useEffect(() => {
        if (!arrivalText.trim()) {
            return;
        }

        const timeout = setTimeout(async() => {
            if (isCoordinateInput(arrivalText)) {
                onArrivalChange(parseCoordinates(arrivalText));
                return;
            }

            try {
                const response = await fetch(
                    `/api/geocode/?q=${encodeURIComponent(arrivalText)}`
                );

                if (!response.ok) {
                    throw new Error(`HTTP error: ${response.status}`);
                }

                const data = await response.json();

                if (data.length === 0) {
                    return;
                }

                const point: Point = [
                    Number(data[0].lat),
                    Number(data[0].lon),
                ];

                onArrivalChange(point);
            }
            catch (error) {
                console.error("Geocoding error:", error);
            }
        }, 2000);

        return () => clearTimeout(timeout);
    }, [arrivalText, onArrivalChange]);

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
                    value={departureText}
                    onChange={(event) => {
                        setDepartureText(event.target.value);
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
                    value={departureText}
                    onChange={(event) => {
                        setDepartureText(event.target.value);
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
        </div>
    )
}