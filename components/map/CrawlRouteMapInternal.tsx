"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet"
import { DivIcon } from "leaflet"
import { useRouter } from "next/navigation"
import "leaflet/dist/leaflet.css"
import "@/app/map.css"
import { buildCrawlMarkerHtml } from "@/utils/map/crawl-marker"
import { getCrawlSegmentStyle } from "@/utils/map/crawl-route-style"
import { invalidateMapSize } from "@/utils/map/leaflet"
import { normalizeLatLng } from "@/utils/map/coords"
import { buildOsrmUrl } from "@/utils/map/osrm"

function MapFocus({ focusPoint }: { focusPoint: { lat: number; lng: number } | null }) {
    const map = useMap()

    useEffect(() => {
        const normalized = normalizeLatLng(focusPoint ?? null)
        if (!normalized) return
        if (!map) return

        const timer = setTimeout(() => {
            try {
                if (!map.getContainer()) return
                const currentZoom = map.getZoom()
                const targetZoom = Number.isFinite(currentZoom) ? Math.max(currentZoom, 13) : 13
                map.stop()
                map.setView([normalized.lat, normalized.lng], targetZoom, { animate: false })
            } catch {
                // Silently ignore
            }
        }, 100)

        return () => clearTimeout(timer)
    }, [focusPoint, map])

    return null
}

function MapResizeHandler() {
    const map = useMap()
    const observerRef = useRef<ResizeObserver | null>(null)

    useEffect(() => {
        invalidateMapSize(map)
        const container = map.getContainer()
        observerRef.current = new ResizeObserver(() => invalidateMapSize(map))
        observerRef.current.observe(container)

        const handle = () => invalidateMapSize(map)
        window.addEventListener("orientationchange", handle)

        return () => {
            observerRef.current?.disconnect()
            window.removeEventListener("orientationchange", handle)
        }
    }, [map])

    return null
}

function MapBounds({ points }: { points: { lat: number; lng: number }[] }) {
    const map = useMap()

    useEffect(() => {
        if (!map) return
        const validPoints = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        if (validPoints.length < 2) return

        const timer = setTimeout(() => {
            try {
                if (!map.getContainer()) return
                const bounds = validPoints.map((p) => [p.lat, p.lng]) as [number, number][]
                map.stop()
                map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14, animate: false })
            } catch {
                // Silently ignore bounds errors
            }
        }, 150)

        return () => clearTimeout(timer)
    }, [points, map])

    return null
}

interface CrawlRouteMapProps {
    points: { lat: number; lng: number; imageUrl?: string | null; label?: string; index?: number; cafeSlug?: string }[]
    focusPoint?: { lat: number; lng: number } | null
    showUserLocation?: boolean
}

const markerIcon = (point: CrawlRouteMapProps["points"][number], showTooltip: boolean) =>
    new DivIcon({
        className: "crawl-marker-icon",
        html: buildCrawlMarkerHtml({ 
            imageUrl: point.imageUrl ?? null, 
            label: point.label, 
            index: point.index,
            cafeSlug: point.cafeSlug,
            showTooltip 
        }),
        iconSize: [44, 44],
        iconAnchor: [22, 44],
    })

// Component to show user's current location on the map
function UserLocationMarker() {
    const [position, setPosition] = useState<[number, number] | null>(null)
    const map = useMap()

    useEffect(() => {
        map.locate({ setView: false, maxZoom: 14 })
        map.on("locationfound", (e) => setPosition([e.latlng.lat, e.latlng.lng]))
    }, [map])

    if (!position) return null
    return (
        <Marker
            position={position}
            icon={
                new DivIcon({
                    className: "user-location-marker",
                    html: `<div style="width: 14px; height: 14px; background: #4285F4; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7],
                })
            }
        />
    )
}

// Individual marker component with click/tap handling
function CrawlMarker({ 
    point, 
    index 
}: { 
    point: CrawlRouteMapProps["points"][number]
    index: number 
}) {
    const router = useRouter()
    const [showTooltip, setShowTooltip] = useState(false)
    const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const handleClick = () => {
        if (!point.cafeSlug) return
        
        // Check if it's a mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        )
        
        if (isMobile) {
            // On mobile: first tap shows tooltip, second tap opens cafe
            if (!showTooltip) {
                setShowTooltip(true)
                // Auto-hide tooltip after 3 seconds
                if (tooltipTimeoutRef.current) {
                    clearTimeout(tooltipTimeoutRef.current)
                }
                tooltipTimeoutRef.current = setTimeout(() => {
                    setShowTooltip(false)
                }, 3000)
            } else {
                // Second tap - navigate to cafe
                router.push(`/cafes/${point.cafeSlug}`)
            }
        } else {
            // On desktop: click opens cafe directly
            router.push(`/cafes/${point.cafeSlug}`)
        }
    }

    useEffect(() => {
        return () => {
            if (tooltipTimeoutRef.current) {
                clearTimeout(tooltipTimeoutRef.current)
            }
        }
    }, [])

    return (
        <Marker
            key={`${point.lat}-${point.lng}-${index}`}
            position={[point.lat, point.lng]}
            icon={markerIcon(point, showTooltip)}
            eventHandlers={{
                click: handleClick,
            }}
        />
    )
}

export default function CrawlRouteMap({ points, focusPoint, showUserLocation }: CrawlRouteMapProps) {
    const [segments, setSegments] = useState<[number, number][][]>([])
    const [gapCount, setGapCount] = useState(0)

    const normalizedPoints = useMemo(
        () =>
            points
                .map((point) => ({ point, coords: normalizeLatLng(point) }))
                .filter((entry): entry is { point: CrawlRouteMapProps["points"][number]; coords: { lat: number; lng: number } } =>
                    entry.coords !== null
                )
                .map(({ point, coords }) => ({ ...point, lat: coords.lat, lng: coords.lng })),
        [points]
    )

    const normalizedFocus = normalizeLatLng(focusPoint ?? null)
    const defaultCenter: [number, number] = normalizedFocus
        ? [normalizedFocus.lat, normalizedFocus.lng]
        : normalizedPoints[0]
          ? [normalizedPoints[0].lat, normalizedPoints[0].lng]
          : [12.8797, 121.774]

    useEffect(() => {
        let cancelled = false
        const run = async () => {
            if (normalizedPoints.length < 2) {
                setSegments([])
                setGapCount(0)
                return
            }
            const requests = normalizedPoints.slice(0, -1).map((p, idx) => ({
                start: p,
                end: normalizedPoints[idx + 1],
            }))

            const results = await Promise.all(
                requests.map(async ({ start, end }) => {
                    const url = buildOsrmUrl(start, end, "driving")
                    const res = await fetch(url)
                    if (!res.ok) {
                        console.error(`[CrawlRouteMap] Failed to fetch route: ${res.status}`)
                        return null
                    }
                    const data = await res.json()
                    if (!data?.routes?.[0]?.geometry?.coordinates) return null
                    // Transform GeoJSON [lng,lat] to Leaflet [lat,lng]
                    return data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]])
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
    }, [normalizedPoints])

    return (
        <div className="relative h-full w-full z-0">
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
                {normalizedPoints.map((p, idx) => (
                    <CrawlMarker
                        key={`${p.lat}-${p.lng}-${idx}`}
                        point={p}
                        index={idx}
                    />
                ))}
                {segments.map((segment, idx) => (
                    <Polyline
                        key={`seg-${idx}`}
                        positions={segment}
                        pathOptions={getCrawlSegmentStyle(idx)}
                    />
                ))}
                <MapFocus focusPoint={focusPoint ?? null} />
                <MapResizeHandler />
                <MapBounds points={normalizedPoints} />
                {showUserLocation && <UserLocationMarker />}
            </MapContainer>
            {gapCount > 0 && (
                <div className="absolute top-3 right-3 bg-background/90 border border-secondary/30 text-xs text-text/70 px-3 py-2 rounded-lg shadow-sm">
                    {gapCount} route gap{gapCount > 1 ? "s" : ""} (no road path)
                </div>
            )}
        </div>
    )
}
