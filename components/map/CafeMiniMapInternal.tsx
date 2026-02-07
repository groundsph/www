"use client"

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import { Icon } from "leaflet"
import "leaflet/dist/leaflet.css"

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
