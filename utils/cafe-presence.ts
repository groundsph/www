/**
 * Deciding whether to interrupt a visitor with "Are you at <cafe>?".
 *
 * The logic lives here — pure and unit-testable — rather than in the hook that
 * owns the browser APIs. See `hooks/useCafePresence.ts` for the wiring.
 *
 * Design rule: we never assert someone is at a cafe. Every threshold below
 * exists to answer "would a reasonable person say the visitor is in this
 * cafe?" and any doubt resolves to "don't prompt".
 */

import { haversineDistance } from "@/utils/geo"

// ============================================================================
// Thresholds
// ============================================================================

/** How far from the cafe we still consider a visit plausible. Tighter than the 150m check-in radius. */
export const PRESENCE_RADIUS_METERS = 100
/** A fix with worse accuracy than this cannot tell adjacent cafes apart. */
export const MAX_ACCURACY_METERS = 60
/** Minimum continuous presence before we offer the prompt. */
export const DWELL_MS = 90_000
/** Two corroborating fixes must agree within this distance. */
export const SAMPLE_AGREEMENT_METERS = 50
/** Walking pace. Anything faster means "passing through", not "sitting in". */
export const MAX_SPEED_METERS_PER_SECOND = 1.4
/**
 * Net displacement across a presence session. Someone parked in a cafe barely
 * moves; someone strolling past racks up far more than this in 90 seconds.
 */
export const MAX_NET_DISPLACEMENT_METERS = 50
/** Suppression window after the visitor says "Not here". */
export const DISMISSAL_TTL_MS = 7 * 24 * 60 * 60 * 1000

const PROMPTED_PREFIX = "grounds:checkin:prompted:"
const DISMISSED_PREFIX = "grounds:checkin:dismissed:"
const AUTO_OPENED_KEY = "grounds:checkin:auto-opened"

// ============================================================================
// Types
// ============================================================================

export interface PresenceSample {
    lat: number
    lng: number
    /** Reported accuracy in metres */
    accuracy: number
    /** Sample time in epoch milliseconds */
    timestamp: number
}

export interface PresenceSubject {
    cafeId: string
    cafeLat: number
    cafeLng: number
}

export type PresenceBlockedReason =
    | "no-samples"
    | "poor-accuracy"
    | "too-far"
    | "single-sample"
    | "moving"
    | "not-long-enough"
    | "already-prompted-today"
    | "dismissed"
    | "already-auto-opened"

export interface PresenceOptions {
    /** Restrict to real GPS fixes; never prompt on an IP-derived estimate. */
    source: "gps" | "ip" | "cache" | null
    isEstimate: boolean
    /** Only prompt while the page is visible. */
    visible: boolean
    /** Whether this page load already auto-opened the prompt. */
    autoOpenedThisLoad: boolean
    /** Epoch ms used for dwell math and the PH-day prompt window. */
    now: number
    /** Injectable for tests; defaults to `localStorage` in the browser. */
    storage?: StorageLike | null
}

export interface PresenceDecision {
    shouldPrompt: boolean
    reason: PresenceBlockedReason | null
    /** Metres from the cafe to the most recent fix. */
    distance: number | null
    /** Reported accuracy of the most recent fix. */
    accuracy: number | null
    /** Continuous presence at this cafe, from the first accepted fix. */
    dwellMs: number
    /** Number of accepted (accurate, on-site) samples. */
    sampleCount: number
}

export interface StorageLike {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
}

// ============================================================================
// Philippine-day helpers
// ============================================================================

const PH_OFFSET_MS = 8 * 60 * 60 * 1000

/** Start of the current Philippine day, in real epoch ms. Matches `getPHTodayStart()`. */
export function phDayStartEpoch(now: number): number {
    const ph = now + PH_OFFSET_MS
    const startOfDayPH = ph - (ph % (24 * 60 * 60 * 1000))
    return startOfDayPH - PH_OFFSET_MS
}

// ============================================================================
// Suppression ledger
// ============================================================================

const promptedKey = (cafeId: string) => `${PROMPTED_PREFIX}${cafeId}`
const dismissedKey = (cafeId: string) => `${DISMISSED_PREFIX}${cafeId}`

function readTimestamp(storage: StorageLike | null | undefined, key: string): number | null {
    if (!storage) return null
    try {
        const raw = storage.getItem(key)
        if (!raw) return null
        const parsed = Number.parseInt(raw, 10)
        return Number.isFinite(parsed) ? parsed : null
    } catch {
        return null
    }
}

function writeTimestamp(
    storage: StorageLike | null | undefined,
    key: string,
    value: number
): void {
    if (!storage) return
    try {
        storage.setItem(key, String(value))
    } catch {
        // Quota or private-mode failures must never break check-in.
    }
}

/** True when the visitor was already offered this cafe's prompt earlier today (PH time). */
export function hasPromptedToday(
    storage: StorageLike | null | undefined,
    cafeId: string,
    now: number
): boolean {
    const promptedAt = readTimestamp(storage, promptedKey(cafeId))
    if (promptedAt === null) return false
    return promptedAt >= phDayStartEpoch(now)
}

/** True when the visitor said "Not here" for this cafe within the dismissal window. */
export function isDismissed(
    storage: StorageLike | null | undefined,
    cafeId: string,
    now: number
): boolean {
    const dismissedAt = readTimestamp(storage, dismissedKey(cafeId))
    if (dismissedAt === null) return false
    return now - dismissedAt < DISMISSAL_TTL_MS
}

export function markPrompted(
    storage: StorageLike | null | undefined,
    cafeId: string,
    now: number
): void {
    writeTimestamp(storage, promptedKey(cafeId), now)
}

export function markDismissed(
    storage: StorageLike | null | undefined,
    cafeId: string,
    now: number
): void {
    writeTimestamp(storage, dismissedKey(cafeId), now)
}

/** Per page load, not per session: a reload is a fresh chance to be helpful. */
export function hasAutoOpenedThisLoad(
    storage: StorageLike | null | undefined
): boolean {
    if (!storage) return false
    try {
        return storage.getItem(AUTO_OPENED_KEY) === "1"
    } catch {
        return false
    }
}

export function markAutoOpenedThisLoad(
    storage: StorageLike | null | undefined
): void {
    if (!storage) return
    try {
        storage.setItem(AUTO_OPENED_KEY, "1")
    } catch {
        // ignore
    }
}

// ============================================================================
// Gate
// ============================================================================

function blocked(
    reason: PresenceBlockedReason,
    context: Partial<PresenceDecision>
): PresenceDecision {
    return {
        shouldPrompt: false,
        reason,
        distance: context.distance ?? null,
        accuracy: context.accuracy ?? null,
        dwellMs: context.dwellMs ?? 0,
        sampleCount: context.sampleCount ?? 0,
    }
}

/**
 * Choose the samples that belong to the current presence session.
 *
 * A session survives only while the visitor stays on-site. A sample that is
 * outside the presence radius means they left (or the fix was wild), so the
 * session restarts rather than accumulating implausible dwell time. A merely
 * imprecise fix is skipped instead of resetting, because accuracy naturally
 * jitters and one bad reading should not throw away two good minutes.
 */
export function currentSession(
    samples: readonly PresenceSample[],
    subject: PresenceSubject
): PresenceSample[] {
    const session: PresenceSample[] = []

    for (const sample of samples) {
        const distance = haversineDistance(
            sample.lat,
            sample.lng,
            subject.cafeLat,
            subject.cafeLng
        ) * 1000

        if (distance > PRESENCE_RADIUS_METERS) {
            session.length = 0
            continue
        }

        if (sample.accuracy > MAX_ACCURACY_METERS) {
            continue
        }

        session.push(sample)
    }

    return session
}

/**
 * Decide whether to prompt for this cafe right now.
 *
 * Ordering is deliberate: cheap disqualifiers first, then evidence quality
 * (samples, movement, dwell), then the suppression ledger. A visitor who has
 * already been offered the prompt today short-circuits before any geometry.
 */
export function evaluatePresence(
    samples: readonly PresenceSample[],
    subject: PresenceSubject,
    options: PresenceOptions
): PresenceDecision {
    const { source, isEstimate, visible, autoOpenedThisLoad, now } = options
    const storage = options.storage ?? null

    if (source !== "gps" || isEstimate) {
        return blocked("no-samples", {})
    }

    if (!visible) {
        return blocked("not-long-enough", {})
    }

    if (autoOpenedThisLoad || hasAutoOpenedThisLoad(storage)) {
        return blocked("already-auto-opened", {})
    }

    if (hasPromptedToday(storage, subject.cafeId, now)) {
        return blocked("already-prompted-today", {})
    }

    if (isDismissed(storage, subject.cafeId, now)) {
        return blocked("dismissed", {})
    }

    if (samples.length === 0) {
        return blocked("no-samples", {})
    }

    const latest = samples[samples.length - 1]
    const latestDistance =
        haversineDistance(latest.lat, latest.lng, subject.cafeLat, subject.cafeLng) * 1000

    if (latest.accuracy > MAX_ACCURACY_METERS) {
        return blocked("poor-accuracy", {
            distance: latestDistance,
            accuracy: latest.accuracy,
        })
    }

    if (latestDistance > PRESENCE_RADIUS_METERS) {
        return blocked("too-far", { distance: latestDistance, accuracy: latest.accuracy })
    }

    const session = currentSession(samples, subject)

    if (session.length < 2) {
        return blocked("single-sample", {
            distance: latestDistance,
            accuracy: latest.accuracy,
            sampleCount: session.length,
        })
    }

    // Corroboration: the two most recent accepted fixes must agree.
    const previous = session[session.length - 2]
    const current = session[session.length - 1]
    const first = session[0]
    const spread =
        haversineDistance(previous.lat, previous.lng, current.lat, current.lng) * 1000

    const dwellMs = Math.max(0, current.timestamp - first.timestamp)

    // Walking past a cafe keeps you inside the radius for the whole crossing, so
    // dwell alone is not enough. A stationary visitor stays put; the net
    // displacement across the session is what separates "sitting" from "passing".
    // Checked before sample agreement so a walk-by is reported as movement
    // rather than as noisy readings.
    const netDisplacement =
        haversineDistance(first.lat, first.lng, current.lat, current.lng) * 1000

    if (netDisplacement > MAX_NET_DISPLACEMENT_METERS) {
        return blocked("moving", {
            distance: latestDistance,
            accuracy: latest.accuracy,
            dwellMs,
            sampleCount: session.length,
        })
    }

    if (spread > SAMPLE_AGREEMENT_METERS) {
        return blocked("single-sample", {
            distance: latestDistance,
            accuracy: latest.accuracy,
            dwellMs,
            sampleCount: session.length,
        })
    }

    const elapsedMs = Math.max(0, current.timestamp - previous.timestamp)
    if (elapsedMs > 0) {
        const speed = spread / (elapsedMs / 1000)
        if (speed > MAX_SPEED_METERS_PER_SECOND) {
            return blocked("moving", {
                distance: latestDistance,
                accuracy: latest.accuracy,
                dwellMs,
                sampleCount: session.length,
            })
        }
    }

    if (dwellMs < DWELL_MS) {
        return blocked("not-long-enough", {
            distance: latestDistance,
            accuracy: latest.accuracy,
            dwellMs,
            sampleCount: session.length,
        })
    }

    return {
        shouldPrompt: true,
        reason: null,
        distance: latestDistance,
        accuracy: latest.accuracy,
        dwellMs,
        sampleCount: session.length,
    }
}

/**
 * Rough walking time, for copy like "2 min walk". Assumes 80 m/min, which is a
 * slow stroll — better to over-estimate than to make someone late.
 */
export function walkMinutes(distanceMeters: number): number {
    return Math.max(1, Math.round(distanceMeters / 80))
}
