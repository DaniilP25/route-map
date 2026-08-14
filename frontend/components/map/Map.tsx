"use client";

import {useEffect, useRef, useState } from "react";
import L from "leaflet";
import RoutePanel from "./RoutePanel";
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

interface RouteGeometry {
    type: string;
    coordinates: [number, number][];
}

function createPointIcon(number: number) {
    return L.divIcon({
        className: "",
        html: `
            <div class="relative flex flex-col items-center">
                <div class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-sm font-semibold text-white shadow-md">
                    ${number}
                </div>
                <div class="h-2 w-2 -mt-1 rotate-45 bg-gray-700></div>
            </div>
        `,
        iconSize: [32, 40],
        iconAnchor: [16, 36],
    });
}

export default function Map() {
    const [departure, setDeparture] = useState<RoutePoint>({
        text: "",
        point: null,
    });

    const [arrivals, setArrivals] = useState<ArrivalInput[]>([
        {
            id: 1,
            text: "",
            point: null,
        },
    ]);

    const [selecting, setSelecting] = useState<Selecting>(null);
    const [route, setRoute] = useState<RouteGeometry | null>(null);

    const buildRoute = () => {

    };

    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);

    const routeLineRef = useRef<L.Polyline | null>(null);
    const departureMarkerRef = useRef<L.Marker | null>(null);
    const arrivalMarkerRefs = useRef<Map<number, L.Marker>>(new globalThis.Map());

    // Инициализация карты
    useEffect(() => {
        if (!mapContainerRef.current) {
            return;
        }

        const map = L.map(mapContainerRef.current, {
            zoomControl: false,
        }).setView(
            [54.99, 73.36],
            13,
        );

        mapRef.current = map;

        L.control.zoom({
            position: "bottomright"
        }).addTo(map);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
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
        
            const point: Point = [lat, lng];

            if (selecting.type === "departure") {
                setDeparture({
                    text: `${point[0]}, ${point[1]}`,
                    point,
                });
            }
            else if (selecting.type === "arrival") {
                setArrivals((current) =>
                    current.map((arrival) =>
                        arrival.id === selecting.id
                        ? {
                            ...arrival,
                            point,
                            text: `${point[0]}, ${point[1]}`
                        }
                        : arrival
                    )
                );
            }

            setSelecting(null);
        };

        map.on("click", handleMapClick);

        return () => {
            map.off("click", handleMapClick);
        };

    }, [selecting]);

    // API-запрос: отправка точек (координат/мест) -> получение координат точек маршрута, времени и расстояния
    useEffect(() => {
        async function getRoute() {
            try {
                if (arrivals.length === 0) {
                    return;
                }

                const points: string[] = [
                    departure.point
                        ? `${departure.point[0]}, ${departure.point[1]}`
                        : departure.text,
                    
                    ...arrivals
                        .map((arrival) =>
                            arrival.point
                            ? `${arrival.point[0]}, ${arrival.point[1]}`
                            : arrival.text
                        )
                        .filter((point) => point.trim() !== ""),
                ];

                if (!departure.point && departure.text.trim() === "") {
                    setRoute(null);
                    return;
                }

                if (points.length < 2) {
                    setRoute(null);
                    return;
                }

                const response = await fetch(
                    "http://127.0.0.1:3001/route", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            points: points,
                        }),
                    },
                );
                

                if (!response.ok) {
                    throw new Error(
                        `HTTP error: ${response.status}`
                    )
                }

                const data = await response.json();

                setRoute(data.geometry);
            } catch (error) {
                console.error("Route error:", error);
                setRoute(null);
                
                if (routeLineRef.current) {
                    routeLineRef.current.remove();
                    routeLineRef.current = null;
                }
            }
        }

        getRoute();
    }, [departure, arrivals]);

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

        const coordinates: Point[] = route.coordinates.map(
            ([lng, lat]) => [lat, lng]
        );

        routeLineRef.current = L.polyline(
            coordinates
        ).addTo(mapRef.current);
    }, [route]);

    useEffect(() => {
        if (!mapRef.current) {
            return;
        }

        const map = mapRef.current;

        if (departure.point) {
            if (!departureMarkerRef.current) {
                const marker = L.marker(departure.point, {
                    draggable: true,
                    icon: createPointIcon(1),
                }).addTo(map);

                marker.on("dragend", () => {
                    const position = marker.getLatLng();

                    setDeparture({
                        text: `${position.lat}, ${position.lng}`,
                        point: [
                            position.lat,
                            position.lng,
                        ],
                    });
                });
                departureMarkerRef.current = marker;
            }
            else {
                departureMarkerRef.current.setLatLng(departure.point);   
            }
        }
        else if (departureMarkerRef.current) {
            departureMarkerRef.current.remove();
            departureMarkerRef.current = null;
        }

        const activeIds = new Set(
            arrivals
                .filter((arrival) => arrival.point)
                .map((arrival) => arrival.id)
        );

        for (const [id, marker] of arrivalMarkerRefs.current) {
            if (!activeIds.has(id)) {
                marker.remove();
                arrivalMarkerRefs.current.delete(id);
            }
        }

        arrivals.forEach((arrival) => {
            if (!arrival.point) {
                return;
            }

            const existingMarker = arrivalMarkerRefs.current.get(
                arrival.id
            );

            if (existingMarker) {
                existingMarker.setLatLng(arrival.point);
                return;
            }

            const marker = L.marker(arrival.point, {
                draggable: true,
                icon: createPointIcon(arrival.id + 1),
            }).addTo(map);

            marker.on("dragend", () => {
                const position = marker.getLatLng();

                setArrivals((current) =>
                    current.map((item) =>
                        item.id === arrival.id
                            ? {
                                ...item,
                                point: [
                                    position.lat,
                                    position.lng,
                                ],
                                text: `${position.lat}, ${position.lng}`,
                            }
                            : item
                    )
                );
            });

            arrivalMarkerRefs.current.set(
                arrival.id,
                marker
            );
        });
    }, [departure, arrivals]);

    return (
        <>
        <div
            ref={mapContainerRef}
            className="h-screen w-full"
        />
    
        <RoutePanel
            departure={departure}
            arrivals={arrivals}
            selecting={selecting}
            onSelectMode={setSelecting}
            onDepartureChange={setDeparture}
            onArrivalChange={setArrivals}
            onBuildRoute={buildRoute}
        />
        </>);
}