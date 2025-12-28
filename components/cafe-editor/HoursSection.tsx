import { OperatingHour } from "@/utils/types/cafe"
import OperatingHoursEditor from "@/components/submit/OperatingHoursEditor"

interface HoursSectionProps {
    hours: OperatingHour[]
    onChange: (hours: OperatingHour[]) => void
    colorScheme?: "primary" | "accent"
}

export default function HoursSection({
    hours,
    onChange,
    colorScheme = "primary",
}: HoursSectionProps) {
    return (
        <div>
            <label className='block text-sm font-medium text-text/60 mb-4'>
                Operating Hours
            </label>
            <OperatingHoursEditor
                value={hours}
                onChange={onChange}
            />
        </div>
    )
}
