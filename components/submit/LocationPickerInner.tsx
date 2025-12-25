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

interface LocationPickerInnerProps {
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

// Component to track map bounds for search biasing
function MapBoundsLogger({
    onBoundsChange,
}: {
    onBoundsChange: (bounds: string) => void
}) {
    const map = useMap()
    const updateBounds = useCallback(() => {
        const b = map.getBounds()
        // Nominatim expects: <x1>,<y1>,<x2>,<y2> (left, top, right, bottom)
        // lon1, lat1, lon2, lat2
        onBoundsChange(
            `${b.getWest()},${b.getNorth()},${b.getEast()},${b.getSouth()}`
        )
    }, [map, onBoundsChange])

    useMapEvents({
        moveend: updateBounds,
        zoomend: updateBounds,
    })

    useEffect(() => {
        updateBounds()
    }, [updateBounds])

    return null
}

export default function LocationPickerInner({
    lat,
    lng,
    onChange,
    onAddressChange,
}: LocationPickerInnerProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [isSearching, setIsSearching] = useState(false)
    const [manualLat, setManualLat] = useState(lat?.toString() || "")
    const [manualLng, setManualLng] = useState(lng?.toString() || "")
    // Search bias viewbox: minLon, maxLat, maxLon, minLat
    const [viewbox, setViewbox] = useState("")

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
            // First attempt: Strict search within current viewbox
            let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
                searchQuery
            )}&countrycodes=ph&limit=1`

            if (viewbox) {
                // bounded=1 forces results to be within the viewbox
                const strictUrl = `${url}&viewbox=${viewbox}&bounded=1`
                console.log(
                    "[LocationPicker] attempting strict search:",
                    strictUrl
                )

                const response = await fetch(strictUrl, {
                    headers: { "User-Agent": "Grounds-CafeApp" },
                })
                const results = await response.json()

                if (results.length > 0) {
                    const {
                        lat: newLat,
                        lon: newLng,
                        display_name,
                    } = results[0]
                    onChange(parseFloat(newLat), parseFloat(newLng))
                    if (onAddressChange && display_name) {
                        onAddressChange(display_name)
                    }
                    return // Found strict match!
                }
            }

            // Fallback: Global/Global-ish search (bounded=0)
            if (viewbox) {
                url += `&viewbox=${viewbox}&bounded=0`
            }
            console.log("[LocationPicker] attempting fallback search:", url)

            const response = await fetch(url, {
                headers: { "User-Agent": "Grounds-CafeApp" },
            })
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

    const [showTools, setShowTools] = useState(false)

    return (
        <div className='space-y-4'>
            {/* Selected location indicator - shown at top when location is set */}
            {lat && lng && (
                <div className='flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700'>
                    <MapPin className='w-4 h-4 shrink-0' />
                    <span className='font-medium'>
                        Location set: {lat.toFixed(6)}, {lng.toFixed(6)}
                    </span>
                </div>
            )}

            {/* Interactive Map - Primary focus */}
            <div className='relative w-full aspect-video rounded-xl overflow-hidden border-2 border-text/20'>
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
                    <MapBoundsLogger onBoundsChange={setViewbox} />
                    {lat && lng && (
                        <Marker
                            position={[lat, lng]}
                            icon={markerIcon}
                        />
                    )}
                </MapContainer>

                {/* Hint overlay - more prominent */}
                {!lat && !lng && (
                    <div className='absolute inset-0 flex items-center justify-center pointer-events-none bg-black/30'>
                        <div className='bg-white px-5 py-3 rounded-xl text-center shadow-lg'>
                            <MapPin className='w-6 h-6 text-primary mx-auto mb-1' />
                            <p className='font-semibold text-text'>
                                Click on the map
                            </p>
                            <p className='text-xs text-text/60'>
                                to set the cafe location
                            </p>
                        </div>
                    </div>
                )}

                {/* Use my location button - floating on map */}
                <button
                    type='button'
                    onClick={getCurrentLocation}
                    className='absolute top-3 right-3 z-1000 p-2.5 bg-white hover:bg-gray-50 rounded-xl shadow-md transition-colors cursor-pointer border border-text/10'
                    title='Use my current location'
                >
                    <Crosshair className='w-5 h-5 text-primary' />
                </button>
            </div>

            {/* Helper text */}
            <p className='text-xs text-text/50 text-center'>
                Click anywhere on the map to place the marker, or use the
                location tools below
            </p>

            {/* Collapsible Location Tools */}
            <div className='border border-text/15 rounded-xl overflow-hidden'>
                <button
                    type='button'
                    onClick={() => setShowTools(!showTools)}
                    className='w-full flex items-center justify-between px-4 py-3 bg-text/5 hover:bg-text/10 transition-colors cursor-pointer'
                >
                    <span className='text-sm font-medium text-text/70 flex items-center gap-2'>
                        <Search className='w-4 h-4' />
                        Location Tools
                        <span className='text-xs text-text/40 font-normal'>
                            (optional)
                        </span>
                    </span>
                    <svg
                        className={`w-4 h-4 text-text/40 transition-transform ${showTools ? "rotate-180" : ""}`}
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                    >
                        <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M19 9l-7 7-7-7'
                        />
                    </svg>
                </button>

                {showTools && (
                    <div className='p-4 space-y-4 border-t border-text/10'>
                        {/* Search bar */}
                        <div>
                            <label className='text-xs font-medium text-text/60 mb-2 block'>
                                Search by name or address
                            </label>
                            <div className='flex gap-2'>
                                <div className='flex-1 relative'>
                                    <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40' />
                                    <input
                                        type='text'
                                        value={searchQuery}
                                        onChange={(e) =>
                                            setSearchQuery(e.target.value)
                                        }
                                        onKeyDown={(e) =>
                                            e.key === "Enter" && handleSearch()
                                        }
                                        placeholder='e.g. Starbucks IT Park Cebu (may be incorrect)'
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
                            </div>
                        </div>

                        {/* Divider */}
                        <div className='flex items-center gap-3'>
                            <div className='flex-1 h-px bg-text/10' />
                            <span className='text-xs text-text/40'>
                                or enter coordinates
                            </span>
                            <div className='flex-1 h-px bg-text/10' />
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
                                    onChange={(e) =>
                                        setManualLat(e.target.value)
                                    }
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
                                    onChange={(e) =>
                                        setManualLng(e.target.value)
                                    }
                                    onBlur={handleManualCoordinates}
                                    placeholder='e.g. 123.8854'
                                    className='w-full px-3 py-2 border border-text/20 rounded-lg bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-sm'
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
