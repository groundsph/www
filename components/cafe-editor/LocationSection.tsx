"use client"

/**
 * LocationSection - Shared component for cafe location editing.
 * Used by CafeEditor (admin) and CafeEditClient (owner).
 */

import { type ColorScheme, getColorClasses } from "@/utils/hooks/cafe-form"
import LocationPicker from "@/components/submit/LocationPicker"

export interface LocationData {
    region: string | null
    province: string | null
    city_municipality: string | null
    address_display: string
    area: string | null
    lat: number | null
    lng: number | null
}

interface LocationSectionProps {
    /** Current location data */
    data: LocationData
    /** Update a single field */
    onChange: <K extends keyof LocationData>(
        key: K,
        value: LocationData[K]
    ) => void
    /** Whether region/province/city are read-only (owner mode) */
    readOnlyLocation?: boolean
    /** Color scheme for theming */
    colorScheme?: ColorScheme
}

/**
 * Location section for cafe editing.
 * Includes region, province, city, address display, area, and map picker.
 */
export default function LocationSection({
    data,
    onChange,
    readOnlyLocation = true,
    colorScheme = "primary",
}: LocationSectionProps) {
    const colors = getColorClasses(colorScheme)

    return (
        <div className='space-y-6'>
            {/* Region/Province/City Grid */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <div>
                    <label className='block text-sm font-medium text-text/60 mb-2'>
                        Region
                    </label>
                    <input
                        type='text'
                        value={data.region || ""}
                        readOnly={readOnlyLocation}
                        onChange={
                            readOnlyLocation
                                ? undefined
                                : (e) => onChange("region", e.target.value)
                        }
                        className={`w-full px-4 py-3 border border-text/10 rounded-lg ${
                            readOnlyLocation
                                ? "bg-text/5 text-text/60"
                                : `bg-background focus:outline-none focus:ring-2 ${colors.focusRing}`
                        }`}
                    />
                </div>
                <div>
                    <label className='block text-sm font-medium text-text/60 mb-2'>
                        Province
                    </label>
                    <input
                        type='text'
                        value={data.province || ""}
                        readOnly={readOnlyLocation}
                        onChange={
                            readOnlyLocation
                                ? undefined
                                : (e) => onChange("province", e.target.value)
                        }
                        className={`w-full px-4 py-3 border border-text/10 rounded-lg ${
                            readOnlyLocation
                                ? "bg-text/5 text-text/60"
                                : `bg-background focus:outline-none focus:ring-2 ${colors.focusRing}`
                        }`}
                    />
                </div>
                <div>
                    <label className='block text-sm font-medium text-text/60 mb-2'>
                        City/Municipality
                    </label>
                    <input
                        type='text'
                        value={data.city_municipality || ""}
                        readOnly={readOnlyLocation}
                        onChange={
                            readOnlyLocation
                                ? undefined
                                : (e) =>
                                      onChange(
                                          "city_municipality",
                                          e.target.value
                                      )
                        }
                        className={`w-full px-4 py-3 border border-text/10 rounded-lg ${
                            readOnlyLocation
                                ? "bg-text/5 text-text/60"
                                : `bg-background focus:outline-none focus:ring-2 ${colors.focusRing}`
                        }`}
                    />
                </div>
            </div>

            {/* Display Address */}
            <div>
                <label className='block text-sm font-medium text-text/60 mb-2'>
                    Display Address
                </label>
                <input
                    type='text'
                    value={data.address_display}
                    onChange={(e) =>
                        onChange("address_display", e.target.value)
                    }
                    className={`w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing}`}
                />
            </div>

            {/* Area/Neighborhood (optional) */}
            <div>
                <label className='block text-sm font-medium text-text/60 mb-2'>
                    Area/Neighborhood
                </label>
                <input
                    type='text'
                    value={data.area || ""}
                    onChange={(e) => onChange("area", e.target.value || null)}
                    placeholder='e.g., Poblacion, BGC, Salcedo Village'
                    className={`w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing}`}
                />
            </div>

            {/* Map Location */}
            <div>
                <label className='block text-sm font-medium text-text/60 mb-2'>
                    Map Location
                </label>
                <LocationPicker
                    lat={data.lat}
                    lng={data.lng}
                    onChange={(lat: number, lng: number) => {
                        onChange("lat", lat)
                        onChange("lng", lng)
                    }}
                />
            </div>
        </div>
    )
}
