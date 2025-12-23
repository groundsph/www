"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { MapPin, Search, Crosshair } from "lucide-react"
import {
    MapContainer,
    TileLayer,
    Marker,
    useMapEvents,
    useMap,
} from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// Fix Leaflet default marker icon issue with Next.js
const markerIcon = new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
})

interface LocationPickerProps {
    lat: number | null
    lng: number | null
    onChange: (lat: number, lng: number) => void
    onAddressChange?: (address: string) => void
}

// Component to handle map clicks
function ClickHandler({
    onClick,
}: {
    onClick: (lat: number, lng: number) => void
}) {
    useMapEvents({
        click: (e) => {
            onClick(e.latlng.lat, e.latlng.lng)
        },
    })
    return null
}

// Component to recenter map when coordinates change
function MapController({
    lat,
    lng,
}: {
    lat: number | null
    lng: number | null
}) {
    const map = useMap()

    useEffect(() => {
        if (lat && lng) {
            map.setView([lat, lng], 16)
        }
    }, [lat, lng, map])

    return null
}

function LocationPickerInner({
    lat,
    lng,
    onChange,
    onAddressChange,
}: LocationPickerProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [isSearching, setIsSearching] = useState(false)
    const [manualLat, setManualLat] = useState(lat?.toString() || "")
    const [manualLng, setManualLng] = useState(lng?.toString() || "")

    // Default center (Philippines)
    const defaultCenter: [number, number] = [12.8797, 121.774]
    const center: [number, number] = lat && lng ? [lat, lng] : defaultCenter
    const zoom = lat && lng ? 16 : 6

    // Update manual inputs when props change
    useEffect(() => {
        if (lat !== null) setManualLat(lat.toString())
        if (lng !== null) setManualLng(lng.toString())
    }, [lat, lng])

    const handleManualCoordinates = () => {
        const parsedLat = parseFloat(manualLat)
        const parsedLng = parseFloat(manualLng)

        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
            if (
                parsedLat >= -90 &&
                parsedLat <= 90 &&
                parsedLng >= -180 &&
                parsedLng <= 180
            ) {
                onChange(parsedLat, parsedLng)
            }
        }
    }

    const handleSearch = async () => {
        if (!searchQuery.trim()) return

        setIsSearching(true)
        try {
            // Use Nominatim for geocoding (free, no API key needed)
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=ph&limit=1`,
                { headers: { "User-Agent": "Grounds-CafeApp" } }
            )
            const results = await response.json()

            if (results.length > 0) {
                const { lat: newLat, lon: newLng, display_name } = results[0]
                onChange(parseFloat(newLat), parseFloat(newLng))
                if (onAddressChange && display_name) {
                    onAddressChange(display_name)
                }
            }
        } catch (error) {
            console.error("Geocoding error:", error)
        } finally {
            setIsSearching(false)
        }
    }

    const getCurrentLocation = () => {
        if (!navigator.geolocation) return

        navigator.geolocation.getCurrentPosition(
            (position) => {
                onChange(position.coords.latitude, position.coords.longitude)
            },
            (error) => {
                console.error("Geolocation error:", error)
            }
        )
    }

    const handleMapClick = useCallback(
        (clickLat: number, clickLng: number) => {
            onChange(clickLat, clickLng)
        },
        [onChange]
    )

    return (
        <div className='space-y-4'>
            {/* Search bar */}
            <div className='flex gap-2'>
                <div className='flex-1 relative'>
                    <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40' />
                    <input
                        type='text'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder='Search for a location...'
                        className='w-full pl-10 pr-4 py-2.5 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm'
                    />
                </div>
                <button
                    type='button'
                    onClick={handleSearch}
                    disabled={isSearching}
                    className='px-4 py-2 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer'
                >
                    {isSearching ? "..." : "Search"}
                </button>
                <button
                    type='button'
                    onClick={getCurrentLocation}
                    className='p-2.5 bg-text/10 hover:bg-text/20 rounded-xl transition-colors cursor-pointer'
                    title='Use my location'
                >
                    <Crosshair className='w-5 h-5 text-text/60' />
                </button>
            </div>

            {/* Interactive Map */}
            <div className='relative w-full aspect-video rounded-xl overflow-hidden border border-text/20'>
                <MapContainer
                    center={center}
                    zoom={zoom}
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom={true}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                    />
                    <ClickHandler onClick={handleMapClick} />
                    <MapController
                        lat={lat}
                        lng={lng}
                    />
                    {lat && lng && (
                        <Marker
                            position={[lat, lng]}
                            icon={markerIcon}
                        />
                    )}
                </MapContainer>

                {/* Hint overlay */}
                {!lat && !lng && (
                    <div className='absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20'>
                        <div className='bg-white/90 px-4 py-2 rounded-lg text-sm font-medium text-text/70 shadow-lg'>
                            Click on the map to set location
                        </div>
                    </div>
                )}
            </div>

            {/* Manual coordinates input */}
            <div className='flex items-center gap-3'>
                <div className='flex-1'>
                    <label className='text-xs font-medium text-text/60 mb-1 block'>
                        Latitude
                    </label>
                    <input
                        type='number'
                        step='any'
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        onBlur={handleManualCoordinates}
                        placeholder='e.g. 10.3157'
                        className='w-full px-3 py-2 border border-text/20 rounded-lg bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-sm'
                    />
                </div>
                <div className='flex-1'>
                    <label className='text-xs font-medium text-text/60 mb-1 block'>
                        Longitude
                    </label>
                    <input
                        type='number'
                        step='any'
                        value={manualLng}
                        onChange={(e) => setManualLng(e.target.value)}
                        onBlur={handleManualCoordinates}
                        placeholder='e.g. 123.8854'
                        className='w-full px-3 py-2 border border-text/20 rounded-lg bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-sm'
                    />
                </div>
            </div>

            {/* Coordinates display */}
            {lat && lng && (
                <div className='flex items-center gap-2 text-sm text-text/60'>
                    <MapPin className='w-4 h-4' />
                    <span>
                        Selected: {lat.toFixed(6)}, {lng.toFixed(6)}
                    </span>
                </div>
            )}
        </div>
    )
}

// Dynamic import to avoid SSR issues with Leaflet
import dynamic from "next/dynamic"

const LocationPickerWithNoSSR = dynamic(
    () => Promise.resolve(LocationPickerInner),
    {
        ssr: false,
        loading: () => (
            <div className='w-full aspect-video rounded-xl bg-text/5 border border-text/20 flex items-center justify-center'>
                <div className='text-text/40 text-sm'>Loading map...</div>
            </div>
        ),
    }
)

export default function LocationPicker(props: LocationPickerProps) {
    return <LocationPickerWithNoSSR {...props} />
}
