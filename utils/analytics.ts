"use client"

import { createLocalClient } from "@/utils/supabase/client"

// Rate limit tracking: store last view time per cafe
const viewedCafes = new Map<string, number>()
const RATE_LIMIT_MS = 60 * 60 * 1000 // 1 hour

/**
 * Generate anonymous visitor ID from browser fingerprint
 * This is a simple hash that doesn't use cookies or personal data
 */
function generateVisitorId(): string {
    const data = [
        navigator.userAgent,
        navigator.language,
        screen.width,
        screen.height,
        new Date().getTimezoneOffset(),
    ].join("|")

    // Simple hash function
    let hash = 0
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString(36)
}

/**
 * Detect device type from user agent
 */
function getDeviceType(): "mobile" | "tablet" | "desktop" {
    const ua = navigator.userAgent.toLowerCase()
    if (/mobile|android|iphone|ipod/.test(ua)) return "mobile"
    if (/tablet|ipad/.test(ua)) return "tablet"
    return "desktop"
}

/**
 * Track a page view for a cafe
 * Rate-limited to 1 view per cafe per hour per visitor
 */
export async function trackCafePageView(cafeId: string): Promise<void> {
    if (typeof window === "undefined") return

    // Check rate limit
    const lastView = viewedCafes.get(cafeId)
    const now = Date.now()
    if (lastView && now - lastView < RATE_LIMIT_MS) {
        return // Already tracked within the hour
    }

    try {
        const supabase = createLocalClient()

        await supabase.from("cafe_page_views").insert({
            cafe_id: cafeId,
            visitor_id: generateVisitorId(),
            device_type: getDeviceType(),
            referrer: document.referrer || null,
        })

        // Update rate limit tracker
        viewedCafes.set(cafeId, now)
    } catch (error) {
        // Silently fail - analytics shouldn't break the page
        console.error("Failed to track page view:", error)
    }
}
