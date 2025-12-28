import { OperatingHours, OperatingHour } from "./types/cafe";
import { Database } from "./types/database.types";

export function getPriceLevel(priceLevel: Database["public"]["Enums"]["price_level"]) {
    switch (priceLevel) {
        case "low":
            return "₱";
        case "medium":
            return "₱ ₱";
        case "high":
            return "₱ ₱ ₱";
    }
}

export function formatTimeTo12Hour(time24?: string): string {
    if (!time24) return '';

    const parts = time24.split(':');
    if (parts.length !== 2) {
        return ''; // Invalid format
    }

    const [hoursStr, minutesStr] = parts;
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return ''; // Invalid time values
    }

    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Check if a cafe is currently open based on operating hours
 */
export function isOpenNow(operatingHours?: OperatingHours | null): { isOpen: boolean; closesAt?: string; opensAt?: string } {
    if (!operatingHours || operatingHours.length === 0) {
        return { isOpen: false };
    }

    const now = new Date();
    const days: Array<OperatingHour['day']> = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const currentDay = days[now.getDay()];
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const todayHours = operatingHours.find(h => h.day === currentDay);

    if (!todayHours || todayHours.is_closed) {
        // Find next opening day
        const todayIndex = days.indexOf(currentDay);
        for (let i = 1; i <= 7; i++) {
            const nextDayIndex = (todayIndex + i) % 7;
            const nextDay = days[nextDayIndex];
            const nextHours = operatingHours.find(h => h.day === nextDay && !h.is_closed);
            if (nextHours) {
                if (nextHours.is_24_hours) {
                    return { isOpen: false, opensAt: `${nextDay.charAt(0).toUpperCase() + nextDay.slice(1)} 12:00 AM` };
                }
                return { isOpen: false, opensAt: `${nextDay.charAt(0).toUpperCase() + nextDay.slice(1)} ${formatTimeTo12Hour(nextHours.open)}` };
            }
        }
        return { isOpen: false };
    }

    // If it's a 24-hour day, always open
    if (todayHours.is_24_hours) {
        return { isOpen: true, closesAt: undefined };
    }

    // Handle overnight hours (e.g., 10:00 AM - 1:00 AM where close < open)
    const isOvernightHours = todayHours.close < todayHours.open;

    let isOpen: boolean;
    if (isOvernightHours) {
        // For overnight hours: open if current time is after opening OR before closing
        isOpen = currentTime >= todayHours.open || currentTime < todayHours.close;
    } else {
        // Normal hours: open if current time is between open and close
        isOpen = currentTime >= todayHours.open && currentTime < todayHours.close;
    }

    if (isOpen) {
        return { isOpen: true, closesAt: formatTimeTo12Hour(todayHours.close) };
    } else if (!isOvernightHours && currentTime < todayHours.open) {
        return { isOpen: false, opensAt: formatTimeTo12Hour(todayHours.open) };
    } else if (isOvernightHours && currentTime >= todayHours.close && currentTime < todayHours.open) {
        // For overnight: we're in the closed window between close and next open
        return { isOpen: false, opensAt: formatTimeTo12Hour(todayHours.open) };
    } else {
        // Already closed today, find next opening
        const todayIndex = days.indexOf(currentDay);
        for (let i = 1; i <= 7; i++) {
            const nextDayIndex = (todayIndex + i) % 7;
            const nextDay = days[nextDayIndex];
            const nextHours = operatingHours.find(h => h.day === nextDay && !h.is_closed);
            if (nextHours) {
                return { isOpen: false, opensAt: `${nextDay.charAt(0).toUpperCase() + nextDay.slice(1)} ${formatTimeTo12Hour(nextHours.open)}` };
            }
        }
        return { isOpen: false };
    }
}

/**
 * Placeholder URL constant for cafes without uploaded thumbnails
 */
export const CAFE_PLACEHOLDER_URL = "https://uriwhfpoprbrcehboadj.supabase.co/storage/v1/object/public/cafes/placeholder.jpg";

/**
 * Resolve cafe thumbnail - returns actual URL or placeholder image URL
 * When thumbnail === "placeholder", returns the actual placeholder image URL
 */
export function getCafeThumbnailUrl(thumbnail: string): string {
    if (thumbnail === "placeholder") {
        return CAFE_PLACEHOLDER_URL;
    }
    return thumbnail;
}