"use client";

import {useEffect, useRef, useState } from "react";
import L from "leaflet";
import RoutePanel from "./RoutePanel";
type Point = [number, number];

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
    const [departure, setDeparture] = useState<Point | null>(null);
    const [arrival, setArrival] = useState<Point | null>(null);
    const [selecting, setSelecting] = useState<
        "departure" | "arrival" | "build-route" | null
    >(null);
    const [route, setRoute] = useState<{
        type: string;
        coordinates: [number, number][];
    } | null>(null);

    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);

    const routeLineRef = useRef<L.Polyline | null>(null);
    const departureMarkerRef = useRef<L.Marker | null>(null);
    const arrivalMarkerRef = useRef<L.Marker | null>(null);

    useEffect(() => {
        if (!mapContainerRef.current) {
            return;
        }

        const map = L.map(mapContainerRef.current, {
            zoomControl: false,
        }).setView(
            [55.7558, 37.6176],
            10,
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

    useEffect(() => {
        if (!mapRef.current) {
            return;
        }

        const map = mapRef.current;

        const handleMapClick = (event: L.LeafletMouseEvent) => {
            if (selecting === null) {
                return;
            }

            const lat = event.latlng.lat;
            const lng = ((event.latlng.lng + 180) % 360 + 360) % 360 - 180;
        
            const point: Point = [lat, lng];

            if (selecting === "departure") {
                setDeparture(point);
            }
            else if (selecting === "arrival") {
                setArrival(point);
            }

            setSelecting(null);
        };

        map.on("click", handleMapClick);

        return () => {
            map.off("click", handleMapClick);
        };

    }, [selecting]);

    useEffect(() => {
        async function getRoute() {
            try {
                if (!departure || !arrival) {
                    return;
                }

                const response = await fetch(
                    "http://127.0.0.1:3001/route", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            points: [
                                `${departure[0]}, ${departure[1]}`,
                                `${arrival[0]}, ${arrival[1]}`,
                            ],
                        }),
                    },
                );
                

                if (!response.ok) {
                    throw new Error(
                        `HTTP error: ${response.status}`
                    )
                }

                const data = await response.json();
                console.log(data);

                const coordinates: Point[] = data.geometry.coordinates.map(
                    ([lng, lat]: [number, number]) => [lat, lng] as Point
                );

                if (routeLineRef.current) {
                    routeLineRef.current.remove();
                    routeLineRef.current = null;
                }

                if (mapRef.current) {
                    routeLineRef.current = L.polyline(
                        coordinates,
                    ).addTo(mapRef.current);
                }
            } catch (error) {
                console.error("Route error:", error);
                
                if (routeLineRef.current) {
                    routeLineRef.current.remove();
                    routeLineRef.current = null;
                }
            }
        }

        getRoute();
    }, [departure, arrival]);

    useEffect(() => {
        if (!mapRef.current || !route) {
            return;
        }

        if (routeLineRef.current) {
            routeLineRef.current.remove();
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

        if (departure) {
            if (!departureMarkerRef.current) {
                departureMarkerRef.current = L.marker(departure, {
                    draggable: true,
                    icon: createPointIcon(1),
                }).addTo(map);

                departureMarkerRef.current.on("dragend", () => {
                    const marker = departureMarkerRef.current;

                    if (!marker) {
                        return;
                    }

                    const position = marker.getLatLng();

                    setDeparture([position.lat, position.lng]);
                });
            }
            else {
                departureMarkerRef.current.setLatLng(departure);   
            }
        }
        else if (departureMarkerRef.current) {
            departureMarkerRef.current.remove();
            departureMarkerRef.current = null;
        }

        if (arrival) {
            if (!arrivalMarkerRef.current) {
                arrivalMarkerRef.current = L.marker(arrival, {
                    draggable: true,
                    icon: createPointIcon(2),
                }).addTo(map);

                arrivalMarkerRef.current.on("dragend", () => {
                    const marker = arrivalMarkerRef.current;

                    if (!marker) {
                        return;
                    }

                    const position = marker.getLatLng();

                    setArrival([position.lat, position.lng]);
                });
            }
            else {
                arrivalMarkerRef.current.setLatLng(arrival);
            }
        }
        else if (arrivalMarkerRef.current) {
            arrivalMarkerRef.current.remove();
            arrivalMarkerRef.current = null;
        }

    }, [departure, arrival]);

    return (
        <>
        <div
            ref={mapContainerRef}
            className="h-screen w-full"
        />
    
        <RoutePanel
            departure={departure}
            arrival={arrival}
            selecting={selecting}
            onSelectMode={setSelecting}
            onDepartureChange={setDeparture}
            onArrivalChange={setArrival}
            onRouteChange={setRoute}
        />
        </>);
}