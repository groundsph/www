"use client"

import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "@/app/map.css"

interface CrawlRouteMapProps {
    points: { lat: number; lng: number }[]
}

export default function CrawlRouteMap({ points }: CrawlRouteMapProps) {
    const defaultCenter: [number, number] = [12.8797, 121.774]

    return (
        <MapContainer
            center={defaultCenter}
            zoom={6}
            scrollWheelZoom
            className="h-full w-full"
            style={{ minHeight: "420px" }}
        >
            <TileLayer
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            {points.map((p, idx) => (
                <Marker
                    key={`${p.lat}-${p.lng}-${idx}`}
                    position={[p.lat, p.lng]}
                />
            ))}
            {points.length >= 2 && (
                <Polyline
                    positions={points.map((p) => [p.lat, p.lng])}
                    pathOptions={{ color: "#74512d", weight: 4, opacity: 0.8 }}
                />
            )}
        </MapContainer>
    )
}
