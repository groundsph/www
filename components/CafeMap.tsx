"use client"

import { Cafe } from "@/utils/types/cafe"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import { Icon, DivIcon } from "leaflet"
import "leaflet/dist/leaflet.css"
import Link from "next/link"
import { useMemo, useState, useEffect } from "react"

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
            zoom={14}
            scrollWheelZoom={true}
            className='h-full w-full'
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
                        <div className='flex flex-col gap-1'>
                            <Link
                                href={`/cafes/${cafe.slug}`}
                                className='font-serif font-semibold text-primary hover:underline'
                            >
                                {cafe.name}
                            </Link>
                            <p className='text-sm opacity-70'>
                                {cafe.address_display}
                            </p>
                        </div>
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    )
}
