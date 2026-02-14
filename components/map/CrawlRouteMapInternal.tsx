"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet"
import { DivIcon } from "leaflet"
import "leaflet/dist/leaflet.css"
import "@/app/map.css"
import { buildCrawlMarkerHtml } from "@/utils/map/crawl-marker"

function MapFocus({ focusPoint }: { focusPoint: { lat: number; lng: number } | null }) {
    const map = useMap()
    useEffect(() => {
        if (!focusPoint) return
        map.flyTo([focusPoint.lat, focusPoint.lng], Math.max(map.getZoom(), 13), { duration: 0.8 })
    }, [focusPoint, map])
    return null
}

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
    const [segments, setSegments] = useState<[number, number][][]>([])
    const [gapCount, setGapCount] = useState(0)

    // Default center: Philippines (used when no focus point is provided)
    const defaultCenter: [number, number] = focusPoint
        ? [focusPoint.lat, focusPoint.lng]
        : [12.8797, 121.774]

    useEffect(() => {
        let cancelled = false
        const run = async () => {
            if (points.length < 2) {
                setSegments([])
                setGapCount(0)
                return
            }
            const requests = points.slice(0, -1).map((p, idx) => ({
                start: p,
                end: points[idx + 1],
            }))

            const results = await Promise.all(
                requests.map(async ({ start, end }) => {
                    const res = await fetch("/api/routes/osrm", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ start, end, profile: "driving" }),
                    })
                    if (!res.ok) {
                        console.error(`[CrawlRouteMap] Failed to fetch route: ${res.status}`)
                        return null
                    }
                    const json = await res.json()
                    if (!json?.geometry?.coordinates) return null
                    // Transform GeoJSON [lng,lat] to Leaflet [lat,lng]
                    return json.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]])
                })
            )

            if (cancelled) return
            setGapCount(results.filter((r) => !r).length)
            setSegments(results.filter(Boolean) as [number, number][][])
        }

        run()
        return () => {
            cancelled = true
        }
    }, [points])

    return (
        <div className="relative h-full w-full">
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
                {segments.map((segment, idx) => (
                    <Polyline
                        key={`seg-${idx}`}
                        positions={segment}
                        pathOptions={{ color: "#74512d", weight: 4, opacity: 0.8 }}
                    />
                ))}
                <MapFocus focusPoint={focusPoint ?? null} />
            </MapContainer>
            {gapCount > 0 && (
                <div className="absolute top-3 right-3 bg-background/90 border border-secondary/30 text-xs text-text/70 px-3 py-2 rounded-lg shadow-sm">
                    {gapCount} route gap{gapCount > 1 ? "s" : ""} (no road path)
                </div>
            )}
        </div>
    )
}
