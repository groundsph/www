"use client"

import { Cafe } from "@/utils/types/cafe"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import { Icon } from "leaflet"
import "leaflet/dist/leaflet.css"
import { useState, useEffect } from "react"

interface CafeMiniMapProps {
    cafe: Cafe
}

export default function CafeMiniMap({ cafe }: CafeMiniMapProps) {
    const [mapKey, setMapKey] = useState(`map-${cafe.id}-${Date.now()}`)
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
        // Generate new key on mount to ensure fresh map instance
        setMapKey(`map-${cafe.id}-${Date.now()}`)
    }, [cafe.id])

    if (!isMounted) {
        return (
            <div className='w-full h-full min-h-[180px] flex items-center justify-center bg-secondary/20 rounded-xl'>
                <p className='text-text/50 font-serif text-sm'>
                    Loading map...
                </p>
            </div>
        )
    }

    const customIcon = new Icon({
        iconUrl: "/marker-icon.png",
        iconRetinaUrl: "/marker-icon-2x.png",
        shadowUrl: "/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
    })

    return (
        <MapContainer
            key={mapKey}
            center={[cafe.lat, cafe.lng]}
            zoom={16}
            scrollWheelZoom={false}
            dragging={false}
            zoomControl={false}
            className='h-full w-full z-0 rounded-xl'
            style={{ minHeight: "180px" }}
        >
            <TileLayer
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                url='https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
            />
            <Marker
                position={[cafe.lat, cafe.lng]}
                icon={customIcon}
            >
                <Popup>{cafe.name}</Popup>
            </Marker>
        </MapContainer>
    )
}
