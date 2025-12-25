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
import { DivIcon, point } from "leaflet"
import "leaflet/dist/leaflet.css"
import "@/app/map.css"
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
    // Custom marker icon matching site theme
    const createCafeIcon = useCallback(
        () =>
            new DivIcon({
                className: "cafe-marker",
                html: `<div style="
                    width: 36px;
                    height: 36px;
                    background: linear-gradient(135deg, #74512d 0%, #543310 100%);
                    border: 3px solid #f8f4e1;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    box-shadow: 0 4px 12px rgba(84, 51, 16, 0.35), 0 2px 4px rgba(84, 51, 16, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <svg style="transform: rotate(45deg); width: 18px; height: 18px;" viewBox="0 0 24 24" fill="none" stroke="#f8f4e1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
                        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
                        <line x1="6" y1="2" x2="6" y2="4"/>
                        <line x1="10" y1="2" x2="10" y2="4"/>
                        <line x1="14" y1="2" x2="14" y2="4"/>
                    </svg>
                </div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 36],
                popupAnchor: [0, -36],
            }),
        []
    )

    const customIcon = useMemo(() => createCafeIcon(), [createCafeIcon])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cluster type from external react-leaflet-cluster library
    const createClusterCustomIcon = function (cluster: any) {
        const count = cluster.getChildCount()
        const size = count > 10 ? 48 : count > 5 ? 42 : 36
        return new DivIcon({
            html: `<div style="
                width: ${size}px;
                height: ${size}px;
                background: linear-gradient(135deg, #74512d 0%, #543310 100%);
                border: 3px solid #f8f4e1;
                border-radius: 50%;
                box-shadow: 0 4px 12px rgba(84, 51, 16, 0.35), 0 2px 4px rgba(84, 51, 16, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: serif;
                font-weight: bold;
                font-size: ${count > 10 ? "14px" : "13px"};
                color: #f8f4e1;
            ">
                ${count}
            </div>`,
            className: "marker-cluster-custom",
            iconSize: point(size, size, true),
        })
    }

    // Default center (Cebu City)
    const defaultCenter: [number, number] = [10.3157, 123.8854]

    // Force re-render on mount to avoid map initialization issues
    const [mapKey, setMapKey] = useState("map-init")

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: Force re-render on mount to avoid map initialization issues
        setMapKey(`map-${Date.now()}`)
    }, [])

    return (
        <MapContainer
            key={mapKey}
            center={defaultCenter}
            zoom={12}
            scrollWheelZoom={true}
            dragging={true}
            touchZoom={true}
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
                iconCreateFunction={createClusterCustomIcon}
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
                                <div className='w-72 max-w-[70svw] flex flex-col rounded-xl overflow-hidden shadow-lg border border-secondary/20 bg-background'>
                                    {/* Image with gradient overlay */}
                                    <div className='relative w-full h-36 overflow-clip rounded-t-xl bg-linear-to-br from-secondary/30 to-secondary/10'>
                                        {cafe.thumbnail && (
                                            /* eslint-disable-next-line @next/next/no-img-element -- Leaflet popups don't support next/image */
                                            <img
                                                src={cafe.thumbnail}
                                                alt={cafe.name}
                                                className='object-cover w-full h-full'
                                            />
                                        )}
                                        {/* Gradient overlay for text readability */}
                                        <div className='absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent' />

                                        {/* Rating pill */}
                                        <div className='absolute top-3 left-3 bg-primary px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg'>
                                            <StarIcon className='w-3.5 h-3.5 fill-background text-background' />
                                            <span className='text-xs font-bold text-background'>
                                                {cafe.average_rating?.toFixed(
                                                    1
                                                ) || "N/A"}
                                            </span>
                                        </div>

                                        {/* Cafe name overlaid on image */}
                                        <div className='absolute bottom-0 left-0 right-0 p-3'>
                                            <h3 className='font-serif font-bold text-white text-lg leading-tight drop-shadow-lg'>
                                                {cafe.name}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* Content section */}
                                    <div className='p-4 flex flex-col gap-3 bg-linear-to-b from-background to-tertiary/50 rounded-b-xl'>
                                        {/* Address with icon */}
                                        <div className='flex items-start gap-2'>
                                            <svg
                                                className='w-4 h-4 text-secondary mt-0.5 shrink-0'
                                                fill='none'
                                                stroke='currentColor'
                                                viewBox='0 0 24 24'
                                            >
                                                <path
                                                    strokeLinecap='round'
                                                    strokeLinejoin='round'
                                                    strokeWidth={2}
                                                    d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'
                                                />
                                                <path
                                                    strokeLinecap='round'
                                                    strokeLinejoin='round'
                                                    strokeWidth={2}
                                                    d='M15 11a3 3 0 11-6 0 3 3 0 016 0z'
                                                />
                                            </svg>
                                            <p className='text-text/70 text-sm leading-snug line-clamp-2'>
                                                {cafe.address_display}
                                            </p>
                                        </div>

                                        {/* Divider */}
                                        <div className='w-full h-px bg-linear-to-r from-transparent via-secondary/30 to-transparent' />

                                        {/* Footer */}
                                        <div className='flex items-center justify-between'>
                                            <div className='flex items-center gap-1.5'>
                                                <svg
                                                    className='w-4 h-4 text-secondary'
                                                    fill='none'
                                                    stroke='currentColor'
                                                    viewBox='0 0 24 24'
                                                >
                                                    <path
                                                        strokeLinecap='round'
                                                        strokeLinejoin='round'
                                                        strokeWidth={2}
                                                        d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
                                                    />
                                                </svg>
                                                <span className='text-text/60 text-xs font-medium'>
                                                    {cafe.total_reviews || 0}{" "}
                                                    reviews
                                                </span>
                                            </div>
                                            <Link
                                                href={`/cafes/${cafe.slug}`}
                                                className='group flex items-center gap-1.5 px-3 py-1.5 border border-primary/20 text-xs font-semibold rounded-full transition-all hover:gap-2 shadow-sm text-text!'
                                            >
                                                Explore
                                                <svg
                                                    className='w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5'
                                                    fill='none'
                                                    stroke='currentColor'
                                                    viewBox='0 0 24 24'
                                                >
                                                    <path
                                                        strokeLinecap='round'
                                                        strokeLinejoin='round'
                                                        strokeWidth={2.5}
                                                        d='M9 5l7 7-7 7'
                                                    />
                                                </svg>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
            </MarkerClusterGroup>
        </MapContainer>
    )
}
