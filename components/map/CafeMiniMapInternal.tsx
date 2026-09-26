"use client"

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import { Icon } from "leaflet"
import "leaflet/dist/leaflet.css"
import { CARTO_ATTRIBUTION, CARTO_LIGHT_TILE_URL } from "@/utils/map/tiles"

interface CafeMiniMapInternalProps {
    cafe: {
        id: string
        name: string
        lat: number
        lng: number
    }
}

export default function CafeMiniMapInternal({
    cafe,
}: CafeMiniMapInternalProps) {
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
            key={`map-${cafe.id}`}
            center={[cafe.lat, cafe.lng]}
            zoom={16}
            scrollWheelZoom={false}
            dragging={false}
            zoomControl={false}
            className='h-full w-full z-0 rounded-xl'
            style={{ minHeight: "180px" }}
        >
            <TileLayer
                attribution={CARTO_ATTRIBUTION}
                url={CARTO_LIGHT_TILE_URL}
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
