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

    const [points, setPoints] = useState<[number, number][]>([]);
    const [route, setRoute] = useState<[number, number][]>([]);

    const mapContainerRef = useRef<HTMLDivElement | null>(null);

    const mapRef = useRef<L.Map | null>(null);

    useEffect(() => {
        if (!mapContainerRef.current) {
            return;
        }

        const map = L.map(mapContainerRef.current).setView(
            [55.7558, 37.6176],
            10,
        );

        mapRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);

        map.on("click", (event) => {
            const lat = event.latlng.lat;
            const lng = ((event.latlng.lng + 180) % 360 + 360) % 360 - 180;
            console.log(lat, lng);

            setPoints((current) => {
                if (current.length >= 2) {
                    return current;
                } 
                return [...current, [lat, lng]]
            });
        });

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    useEffect(() => {
       async function getRoute() {
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
            console.log(data);

            const coordinates = data.geometry.coordinates.map(
                ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
            );

            setRoute(coordinates);
        }

        getRoute();
    }, [points]);

    useEffect(() => {
        if (!mapRef.current || route.length === 0) {
            return;
        }

        const line = L.polyline(route).addTo(mapRef.current);

        return () => {
            line.remove();
        };
    }, [route]);

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