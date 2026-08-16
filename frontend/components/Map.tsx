"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import RoutePanel from "./RoutePanel";
import OptimizeResultsPanel from "./OptimizeResultsPanel";
import { ROUTE_VIEWS, ROUTE_VIEW_META, getRouteResult } from "./algorithms";
import {
    type Point,
    type RoutePointInput,
    type GeocodingResult,
    type RouteGeometry,
    type RouteResponse,
    type OptimizeResponse,
    type RouteViewKey,
    type Selecting,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

const DEFAULT_CENTER: Point = [54.99, 73.36];
const DEFAULT_ZOOM = 13;
const GEOCODE_DEBOUNCE_MS = 500;

const ALL_VIEW_KEYS = ROUTE_VIEWS.map((meta) => meta.key);
const VIEW_KEY_SET = new Set<string>(ALL_VIEW_KEYS);

function emptyVisibility(): Record<RouteViewKey, boolean> {
    return Object.fromEntries(
        ALL_VIEW_KEYS.map((key) => [key, false]),
    ) as Record<RouteViewKey, boolean>;
}

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

function reorderPointsForView(
    points: RoutePointInput[],
    result: OptimizeResponse | null,
    view: RouteViewKey,
): RoutePointInput[] {
    if (!result) {
        return points;
    }

    const resolved = points.filter((p) => p.point != null);
    const unresolved = points.filter((p) => p.point == null);

    const viewResult = getRouteResult(result, view);

    if (!viewResult) {
        return points;
    }

    const ordered = viewResult.order
        .map((index) => resolved[index])
        .filter((p): p is RoutePointInput => p != null);

    if (ordered.length !== resolved.length) {
        return points;
    }

    return [...ordered, ...unresolved];
}

export default function RouteMap() {
    const [points, setPoints] = useState<RoutePointInput[]>([
        createEmptyPoint(1),
        createEmptyPoint(2),
    ]);

    const [selecting, setSelecting] = useState<Selecting>(null);

    const [route, setRoute] = useState<RouteGeometry | null>(null);

    const [optimizeResult, setOptimizeResult] = useState<OptimizeResponse | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);

    const [routeGeoms, setRouteGeoms] = useState<Partial<Record<RouteViewKey, RouteGeometry>>>({});
    const [routeDurations, setRouteDurations] = useState<Partial<Record<RouteViewKey, number>>>({});

    const [visibility, setVisibility] = useState<Record<RouteViewKey, boolean>>(emptyVisibility());

    const [activeView, setActiveView] = useState<RouteViewKey>("original");

    const [suggestions, setSuggestions] = useState<Record<number, GeocodingResult[]>>({});
    const [geocodingTarget, setGeocodingTarget] = useState<number | null>(null);

    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);

    const previewLineRef = useRef<L.Polyline | null>(null);
    const viewLineRefs = useRef<Map<RouteViewKey, L.Polyline>>(new Map());
    const markerRefs = useRef<Map<number, L.Marker>>(new Map());

    const displayedPoints = useMemo(
        () => reorderPointsForView(points, optimizeResult, activeView),
        [points, optimizeResult, activeView],
    );

    const fetchRoute = async (
        orderedPoints: Point[],
    ): Promise<{ geometry: RouteGeometry; duration: number } | null> => {
        if (orderedPoints.length < 2) {
            return null;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/route`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ points: orderedPoints }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = (await response.json()) as RouteResponse;
            return { geometry: data.geometry, duration: data.duration };
        } catch (error) {
            console.error("Route geometry error:", error);
            return null;
        }
    };

    const resetOptimizeState = () => {
        setOptimizeResult(null);
        setRouteGeoms({});
        setRouteDurations({});
        setVisibility(emptyVisibility());
        setActiveView("original");
    };

    const toggleVisibility = (key: RouteViewKey) => {
        setVisibility((current) => ({ ...current, [key]: !current[key] }));
    };

    const selectActiveView = (key: RouteViewKey) => {
        setActiveView(key);
        setVisibility((current) => ({ ...current, [key]: true }));
    };

    const buildRoute = async () => {
        const resolvedPoints = points.filter(
            (p): p is RoutePointInput & { point: Point } => p.point != null,
        );

        if (resolvedPoints.length < 2) {
            return;
        }

        setIsOptimizing(true);

        try {
            const response = await fetch(`${API_BASE_URL}/optimize`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    points: resolvedPoints.map((p) => p.point),
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = (await response.json()) as OptimizeResponse;
            setOptimizeResult(data);

            const chosenView: RouteViewKey = VIEW_KEY_SET.has(data.chosen_algorithm)
                ? (data.chosen_algorithm as RouteViewKey)
                : "original";

            const nextVisibility = emptyVisibility();
            nextVisibility[chosenView] = true;
            setVisibility(nextVisibility);
            setActiveView(chosenView);

            const entries = ALL_VIEW_KEYS
                .map((key) => {
                    const viewResult = getRouteResult(data, key);
                    return viewResult ? ([key, viewResult.points] as const) : null;
                })
                .filter(
                    (entry): entry is readonly [RouteViewKey, Point[]] => entry != null,
                );

            const fetched = await Promise.all(
                entries.map(([key, pts]) => fetchRoute(pts).then((r) => [key, r] as const)),
            );

            const nextGeoms: Partial<Record<RouteViewKey, RouteGeometry>> = {};
            const nextDurations: Partial<Record<RouteViewKey, number>> = {};

            for (const [key, fetchedRoute] of fetched) {
                if (!fetchedRoute) {
                    continue;
                }
                nextGeoms[key] = fetchedRoute.geometry;
                nextDurations[key] = fetchedRoute.duration;
            }

            setRouteGeoms(nextGeoms);
            setRouteDurations(nextDurations);
        } catch (error) {
            console.error("Optimize error:", error);
            setOptimizeResult(null);
            setRouteGeoms({});
            setRouteDurations({});
        } finally {
            setIsOptimizing(false);
        }
    };

    const nextPointId = () =>
        points.length === 0 ? 1 : Math.max(...points.map((p) => p.id)) + 1;

    const addPoint = () => {
        setPoints((current) => [...current, createEmptyPoint(nextPointId())]);
        resetOptimizeState();
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
        resetOptimizeState();
    };

    const handlePointChange = (id: number, text: string) => {
        setPoints((current) =>
            current.map((p) =>
                p.id === id ? { ...p, text, point: null } : p,
            ),
        );

        setSuggestions((current) => ({ ...current, [id]: [] }));

        setGeocodingTarget(text.trim() === "" ? null : id);
        resetOptimizeState();
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
        resetOptimizeState();
    };

    const updatePointCoordinates = (id: number, point: Point) => {
        setGeocodingTarget(null);

        setPoints((current) =>
            current.map((p) =>
                p.id === id ? { ...p, point, text: formatPoint(point) } : p,
            ),
        );
        resetOptimizeState();
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
            attributionControl: false,
        }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

        const myAttrControl = L.control.attribution().addTo(map);
        myAttrControl.setPrefix('<a href="https://leafletjs.com/">Leaflet</a>');

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
    }, [selecting, updatePointCoordinates]);

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

    useEffect(() => {
        if (!mapRef.current) {
            return;
        }

        if (previewLineRef.current) {
            previewLineRef.current.remove();
            previewLineRef.current = null;
        }

        if (!route || optimizeResult) {
            return;
        }

        const path: Point[] = route.coordinates.map(([lng, lat]) => [lat, lng]);

        previewLineRef.current = L.polyline(path, {
            color: "#2563eb",
            weight: 4,
            opacity: 0.6,
        }).addTo(mapRef.current);
    }, [route, optimizeResult]);

    useEffect(() => {
        if (!mapRef.current) {
            return;
        }

        const map = mapRef.current;

        for (const key of ALL_VIEW_KEYS) {
            const geometry = routeGeoms[key];
            const shouldShow = Boolean(visibility[key]) && geometry != null;
            const existing = viewLineRefs.current.get(key);

            if (!shouldShow) {
                if (existing) {
                    existing.remove();
                    viewLineRefs.current.delete(key);
                }
                continue;
            }

            const path: Point[] = geometry!.coordinates.map(([lng, lat]) => [lat, lng]);
            const color = ROUTE_VIEW_META[key].color;

            if (existing) {
                existing.setLatLngs(path);
                existing.setStyle({ color });
            } else {
                viewLineRefs.current.set(
                    key,
                    L.polyline(path, {
                        color,
                        weight: 5,
                        opacity: 0.9,
                    }).addTo(map),
                );
            }
        }
    }, [routeGeoms, visibility]);

    useEffect(() => {
        if (!mapRef.current) {
            return;
        }

        const map = mapRef.current;

        const activeIds = new Set(
            displayedPoints.filter((p) => p.point).map((p) => p.id),
        );

        for (const [id, marker] of markerRefs.current) {
            if (!activeIds.has(id)) {
                marker.remove();
                markerRefs.current.delete(id);
            }
        }

        displayedPoints.forEach((p, index) => {
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
    }, [displayedPoints, updatePointCoordinates]);

    return (
        <>
            <div ref={mapContainerRef} className="h-screen w-full" />

            <RoutePanel
                points={displayedPoints}
                selecting={selecting}
                suggestions={suggestions}
                onSelectMode={setSelecting}
                onPointChange={handlePointChange}
                onSelectSuggestion={selectSuggestion}
                onBuildRoute={buildRoute}
                onAddPoint={addPoint}
                onRemovePoint={removePoint}
                activeView={activeView}
                activeViewLabel={optimizeResult ? ROUTE_VIEW_META[activeView].label : null}
                onResetOrder={() => selectActiveView("original")}
            />

            <OptimizeResultsPanel
                result={optimizeResult}
                isLoading={isOptimizing}
                visibility={visibility}
                onToggleVisibility={toggleVisibility}
                activeView={activeView}
                onSelectActiveView={selectActiveView}
                routeDurations={routeDurations}
            />
        </>
    );
}