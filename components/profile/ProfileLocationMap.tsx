"use client"

import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet"
import { DivIcon } from "leaflet"
import "leaflet/dist/leaflet.css"
import "@/app/map.css"
import { useEffect, useState } from "react"
import {
    CARTO_ATTRIBUTION,
    CARTO_LIGHT_NOLABELS_TILE_URL,
} from "@/utils/map/tiles"

function LocationMarker() {
    const [position, setPosition] = useState<[number, number] | null>(null)
    const map = useMap()

    useEffect(() => {
        map.locate({ setView: true, maxZoom: 14 })
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

export default function ProfileLocationMap() {
    return (
        <div className="rounded-2xl overflow-hidden border border-secondary/20">
            <MapContainer center={[12.8797, 121.774]} zoom={6} scrollWheelZoom className="h-[240px] w-full">
                <TileLayer
                    attribution={CARTO_ATTRIBUTION}
                    url={CARTO_LIGHT_NOLABELS_TILE_URL}
                />
                <LocationMarker />
            </MapContainer>
        </div>
    )
}
