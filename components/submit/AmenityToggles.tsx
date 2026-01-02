"use client"

import {
    WifiIcon,
    PlugIcon,
    CarIcon,
    SnowflakeIcon,
    PawPrintIcon,
    SunIcon,
    Utensils,
    Laptop,
    Armchair,
    Toilet,
    Droplet,
    MilkOff,
    Coffee,
    Cigarette,
} from "lucide-react"
import { cn } from "@/utils/cn"

interface AmenityOption {
    key: string
    label: string
    icon: React.ElementType
}

const AMENITY_OPTIONS: AmenityOption[] = [
    { key: "has_wifi", label: "WiFi", icon: WifiIcon },
    { key: "has_smoking", label: "Smoking Area", icon: Cigarette },
    { key: "has_sockets", label: "Power Outlets", icon: PlugIcon },
    { key: "has_parking", label: "Parking", icon: CarIcon },
    { key: "has_aircon", label: "Air Conditioning", icon: SnowflakeIcon },
    { key: "is_pet_friendly", label: "Pet Friendly", icon: PawPrintIcon },
    { key: "has_outdoor_seating", label: "Outdoor Seating", icon: SunIcon },
    { key: "has_indoor_seating", label: "Indoor Seating", icon: Armchair },
    { key: "has_restroom", label: "Restroom", icon: Toilet },
    { key: "has_bidet", label: "Bidet", icon: Droplet },
    { key: "has_non_dairy", label: "Non-Dairy Milk", icon: MilkOff },
    { key: "has_decaf", label: "Decaf Options", icon: Coffee },
    { key: "serves_food", label: "Serves Food", icon: Utensils },
    { key: "is_work_friendly", label: "Work Friendly", icon: Laptop },
]

interface AmenityTogglesProps {
    values: Record<string, boolean>
    onChange: (key: string, value: boolean) => void
}

export default function AmenityToggles({
    values,
    onChange,
}: AmenityTogglesProps) {
    return (
        <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
            {AMENITY_OPTIONS.map((amenity) => {
                const Icon = amenity.icon
                const isActive = values[amenity.key] || false

                return (
                    <button
                        key={amenity.key}
                        type='button'
                        onClick={() => onChange(amenity.key, !isActive)}
                        className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer",
                            isActive
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-text/10 bg-text/5 text-text/60 hover:border-text/30 hover:bg-text/10"
                        )}
                    >
                        <Icon className='w-6 h-6' />
                        <span className='text-sm font-medium text-center leading-tight'>
                            {amenity.label}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}
