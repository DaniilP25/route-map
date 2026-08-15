"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import RoutePanel from "./RoutePanel";
import {
    type Point,
    type RoutePointInput,
    type GeocodingResult,
    type RouteGeometry,
    type RouteResponse,
    type Selecting,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

const DEFAULT_CENTER: Point = [54.99, 73.36];
const DEFAULT_ZOOM = 13;
const GEOCODE_DEBOUNCE_MS = 500;

function createPointIcon(number: number) {
    return L.divIcon({
        className: "",
        html: `
            <div class="relative flex flex-col items-center">
                <div class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-sm font-semibold text-white shadow-md">
                    ${number}
                </div>
                <div class="h-2 w-2 -mt-1 rotate-45 bg-gray-700"></div>
            </div>
        `,
        iconSize: [32, 40],
        iconAnchor: [16, 36],
    });
}

function formatPoint(point: Point): string {
    return `${point[0].toFixed(6)}, ${point[1].toFixed(6)}`;
}

function createEmptyPoint(id: number): RoutePointInput {
    return { id, text: "", point: null };
}

export default function RouteMap() {
    const [points, setPoints] = useState<RoutePointInput[]>([
        createEmptyPoint(1),
        createEmptyPoint(2),
    ]);

    const [selecting, setSelecting] = useState<Selecting>(null);
    const [route, setRoute] = useState<RouteGeometry | null>(null);

    const [suggestions, setSuggestions] = useState<Record<number, GeocodingResult[]>>({});
    const [geocodingTarget, setGeocodingTarget] = useState<number | null>(null);

    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);

    const routeLineRef = useRef<L.Polyline | null>(null);
    const markerRefs = useRef<Map<number, L.Marker>>(new Map());

    const buildRoute = () => {
        // TODO: оптимизация порядка точек
    };

    const nextPointId = () =>
        points.length === 0 ? 1 : Math.max(...points.map((p) => p.id)) + 1;

    const addPoint = () => {
        setPoints((current) => [...current, createEmptyPoint(nextPointId())]);
    };

    const removePoint = (id: number) => {
        setPoints((current) => {
            if (current.length <= 2) {
                return current;
            }
            return current.filter((p) => p.id !== id);
        });

        setSuggestions((current) => {
            const next = { ...current };
            delete next[id];
            return next;
        });

        setSelecting((current) => (current === id ? null : current));
        setGeocodingTarget((current) => (current === id ? null : current));
    };

    const handlePointChange = (id: number, text: string) => {
        setPoints((current) =>
            current.map((p) =>
                p.id === id ? { ...p, text, point: null } : p,
            ),
        );

        setSuggestions((current) => ({ ...current, [id]: [] }));

        setGeocodingTarget(text.trim() === "" ? null : id);
    };

    const selectSuggestion = (id: number, suggestion: GeocodingResult) => {
        setPoints((current) =>
            current.map((p) =>
                p.id === id
                    ? { ...p, text: suggestion.name, point: suggestion.point }
                    : p,
            ),
        );

        setSuggestions((current) => {
            const next = { ...current };
            delete next[id];
            return next;
        });

        setGeocodingTarget(null);
    };

    const updatePointCoordinates = (id: number, point: Point) => {
        setGeocodingTarget(null);

        setPoints((current) =>
            current.map((p) =>
                p.id === id ? { ...p, point, text: formatPoint(point) } : p,
            ),
        );
    };

    // API-запрос /geocode (только для ручного ввода текста)
    useEffect(() => {
        if (geocodingTarget == null) {
            return;
        }

        const targetId = geocodingTarget;
        const text = points.find((p) => p.id === targetId)?.text ?? "";

        if (text.trim() === "") {
            return;
        }

        const controller = new AbortController();

        const timeout = setTimeout(async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/geocode`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: text }),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`HTTP error: ${response.status}`);
                }

                const data = (await response.json()) as GeocodingResult[];

                setSuggestions((current) => ({ ...current, [targetId]: data }));
            } catch (error) {
                if (error instanceof DOMException && error.name === "AbortError") {
                    return;
                }

                console.error("Geocoding error:", error);
            }
        }, GEOCODE_DEBOUNCE_MS);

        return () => {
            clearTimeout(timeout);
            controller.abort();
        };
    }, [geocodingTarget, points]);

    // Инициализация карты
    useEffect(() => {
        if (!mapContainerRef.current) {
            return;
        }

        const map = L.map(mapContainerRef.current, {
            zoomControl: false,
        }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

        mapRef.current = map;

        L.control.zoom({ position: "bottomright" }).addTo(map);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Выбор точки кликом на карте
    useEffect(() => {
        if (!mapRef.current) {
            return;
        }

        const map = mapRef.current;

        const handleMapClick = (event: L.LeafletMouseEvent) => {
            if (selecting == null) {
                return;
            }

            const lat = event.latlng.lat;
            const lng = ((event.latlng.lng + 180) % 360 + 360) % 360 - 180;

            updatePointCoordinates(selecting, [lat, lng]);
            setSelecting(null);
        };

        map.on("click", handleMapClick);

        return () => {
            map.off("click", handleMapClick);
        };
    }, [selecting]);

    // API-запрос /route: отправка координат -> получение геометрии, времени и расстояния.
    // Отменяет предыдущий незавершённый запрос, если точки меняются быстрее ответа сервера.
    useEffect(() => {
        const controller = new AbortController();

        async function getRoute() {
            const resolvedPoints = points
                .map((p) => p.point)
                .filter((point): point is Point => point != null);

            const hasUnresolvedPoint = points.some(
                (p) => p.text.trim() !== "" && p.point == null,
            );

            if (resolvedPoints.length < 2 || hasUnresolvedPoint) {
                setRoute(null);
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/route`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ points: resolvedPoints }),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`HTTP error: ${response.status}`);
                }

                const data = (await response.json()) as RouteResponse;

                setRoute(data.geometry);
            } catch (error) {
                if (error instanceof DOMException && error.name === "AbortError") {
                    return;
                }

                console.error("Route error:", error);
                setRoute(null);
            }
        }

        getRoute();

        return () => {
            controller.abort();
        };
    }, [points]);

    // Отрисовка маршрута по координатам точек
    useEffect(() => {
        if (!mapRef.current) {
            return;
        }

        if (routeLineRef.current) {
            routeLineRef.current.remove();
            routeLineRef.current = null;
        }

        if (!route) {
            return;
        }

        const path: Point[] = route.coordinates.map(([lng, lat]) => [lat, lng]);

        routeLineRef.current = L.polyline(path).addTo(mapRef.current);
    }, [route]);

    // Маркеры точек
    useEffect(() => {
        if (!mapRef.current) {
            return;
        }

        const map = mapRef.current;

        const activeIds = new Set(points.filter((p) => p.point).map((p) => p.id));

        for (const [id, marker] of markerRefs.current) {
            if (!activeIds.has(id)) {
                marker.remove();
                markerRefs.current.delete(id);
            }
        }

        points.forEach((p, index) => {
            if (!p.point) {
                return;
            }

            const existingMarker = markerRefs.current.get(p.id);

            if (existingMarker) {
                existingMarker.setLatLng(p.point);
                existingMarker.setIcon(createPointIcon(index + 1));
                return;
            }

            const marker = L.marker(p.point, {
                draggable: true,
                icon: createPointIcon(index + 1),
            }).addTo(map);

            marker.on("dragend", () => {
                const position = marker.getLatLng();
                updatePointCoordinates(p.id, [position.lat, position.lng]);
            });

            markerRefs.current.set(p.id, marker);
        });
    }, [points]);

    return (
        <>
            <div ref={mapContainerRef} className="h-screen w-full" />

            <RoutePanel
                points={points}
                selecting={selecting}
                suggestions={suggestions}
                onSelectMode={setSelecting}
                onPointChange={handlePointChange}
                onSelectSuggestion={selectSuggestion}
                onBuildRoute={buildRoute}
                onAddPoint={addPoint}
                onRemovePoint={removePoint}
            />
        </>
    );
}