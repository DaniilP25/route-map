"use client";

type Point = [number, number];

interface RoutePanelProps {
    departure: Point | null;
    arrival: Point | null;
    selecting: "departure" | "arrival" | null;
    onSelectMode: (mode: "departure" | "arrival") => void;
    onDepartureChange: (point: Point | null) => void;
    onArrivalChange: (point: Point | null) => void;
}

export default function RoutePanel({
    departure,
    arrival,
    selecting,
    onSelectMode,
    onDepartureChange,
    onArrivalChange
}: RoutePanelProps) {
    return (
        <div className="absolute left-4 top-4 z-[1000] w-80 rounded-lg bg-white p-4 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">
                Маршрут
            </h2>

            <div className="mb-4">
                <div className="mb-2 text-sm font-medium">
                    Пункт отправления
                </div>

                <input
                    className="mb-2 w-full"
                    placeholder="Широта, долгота"
                    value={
                        departure
                        ? `${departure[0]}, ${departure[1]}`
                        : ""
                    }
                    onChange={(event) => {
                        const value = event.target.value;

                        const [lat, lng] = value
                            .split(",")
                            .map(Number);

                        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                            onDepartureChange([lat, lng]);
                        }
                    }}
                />

                <button type="button" className={`w-full rounded px-3 py-2 text-sm ${
                    selecting === "departure"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200"
                }`}>
                    Выбрать на карте
                </button>
            </div>

            <div>

            </div>
        </div>
    )
}