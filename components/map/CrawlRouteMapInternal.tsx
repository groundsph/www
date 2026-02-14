"use client"

import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet"
import { DivIcon } from "leaflet"
import "leaflet/dist/leaflet.css"
import "@/app/map.css"
import { buildCrawlMarkerHtml } from "@/utils/map/crawl-marker"

interface CrawlRouteMapProps {
    points: { lat: number; lng: number; imageUrl?: string | null; label?: string }[]
    focusPoint?: { lat: number; lng: number } | null
}

const markerIcon = (point: CrawlRouteMapProps["points"][number]) =>
    new DivIcon({
        html: buildCrawlMarkerHtml({ imageUrl: point.imageUrl ?? null, label: point.label }),
        iconSize: [40, 40],
        iconAnchor: [20, 40],
    })

export default function CrawlRouteMap({ points, focusPoint }: CrawlRouteMapProps) {
    const defaultCenter: [number, number] = focusPoint
        ? [focusPoint.lat, focusPoint.lng]
        : [12.8797, 121.774]

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
                url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
            />
            {points.map((p, idx) => (
                <Marker
                    key={`${p.lat}-${p.lng}-${idx}`}
                    position={[p.lat, p.lng]}
                    icon={markerIcon(p)}
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
