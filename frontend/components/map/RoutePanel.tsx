"use client";

import { Map, Plus } from "lucide-react";

type Point = [number, number];

interface RoutePoint {
    text: string;
    point: Point | null;
}

interface ArrivalInput extends RoutePoint {
    id: number;
}

type Selecting = 
    { type: "departure" } |
    { type: "arrival"; id: number } |
    null;

interface RoutePanelProps {
    departure: RoutePoint;
    arrivals: ArrivalInput[];
    selecting: Selecting;
    onSelectMode: (mode: Selecting ) => void;
    onDepartureChange: (point: RoutePoint) => void;
    onArrivalChange: (point: ArrivalInput[]) => void;
    onBuildRoute: () => void;
}

export default function RoutePanel({
    departure,
    arrivals,
    selecting,
    onSelectMode,
    onDepartureChange,
    onArrivalChange,
    onBuildRoute,
}: RoutePanelProps) {

    return (
        <div className="absolute left-5 top-10 z-1000 w-520px rounded-lg bg-white/80 p-4 shadow-lg backdrop-blur-sm">
            <h2 className="mb-4 text-black font-semibold">
                Маршрут
            </h2>

            <div className="mb-4 flex items-center gap-3">
                <label className="w-40 shrink-0 text-base font-medium text-black whitespace-nowrap">
                    Точка №1
                </label>

                <input
                    className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-base text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Место или координаты"
                    value={departure.text}
                    onChange={(event) => {
                        onDepartureChange({
                            text: event.target.value,
                            point: null,
                        });
                    }}
                />

                <button
                    type="button"
                    onClick={() => {
                        onSelectMode(
                            selecting?.type === "departure"
                                ? null
                                : { type: "departure" },
                        );
                    }}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded border ${
                        selecting?.type === "departure"
                        ? "bg-black text-white"
                        : "bg-white text-black hover:bg-black hover:text-white"
                    }`}
                    title="Выбрать на карте"
                >
                    <Map size={20} />
                </button>
            </div>

            {arrivals.map((arrival, index) => (
                <div
                    key={arrival.id}
                    className="mb-4 flex items-center gap-3"
                >
                    <label className="w-40 shrink-0 text-base font-medium text-black whitespace-nowrap">
                        Точка
                        { ` №${index + 2}` }
                    </label>

                    <input
                        className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-base text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Место или координаты"
                        value={arrival.text}
                        onChange={(event) => {
                            onArrivalChange(
                                arrivals.map((item) => 
                                    item.id === arrival.id
                                    ? {
                                        ...item,
                                        text: event.target.value,
                                        point: null,
                                    }
                                    : item
                                ),
                            );
                        }}
                    />

                    <button
                        type="button"
                        onClick={() => {
                            onSelectMode(
                                selecting?.type === "arrival" && selecting.id === arrival.id
                                    ? null
                                    : {
                                        type: "arrival",
                                        id: arrival.id,
                                    },
                            );
                        }}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded border ${
                            selecting?.type === "arrival" && selecting?.id === arrival.id
                                ? "bg-black text-white"
                                : "bg-white text-black hover:bg-black hover:text-white"
                        }`}
                        title="Выбрать на карте"
                    >
                        <Map size={20} />
                    </button>
                </div>
            ))}

            <div className="mt-4 flex items-center justify-end gap-3">
                <button
                    type="button"
                    onClick={onBuildRoute}
                >
                    Оптимизировать маршрут
                </button>

                <button
                    type="button"
                    onClick={() => {
                        const nextId = arrivals.length === 0
                            ? 1
                            : Math.max(...arrivals.map((arrival) => arrival.id)) + 1;
                        
                        onArrivalChange([
                            ...arrivals,
                            {
                                id: nextId,
                                text: "",
                                point: null,
                            },
                        ]);
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-white text-black hover:bg-black hover:text-white"
                    title="Добавить новую точку"
                >
                    <Plus strokeWidth={2} size={20} />
                </button>
            </div>
        </div>
    )
}