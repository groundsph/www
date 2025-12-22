"use client"

import { CafeWithRatings } from "@/utils/types/extra"
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap,
    useMapEvents,
} from "react-leaflet"
import { Icon, DivIcon } from "leaflet"
import "leaflet/dist/leaflet.css"
import Link from "next/link"
import { useMemo, useState, useEffect, useCallback } from "react"
import { StarIcon } from "lucide-react"
import MarkerClusterGroup from "react-leaflet-cluster"

interface CafeMapProps {
    cafes: CafeWithRatings[]
    onBoundsChange?: (bounds: {
        swLat: number
        swLng: number
        neLat: number
        neLng: number
    }) => void
}

// Component to handle location updates and center on user
function LocationMarker() {
    const [position, setPosition] = useState<[number, number] | null>(null)
    const map = useMap()

    // Blue dot icon for user location
    const userIcon = useMemo(
        () =>
            new DivIcon({
                className: "user-location-marker",
                html: `<div style="
            width: 16px;
            height: 16px;
            background: #4285F4;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
            }),
        []
    )

    useEffect(() => {
        map.locate({ setView: true, maxZoom: 14 })

        map.on("locationfound", (e) => {
            setPosition([e.latlng.lat, e.latlng.lng])
        })

        map.on("locationerror", () => {
            // Silently fall back to default center if location denied
            console.log("Location access denied, using default center")
        })
    }, [map])

    return position ? (
        <Marker
            position={position}
            icon={userIcon}
        >
            <Popup>You are here</Popup>
        </Marker>
    ) : null
}

// Component to handle map bounds changes for lazy loading
function BoundsHandler({
    onBoundsChange,
}: {
    onBoundsChange?: CafeMapProps["onBoundsChange"]
}) {
    const map = useMapEvents({
        moveend: () => {
            if (onBoundsChange) {
                const bounds = map.getBounds()
                onBoundsChange({
                    swLat: bounds.getSouthWest().lat,
                    swLng: bounds.getSouthWest().lng,
                    neLat: bounds.getNorthEast().lat,
                    neLng: bounds.getNorthEast().lng,
                })
            }
        },
    })
    return null
}

export default function CafeMap({ cafes, onBoundsChange }: CafeMapProps) {
    // Custom marker icon
    const customIcon = useMemo(
        () =>
            new Icon({
                iconUrl: "/marker-icon.png",
                iconRetinaUrl: "/marker-icon-2x.png",
                shadowUrl: "/marker-shadow.png",
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41],
            }),
        []
    )

    // Default center (Cebu City)
    const defaultCenter: [number, number] = [10.3157, 123.8854]

    // Force re-render on mount to avoid map initialization issues
    const [mapKey, setMapKey] = useState("map-init")

    useEffect(() => {
        setMapKey(`map-${Date.now()}`)
    }, [])

    return (
        <MapContainer
            key={mapKey}
            center={defaultCenter}
            zoom={12}
            scrollWheelZoom={true}
            className='h-full w-full z-10'
            style={{ minHeight: "500px" }}
        >
            <TileLayer
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                url='https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
            />
            <LocationMarker />
            <BoundsHandler onBoundsChange={onBoundsChange} />
            <MarkerClusterGroup
                chunkedLoading
                maxClusterRadius={60}
            >
                {cafes
                    .filter(
                        (
                            c
                        ): c is CafeWithRatings & {
                            lat: number
                            lng: number
                            slug: string
                            name: string
                        } =>
                            c.lat != null &&
                            c.lng != null &&
                            c.slug != null &&
                            c.name != null
                    )
                    .map((cafe) => (
                        <Marker
                            key={cafe.id}
                            position={[cafe.lat, cafe.lng]}
                            icon={customIcon}
                        >
                            <Popup className='cafe-popup'>
                                <div className='w-64 flex flex-col gap-3'>
                                    {/* Image with overlay */}
                                    <div className='relative w-full h-32 overflow-clip rounded-xl bg-secondary/20'>
                                        {cafe.thumbnail && (
                                            <img
                                                src={cafe.thumbnail}
                                                alt={cafe.name}
                                                className='object-cover w-full h-full'
                                            />
                                        )}
                                        {/* Rating badge */}
                                        <div className='absolute top-2 right-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm'>
                                            <StarIcon className='w-3.5 h-3.5 fill-primary text-primary' />
                                            <span className='text-sm font-semibold text-text'>
                                                {cafe.average_rating?.toFixed(
                                                    1
                                                ) || "N/A"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className='flex flex-col gap-1'>
                                        <h3 className='font-serif font-bold text-text text-lg leading-tight'>
                                            {cafe.name}
                                        </h3>
                                        <p className='text-text/60 text-sm line-clamp-1'>
                                            {cafe.address_display}
                                        </p>
                                    </div>

                                    {/* Footer */}
                                    <div className='flex items-center justify-between'>
                                        <span className='text-text/50 text-xs'>
                                            {cafe.total_reviews || 0} reviews
                                        </span>
                                        <Link
                                            href={`/cafes/${cafe.slug}`}
                                            className='flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors'
                                        >
                                            View Details
                                            <svg
                                                className='w-4 h-4'
                                                fill='none'
                                                stroke='currentColor'
                                                viewBox='0 0 24 24'
                                            >
                                                <path
                                                    strokeLinecap='round'
                                                    strokeLinejoin='round'
                                                    strokeWidth={2}
                                                    d='M9 5l7 7-7 7'
                                                />
                                            </svg>
                                        </Link>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
            </MarkerClusterGroup>
        </MapContainer>
    )
}
