"use client"

import { type ColorScheme, getColorClasses } from "@/utils/hooks/cafe-form"
import LocationPicker from "@/components/submit/LocationPicker"
import {
    PHILIPPINES_LOCATIONS,
    getProvincesForRegion,
    getCitiesForProvince,
} from "@/utils/data/philippines"

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
    data: LocationData
    onChange: <K extends keyof LocationData>(key: K, value: LocationData[K]) => void
    readOnlyLocation?: boolean
    colorScheme?: ColorScheme
}

export default function LocationSection({
    data,
    onChange,
    readOnlyLocation = true,
    colorScheme = "primary",
}: LocationSectionProps) {
    const colors = getColorClasses(colorScheme)

    const availableProvinces = data.region
        ? getProvincesForRegion(data.region)
        : []
    const availableCities =
        data.region && data.province
            ? getCitiesForProvince(data.region, data.province)
            : []

    return (
        <div className='space-y-6'>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                {readOnlyLocation ? (
                    <>
                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-2'>Region</label>
                            <input type='text' value={data.region || ""} readOnly
                                className='w-full px-4 py-3 border border-text/10 rounded-lg bg-text/5 text-text/60' />
                        </div>
                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-2'>Province</label>
                            <input type='text' value={data.province || ""} readOnly
                                className='w-full px-4 py-3 border border-text/10 rounded-lg bg-text/5 text-text/60' />
                        </div>
                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-2'>City/Municipality</label>
                            <input type='text' value={data.city_municipality || ""} readOnly
                                className='w-full px-4 py-3 border border-text/10 rounded-lg bg-text/5 text-text/60' />
                        </div>
                    </>
                ) : (
                    <>
                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-2'>
                                Region <span className='text-red-500'>*</span>
                            </label>
                            <select
                                value={data.region || ""}
                                onChange={(e) => {
                                    onChange("region", e.target.value || null)
                                    onChange("province", "")
                                    onChange("city_municipality", "")
                                }}
                                className={`w-full px-4 py-3 border border-text/10 rounded-lg
                                    bg-background focus:outline-none focus:ring-2 ${colors.focusRing}`}
                            >
                                <option value="">Select region</option>
                                {PHILIPPINES_LOCATIONS.regions.map((r) => (
                                    <option key={r.name} value={r.name}>{r.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-2'>
                                Province <span className='text-red-500'>*</span>
                            </label>
                            <select
                                value={data.province || ""}
                                onChange={(e) => {
                                    onChange("province", e.target.value || null)
                                    onChange("city_municipality", "")
                                }}
                                disabled={!data.region}
                                className={`w-full px-4 py-3 border border-text/10 rounded-lg
                                    bg-background focus:outline-none focus:ring-2 ${colors.focusRing}
                                    disabled:opacity-50`}
                            >
                                <option value="">Select province</option>
                                {availableProvinces.map((p) => (
                                    <option key={p.name} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-2'>
                                City/Municipality <span className='text-red-500'>*</span>
                            </label>
                            <select
                                value={data.city_municipality || ""}
                                onChange={(e) =>
                                    onChange("city_municipality", e.target.value || null)
                                }
                                disabled={!data.province}
                                className={`w-full px-4 py-3 border border-text/10 rounded-lg
                                    bg-background focus:outline-none focus:ring-2 ${colors.focusRing}
                                    disabled:opacity-50`}
                            >
                                <option value="">Select city</option>
                                {availableCities.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </>
                )}
            </div>

            <div>
                <label className='block text-sm font-medium text-text/60 mb-2'>
                    Display Address
                </label>
                <input type='text' value={data.address_display}
                    onChange={(e) => onChange("address_display", e.target.value)}
                    className={`w-full px-4 py-3 bg-background border border-text/10
                        rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing}`} />
            </div>

            <div>
                <label className='block text-sm font-medium text-text/60 mb-2'>
                    Area/Neighborhood
                </label>
                <input type='text' value={data.area || ""}
                    onChange={(e) => onChange("area", e.target.value || null)}
                    placeholder='e.g., Poblacion, BGC, Salcedo Village'
                    className={`w-full px-4 py-3 bg-background border border-text/10
                        rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing}`} />
            </div>

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
