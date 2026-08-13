"use client";

import {useEffect, useRef, useState } from "react";
import L from "leaflet";
import RoutePanel from "./RoutePanel";
type Point = [number, number];

export default function Map() {
    const [departure, setDeparture] = useState<Point | null>(null);
    const [arrival, setArrival] = useState<Point | null>(null);
    const [selecting, setSelecting] = useState<
        "departure" | "arrival" | null
    >(null);

    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);

    const routeLineRef = useRef<L.Polyline | null>(null);

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
        if (!departure || !arrival) {
            return;
        }

        async function getRoute() {
            try {
                const response = await fetch(
                    "http://127.0.0.1:3001/route", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            points: [
                                departure,
                                arrival,
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
        />
        </>);
}