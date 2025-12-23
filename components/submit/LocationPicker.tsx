"use client"

import dynamic from "next/dynamic"

interface LocationPickerProps {
    lat: number | null
    lng: number | null
    onChange: (lat: number, lng: number) => void
    onAddressChange?: (address: string) => void
}

// Dynamic import to avoid SSR issues with Leaflet
const LocationPickerInner = dynamic(() => import("./LocationPickerInner"), {
    ssr: false,
    loading: () => (
        <div className='w-full aspect-video rounded-xl bg-text/5 border border-text/20 flex items-center justify-center'>
            <div className='text-text/40 text-sm'>Loading map...</div>
        </div>
    ),
})

export default function LocationPicker(props: LocationPickerProps) {
    return <LocationPickerInner {...props} />
}
