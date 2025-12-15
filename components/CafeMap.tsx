"use client"

import { Cafe } from "@/utils/types/cafe"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import { Icon, DivIcon } from "leaflet"
import "leaflet/dist/leaflet.css"
import Link from "next/link"
import { useMemo, useState, useEffect } from "react"
import Image from "next/image"
import { StarIcon } from "lucide-react"

interface CafeMapProps {
    cafes: Cafe[]
}

// Component to handle location updates
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

export default function CafeMap({ cafes }: CafeMapProps) {
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

    return (
        <MapContainer
            center={defaultCenter}
            zoom={16}
            scrollWheelZoom={true}
            className='h-full w-full z-10'
            style={{ minHeight: "500px" }}
        >
            {/* Carto Positron - clean, minimal map style */}
            <TileLayer
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                url='https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
            />
            <LocationMarker />
            {cafes.map((cafe) => (
                <Marker
                    key={cafe.id}
                    position={[cafe.lat, cafe.lng]}
                    icon={customIcon}
                >
                    <Popup>
                        <div className='flex flex-col gap-2'>
                            <Link
                                href={`/cafes/${cafe.slug}`}
                                className='font-serif font-semibold text-text hover:underline text-lg'
                            >
                                {cafe.name}
                            </Link>
                            <div className='relative w-full h-auto aspect-video overflow-clip rounded-lg'>
                                <Image
                                    src={cafe.thumbnail}
                                    alt={cafe.name}
                                    fill
                                    className='object-cover'
                                />
                            </div>
                            <div className='flex flex-row gap-2 items-center'>
                                <div className='flex flex-row gap-2 items-center text-base font-semibold opacity-80'>
                                    <StarIcon className='w-4 h-4 fill-primary' />
                                    {cafe.rating}/10
                                </div>
                                <span className='text-text/60 opacity-80'>
                                    {cafe.reviews} reviews
                                </span>
                            </div>
                            <p className='text-text/60'>
                                {cafe.address_display}
                            </p>
                        </div>
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    )
}
